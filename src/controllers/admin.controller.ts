
import type { Request, Response } from "express";

import {
  promoteUserToVendor,
  getAllVendors,
  blockUser,
  unblockUser,
  type PromoteVendorReason,
} from "../services/admin.service.js";

export const promoteVendorController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid user email is required.",
      });
    }

    const result = await promoteUserToVendor(email.trim().toLowerCase());

    if (!result.success) {
      const errors: Record<
        PromoteVendorReason,
        { status: number; message: string }
      > = {
        NOT_FOUND: { status: 404, message: "User not found." },
        ADMIN_ACCOUNT: { status: 403, message: "Admin cannot be promoted." },
        ALREADY_VENDOR: { status: 409, message: "User is already a vendor." },
        INVALID_ROLE: { status: 400, message: "Only customers can be promoted." },
        BLOCKED_USER: { status: 403, message: "Blocked users cannot be promoted." },
      };

      const error = errors[result.reason];

      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer successfully promoted to vendor.",
    });
  } catch (error) {
    console.error("Vendor promotion error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to promote customer.",
    });
  }
};

export const getAllVendorsController = async (
  _req: Request,
  res: Response
) => {
  try {
    const vendors = await getAllVendors();

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    console.error("Get vendors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendors.",
    });
  }
};

export const blockUserController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid user email is required.",
      });
    }

    const result = await blockUser(
      email.trim().toLowerCase(),
      res.locals.user.id
    );

    if (!result.success) {
      const statusCode = result.reason === "NOT_FOUND" ? 404 : 403;

      return res.status(statusCode).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "User not found."
            : result.reason === "SELF_BLOCK"
              ? "You cannot block your own account."
              : "You cannot block another admin.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User blocked successfully.",
    });
  } catch (error) {
    console.error("Block user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to block user.",
    });
  }
};

export const unblockUserController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid user email is required.",
      });
    }

    const result = await unblockUser(email.trim().toLowerCase());

    if (!result.success) {
      return res.status(result.reason === "NOT_FOUND" ? 404 : 403).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "User not found."
            : "Admin account cannot be modified.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully.",
    });
  } catch (error) {
    console.error("Unblock user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unblock user.",
    });
  }
};
