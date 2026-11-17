import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  createMenuItem,
  getMyMenuItems,
  updateMenuItem,
  deleteMenuItem,
  type MenuItemInput,
} from "../services/menu.service.js";

const isValidString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidPrice = (value: unknown): value is number => {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
};

const getMenuItemId = (value: string | string[] | undefined) => {
  return typeof value === "string" ? value : undefined;
};

// CREATE MENU ITEM
export const createMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      description,
      category,
      price,
      imageUrl,
      imageId,
      isAvailable,
    } = req.body;

    if (
      !isValidString(name) ||
      !isValidString(description) ||
      !isValidString(category) ||
      !isValidPrice(price) ||
      !isValidString(imageUrl) ||
      !isValidString(imageId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, description, category, positive price, imageUrl and imageId are required.",
      });
    }

    if (
      isAvailable !== undefined &&
      typeof isAvailable !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isAvailable must be a boolean.",
      });
    }

    let parsedImageUrl: URL;

    try {
      parsedImageUrl = new URL(imageUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: "A valid image URL is required.",
      });
    }

    if (parsedImageUrl.protocol !== "https:") {
      return res.status(400).json({
        success: false,
        message: "Image URL must use HTTPS.",
      });
    }

    const data: MenuItemInput = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      price,
      imageUrl: parsedImageUrl.toString(),
      imageId: imageId.trim(),
      isAvailable,
    };

    const result = await createMenuItem(
      res.locals.user.id,
      data
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Restaurant profile not found. Create it first.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Menu item created successfully.",
      menuItem: result.menuItem,
    });
  } catch (error) {
    console.error("Create menu item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create menu item.",
    });
  }
};

// GET VENDOR'S MENU ITEMS
export const getMyMenuItemsController = async (
  _req: Request,
  res: Response
) => {
  try {
    const menuItems = await getMyMenuItems(res.locals.user.id);

    return res.status(200).json({
      success: true,
      count: menuItems.length,
      menuItems,
    });
  } catch (error) {
    console.error("Get menu items error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve menu items.",
    });
  }
};

// UPDATE MENU ITEM
export const updateMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getMenuItemId(req.params.id);

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "price",
      "imageUrl",
      "imageId",
      "isAvailable",
    ];

    const updates: Partial<MenuItemInput> = {};

    for (const field of allowedFields) {
      if (req.body?.[field] === undefined) {
        continue;
      }

      const value = req.body[field];

      if (["name", "description", "category", "imageId"].includes(field)) {
        if (!isValidString(value)) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string.`,
          });
        }

        (updates as Record<string, unknown>)[field] = value.trim();
      } else if (field === "price") {
        if (!isValidPrice(value)) {
          return res.status(400).json({
            success: false,
            message: "Price must be a positive number.",
          });
        }

        updates.price = value;
      } else if (field === "imageUrl") {
        if (!isValidString(value)) {
          return res.status(400).json({
            success: false,
            message: "imageUrl must be a valid HTTPS URL.",
          });
        }

        try {
          const parsedUrl = new URL(value);

          if (parsedUrl.protocol !== "https:") {
            throw new Error("HTTPS required");
          }

          updates.imageUrl = parsedUrl.toString();
        } catch {
          return res.status(400).json({
            success: false,
            message: "imageUrl must be a valid HTTPS URL.",
          });
        }
      } else if (field === "isAvailable") {
        if (typeof value !== "boolean") {
          return res.status(400).json({
            success: false,
            message: "isAvailable must be a boolean.",
          });
        }

        updates.isAvailable = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid field is required.",
      });
    }

    const result = await updateMenuItem(
      res.locals.user.id,
      id,
      updates
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu item updated successfully.",
      menuItem: result.menuItem,
    });
  } catch (error) {
    console.error("Update menu item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update menu item.",
    });
  }
};

// DELETE MENU ITEM
export const deleteMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getMenuItemId(req.params.id);

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu item ID.",
      });
    }

    const result = await deleteMenuItem(
      res.locals.user.id,
      id
    );

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