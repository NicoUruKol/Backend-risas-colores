import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/auth.middleware.js";
import { listAdmins, postAdmin, patchMyPassword } from "./admins.controller.js";

const router = Router();

router.get("/", requireSuperAdmin, listAdmins);
router.post("/", requireSuperAdmin, postAdmin);
router.patch("/me/password", requireAdmin, patchMyPassword);

export default router;