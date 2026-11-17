
import { Router } from "express";

import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import vendorRoutes from "./vendor.routes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/vendor", vendorRoutes);

export default router;
