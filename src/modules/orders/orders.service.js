import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import { mpPreference } from "../../config/mercadopago.js";

/* ==============================
Collections
============================== */
const PRODUCTS_COL = "products";
const ORDERS_COL = "orders";
const STOCK_MOVEMENTS_COL = "stock_movements";

/* ==============================
Allowed status
============================== */
const ALLOWED_STATUS = new Set([
    "created",
    "pending_payment",
    "paid",
    "expired",
    "cancelled",
]);

const ALLOWED_DELIVERY_STATUS = new Set([
    "pending_delivery",
    "ready_for_pickup",
    "delivered",
]);

const canTransition = (from, to) => {
    if (from === to) return true;

    if (from === "created" && (to === "pending_payment" || to === "paid" || to === "cancelled")) return true;
    if (from === "pending_payment" && (to === "paid" || to === "expired" || to === "cancelled")) return true;
    if (from === "expired" && to === "cancelled") return true;

    return false;
};

const canSetDeliveryStatus = ({ orderStatus, currentDeliveryStatus, nextDeliveryStatus }) => {
    if (currentDeliveryStatus === nextDeliveryStatus) return true;

    if (orderStatus !== "paid") return false;

    if (
        currentDeliveryStatus === "pending_delivery" &&
        nextDeliveryStatus === "ready_for_pickup"
    ) {
        return true;
    }

    if (
        currentDeliveryStatus === "ready_for_pickup" &&
        nextDeliveryStatus === "pending_delivery"
    ) {
        return true;
    }

    if (
        currentDeliveryStatus === "ready_for_pickup" &&
        nextDeliveryStatus === "delivered"
    ) {
        return true;
    }

    if (
        currentDeliveryStatus === "delivered" &&
        nextDeliveryStatus === "ready_for_pickup"
    ) {
        return true;
    }

    return false;
};

/* ==============================
Helpers
============================== */
const validationError = (message, details = []) => {
    const err = new Error(message);
    err.code = "VALIDATION_ERROR";
    err.details = details;
    return err;
};

const notFoundError = (message, details = {}) => {
    const err = new Error(message);
    err.code = "NOT_FOUND";
    err.details = details;
    return err;
};

const outOfStockError = (message, details = {}) => {
    const err = new Error(message);
    err.code = "OUT_OF_STOCK";
    err.details = details;
    return err;
};

const invalidTransitionError = (message, details = {}) => {
    const err = new Error(message);
    err.code = "INVALID_TRANSITION";
    err.details = details;
    return err;
};

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

const normalizeCode = (code) => (code ?? "").toString().trim();
const normalizeSize = (size) => (size ?? "").toString().trim();

/* ==============================
Create Payment Preference (MP)
============================== */
export const createPaymentPreference = async (order) => {
    const missingEnv = [];

    const mpAccessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
    const publicUrl = String(process.env.PUBLIC_URL || "").trim().replace(/\/+$/, "");
    const frontUrl = String(process.env.FRONT_URL || "").trim().replace(/\/+$/, "");

    if (!mpAccessToken) missingEnv.push("MP_ACCESS_TOKEN");
    if (!publicUrl) missingEnv.push("PUBLIC_URL");
    if (!frontUrl) missingEnv.push("FRONT_URL");

    if (missingEnv.length > 0) {
        const err = new Error(
            `Faltan variables de entorno para Mercado Pago: ${missingEnv.join(", ")}`
        );
        err.code = "PAYMENT_CONFIG_ERROR";
        err.details = missingEnv;
        throw err;
    }

    let successUrl;
    let failureUrl;
    let pendingUrl;
    let webhookUrl;

    try {
        successUrl = new URL("/payment-success", frontUrl).toString();
        failureUrl = new URL("/payment-failure", frontUrl).toString();
        pendingUrl = new URL("/payment-pending", frontUrl).toString();
        webhookUrl = new URL("/api/payments/webhook", publicUrl).toString();
    } catch {
        const err = new Error("FRONT_URL o PUBLIC_URL no son URLs válidas");
        err.code = "PAYMENT_CONFIG_ERROR";
        throw err;
    }

    if (!order?.id) {
        const err = new Error("La orden no tiene id");
        err.code = "PAYMENT_ORDER_INVALID";
        throw err;
    }

    if (!Array.isArray(order?.items) || order.items.length === 0) {
        const err = new Error("La orden no tiene items válidos para generar la preferencia");
        err.code = "PAYMENT_ORDER_INVALID";
        throw err;
    }

    const normalizedItems = order.items.map((item, index) => {
        const quantity = Number(item?.qty);
        const unitPrice = Number(item?.unitPrice);
        const name = String(item?.name || "").trim();
        const sizeRaw = String(item?.size || "").trim();
        const sizeLabel = sizeRaw || "Único";

        if (!name) {
            const err = new Error(`El item ${index + 1} no tiene nombre`);
            err.code = "PAYMENT_ITEM_INVALID";
            throw err;
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            const err = new Error(
                `El item "${name}" tiene una cantidad inválida: ${item?.qty}`
            );
            err.code = "PAYMENT_ITEM_INVALID";
            throw err;
        }

        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
            const err = new Error(
                `El item "${name}" tiene un precio inválido: ${item?.unitPrice}`
            );
            err.code = "PAYMENT_ITEM_INVALID";
            throw err;
        }

        return {
            title: `${name} - Talle ${sizeLabel}`,
            quantity,
            currency_id: "ARS",
            unit_price: Number(unitPrice.toFixed(2)),
        };
    });

    console.log("MP FINAL ITEMS =>", normalizedItems);
    console.log("MP PAYER =>", order.customer);
    const preference = {
    items: normalizedItems,

    payer: {
        name: order.customer?.name || "Comprador Test",
        email: order.customer?.email || "test@test.com",
    },

    external_reference: String(order.id),
    notification_url: webhookUrl,
    back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
    },
    auto_return: "approved",
};

    console.log("MP URLS =>", {
        publicUrl,
        frontUrl,
        successUrl,
        failureUrl,
        pendingUrl,
        webhookUrl,
    });

    console.log("MP order raw =>", order);
    console.log("MP preference body =>", preference);

    try {
        const response = await mpPreference.create({ body: preference });
        console.log("MP preference response =>", response);
        return response;
    } catch (error) {
        console.error("MP create preference error =>", {
            message: error?.message,
            status: error?.status,
            cause: error?.cause,
            response: error?.response,
        });
        throw error;
    }
};

/* ==============================
Create Order (public)
Body:
{
    customer?: { name?, email?, phone? },
    items: [{ code, size, qty }],
    meta?: { kidName?, adultName? }
}
============================== */
export const create = async (payload) => {
    const customer = payload?.customer || null;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const meta = payload?.meta || null;

    if (items.length === 0) {
        throw validationError("items es obligatorio (array no vacío)", ["items"]);
    }

    const normalized = items.map((it, idx) => {
        const code = normalizeCode(it?.code);
        const size = normalizeSize(it?.size);
        const qty = Number(it?.qty);

        const problems = [];
        if (!code) problems.push(`items[${idx}].code es obligatorio`);
        if (!size) problems.push(`items[${idx}].size es obligatorio`);
        if (!isPositiveInt(qty)) problems.push(`items[${idx}].qty debe ser entero > 0`);

        if (problems.length) {
            throw validationError("Datos de compra inválidos", problems);
        }

        return { code, size, qty };
    });

    /* ==============================
    Consolidar items repetidos (mismo código+talle)
    ============================== */
    const groupedMap = new Map();

    for (const it of normalized) {
        const key = `${it.code}__${it.size}`;
        const prev = groupedMap.get(key);

        if (prev) {
            prev.qty += it.qty;
        } else {
            groupedMap.set(key, { ...it });
        }
    }

    const groupedItems = Array.from(groupedMap.values());

    const orderRef = db.collection(ORDERS_COL).doc();

    const baseOrder = await db.runTransaction(async (tx) => {
        let total = 0;
        const computedItems = [];

        /* ==============================
        1) READS primero
        ============================== */
        const readResults = [];

        for (const it of groupedItems) {
            const productRef = db.collection(PRODUCTS_COL).doc(it.code);
            const productSnap = await tx.get(productRef);

            if (!productSnap.exists) {
                throw notFoundError("Producto no encontrado", { productCode: it.code });
            }

            const product = productSnap.data() || {};

            if (product.active !== true) {
                throw notFoundError("Producto inactivo o no disponible", { productCode: it.code });
            }

            const variants = Array.isArray(product.variants) ? product.variants : [];
            const vIndex = variants.findIndex((v) => normalizeSize(v?.size) === it.size);

            if (vIndex === -1) {
                throw notFoundError("Talle no encontrado", {
                    productCode: it.code,
                    size: it.size,
                });
            }

            const variant = variants[vIndex];
            const currentStock = Number(variant?.stock ?? 0);
            const unitPrice = Number(variant?.price ?? product?.price ?? 0);

            if (!isPositiveInt(it.qty)) {
                throw validationError("Cantidad inválida", [
                    { productCode: it.code, size: it.size },
                ]);
            }

            if (currentStock < it.qty) {
                throw outOfStockError("Stock insuficiente", {
                    productCode: it.code,
                    size: it.size,
                    requested: it.qty,
                    available: currentStock,
                });
            }

            readResults.push({
                item: it,
                productRef,
                product,
                variants,
                vIndex,
                currentStock,
                unitPrice,
            });
        }

        /* ==============================
        2) Preparar datos en memoria
        ============================== */
        const stockWrites = [];
        const movementWrites = [];

        for (const row of readResults) {
            const { item, productRef, product, variants, vIndex, currentStock, unitPrice } = row;

            const stockBefore = currentStock;
            const stockAfter = currentStock - item.qty;

            const updatedVariants = variants.map((v, i) => {
                if (i !== vIndex) return v;
                return { ...v, stock: stockAfter };
            });

            stockWrites.push({
                productRef,
                updatedVariants,
            });

            movementWrites.push({
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                type: "order_create",
                orderId: orderRef.id,
                productCode: item.code,
                size: item.size,
                qtyDelta: -item.qty,
                stockBefore,
                stockAfter,
                actor: "system",
            });

            const snapItem = {
                code: item.code,
                name: product?.name ?? "",
                avatar: product?.avatar ?? "",
                category: product?.category ?? "",
                season: product?.season ?? "",
                size: item.size,
                qty: item.qty,
                unitPrice,
                lineTotal: unitPrice * item.qty,
            };

            total += snapItem.lineTotal;
            computedItems.push(snapItem);
        }

        /* ==============================
        3) WRITES recién al final
        ============================== */
        for (const write of stockWrites) {
            tx.update(write.productRef, { variants: write.updatedVariants });
        }

        for (const mov of movementWrites) {
            const movRef = db.collection(STOCK_MOVEMENTS_COL).doc();
            tx.set(movRef, mov);
        }

        const orderDoc = {
            status: "created",
            deliveryStatus: "pending_delivery",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            customer: customer
                ? {
                    name: (customer.name ?? "").toString().trim(),
                    email: (customer.email ?? "").toString().trim(),
                    phone: (customer.phone ?? "").toString().trim(),
                }
                : null,

            family: meta
                ? {
                    kidName: (meta.kidName ?? "").toString().trim(),
                    adultName: (meta.adultName ?? "").toString().trim(),
                }
                : null,

            items: computedItems,
            total,

            notifications: {
                gardenPaidEmailSent: false,
                familyPaidEmailSent: false,
                readyForPickupEmailSent: false,
            },
        };

        tx.set(orderRef, orderDoc);

        return {
            id: orderRef.id,
            status: "created",
            deliveryStatus: "pending_delivery",
            total,
            items: computedItems,
        };
    });

    /* ==============================
    2) Outside transaction: create MP preference
    ============================== */
    const payment = await createPaymentPreference({
        id: baseOrder.id,
        items: baseOrder.items,
        customer: payload.customer,
    });

    /* ==============================
    3) Save MP info + move to pending_payment
    ============================== */
    await db.collection(ORDERS_COL).doc(baseOrder.id).set(
        {
            status: "pending_payment",
            mp: {
                preferenceId: payment.id,
                init_point: payment.init_point,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return {
        id: baseOrder.id,
        status: "pending_payment",
        deliveryStatus: "pending_delivery",
        total: baseOrder.total,
        init_point: payment.init_point,
    };
};

/* ==============================
Admin: list/get
============================== */
export const list = async () => {
    const snap = await db.collection(ORDERS_COL).orderBy("createdAt", "desc").limit(100).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getById = async (id) => {
    const doc = await db.collection(ORDERS_COL).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
};

/* ==============================
Admin: set payment status
============================== */
export const setStatus = async (id, nextStatus) => {
    const status = (nextStatus ?? "").toString().trim();

    if (!ALLOWED_STATUS.has(status)) {
        throw validationError("Status inválido", [
            `status debe ser uno de: ${Array.from(ALLOWED_STATUS).join(", ")}`,
        ]);
    }

    const ref = db.collection(ORDERS_COL).doc(id);

    const exists = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false;

        const prevData = snap.data() || {};
        const prevStatus = (prevData.status ?? "created").toString();

        if (!canTransition(prevStatus, status)) {
            throw invalidTransitionError("Transición de status no permitida", {
                from: prevStatus,
                to: status,
            });
        }

        tx.update(ref, {
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return true;
    });

    if (!exists) return null;

    return await getById(id);
};

/* ==============================
Admin: set delivery status
============================== */
/* ==============================
Admin: set delivery status
============================== */
export const setDeliveryStatus = async (id, nextDeliveryStatus) => {
    const deliveryStatus = (nextDeliveryStatus ?? "").toString().trim();

    if (!ALLOWED_DELIVERY_STATUS.has(deliveryStatus)) {
        throw validationError("Estado de entrega inválido", [
            `deliveryStatus debe ser uno de: ${Array.from(ALLOWED_DELIVERY_STATUS).join(", ")}`,
        ]);
    }

    const ref = db.collection(ORDERS_COL).doc(id);

    const exists = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false;

        const data = snap.data() || {};
        const orderStatus = (data.status ?? "created").toString();
        const currentDeliveryStatus = (data.deliveryStatus ?? "pending_delivery").toString();

        if (
            !canSetDeliveryStatus({
                orderStatus,
                currentDeliveryStatus,
                nextDeliveryStatus: deliveryStatus,
            })
        ) {
            throw invalidTransitionError("Transición de entrega no permitida", {
                orderStatus,
                from: currentDeliveryStatus,
                to: deliveryStatus,
            });
        }

        const patch = {
            deliveryStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (deliveryStatus === "ready_for_pickup") {
            patch.readyForPickupAt = admin.firestore.FieldValue.serverTimestamp();
            patch.deliveredAt = null;
        } else if (deliveryStatus === "delivered") {
            patch.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
            patch.readyForPickupAt = null;
            patch.deliveredAt = null;
        }

        tx.update(ref, patch);

        return true;
    });

    if (!exists) return null;

    return await getById(id);
};

/* ==============================
Admin: cancel + restock
============================== */
export const cancel = async (orderId) => {
    const orderRef = db.collection(ORDERS_COL).doc(orderId);

    const exists = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) return false;

        const order = orderSnap.data() || {};
        const status = (order.status ?? "created").toString();

        const cancelable = new Set(["created", "pending_payment", "expired"]);
        if (!cancelable.has(status)) {
            throw invalidTransitionError("Transición de status no permitida", {
                from: status,
                to: "cancelled",
            });
        }

        const items = Array.isArray(order.items) ? order.items : [];

        const validItems = items.filter((it) => {
            const code = (it?.code ?? "").toString().trim();
            const size = (it?.size ?? "").toString().trim();
            const qty = Number(it?.qty ?? 0);

            return code && size && Number.isFinite(qty) && qty > 0;
        });

        const productRefs = validItems.map((it) => db.collection(PRODUCTS_COL).doc(it.code));
        const productSnaps = productRefs.length
            ? await Promise.all(productRefs.map((ref) => tx.get(ref)))
            : [];

        for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            const productRef = productRefs[i];
            const productSnap = productSnaps[i];

            if (!productSnap.exists) continue;

            const productData = productSnap.data() || {};
            const variants = Array.isArray(productData.variants) ? productData.variants : [];

            const variantIndex = variants.findIndex(
                (v) => (v?.size ?? "").toString().trim() === item.size
            );

            if (variantIndex === -1) continue;

            const currentStock = Number(variants[variantIndex]?.stock ?? 0);
            const nextStock = currentStock + Number(item.qty);

            const updatedVariants = variants.map((variant, index) => {
                if (index !== variantIndex) return variant;
                return { ...variant, stock: nextStock };
            });

            tx.update(productRef, { variants: updatedVariants });

            const movRef = db.collection(STOCK_MOVEMENTS_COL).doc();
            tx.set(movRef, {
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                type: "order_cancel",
                orderId,
                productCode: item.code,
                size: item.size,
                qtyDelta: Number(item.qty),
                stockBefore: currentStock,
                stockAfter: nextStock,
                actor: "system",
            });
        }

        tx.update(orderRef, {
            status: "cancelled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return true;
    });

    if (!exists) return null;

    return await getById(orderId);
};