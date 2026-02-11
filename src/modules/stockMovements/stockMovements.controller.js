import * as stockMovementsService from "./stockMovements.service.js";

export const listStockMovements = async (req, res, next) => {
    try {
        const data = await stockMovementsService.list(req.query || {});
        return res.status(200).json({ ok: true, data });
    } catch (err) {
        next(err);
    }
};

export const getStockMovementById = async (req, res, next) => {
    try {
        const mov = await stockMovementsService.getById(req.params.id);
        if (!mov) return res.status(404).json({ ok: false, message: "Movimiento no encontrado" });
        return res.status(200).json({ ok: true, data: mov });
    } catch (err) {
        next(err);
    }
};
