import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  getAvailableMenuItems,
  getAvailableMenuItemById,
  getAvailableCategories,
  type MenuBrowseFilters,
} from "../services/customer-menu.service.js";

const getQueryString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value.trim() : undefined;
};

const parsePrice = (
  value: string | undefined
): number | undefined => {
  if (value === undefined) return undefined;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

// GET ALL AVAILABLE MENU ITEMS
export const getAvailableMenuItemsController = async (
  req: Request,
  res: Response
) => {
  try {
    const search = getQueryString(req.query.q);
    const category = getQueryString(req.query.category);

    const minPriceValue = getQueryString(req.query.minPrice);
    const maxPriceValue = getQueryString(req.query.maxPrice);

    const minPrice = parsePrice(minPriceValue);
    const maxPrice = parsePrice(maxPriceValue);

    if (
      (minPriceValue !== undefined && minPrice === undefined) ||
      (maxPriceValue !== undefined && maxPrice === undefined)
    ) {
      return res.status(400).json({
        success: false,
        message: "Price filters must be valid non-negative numbers.",
      });
    }

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "minPrice cannot be greater than maxPrice.",
      });
    }

    if (
      (search && search.length > 100) ||
      (category && category.length > 60)
    ) {
      return res.status(400).json({
        success: false,
        message: "Search or category value is too long.",
      });
    }

    const sortValue = getQueryString(req.query.sort) ?? "newest";

    if (
      !["newest", "price_asc", "price_desc"].includes(sortValue)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort option.",
      });
    }

    const pageValue = getQueryString(req.query.page) ?? "1";
    const limitValue = getQueryString(req.query.limit) ?? "12";

    const page = Number(pageValue);
    const limit = Number(limitValue);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50.",
      });
    }

    const filters: MenuBrowseFilters = {
      search,
      category,
      minPrice,
      maxPrice,
      sort: sortValue as MenuBrowseFilters["sort"],
      page,
      limit,
    };

    const result = await getAvailableMenuItems(filters);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Browse menu items error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve menu items.",
    });
  }
};

// GET SINGLE AVAILABLE MENU ITEM
export const getAvailableMenuItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid menu item ID.",
        });
      }

    const menuItem = await getAvailableMenuItemById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found or unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      menuItem,
    });
  } catch (error) {
    console.error("Get menu item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve menu item.",
    });
  }
};

// GET AVAILABLE CATEGORIES
export const getAvailableCategoriesController = async (
  _req: Request,
  res: Response
) => {
  try {
    const categories = await getAvailableCategories();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get menu categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve categories.",
    });
  }
};