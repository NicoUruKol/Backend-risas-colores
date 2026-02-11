import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import { mpPayment } from "../../config/mercadopago.js";
import * as ordersService from "../orders/orders.service.js";

const normalize = (v) => (v ?? "").toString().trim();

export const mercadoPagoWebhook = async (req, res) => {
    try {
        const paymentId = req.body?.data?.id;
        if (!paymentId) return res.sendStatus(200);

        const payment = await mpPayment.get({ id: paymentId });

        const mpStatus = normalize(payment?.status); // approved | rejected | in_process | ...
        const orderId = normalize(payment?.external_reference);

        if (!orderId) return res.sendStatus(200);

        const order = await ordersService.getById(orderId);
        if (!order) return res.sendStatus(200);

        // 🔒 Idempotencia fuerte
        if (order.status === "paid" || order.status === "cancelled") {
        // igual guardamos el paymentId/mpStatus por auditoría
        await db.collection("orders").doc(orderId).set(
            {
            mp: {
                paymentId,
                status: mpStatus,
                lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return res.sendStatus(200);
        }

        // Guardar siempre info de MP (audit)
        await db.collection("orders").doc(orderId).set(
        {
            mp: {
            paymentId,
            status: mpStatus,
            lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
        );

        // ✅ Aprobado => paid
        if (mpStatus === "approved") {
        await ordersService.setStatus(orderId, "paid");

        await db.collection("orders").doc(orderId).set(
            {
            mp: {
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return res.sendStatus(200);
        }

        // ❌ Rechazado / cancelado => cancelar y devolver stock
        // (en MP pueden aparecer "rejected" o "cancelled")
        if (mpStatus === "rejected" || mpStatus === "cancelled") {
        await ordersService.cancel(orderId);

        await db.collection("orders").doc(orderId).set(
            {
            mp: {
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return res.sendStatus(200);
        }

        // 🟡 Pendiente/en proceso => dejamos pending_payment (si no lo estaba)
        if (mpStatus === "in_process" || mpStatus === "pending") {
        if (order.status !== "pending_payment") {
            await ordersService.setStatus(orderId, "pending_payment");
        }
        return res.sendStatus(200);
        }

        // Otros estados: no hacemos nada por ahora
        return res.sendStatus(200);
    } catch (err) {
        console.error("Webhook MP error:", err);
        return res.sendStatus(500);
    }
};
