
import type { Request, Response } from "express";
import type Stripe from "stripe";

import stripe from "../config/stripe.js";
import { handleStripeWebhookEvent } from "../services/stripe-webhook.service.js";

export const stripeWebhookController = async (
  req: Request,
  res: Response,
) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe signature or webhook secret.",
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error,
    );

    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature.",
    });
  }

  try {
    await handleStripeWebhookEvent(event);

    return res.status(200).json({
      success: true,
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};
