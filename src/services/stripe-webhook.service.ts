
import { ObjectId } from "mongodb";
import type Stripe from "stripe";

import connectDB from "../config/database.js";
import stripe from "../config/stripe.js";
import { upsertTransactionFromInvoice } from "./transaction.service.js";

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end: number;
};

const getCustomerId = (
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null,
): string | null => {
  if (!customer) return null;

  return typeof customer === "string"
    ? customer
    : customer.id;
};

const updateVendorPremium = async (
  userId: string | undefined,
  customerId: string | null,
  updateData: Record<string, unknown>,
) => {
  const db = await connectDB();
  const users = db.collection("user");

  const filter = userId && ObjectId.isValid(userId)
    ? { _id: new ObjectId(userId) }
    : customerId
      ? { stripeCustomerId: customerId }
      : null;

  if (!filter) {
    throw new Error("VENDOR_NOT_FOUND_FOR_PAYMENT");
  }

  const result = await users.updateOne(
    filter,
    {
      $set: {
        ...updateData,
        ...(customerId
          ? { stripeCustomerId: customerId }
          : {}),
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new Error("VENDOR_NOT_FOUND_FOR_PAYMENT");
  }

  console.log("Vendor premium updated:", {
    userId,
    customerId,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });
};

const updateVendorSubscription = async (
  userId: string | undefined,
  customerId: string | null,
  subscription: Stripe.Subscription,
) => {
  const active =
    subscription.status === "active" ||
    subscription.status === "trialing";

  let subscriptionStatus:
    | "ACTIVE"
    | "CANCELLED"
    | "PAST_DUE"
    | "FREE";

  if (active) {
    subscriptionStatus = "ACTIVE";
  } else if (subscription.status === "canceled") {
    subscriptionStatus = "CANCELLED";
  } else if (
    subscription.status === "incomplete_expired"
  ) {
    subscriptionStatus = "FREE";
  } else {
    subscriptionStatus = "PAST_DUE";
  }

  const subscriptionWithPeriod =
    subscription as SubscriptionWithPeriod;

  const updateData: Record<string, unknown> = {
    isPremium: active,
    subscriptionStatus,
    stripeSubscriptionId: subscription.id,
  };

  if (subscriptionWithPeriod.current_period_end) {
    updateData.premiumExpiresAt = new Date(
      subscriptionWithPeriod.current_period_end * 1000,
    );
  }

  await updateVendorPremium(
    userId,
    customerId,
    updateData,
  );
};

export const handleStripeWebhookEvent = async (
  event: Stripe.Event,
) => {
  console.log("Stripe webhook received:", event.type);

  switch (event.type) {
    // One-time payment Checkout
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = getCustomerId(session.customer);

      if (session.mode === "subscription") {
        if (!session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        await updateVendorSubscription(
          session.metadata?.userId,
          customerId,
          subscription,
        );

        break;
      }

      if (
        session.mode === "payment" &&
        session.payment_status === "paid"
      ) {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!paymentIntentId) {
          throw new Error("PAYMENT_INTENT_NOT_FOUND");
        }

        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== "succeeded") {
          throw new Error("PAYMENT_NOT_SUCCESSFUL");
        }

        await updateVendorPremium(
          session.metadata?.userId,
          customerId,
          {
            isPremium: true,
            subscriptionStatus: "ACTIVE",
            stripePaymentIntentId: paymentIntent.id,
            premiumActivatedAt: new Date(),
          },
        );
      }

      break;
    }

    // Successful subscription invoice payment
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;

      await upsertTransactionFromInvoice(
        invoice,
        "PAID",
        event.id
      );

      break;
    }

    // Subscription updated
    case "customer.subscription.updated": {
      const subscription =
        event.data.object as Stripe.Subscription;

      await updateVendorSubscription(
        subscription.metadata.userId,
        getCustomerId(subscription.customer),
        subscription,
      );

      break;
    }

    // Subscription deleted
    case "customer.subscription.deleted": {
      const subscription =
        event.data.object as Stripe.Subscription;

      await updateVendorSubscription(
        subscription.metadata.userId,
        getCustomerId(subscription.customer),
        subscription,
      );

      break;
    }

    // Failed recurring payment
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = getCustomerId(invoice.customer);

      if (customerId) {
        const db = await connectDB();

        await db.collection("user").updateOne(
          { stripeCustomerId: customerId },
          {
            $set: {
              isPremium: false,
              subscriptionStatus: "PAST_DUE",
            },
          },
        );
      }

      await upsertTransactionFromInvoice(
        invoice,
        "FAILED",
        event.id
      );

      break;
    }

    default:
      console.log("Unhandled Stripe event:", event.type);
      break;
  }
};
