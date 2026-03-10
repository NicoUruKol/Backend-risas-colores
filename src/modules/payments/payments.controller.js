import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import { mpPayment } from "../../config/mercadopago.js";
import * as ordersService from "../orders/orders.service.js";
import { sendPaidOrderNotifications } from "../notifications/notifications.service.js";

const ORDERS_COL = "orders";

const normalize = (v) => (v ?? "").toString().trim();

export const mercadoPagoWebhook = async (req, res) => {
    try {
        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            return res.sendStatus(200);
        }

        const payment = await mpPayment.get({ id: paymentId });

        const mpStatus = normalize(payment?.status);
        const orderId = normalize(payment?.external_reference);

        if (!orderId) {
            return res.sendStatus(200);
        }

        const order = await ordersService.getById(orderId);

        if (!order) {
            return res.sendStatus(200);
        }

        /* ==============================
        Siempre guardamos auditoría MP
        ============================== */
        await db.collection(ORDERS_COL).doc(orderId).set(
            {
                mp: {
                    ...(order.mp || {}),
                    paymentId,
                    status: mpStatus,
                    lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        /* ==============================
        Si ya está cancelada, no hacemos nada más
        ============================== */
        if (order.status === "cancelled") {
            return res.sendStatus(200);
        }

        /* ==============================
        Approved => paid + pending_delivery
        ============================== */
                if (mpStatus === "approved") {
            if (order.status !== "paid") {
                await ordersService.setStatus(orderId, "paid");
            }

            const freshOrder = await ordersService.getById(orderId);
            const currentDeliveryStatus = normalize(freshOrder?.deliveryStatus) || "pending_delivery";

            if (currentDeliveryStatus !== "pending_delivery") {
                try {
                    await ordersService.setDeliveryStatus(orderId, "pending_delivery");
                } catch {
                    // No rompemos el webhook por esto
                }
            }

            await db.collection(ORDERS_COL).doc(orderId).set(
                {
                    mp: {
                        ...(freshOrder?.mp || order.mp || {}),
                        paymentId,
                        status: mpStatus,
                        paidAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            const finalOrder = await ordersService.getById(orderId);

            try {
                await sendPaidOrderNotifications(finalOrder);
            } catch (mailErr) {
                console.error("Error enviando mails del pedido pago:", mailErr);
            }

            return res.sendStatus(200);
        }

        /* ==============================
        Rejected / cancelled => cancel + restock
        ============================== */
        if (mpStatus === "rejected" || mpStatus === "cancelled") {
            if (order.status !== "cancelled") {
                await ordersService.cancel(orderId);
            }

            await db.collection(ORDERS_COL).doc(orderId).set(
                {
                    mp: {
                        ...(order.mp || {}),
                        paymentId,
                        status: mpStatus,
                        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            return res.sendStatus(200);
        }

        /* ==============================
        Pending / in_process => pending_payment
        ============================== */
        if (mpStatus === "in_process" || mpStatus === "pending") {
            if (order.status !== "pending_payment") {
                try {
                    await ordersService.setStatus(orderId, "pending_payment");
                } catch {
                    // Si ya no puede volver por transición, no rompemos webhook.
                }
            }

            return res.sendStatus(200);
        }

        /* ==============================
        Otros estados => no hacemos nada
        ============================== */
        return res.sendStatus(200);
    } catch (err) {
        console.error("Webhook MP error:", err);
        return res.sendStatus(500);
    }
};