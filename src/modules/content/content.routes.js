import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

import {
    getHomeHero,
    getElJardinGallery,
    putHomeHero,
    putElJardinGallery,
} from "./content.controller.js";

const router = Router();

// Público
router.get("/home-hero", getHomeHero);
router.get("/el-jardin-gallery", getElJardinGallery);

// Admin
router.put("/home-hero", requireAdmin, putHomeHero);
router.put("/el-jardin-gallery", requireAdmin, putElJardinGallery);

export default router;
