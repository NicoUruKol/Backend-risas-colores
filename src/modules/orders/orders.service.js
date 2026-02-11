import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import { mpPreference } from "../../config/mercadopago.js";


const PRODUCTS_COL = "products";
const ORDERS_COL = "orders";
const STOCK_MOVEMENTS_COL = "stock_movements";

const ALLOWED_STATUS = new Set([
    "created",
    "pending_payment",
    "paid",
    "expired",
    "cancelled",
]);

const canTransition = (from, to) => {
    if (from === to) return true;

    if (from === "created" && (to === "pending_payment" || to === "paid" || to === "cancelled")) return true;
    if (from === "pending_payment" && (to === "paid" || to === "expired" || to === "cancelled")) return true;
    if (from === "expired" && to === "cancelled") return true;

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

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

const normalizeCode = (code) => (code ?? "").toString().trim();
const normalizeSize = (size) => (size ?? "").toString().trim();

/* ==============================
Create Payment Preference (MP)
============================== */
export const createPaymentPreference = async (order) => {
    const preference = {
        items: order.items.map((item) => ({
        title: `${item.name} - Talle ${item.size}`,
        quantity: item.qty,
        currency_id: "ARS",
        unit_price: item.unitPrice,
        })),
        external_reference: order.id,
        // ⚠️ más adelante lo cambiás a tu dominio real o ngrok
        notification_url: `${process.env.PUBLIC_URL}/api/payments/webhook`,
        back_urls: {
        success: `${process.env.FRONT_URL}/payment-success`,
        failure: `${process.env.FRONT_URL}/payment-failure`,
        pending: `${process.env.FRONT_URL}/payment-pending`,
        },

        auto_return: "approved",
    };

    const response = await mpPreference.create({ body: preference });
    return response;
    //    return {
    //        id: "fake-preference-id",
    //        init_point: "http://localhost:5173/fake-checkout"
    //        };
};


/* ==============================
Create Order (public)
Body:
{
    customer?: { name?, email?, phone? },
    items: [{ code, size, qty }]
}
============================== */
export const create = async (payload) => {
    const customer = payload?.customer || null;
    const items = Array.isArray(payload?.items) ? payload.items : [];

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

        if (problems.length) throw validationError("Datos de compra inválidos", problems);

        return { code, size, qty };
    });

    const orderRef = db.collection(ORDERS_COL).doc();

    // 1) Transacción Firestore: valida + descuenta + crea orden + registra movimientos
    const baseOrder = await db.runTransaction(async (tx) => {
        const computedItems = [];
        let total = 0;

        for (const it of normalized) {
        const productRef = db.collection(PRODUCTS_COL).doc(it.code);
        const productSnap = await tx.get(productRef);

        if (!productSnap.exists) {
            throw notFoundError("Producto no encontrado", { productCode: it.code });
        }

        const product = productSnap.data();

        if (product?.active !== true) {
            throw notFoundError("Producto inactivo o no disponible", { productCode: it.code });
        }

        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const vIndex = variants.findIndex((v) => normalizeSize(v?.size) === it.size);

        if (vIndex === -1) {
            throw notFoundError("Talle no encontrado", { productCode: it.code, size: it.size });
        }

        const variant = variants[vIndex];
        const currentStock = Number(variant?.stock ?? 0);
        const unitPrice = Number(variant?.price ?? product?.price ?? 0);

        if (!isPositiveInt(it.qty)) {
            throw validationError("Cantidad inválida", [{ productCode: it.code, size: it.size }]);
        }

        if (currentStock < it.qty) {
            throw outOfStockError("Stock insuficiente", {
            productCode: it.code,
            size: it.size,
            requested: it.qty,
            available: currentStock,
            });
        }

        const stockBefore = currentStock;
        const stockAfter = currentStock - it.qty;

        const updatedVariants = variants.map((v, i) => {
            if (i !== vIndex) return v;
            return { ...v, stock: stockAfter };
        });

        tx.update(productRef, { variants: updatedVariants });

        const movRef = db.collection(STOCK_MOVEMENTS_COL).doc();
        tx.set(movRef, {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "order_create",
            orderId: orderRef.id,
            productCode: it.code,
            size: it.size,
            qtyDelta: -it.qty,
            stockBefore,
            stockAfter,
            actor: "system",
        });

        const snapItem = {
            code: it.code,
            name: product?.name ?? "",
            avatar: product?.avatar ?? "",
            category: product?.category ?? "",
            season: product?.season ?? "",
            size: it.size,
            qty: it.qty,
            unitPrice,
            lineTotal: unitPrice * it.qty,
        };

        total += snapItem.lineTotal;
        computedItems.push(snapItem);
        }

        const orderDoc = {
        status: "created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        customer: customer
            ? {
                name: (customer.name ?? "").toString().trim(),
                email: (customer.email ?? "").toString().trim(),
                phone: (customer.phone ?? "").toString().trim(),
            }
            : null,
        items: computedItems,
        total,
        };

        tx.set(orderRef, orderDoc);

        return {
        id: orderRef.id,
        status: "created",
        total,
        items: computedItems,
        };
    });

    // 2) Fuera de la transacción: crear preferencia MP
    const payment = await createPaymentPreference({
        id: baseOrder.id,
        items: baseOrder.items,
    });

    // 3) Guardar info de MP + pasar a pending_payment
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

    // 4) Respuesta al front
    return {
        id: baseOrder.id,
        status: "pending_payment",
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
    Admin: set status
    ============================== */
    export const setStatus = async (id, nextStatus) => {
    const status = (nextStatus ?? "").toString().trim();

    if (!ALLOWED_STATUS.has(status)) {
        throw validationError("Status inválido", [
        `status debe ser uno de: ${Array.from(ALLOWED_STATUS).join(", ")}`,
        ]);
    }

    const ref = db.collection(ORDERS_COL).doc(id);

    const updated = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;

        const prev = (snap.data()?.status ?? "created").toString();

        if (!canTransition(prev, status)) {
        const err = new Error("Transición de status no permitida");
        err.code = "INVALID_TRANSITION";
        err.details = { from: prev, to: status };
        throw err;
        }

        tx.update(ref, {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const after = await tx.get(ref);
        return { id: after.id, ...after.data() };
    });

    return updated;
};

/* ==============================
Admin: cancel + restock
============================== */
export const cancel = async (orderId) => {
    const orderRef = db.collection(ORDERS_COL).doc(orderId);

    const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) return null;

        const order = orderSnap.data();
        const status = (order?.status ?? "created").toString();

        const cancelable = new Set(["created", "pending_payment", "expired"]);
        if (!cancelable.has(status)) {
        const err = new Error("Transición de status no permitida");
        err.code = "INVALID_TRANSITION";
        err.details = { from: status, to: "cancelled" };
        throw err;
        }

        const items = Array.isArray(order?.items) ? order.items : [];

        if (items.length > 0) {
        const productRefs = items.map((it) => db.collection(PRODUCTS_COL).doc(it.code));
        const productSnaps = await Promise.all(productRefs.map((r) => tx.get(r)));

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const code = (it?.code ?? "").toString().trim();
            const size = (it?.size ?? "").toString().trim();
            const qty = Number(it?.qty ?? 0);

            if (!code || !size || !Number.isFinite(qty) || qty <= 0) continue;

            const pSnap = productSnaps[i];
            if (!pSnap.exists) continue;

            const pData = pSnap.data();
            const variants = Array.isArray(pData?.variants) ? pData.variants : [];
            const vIndex = variants.findIndex((v) => (v?.size ?? "").toString().trim() === size);
            if (vIndex === -1) continue;

            const currentStock = Number(variants[vIndex]?.stock ?? 0);
            const nextStock = currentStock + qty;

            const updatedVariants = variants.map((v, idx) => {
            if (idx !== vIndex) return v;
            return { ...v, stock: nextStock };
            });

            tx.update(productRefs[i], { variants: updatedVariants });

            const movRef = db.collection(STOCK_MOVEMENTS_COL).doc();
            tx.set(movRef, {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "order_cancel",
            orderId,
            productCode: code,
            size,
            qtyDelta: qty,
            stockBefore: currentStock,
            stockAfter: nextStock,
            actor: "system",
            });
        }
        }

        tx.update(orderRef, {
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const after = await tx.get(orderRef);
        return { id: after.id, ...after.data() };
    });

    return result;
};
