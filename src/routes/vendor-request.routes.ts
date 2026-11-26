import { Router } from "express";

import {
  createVendorRequestController,
  getMyVendorRequestController,
} from "../controllers/vendor-request.controller.js";
import { authenticateJWT } from "../middlewares/jwt.middleware.js";

const router = Router();

// Any signed-in user can submit a request; the role is only changed by an
// admin when the request is approved.
router.use(authenticateJWT);

router.post("/", createVendorRequestController);
router.get("/me", getMyVendorRequestController);

export default router;
