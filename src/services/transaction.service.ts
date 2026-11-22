import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";
import stripe from "../config/stripe.js";

type StripeInvoice = any;

const getCustomerId = (customer: any): string | null => {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
};

const getPaymentIntentId = (invoice: StripeInvoice): string | null => {
  const paymentIntent = invoice?.payment_intent;
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
};

const getSubscriptionId = (invoice: StripeInvoice): string | null => {
  const subscription = invoice?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
};

const getTransactionType = (billingReason: string | undefined | null) => {
  if (billingReason === "subscription_create") return "SUBSCRIPTION_INITIAL";
  if (billingReason === "subscription_cycle") return "SUBSCRIPTION_RENEWAL";
  if (billingReason === "subscription_update") return "SUBSCRIPTION_UPDATE";
  return "SUBSCRIPTION_PAYMENT";
};

const resolveAuthoritativeInvoice = async (invoice: StripeInvoice) => {
  if (!invoice?.id) {
    return invoice;
  }

  try {
    return await stripe.invoices.retrieve(invoice.id);
  } catch (error) {
    console.error("Failed to retrieve authoritative invoice for transaction:", error);
    return invoice;
  }
};

const findVendorForInvoice = async (db: any, invoice: StripeInvoice) => {
  const users = db.collection("user");

  let userId: string | undefined;
  let customerId = getCustomerId(invoice.customer);
  const subscriptionId = getSubscriptionId(invoice);

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      userId = subscription?.metadata?.userId;
      customerId = getCustomerId(subscription?.customer) || customerId;
    } catch (error) {
      console.error("Failed to retrieve Stripe subscription for transaction:", error);
    }
  }

  if (userId && ObjectId.isValid(userId)) {
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (user) return { user, customerId, subscriptionId };
  }

  if (customerId) {
    const user = await users.findOne({ stripeCustomerId: customerId });
    if (user) return { user, customerId, subscriptionId };
  }

  if (subscriptionId) {
    const user = await users.findOne({ stripeSubscriptionId: subscriptionId });
    if (user) return { user, customerId, subscriptionId };
  }

  return null;
};

export const upsertTransactionFromInvoice = async (
  invoice: StripeInvoice,
  status: "PAID" | "FAILED",
  stripeEventId?: string
) => {
  const db = await connectDB();
  const transactions = db.collection("transactions");

  await transactions.createIndex(
    { stripeInvoiceId: 1 },
    { unique: true, sparse: true }
  );
  await transactions.createIndex({ vendorId: 1, transactionDate: -1 });
  await transactions.createIndex({ status: 1, transactionDate: -1 });

  if (!invoice?.id) {
    console.warn("Skipping transaction persistence because invoice ID is missing.");
    return null;
  }

  const vendorContext = await findVendorForInvoice(db, invoice);

  if (!vendorContext?.user) {
    console.warn("Skipping transaction persistence because vendor was not found.", {
      invoiceId: invoice.id,
      customerId: getCustomerId(invoice.customer),
    });
    return null;
  }

  const { user, customerId, subscriptionId } = vendorContext;

  const authoritativeInvoice = await resolveAuthoritativeInvoice(invoice);

  const effectiveStatus =
    status === "FAILED" && authoritativeInvoice?.status === "paid"
      ? "PAID"
      : status;

  const amount =
    effectiveStatus === "PAID"
      ? typeof authoritativeInvoice?.amount_paid === "number"
        ? authoritativeInvoice.amount_paid
        : typeof authoritativeInvoice?.amount_due === "number"
          ? authoritativeInvoice.amount_due
          : 0
      : typeof authoritativeInvoice?.amount_due === "number"
        ? authoritativeInvoice.amount_due
        : typeof authoritativeInvoice?.amount_paid === "number"
          ? authoritativeInvoice.amount_paid
          : 0;
  const currency =
    typeof authoritativeInvoice?.currency === "string"
      ? authoritativeInvoice.currency
      : typeof invoice.currency === "string"
        ? invoice.currency
        : "usd";
  const billingReason = authoritativeInvoice?.billing_reason ?? invoice.billing_reason ?? null;
  const transactionType = getTransactionType(billingReason);
  const paidAt =
    effectiveStatus === "PAID" &&
    typeof authoritativeInvoice?.status_transitions?.paid_at === "number"
      ? new Date(authoritativeInvoice.status_transitions.paid_at * 1000)
      : typeof authoritativeInvoice?.created === "number"
        ? new Date(authoritativeInvoice.created * 1000)
        : null;
  const transactionDate = paidAt ?? new Date();

  const customerEmail =
    typeof authoritativeInvoice?.customer_email === "string"
      ? authoritativeInvoice.customer_email
      : user.email;

  if (effectiveStatus === "FAILED") {
    const existing = await transactions.findOne(
      { stripeInvoiceId: invoice.id },
      { projection: { status: 1 } }
    );

    if (existing?.status === "PAID") {
      console.log("Skipped stale invoice.payment_failed because transaction is already PAID.", {
        invoiceId: invoice.id,
        stripeEventId,
      });
      return existing;
    }
  }

  const mutableFields = {
    vendorId: user._id.toString(),
    userId: user._id.toString(),
    customerEmail,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId:
      getPaymentIntentId(authoritativeInvoice) ?? getPaymentIntentId(invoice),
    amount,
    currency,
    status: effectiveStatus,
    transactionType,
    plan: "Premium",
    billingReason,
    paidAt,
    transactionDate,
    updatedAt: new Date(),
    ...(stripeEventId ? { stripeEventId } : {}),
  };

  const result = await transactions.updateOne(
    { stripeInvoiceId: invoice.id },
    {
      $set: mutableFields,
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return transactions.findOne({ stripeInvoiceId: invoice.id });
};

export interface AdminTransactionFilters {
  q?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const getAdminTransactions = async (filters: AdminTransactionFilters) => {
  const db = await connectDB();
  const transactions = db.collection("transactions");

  await transactions.createIndex(
    { stripeInvoiceId: 1 },
    { unique: true, sparse: true }
  );
  await transactions.createIndex({ transactionDate: -1 });

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.type) {
    query.transactionType = filters.type;
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (!Number.isNaN(from.getTime())) dateFilter.$gte = from;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      if (!Number.isNaN(to.getTime())) dateFilter.$lte = to;
    }
    if (Object.keys(dateFilter).length > 0) {
      query.transactionDate = dateFilter;
    }
  }

  if (filters.q) {
    const regex = {
      $regex: escapeRegex(filters.q),
      $options: "i",
    };

    query.$or = [
      { customerEmail: regex },
      { stripeInvoiceId: regex },
      { stripeSubscriptionId: regex },
      { stripePaymentIntentId: regex },
      { vendorId: regex },
      { transactionType: regex },
      { status: regex },
    ];
  }

  const total = await transactions.countDocuments(query);

  const items = await transactions
    .find(query)
    .sort({ transactionDate: -1, createdAt: -1 })
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit)
    .toArray();

  const vendorIds = [
    ...new Set(
      items
        .map((item) => item.vendorId)
        .filter((id): id is string => typeof id === "string" && ObjectId.isValid(id))
    ),
  ].map((id) => new ObjectId(id));

  const vendors = vendorIds.length
    ? await db
        .collection("user")
        .find(
          { _id: { $in: vendorIds } },
          { projection: { name: 1, email: 1 } }
        )
        .toArray()
    : [];

  const vendorMap = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor]));

  return {
    transactions: items.map((item: any) => ({
      id: item._id.toString(),
      vendorId: item.vendorId,
      vendorName: vendorMap.get(item.vendorId)?.name ?? null,
      customerEmail: item.customerEmail ?? null,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      transactionType: item.transactionType,
      plan: item.plan ?? null,
      billingReason: item.billingReason ?? null,
      stripeCustomerId: item.stripeCustomerId ?? null,
      stripeSubscriptionId: item.stripeSubscriptionId ?? null,
      stripeInvoiceId: item.stripeInvoiceId ?? null,
      stripePaymentIntentId: item.stripePaymentIntentId ?? null,
      transactionDate: item.transactionDate,
      paidAt: item.paidAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt ?? null,
    })),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const getAdminTransactionById = async (id: string) => {
  const db = await connectDB();
  const transactions = db.collection("transactions");

  if (!ObjectId.isValid(id)) {
    return null;
  }

  const item = await transactions.findOne({ _id: new ObjectId(id) });

  if (!item) {
    return null;
  }

  let vendorName: string | null = null;

  if (typeof item.vendorId === "string" && ObjectId.isValid(item.vendorId)) {
    const vendor = await db
      .collection("user")
      .findOne(
        { _id: new ObjectId(item.vendorId) },
        { projection: { name: 1 } }
      );
    vendorName = vendor?.name ?? null;
  }

  return {
    id: item._id.toString(),
    vendorId: item.vendorId,
    vendorName,
    customerEmail: item.customerEmail ?? null,
    amount: item.amount,
    currency: item.currency,
    status: item.status,
    transactionType: item.transactionType,
    plan: item.plan ?? null,
    billingReason: item.billingReason ?? null,
    stripeCustomerId: item.stripeCustomerId ?? null,
    stripeSubscriptionId: item.stripeSubscriptionId ?? null,
    stripeInvoiceId: item.stripeInvoiceId ?? null,
    stripePaymentIntentId: item.stripePaymentIntentId ?? null,
    transactionDate: item.transactionDate,
    paidAt: item.paidAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? null,
  };
};
