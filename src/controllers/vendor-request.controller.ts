import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  approveVendorRequest,
  createVendorRequest,
  getVendorRequestById,
  getVendorRequestForUser,
  getVendorRequests,
  rejectVendorRequest,
  type AdminVendorRequestFilters,
  type CreateVendorRequestReason,
  type ReviewVendorRequestReason,
  type VendorRequestStatus,
} from "../services/vendor-request.service.js";

const createErrorMap: Record<
  CreateVendorRequestReason,
  { status: number; message: string }
> = {
  USER_NOT_FOUND: { status: 404, message: "User account not found." },
  INVALID_ROLE: {
    status: 409,
    message: "Only customers can request to become a vendor.",
  },
  BLOCKED_USER: {
    status: 403,
    message: "Your account has been blocked.",
  },
  PENDING_EXISTS: {
    status: 409,
    message: "You already have a pending vendor request.",
  },
};

const reviewErrorMap: Record<
  ReviewVendorRequestReason,
  { status: number; message: string }
> = {
  NOT_FOUND: { status: 404, message: "Vendor request not found." },
  ALREADY_REVIEWED: {
    status: 409,
    message: "This vendor request has already been reviewed.",
  },
  USER_NOT_FOUND: { status: 404, message: "Requesting user no longer exists." },
  INVALID_ROLE: {
    status: 409,
    message: "This account cannot be promoted to vendor.",
  },
  BLOCKED_USER: {
    status: 409,
    message: "Blocked users cannot be promoted to vendor.",
  },
};

export const createVendorRequestController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = res.locals.user;
    const restaurantName = req.body?.restaurantName;
    const message = req.body?.message ?? "";

    if (typeof restaurantName !== "string") {
      return res.status(400).json({
        success: false,
        message: "Restaurant name is required.",
      });
    }

    const trimmedName = restaurantName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Restaurant name must be between 2 and 120 characters.",
      });
    }

    if (typeof message !== "string" || message.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Message must be 500 characters or fewer.",
      });
    }

    const result = await createVendorRequest({
      userId: user.id,
      name: user.name,
      email: user.email,
      restaurantName: trimmedName,
      message: message.trim(),
    });

    if (!result.success) {
      const error = createErrorMap[result.reason];
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Vendor request submitted for review.",
      request: result.request,
    });
  } catch (error) {
    console.error("Create vendor request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit vendor request.",
    });
  }
};

export const getMyVendorRequestController = async (
  _req: Request,
  res: Response
) => {
  try {
    const request = await getVendorRequestForUser(res.locals.user.id);

    return res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    console.error("Get vendor request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load vendor request.",
    });
  }
};

export const getVendorRequestsController = async (
  req: Request,
  res: Response
) => {
  try {
    const status = req.query.status;
    const q = req.query.q;
    const page = Number(req.query.page ?? "1");
    const limit = Number(req.query.limit ?? "20");

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !["PENDING", "APPROVED", "REJECTED"].includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor request status.",
      });
    }

    if (q !== undefined && (typeof q !== "string" || q.trim().length > 100)) {
      return res.status(400).json({
        success: false,
        message: "Search query must be 100 characters or fewer.",
      });
    }

    const filters: AdminVendorRequestFilters = {
      status: typeof status === "string" ? status : undefined,
      q: typeof q === "string" ? q.trim() : undefined,
      page,
      limit,
    };

    const result = await getVendorRequests(filters);

    return res.status(200).json({
      success: true,
      count: result.requests.length,
      requests: result.requests,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get vendor requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor requests.",
    });
  }
};

export const getVendorRequestByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor request ID.",
      });
    }

    const request = await getVendorRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Vendor request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    console.error("Get vendor request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor request.",
    });
  }
};

export const approveVendorRequestController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor request ID.",
      });
    }

    const result = await approveVendorRequest(res.locals.user.id, id);

    if (!result.success) {
      const error = reviewErrorMap[result.reason];
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.roleUpdated
        ? "Vendor request approved. User can now access the vendor dashboard."
        : "Vendor request approved.",
      request: result.request,
    });
  } catch (error) {
    console.error("Approve vendor request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve vendor request.",
    });
  }
};

export const rejectVendorRequestController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;
    const rejectionReason = req.body?.rejectionReason;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor request ID.",
      });
    }

    if (typeof rejectionReason !== "string" || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
      });
    }

    const trimmedReason = rejectionReason.trim();

    if (trimmedReason.length < 3 || trimmedReason.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be between 3 and 300 characters.",
      });
    }

    const result = await rejectVendorRequest(
      res.locals.user.id,
      id,
      trimmedReason
    );

    if (!result.success) {
      const error = reviewErrorMap[result.reason];
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor request rejected.",
      request: result.request,
    });
  } catch (error) {
    console.error("Reject vendor request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject vendor request.",
    });
  }
};

// Re-exported for consumers that want to narrow the status type.
export type { VendorRequestStatus };
