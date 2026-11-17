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

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { uploadMenuImage } from "../middlewares/upload.middleware.js";

const router = Router();

router.use(authenticate, authorize("vendor"));

// Restaurant Management
router.post("/restaurant", createRestaurantController);
router.get("/restaurant", getMyRestaurantController);
router.patch("/restaurant", updateRestaurantController);

// Image Upload
router.post(
  "/upload-image",
  uploadMenuImage,
  uploadMenuImageController
);

// Menu Management
router.post("/menu-items", createMenuItemController);
router.get("/menu-items", getMyMenuItemsController);
router.patch("/menu-items/:id", updateMenuItemController);
router.delete("/menu-items/:id", deleteMenuItemController);

export default router;