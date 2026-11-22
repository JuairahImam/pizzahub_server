import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  getAdminUsers,
  getAdminUserById,
} from "../services/admin.service.js";

export const getAdminUsersController = async (
  req: Request,
  res: Response
) => {
  try {
    const q = req.query.q;
    const role = req.query.role;
    const blocked = req.query.blocked;
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
      role !== undefined &&
      (typeof role !== "string" ||
        !["customer", "vendor", "admin"].includes(role))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter.",
      });
    }

    if (
      blocked !== undefined &&
      blocked !== "true" &&
      blocked !== "false"
    ) {
      return res.status(400).json({
        success: false,
        message: "Blocked filter must be true or false.",
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

    const result = await getAdminUsers({
      q: typeof q === "string" ? q.trim() : undefined,
      role: typeof role === "string" ? role : undefined,
      blocked:
        blocked === "true"
          ? true
          : blocked === "false"
            ? false
            : undefined,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      count: result.users.length,
      users: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users.",
    });
  }
};

export const getAdminUserByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await getAdminUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get admin user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user.",
    });
  }
};