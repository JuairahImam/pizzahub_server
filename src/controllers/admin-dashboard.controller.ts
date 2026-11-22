import type { Request, Response } from "express";

import { getAdminDashboardOverview } from "../services/admin.service.js";

export const getAdminDashboardOverviewController = async (
  _req: Request,
  res: Response
) => {
  try {
    const overview = await getAdminDashboardOverview();

    return res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error("Get admin dashboard overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard overview.",
    });
  }
};