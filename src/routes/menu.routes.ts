import { Router } from "express";

import {
  getAvailableMenuItemsController,
  getAvailableMenuItemController,
  getAvailableCategoriesController,
} from "../controllers/customer-menu.controller.js";

const router = Router();

router.get("/categories", getAvailableCategoriesController);

router.get("/", getAvailableMenuItemsController);

router.get("/:id", getAvailableMenuItemController);

export default router;