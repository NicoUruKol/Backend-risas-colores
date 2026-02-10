import { db } from "../../config/firebase.js";

const COL = "products";

export const list = async (filters) => {
    const { q, type, active } = filters;

    let ref = db.collection(COL);

    // filtros simples (Firestore permite igualdad, no contains)
    if (type) ref = ref.where("type", "==", type);

    if (active === "true") ref = ref.where("active", "==", true);
    if (active === "false") ref = ref.where("active", "==", false);

    const snap = await ref.get();

    let data = snap.docs.map((d) => ({
        id: d.id, // docId como id
        ...d.data(),
    }));

    // búsqueda por texto: lo hacemos en memoria (para MVP)
    if (q) {
        const needle = q.toLowerCase();
        data = data.filter(
        (p) =>
            (p.name || "").toLowerCase().includes(needle) ||
            (p.description || "").toLowerCase().includes(needle)
        );
    }

    return data;
};

export const getById = async (id) => {
    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() };
};

export const create = async (payload) => {
    // por ahora: asumimos que payload ya viene válido (podemos enchufar validación después)
    const { id, ...rest } = payload;

    if (!id) {
        const err = new Error("id es obligatorio (se usa como docId)");
        err.code = "VALIDATION_ERROR";
        err.details = ["id es obligatorio"];
        throw err;
    }

    const ref = db.collection(COL).doc(id);
    const exists = await ref.get();
    if (exists.exists) {
        const err = new Error("Ya existe un producto con ese id");
        err.code = "DUPLICATE_ID";
        throw err;
    }

    await ref.set(rest, { merge: false });
    return { id, ...rest };
    };

    export const update = async (id, patch) => {
    const ref = db.collection(COL).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    // No permitir cambiar id
    if (patch.id && patch.id !== id) {
        const err = new Error("No se permite cambiar el id del producto");
        err.code = "VALIDATION_ERROR";
        err.details = ["id no es editable"];
        throw err;
    }

    const { id: _ignore, ...rest } = patch;

    await ref.set(rest, { merge: true });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
};

export const remove = async (id) => {
    const ref = db.collection(COL).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const data = { id: doc.id, ...doc.data() };
    await ref.delete();
    return data;
};
