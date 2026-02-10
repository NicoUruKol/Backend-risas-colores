import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

import {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
} from "./products.controller.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProductById);

// CRUD (con auth)
router.post("/", requireAdmin, createProduct);
router.put("/:id", requireAdmin, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);


export default router;
