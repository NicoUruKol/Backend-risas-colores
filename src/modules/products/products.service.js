import { db } from "../../config/firebase.js";

const COL = "products";

/* ==============================
Helpers
============================== */
const makeError = (message, code = "VALIDATION_ERROR", details = []) => {
    const err = new Error(message);
    err.code = code;
    err.details = details;
    return err;
};

const normalizeId = (id) => (id ?? "").toString().trim();

const sanitizeVariantsPublic = (variants) => {
    const arr = Array.isArray(variants) ? variants : [];
    // ✅ solo talles con stock > 0
    return arr.filter((v) => Number(v?.stock ?? 0) > 0);
};

const STOCK_MOVEMENTS_COL = "stock_movements";

const validateAndNormalizeVariants = (variants) => {
    if (!Array.isArray(variants)) {
        throw makeError("variants debe ser un array", "VALIDATION_ERROR", [
        "variants debe ser un array",
        ]);
    }

    const normalized = variants.map((v, i) => {
        const size = (v?.size ?? "").toString().trim();
        const price = Number(v?.price);
        const stock = Number(v?.stock);

        const problems = [];
        if (!size) problems.push(`variants[${i}].size es obligatorio`);
        if (!Number.isFinite(price) || price <= 0)
        problems.push(`variants[${i}].price debe ser número > 0`);
        if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0)
        problems.push(`variants[${i}].stock debe ser entero >= 0`);

        if (problems.length) {
        throw makeError("variants inválidas", "VALIDATION_ERROR", problems);
        }

        return { ...v, size, price, stock };
    });

    const sizes = normalized.map((v) => v.size);
    const unique = new Set(sizes);

    if (unique.size !== sizes.length) {
        throw makeError("No se permiten talles duplicados en variants", "VALIDATION_ERROR", [
        "talles duplicados en variants",
        ]);
    }

    const hasU = unique.has("U");

    if (hasU) {
        if (unique.size !== 1 || normalized.length !== 1) {
        throw makeError('Si existe talle "U", debe ser el único variant', "VALIDATION_ERROR", [
            'variants debe ser exactamente [{ size:"U", price, stock }]',
        ]);
        }
    } else {
        const expected = ["1", "2", "3", "4", "5"];
        const ok = expected.length === unique.size && expected.every((s) => unique.has(s));

        if (!ok) {
        throw makeError('Las prendas deben tener talles exactamente "1" a "5"', "VALIDATION_ERROR", [
            'variants debe incluir talles "1","2","3","4","5" (sin faltantes ni extras)',
        ]);
        }
    }

    // ✅ ordenar (para que siempre venga prolijo)
    const order = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, U: 99 };
    normalized.sort((a, b) => (order[a.size] ?? 999) - (order[b.size] ?? 999));

    return normalized;
};

/* ==============================
List
- Por defecto: solo active=true
- Oculta talles sin stock
- Si un producto queda sin talles disponibles, no se devuelve
============================== */
export const list = async (filters = {}) => {
    const { q, type, active } = filters;

    let ref = db.collection(COL);

    // ✅ por defecto: solo activos
    if (active === undefined || active === "" || active === null) {
        ref = ref.where("active", "==", true);
    } else if (active === "true") {
        ref = ref.where("active", "==", true);
    } else if (active === "false") {
        ref = ref.where("active", "==", false);
    }

    if (type) ref = ref.where("type", "==", type);

    const snap = await ref.get();

    let data = snap.docs.map((d) => ({
        id: d.id, // docId = "010"
        ...d.data(),
    }));

    // búsqueda por texto (en memoria)
    if (q) {
        const needle = q.toLowerCase();
        data = data.filter(
        (p) =>
            (p.name || "").toLowerCase().includes(needle) ||
            (p.description || "").toLowerCase().includes(needle)
        );
    }

    // ✅ ocultar talles sin stock + filtrar productos sin variantes disponibles
    data = data
        .map((p) => ({
        ...p,
        variants: sanitizeVariantsPublic(p.variants),
        }))
        .filter((p) => {
        if (!Array.isArray(p.variants)) return true;
        return p.variants.length > 0;
        });

    return data;
};

/* ==============================
Get by docId
- Oculta talles sin stock
- Si queda sin talles disponibles, devuelve null (no disponible)
============================== */
export const getById = async (id) => {
    const docId = normalizeId(id);
    const doc = await db.collection(COL).doc(docId).get();
    if (!doc.exists) return null;

    const data = { id: doc.id, ...doc.data() };
    data.variants = sanitizeVariantsPublic(data.variants);

    if (Array.isArray(data.variants) && data.variants.length === 0) return null;

    return data;
};

/* ==============================
Create (docId manual)
- Requiere id (ej: "010")
- Bloquea duplicado
- Valida variants si vienen
============================== */
export const create = async (payload) => {
    const { id, ...rest } = payload || {};
    const docId = normalizeId(id);

    if (!docId) {
        throw makeError("id es obligatorio (se usa como docId, ej: '010')", "VALIDATION_ERROR", [
        "id es obligatorio",
        ]);
    }

    if ("variants" in rest) {
        rest.variants = validateAndNormalizeVariants(rest.variants);
    }

    const ref = db.collection(COL).doc(docId);
    const exists = await ref.get();

    if (exists.exists) {
        throw makeError("Ya existe un producto con ese id", "DUPLICATE_ID", [docId]);
    }

    await ref.set(rest, { merge: false });
    return { id: docId, ...rest };
};

/* ==============================
Update
- No permite cambiar id
- Valida variants si vienen
============================== */
export const update = async (id, patch) => {
    const docId = normalizeId(id);
    const ref = db.collection(COL).doc(docId);

    const doc = await ref.get();
    if (!doc.exists) return null;

    if (patch?.id && normalizeId(patch.id) !== docId) {
        throw makeError("No se permite cambiar el id del producto", "VALIDATION_ERROR", [
        "id no es editable",
        ]);
    }

    const { id: _ignore, ...rest } = patch || {};

      // 🚫 Bloquear cambios de stock por PUT
    if ("variants" in rest) {
        const incoming = Array.isArray(rest.variants) ? rest.variants : null;
    if (!incoming) {
        throw makeError("variants debe ser un array", "VALIDATION_ERROR", ["variants debe ser un array"]);
    }

    const current = doc.data()?.variants;
    const currentArr = Array.isArray(current) ? current : [];

    const curMap = new Map(currentArr.map((v) => [String(v?.size ?? "").trim(), Number(v?.stock ?? 0)]));
    const problems = [];

    for (let i = 0; i < incoming.length; i++) {
        const size = String(incoming[i]?.size ?? "").trim();
        if (!size) continue;

        const nextStock = incoming[i]?.stock;

        // si viene stock en el payload, lo comparamos con el actual
        if (nextStock !== undefined) {
            const prevStock = curMap.get(size);
            if (prevStock === undefined) {
            problems.push(`No se puede setear stock para talle inexistente (${size}) desde PUT`);
            } else if (Number(nextStock) !== Number(prevStock)) {
            problems.push(`No se permite modificar stock por PUT (talle ${size}). Usá el endpoint de stock.`);
            }
        }
        }

        if (problems.length) {
        throw makeError("No se permite modificar stock por PUT", "VALIDATION_ERROR", problems);
        }
    }

    if ("variants" in rest) {
        rest.variants = validateAndNormalizeVariants(rest.variants);
    }

    await ref.set(rest, { merge: true });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
};

/* ==============================
Remove = Soft delete
(active:false)
============================== */
export const remove = async (id) => {
    const docId = normalizeId(id);
    const ref = db.collection(COL).doc(docId);

    const doc = await ref.get();
    if (!doc.exists) return null;

    await ref.update({ active: false });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
};

export const adjustStock = async (id, payload, actor = "admin") => {
    const docId = normalizeId(id);

    const size = (payload?.size ?? "").toString().trim();
    const delta = Number(payload?.delta);

    if (!size) {
        throw makeError("size es obligatorio", "VALIDATION_ERROR", ["size es obligatorio"]);
    }
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
        throw makeError("delta debe ser entero distinto de 0", "VALIDATION_ERROR", [
        "delta debe ser entero distinto de 0",
        ]);
    }

    const productRef = db.collection(COL).doc(docId);

    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(productRef);
        if (!snap.exists) return null;

        const product = snap.data();
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const vIndex = variants.findIndex((v) => (v?.size ?? "").toString().trim() === size);

        if (vIndex === -1) {
        throw makeError("Talle no encontrado", "VALIDATION_ERROR", [`size ${size} no existe en el producto`]);
        }

        const stockBefore = Number(variants[vIndex]?.stock ?? 0);
        const stockAfter = stockBefore + delta;

        if (!Number.isInteger(stockAfter) || stockAfter < 0) {
        throw makeError("Stock insuficiente para aplicar el ajuste", "VALIDATION_ERROR", [
            `stock actual: ${stockBefore}, delta: ${delta}`,
        ]);
        }

        const updatedVariants = variants.map((v, i) => {
        if (i !== vIndex) return v;
        return { ...v, stock: stockAfter };
        });

        tx.update(productRef, { variants: updatedVariants });

        const movRef = db.collection(STOCK_MOVEMENTS_COL).doc();
        tx.set(movRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "admin_adjust",
        orderId: null,
        productCode: docId,
        size,
        qtyDelta: delta,
        stockBefore,
        stockAfter,
        actor,
        reason: (payload?.reason ?? "").toString().trim() || null,
        });

        const after = await tx.get(productRef);
        return { id: after.id, ...after.data() };
    });

    return result;
};
