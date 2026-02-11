import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";
import { listStockMovements, getStockMovementById } from "./stockMovements.controller.js";

const router = Router();

/* ==============================
Admin
============================== */
router.get("/", requireAdmin, listStockMovements);
router.get("/:id", requireAdmin, getStockMovementById);

export default router;
