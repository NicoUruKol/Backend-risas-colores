import { db } from "../../config/firebase.js";

const COL = "stock_movements";

export const list = async (filters = {}) => {
    const { productCode, orderId, type, size, limit } = filters;

    let ref = db.collection(COL);

    // filtros por igualdad (Firestore friendly)
    if (productCode) ref = ref.where("productCode", "==", productCode.toString().trim());
    if (orderId) ref = ref.where("orderId", "==", orderId.toString().trim());
    if (type) ref = ref.where("type", "==", type.toString().trim());
    if (size) ref = ref.where("size", "==", size.toString().trim());

    // orden + límite
    const n = Math.min(Math.max(parseInt(limit ?? "100", 10) || 100, 1), 300);

    ref = ref.orderBy("createdAt", "desc").limit(n);

    const snap = await ref.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getById = async (id) => {
    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
};
