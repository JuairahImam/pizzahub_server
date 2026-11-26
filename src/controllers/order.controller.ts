
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
} from "../services/order.service.js";

// CREATE ORDER
export const createOrderController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      items,
      deliveryAddress,
      contactPhone,
      deliveryDate,
      customerMessage,
    } = req.body;

    if (
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide between 1 and 20 order items.",
      });
    }

    for (const item of items) {
      if (
        typeof item.menuItemId !== "string" ||
        !ObjectId.isValid(item.menuItemId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid menu item or quantity.",
        });
      }
    }

    if (
      typeof deliveryAddress !== "string" ||
      deliveryAddress.trim().length < 5 ||
      deliveryAddress.trim().length > 300
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivery address must be between 5 and 300 characters.",
      });
    }

    if (
      typeof contactPhone !== "string" ||
      !/^[0-9+\-\s()]{7,20}$/.test(contactPhone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact phone number.",
      });
    }

    if (
      typeof deliveryDate !== "string" ||
      deliveryDate.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivery date is required.",
      });
    }

    const trimmedDeliveryDate = deliveryDate.trim();
    const parsedDeliveryDate = new Date(trimmedDeliveryDate);

    if (Number.isNaN(parsedDeliveryDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid delivery date.",
      });
    }

    const normalizedDeliveryDate = parsedDeliveryDate
      .toISOString()
      .slice(0, 10);

    if (
      customerMessage !== undefined &&
      customerMessage !== null &&
      (typeof customerMessage !== "string" ||
        customerMessage.trim().length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer message must be 500 characters or fewer.",
      });
    }

    const user = res.locals.user;

    const result = await createOrder(
      {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      {
        items,
        deliveryAddress: deliveryAddress.trim(),
        contactPhone: contactPhone.trim(),
        deliveryDate: normalizedDeliveryDate,
        customerMessage:
          typeof customerMessage === "string"
            ? customerMessage.trim()
            : null,
      }
    );

    if (!result.success) {
      const messages: Record<string, string> = {
        INVALID_ITEMS: "One or more menu item IDs are invalid.",
        ITEMS_UNAVAILABLE:
          "One or more menu items are unavailable or not yet approved.",
        MULTIPLE_RESTAURANTS: "You can order from only one restaurant at a time.",
        RESTAURANT_NOT_FOUND: "Restaurant not found.",
        OWN_ITEM: "You cannot order items from your own restaurant.",
        DUPLICATE_ACTIVE_ORDER:
          "You already have an active order for this item and delivery date.",
      };

      const statusCode =
        result.reason === "DUPLICATE_ACTIVE_ORDER" ? 409 : 400;

      return res.status(statusCode).json({
        success: false,
        message: messages[result.reason] || "Unable to create order.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order: result.order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order.",
    });
  }
};

// GET CUSTOMER'S ORDERS
export const getMyOrdersController = async (
  _req: Request,
  res: Response
) => {
  try {
    const orders = await getMyOrders(res.locals.user.id);

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your orders.",
    });
  }
};

// GET SINGLE CUSTOMER ORDER
export const getMyOrderByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await getMyOrderById(
      res.locals.user.id,
      id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve order details.",
    });
  }
};

// CANCEL CUSTOMER ORDER
export const cancelMyOrderController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const result = await cancelMyOrder(
      res.locals.user.id,
      id
    );

    if (!result.success) {
      return res.status(result.reason === "NOT_FOUND" ? 404 : 409).json({
        success: false,
        message:
          result.reason === "NOT_FOUND"
            ? "Order not found."
            : "Only pending orders can be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order: result.order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel order.",
    });
  }
};
