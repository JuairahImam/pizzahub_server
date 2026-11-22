import type { Request, Response } from "express";
import { ObjectId } from "mongodb";

import {
  getAdminTransactions,
  getAdminTransactionById,
  type AdminTransactionFilters,
} from "../services/transaction.service.js";

export const getAdminTransactionsController = async (
  req: Request,
  res: Response
) => {
  try {
    const q = req.query.q;
    const status = req.query.status;
    const type = req.query.type;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
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

    if (status !== undefined && typeof status !== "string") {
      return res.status(400).json({
        success: false,
        message: "Status filter must be a string.",
      });
    }

    if (type !== undefined && typeof type !== "string") {
      return res.status(400).json({
        success: false,
        message: "Type filter must be a string.",
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

    const filters: AdminTransactionFilters = {
      q: typeof q === "string" ? q.trim() : undefined,
      status: typeof status === "string" ? status.trim() : undefined,
      type: typeof type === "string" ? type.trim() : undefined,
      dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
      dateTo: typeof dateTo === "string" ? dateTo : undefined,
      page,
      limit,
    };

    const result = await getAdminTransactions(filters);

    return res.status(200).json({
      success: true,
      count: result.transactions.length,
      transactions: result.transactions,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin transactions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions.",
    });
  }
};

export const getAdminTransactionByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID.",
      });
    }

    const transaction = await getAdminTransactionById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Get admin transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction.",
    });
  }
};
