
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  getVendorOrders,
  acceptVendorOrder,
  rejectVendorOrder,
  updateVendorOrderStatus,
} from "../services/order.service.js";

const getOrderId = (req: Request): string | null => {
  const id = req.params.id;

  return typeof id === "string" && ObjectId.isValid(id)
    ? id
    : null;
};

// GET VENDOR'S ORDERS
export const getVendorOrdersController = async (
  _req: Request,
  res: Response
) => {
  try {
    const orders = await getVendorOrders(res.locals.user.id);

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get vendor orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor orders.",
    });
  }
};

// ACCEPT ORDER
export const acceptVendorOrderController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getOrderId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const result = await acceptVendorOrder(
      res.locals.user.id,
      id
    );

    if (!result.success) {
      return res.status(result.reason === "NOT_FOUND" ? 404 : 409).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "Order not found."
            : "Only pending orders can be accepted.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order accepted successfully.",
      order: result.order,
    });
  } catch (error) {
    console.error("Accept order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept order.",
    });
  }
};

// REJECT ORDER
export const rejectVendorOrderController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getOrderId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const { rejectionReason } = req.body;

    if (
      typeof rejectionReason !== "string" ||
      rejectionReason.trim().length < 3 ||
      rejectionReason.trim().length > 300
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a rejection reason between 3 and 300 characters.",
      });
    }

    const result = await rejectVendorOrder(
      res.locals.user.id,
      id,
      rejectionReason.trim()
    );

    if (!result.success) {
      return res.status(result.reason === "NOT_FOUND" ? 404 : 409).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "Order not found."
            : "Only pending orders can be rejected.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order rejected successfully.",
      order: result.order,
    });
  } catch (error) {
    console.error("Reject order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject order.",
    });
  }
};

// UPDATE ORDER STATUS
export const updateVendorOrderStatusController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getOrderId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const { status } = req.body;

    const allowedStatuses = [
      "PREPARING",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status.",
      });
    }

    const result = await updateVendorOrderStatus(
      res.locals.user.id,
      id,
      status
    );

    if (!result.success) {
      return res.status(result.reason === "NOT_FOUND" ? 404 : 409).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "Order not found."
            : "Invalid order status transition.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      order: result.order,
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status.",
    });
  }
};
