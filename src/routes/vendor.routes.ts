
import { Router } from "express";

import {
  createRestaurantController,
  getMyRestaurantController,
  updateRestaurantController,
} from "../controllers/vendor.controller.js";

import {
  createMenuItemController,
  getMyMenuItemsController,
  updateMenuItemController,
  deleteMenuItemController,
} from "../controllers/menu.controller.js";

import { uploadMenuImageController } from "../controllers/image.controller.js";

import {
  getVendorOrdersController,
  acceptVendorOrderController,
  rejectVendorOrderController,
  updateVendorOrderStatusController,
} from "../controllers/vendor-order.controller.js";

import {
  createPremiumCheckoutController,
} from "../controllers/stripe.controller.js";

import { authorize } from "../middlewares/role.middleware.js";
import { uploadMenuImage } from "../middlewares/upload.middleware.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";

const router = Router();

router.use(authenticateJWT, authorize("vendor"));

// RESTAURANT MANAGEMENT
router.post("/restaurant", createRestaurantController);
router.get("/restaurant", getMyRestaurantController);
router.patch("/restaurant", updateRestaurantController);

// IMAGE UPLOAD
router.post(
  "/upload-image",
  uploadMenuImage,
  uploadMenuImageController,
);

// MENU MANAGEMENT
router.post("/menu-items", createMenuItemController);
router.get("/menu-items", getMyMenuItemsController);
router.patch("/menu-items/:id", updateMenuItemController);
router.delete("/menu-items/:id", deleteMenuItemController);

// ORDER MANAGEMENT
router.get("/orders", getVendorOrdersController);

router.patch("/orders/:id/accept", acceptVendorOrderController);
router.patch("/orders/:id/reject", rejectVendorOrderController);
router.patch("/orders/:id/status", updateVendorOrderStatusController);

// PREMIUM SUBSCRIPTION
router.post("/premium/checkout", createPremiumCheckoutController);

export default router;
