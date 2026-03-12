import { Router } from "express";
import {
    createOrder,
    listOrders,
    getOrderById,
    updateOrderStatus,
    updateOrderDeliveryStatus,
    markOrderReadyForPickup,
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
router.patch("/:id/delivery-status", requireAdmin, updateOrderDeliveryStatus);
router.post("/:id/ready-for-pickup", requireAdmin, markOrderReadyForPickup);

router.post("/:id/cancel", requireAdmin, cancelOrder);

export default router;