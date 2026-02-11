import { Router } from "express";
import { mercadoPagoWebhook } from "./payments.controller.js";

const router = Router();

router.post("/webhook", mercadoPagoWebhook);

export default router;
