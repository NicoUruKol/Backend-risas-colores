import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware.js";
import { getPublic, getAdmin, putUrl, postCreate, putUpdate, patchActive, del } from "./googleReviews.controller.js";

const router = Router();

// Público (front)
router.get("/google-reviews", getPublic);

// Admin (panel)
router.get("/google-reviews/admin", requireAdmin, getAdmin);
router.put("/google-reviews/url", requireAdmin, putUrl);
router.post("/google-reviews", requireAdmin, postCreate);
router.put("/google-reviews/:id", requireAdmin, putUpdate);
router.patch("/google-reviews/:id/active", requireAdmin, patchActive);
router.delete("/google-reviews/:id", requireAdmin, del);

export default router;