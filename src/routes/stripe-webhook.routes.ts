
import { Router } from "express";

import { stripeWebhookController } from "../controllers/stripe-webhook.controller.js";

const router = Router();

router.post(
  "/webhook",
  stripeWebhookController,
);

export default router;
