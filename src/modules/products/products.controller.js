import * as productsService from "./products.service.js";

export const getProducts = async (req, res, next) => {
    try {
        const filters = {
        q: req.query.q || "",
        type: req.query.type || "",
        active: req.query.active,
        };

        const data = await productsService.list(req.query || {});
        return res.status(200).json({ ok: true, data });
    } catch (err) {
        next(err);
    }
};

export const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await productsService.getById(id);

        if (!product) {
        return res.status(404).json({ ok: false, message: "Producto no encontrado" });
        }

        return res.status(200).json({ ok: true, data: product });
    } catch (err) {
        next(err);
    }
};

export const createProduct = async (req, res, next) => {
    try {
        const created = await productsService.create(req.body);
        return res.status(201).json({ ok: true, data: created });
    } catch (err) {
        if (err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ ok: false, message: err.message, details: err.details });
        }
        if (err.code === "DUPLICATE_ID") {
        return res.status(409).json({ ok: false, code: err.code, message: err.message });
        }
        next(err);
    }
};

    export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await productsService.update(id, req.body);

        if (!updated) {
        return res.status(404).json({ ok: false, message: "Producto no encontrado" });
        }

        return res.status(200).json({ ok: true, data: updated });
    } catch (err) {
        if (err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ ok: false, message: err.message, details: err.details });
        }
        next(err);
    }
};

    export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const removed = await productsService.remove(id);

        if (!removed) {
        return res.status(404).json({ ok: false, message: "Producto no encontrado" });
        }

        return res.status(200).json({ ok: true, data: removed });
    } catch (err) {
        next(err);
    }
};

export const adjustProductStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await productsService.adjustStock(id, req.body, req.user?.email || "admin");

        if (!updated) {
        return res.status(404).json({ ok: false, message: "Producto no encontrado" });
        }

        return res.status(200).json({ ok: true, data: updated });
    } catch (err) {
        if (err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ ok: false, message: err.message, details: err.details });
        }
        next(err);
    }
    };
