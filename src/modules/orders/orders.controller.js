import * as ordersService from "./orders.service.js";

/* ==============================
Create order (public)
============================== */
export const createOrder = async (req, res, next) => {
    try {
        const created = await ordersService.create(req.body);
        return res.status(201).json({ ok: true, data: created });
    } catch (err) {
        if (err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        if (err.code === "NOT_FOUND") {
        return res.status(404).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        if (err.code === "OUT_OF_STOCK") {
        return res.status(409).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        next(err);
    }
};

/* ==============================
Admin list/get
============================== */
export const listOrders = async (req, res, next) => {
    try {
        const data = await ordersService.list();
        return res.status(200).json({ ok: true, data });
    } catch (err) {
        next(err);
    }
};

export const getOrderById = async (req, res, next) => {
    try {
        const order = await ordersService.getById(req.params.id);
        if (!order) return res.status(404).json({ ok: false, message: "Orden no encontrada" });
        return res.status(200).json({ ok: true, data: order });
    } catch (err) {
        next(err);
    }
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        const updated = await ordersService.setStatus(id, status);

        if (!updated) {
        return res.status(404).json({ ok: false, message: "Orden no encontrada" });
        }

        return res.status(200).json({ ok: true, data: updated });
    } catch (err) {
        if (err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        if (err.code === "INVALID_TRANSITION") {
        return res.status(409).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        next(err);
    }
};

export const cancelOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const cancelled = await ordersService.cancel(id);

        if (!cancelled) {
        return res.status(404).json({ ok: false, message: "Orden no encontrada" });
        }

        return res.status(200).json({ ok: true, data: cancelled });
    } catch (err) {
        if (err.code === "INVALID_TRANSITION") {
        return res.status(409).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        if (err.code === "NOT_FOUND") {
        return res.status(404).json({ ok: false, code: err.code, message: err.message, details: err.details });
        }
        next(err);
    }
};
