export const errorHandler = (err, req, res, next) => {
    console.error("❌ Error:", err);

    const status =
        err.code === "VALIDATION_ERROR" ? 400 :
        err.code === "NOT_FOUND" ? 404 :
        err.code === "OUT_OF_STOCK" ? 409 :
        err.code === "INVALID_TRANSITION" ? 400 :
        500;

    return res.status(status).json({
        ok: false,
        code: err.code || "INTERNAL_ERROR",
        message: err.message || "Error interno del servidor",
        details: err.details || undefined,
    });
};
