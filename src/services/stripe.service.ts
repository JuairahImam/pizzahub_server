
import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";
import stripe from "../config/stripe.js";

interface CreateCheckoutInput {
  userId: string;
  name: string;
  email: string;
}

export const createPremiumCheckoutSession = async ({
  userId,
  name,
  email,
}: CreateCheckoutInput) => {
  if (!ObjectId.isValid(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  const clientUrl = process.env.CLIENT_URL;

  if (!priceId) {
    throw new Error("STRIPE_PREMIUM_PRICE_ID is not configured");
  }

  if (!clientUrl) {
    throw new Error("CLIENT_URL is not configured");
  }

  const db = await connectDB();
  const users = db.collection("user");

  const user = await users.findOne({
    _id: new ObjectId(userId),
    role: "vendor",
  });

  if (!user) {
    throw new Error("VENDOR_NOT_FOUND");
  }

  if (user.isBlocked === true) {
    throw new Error("USER_BLOCKED");
  }

  if (
    user.subscriptionStatus === "ACTIVE" &&
    user.isPremium === true
  ) {
    throw new Error("ALREADY_PREMIUM");
  }

  let stripeCustomerId = user.stripeCustomerId as
    | string
    | undefined;

  if (stripeCustomerId) {
    await stripe.customers.update(stripeCustomerId, {
      name,
      email,
    });
  } else {
    const customer = await stripe.customers.create({
      name,
      email,
      metadata: {
        userId,
      },
    });

    stripeCustomerId = customer.id;

    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          stripeCustomerId,
        },
      },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${clientUrl}/vendor/premium/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/vendor/premium/cancel`,
    client_reference_id: userId,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
};
