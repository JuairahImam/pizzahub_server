
import { Router } from "express";

import {
  promoteVendorController,
  getAllVendorsController,
  blockUserController,
  unblockUserController,
  getAdminMenuItemsController,
  getAdminMenuItemController,
  approveMenuItemController,
  rejectMenuItemController,
} from "../controllers/admin.controller.js";
import { getAdminDashboardOverviewController } from "../controllers/admin-dashboard.controller.js";


import { authorize } from "../middlewares/role.middleware.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";

const router = Router();

router.use(authenticateJWT, authorize("admin"));

router.get("/dashboard/overview", getAdminDashboardOverviewController);

router.patch("/users/promote-vendor", promoteVendorController);
router.get("/vendors", getAllVendorsController);

router.patch("/users/block", blockUserController);
router.patch("/users/unblock", unblockUserController);

// MENU MODERATION
router.get("/menu-items", getAdminMenuItemsController);
router.get("/menu-items/:id", getAdminMenuItemController);
router.patch("/menu-items/:id/approve", approveMenuItemController);
router.patch("/menu-items/:id/reject", rejectMenuItemController);

export default router;
