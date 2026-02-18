import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

import {
    getProducts,
    getProductById,
    getProductByIdAdmin,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustProductStock
} from "./products.controller.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id/admin", requireAdmin, getProductByIdAdmin);
router.get("/:id", getProductById);

// CRUD (con auth)
router.post("/", requireAdmin, createProduct);
router.put("/:id", requireAdmin, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);
router.patch("/:id/stock", requireAdmin, adjustProductStock);

export default router;
