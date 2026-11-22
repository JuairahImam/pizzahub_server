
import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  getMyProfileController,
  updateMyProfileController,
} from "../controllers/profile.controller.js";

const router = Router();

// Existing session-based authentication
router.get("/me", authenticate, (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user (session)",
    user: res.locals.user,
  });
});

// JWT-based authentication
router.get("/jwt-me", authenticateJWT, (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user (JWT)",
    user: res.locals.user,
  });
});

// Existing session-based role test
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

// JWT-based role test
router.get(
  "/jwt-vendor-test",
  authenticateJWT,
  authorize("vendor", "admin"),
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "JWT authorization successful!",
    });
  }
);

// Profile management
router.get("/profile", authenticateJWT, getMyProfileController);
router.patch("/profile", authenticateJWT, updateMyProfileController);

export default router;
