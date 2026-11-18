
import { Router } from "express";

import {
  promoteVendorController,
  getAllVendorsController,
  blockUserController,
  unblockUserController,
} from "../controllers/admin.controller.js";


import { authorize } from "../middlewares/role.middleware.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";

const router = Router();

router.use(authenticateJWT, authorize("admin"));

router.patch("/users/promote-vendor", promoteVendorController);
router.get("/vendors", getAllVendorsController);

router.patch("/users/block", blockUserController);
router.patch("/users/unblock", unblockUserController);

export default router;
