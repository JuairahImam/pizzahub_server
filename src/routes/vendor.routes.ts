
import { Router } from "express";

import {
  createRestaurantController,
  getMyRestaurantController,
  updateRestaurantController,
} from "../controllers/vendor.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate, authorize("vendor"));

router.post("/restaurant", createRestaurantController);
router.get("/restaurant", getMyRestaurantController);
router.patch("/restaurant", updateRestaurantController);

export default router;
