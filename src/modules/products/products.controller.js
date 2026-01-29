import * as productsService from "./products.service.js";

export const getProducts = async (req, res, next) => {
    try {
        const filters = {
        q: req.query.q || "",
        type: req.query.type || "",
        active: req.query.active,
        };

        const data = await productsService.list(filters);
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
