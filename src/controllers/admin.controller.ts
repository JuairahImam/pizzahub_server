
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  promoteUserToVendor,
  getAllVendors,
  blockUser,
  unblockUser,
  getAdminMenuItems,
  getAdminMenuItemById,
  approveMenuItem,
  rejectMenuItem,
  deleteAdminMenuItem,
  type PromoteVendorReason,
  type AdminMenuFilters,
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

// ADMIN MENU MODERATION

export const getAdminMenuItemsController = async (
  req: Request,
  res: Response
) => {
  try {
    const status = req.query.status;
    const vendorId = req.query.vendorId;
    const category = req.query.category;
    const q = req.query.q;
    const pageValue = req.query.page ?? "1";
    const limitValue = req.query.limit ?? "20";

    const page = Number(pageValue);
    const limit = Number(limitValue);

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
        message: "Invalid approval status.",
      });
    }

    if (
      vendorId !== undefined &&
      (typeof vendorId !== "string" || !ObjectId.isValid(vendorId))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID.",
      });
    }

    if (category !== undefined && typeof category !== "string") {
      return res.status(400).json({
        success: false,
        message: "Category must be a string.",
      });
    }

    if (
      q !== undefined &&
      (typeof q !== "string" || q.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Search query must be 100 characters or fewer.",
      });
    }

    const filters: AdminMenuFilters = {
      status: typeof status === "string" ? status : undefined,
      vendorId: typeof vendorId === "string" ? vendorId : undefined,
      category: typeof category === "string" ? category.trim() : undefined,
      q: typeof q === "string" ? q.trim() : undefined,
      page,
      limit,
    };

    const result = await getAdminMenuItems(filters);

    return res.status(200).json({
      success: true,
      count: result.menuItems.length,
      menuItems: result.menuItems,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin menu items error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve menu items.",
    });
  }
};

export const getAdminMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    const menuItem = await getAdminMenuItemById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      menuItem,
    });
  } catch (error) {
    console.error("Get admin menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve menu item.",
    });
  }
};

export const approveMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = res.locals.user;
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    const result = await approveMenuItem(user.id, id);

    if (!result.success) {
      if (result.reason === "LIMIT_REACHED") {
        return res.status(403).json({
          success: false,
          message:
            "Free plan allows a maximum of 3 active menu items. Upgrade to Premium to approve more.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Menu item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu item approved successfully.",
      menuItem: result.menuItem,
    });
  } catch (error) {
    console.error("Approve menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve menu item.",
    });
  }
};

export const rejectMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = res.locals.user;
    const id = req.params.id;
    const rejectionReason = req.body?.rejectionReason;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    if (
      typeof rejectionReason !== "string" ||
      rejectionReason.trim().length === 0
    ) {
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

    const result = await rejectMenuItem(user.id, id, trimmedReason);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu item rejected successfully.",
      menuItem: result.menuItem,
    });
  } catch (error) {
    console.error("Reject menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject menu item.",
    });
  }
};


export const deleteAdminMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    const result = await deleteAdminMenuItem(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu item deleted successfully.",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete menu item.",
    });
  }
};
