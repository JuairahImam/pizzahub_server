
import type { Request, Response } from "express";
import { createPremiumCheckoutSession } from "../services/stripe.service.js";

export const createPremiumCheckoutController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    const result = await createPremiumCheckoutSession({
      userId: user.id,
      name: user.name,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: "Premium checkout session created successfully.",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    if (message === "VENDOR_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    if (message === "USER_BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Blocked users cannot subscribe.",
      });
    }

    if (message === "ALREADY_PREMIUM") {
      return res.status(409).json({
        success: false,
        message: "You already have an active Premium subscription.",
      });
    }

    if (message === "INVALID_USER_ID") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    console.error("Premium checkout error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create Premium checkout session.",
    });
  }
};
