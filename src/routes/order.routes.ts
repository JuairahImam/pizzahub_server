
import { Router } from "express";

import {
  createOrderController,
  getMyOrdersController,
  getMyOrderByIdController,
  cancelMyOrderController,
} from "../controllers/order.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate, authorize("customer"));

// Customer Order Management
router.post("/", createOrderController);
router.get("/my", getMyOrdersController);
router.get("/:id", getMyOrderByIdController);
router.patch("/:id/cancel", cancelMyOrderController);

export default router;
