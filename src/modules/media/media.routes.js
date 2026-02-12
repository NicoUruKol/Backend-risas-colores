// src/modules/media/media.routes.js
import { Router } from "express";
import multer from "multer";

import { requireAdmin } from "../../middlewares/auth.middleware.js";
import { listMedia, uploadMedia, deleteMedia } from "./media.controller.js";

const router = Router();

// Upload en memoria (sin tocar disco)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

router.get("/list", requireAdmin, listMedia);
router.post("/upload", requireAdmin, upload.single("file"), uploadMedia);
router.delete("/delete", requireAdmin, deleteMedia);

export default router;
