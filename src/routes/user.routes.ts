
import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user",
    user: res.locals.user,
  });
});
router.get(
    "/vendor-test",
    authenticate,
    authorize("vendor", "admin"),
    (_req, res) => {
      return res.status(200).json({
        success: true,
        message: "Welcome to Vendor Dashboard!",
      });
    }
  );

export default router;
