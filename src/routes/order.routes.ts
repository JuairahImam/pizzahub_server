
import { Router } from "express";

import {
  createOrderController,
  getMyOrdersController,
  getMyOrderByIdController,
  cancelMyOrderController,
} from "../controllers/order.controller.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateJWT, authorize("customer"));

// Customer Order Management
router.post("/", createOrderController);
router.get("/my", getMyOrdersController);
router.get("/:id", getMyOrderByIdController);
router.patch("/:id/cancel", cancelMyOrderController);

export default router;
