
import { Router } from "express";

import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import vendorRoutes from "./vendor.routes.js";
import menuRoutes from "./menu.routes.js";
import orderRoutes from "./order.routes.js";
import vendorRequestRoutes from "./vendor-request.routes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/vendor", vendorRoutes);
router.use("/vendor-requests", vendorRequestRoutes);

// Public Customer Menu APIs
router.use("/menu-items", menuRoutes);

// Customer Order APIs
router.use("/orders", orderRoutes);

export default router;
