import { Router } from "express";

/* ==============================
Middlewares
============================== */
import { requireAdmin, requireSuperAdmin } from "../../middlewares/auth.middleware.js";

/* ==============================
Controllers
============================== */
import {
    listAdmins,
    postAdmin,
    patchMyPassword,
    patchDeactivateAdmin,
    patchReactivateAdmin,
} from "./admins.controller.js";

const router = Router();

/* ==============================
Admins
============================== */
router.get("/", requireSuperAdmin, listAdmins);
router.post("/", requireSuperAdmin, postAdmin);
router.patch("/me/password", requireAdmin, patchMyPassword);
router.patch("/:id/deactivate", requireSuperAdmin, patchDeactivateAdmin);
router.patch("/:id/reactivate", requireSuperAdmin, patchReactivateAdmin);

export default router;