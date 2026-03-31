import { db } from "../../config/firebase.js";

const COL = "stock_movements";
const VISIBLE_TYPES = new Set(["order_paid", "order_cancel"]);

export const list = async (filters = {}) => {
    const { productCode, orderId, type, size, limit } = filters;

    let ref = db.collection(COL);

    if (productCode) ref = ref.where("productCode", "==", productCode.toString().trim());
    if (orderId) ref = ref.where("orderId", "==", orderId.toString().trim());
    if (size) ref = ref.where("size", "==", size.toString().trim());

    const safeType = type ? type.toString().trim() : "";

    // Si el usuario elige un tipo visible, filtramos en Firestore
    if (safeType && VISIBLE_TYPES.has(safeType)) {
        ref = ref.where("type", "==", safeType);
    }

    const n = Math.min(Math.max(parseInt(limit ?? "100", 10) || 100, 1), 300);

    // Si no hay type, traemos más y filtramos en memoria para sacar ruido
    const fetchLimit = safeType ? n : Math.min(n * 3, 300);

    ref = ref.orderBy("createdAt", "desc").limit(fetchLimit);

    const snap = await ref.get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!safeType) {
        items = items.filter((m) => VISIBLE_TYPES.has((m?.type ?? "").toString().trim()));
    }

    return items.slice(0, n);
};

export const getById = async (id) => {
    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
};