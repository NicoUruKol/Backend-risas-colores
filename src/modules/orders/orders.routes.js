import { Router } from "express";
import {
    createOrder,
    listOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder,
} from "./orders.controller.js";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

/* ==============================
Public
============================== */
router.post("/", createOrder);

/* ==============================
Admin
============================== */
router.get("/", requireAdmin, listOrders);
router.get("/:id", requireAdmin, getOrderById);
router.patch("/:id/status", requireAdmin, updateOrderStatus);
router.post("/:id/cancel", requireAdmin, cancelOrder);


export default router;
