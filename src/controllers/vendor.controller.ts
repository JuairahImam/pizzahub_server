
import type { Request, Response } from "express";

import {
  createRestaurant,
  getMyRestaurant,
  updateRestaurant,
  type RestaurantInput,
} from "../services/vendor.service.js";

const isValidRestaurantInput = (data: Partial<RestaurantInput>) => {
  return (
    typeof data.name === "string" &&
    typeof data.description === "string" &&
    typeof data.address === "string" &&
    typeof data.phone === "string" &&
    data.name.trim().length > 0 &&
    data.description.trim().length > 0 &&
    data.address.trim().length > 0 &&
    data.phone.trim().length > 0
  );
};

export const createRestaurantController = async (
  req: Request,
  res: Response
) => {
  try {
    const data = req.body;

    if (!isValidRestaurantInput(data)) {
      return res.status(400).json({
        success: false,
        message: "Name, description, address and phone are required.",
      });
    }

    const result = await createRestaurant(
      res.locals.user.id,
      {
        name: data.name.trim(),
        description: data.description.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
      }
    );

    if (!result.success) {
      return res.status(409).json({
        success: false,
        message: "You have already created a restaurant.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully.",
      restaurant: result.restaurant,
    });
  } catch (error) {
    console.error("Create restaurant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create restaurant.",
    });
  }
};

export const getMyRestaurantController = async (
  _req: Request,
  res: Response
) => {
  try {
    const restaurant = await getMyRestaurant(res.locals.user.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error("Get restaurant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve restaurant.",
    });
  }
};

export const updateRestaurantController = async (
  req: Request,
  res: Response
) => {
  try {
    const allowedFields = ["name", "description", "address", "phone"];
    const updates: Record<string, string> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (
          typeof req.body[field] !== "string" ||
          req.body[field].trim().length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string.`,
          });
        }

        updates[field] = req.body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid field is required.",
      });
    }

    const result = await updateRestaurant(
      res.locals.user.id,
      updates
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Restaurant profile not found. Create it first.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Restaurant updated successfully.",
      restaurant: result.restaurant,
    });
  } catch (error) {
    console.error("Update restaurant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update restaurant.",
    });
  }
};
