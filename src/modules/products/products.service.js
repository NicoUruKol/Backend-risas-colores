const ALLOWED_TYPES = new Set(["remera", "buzo", "pantalon", "mochila"]);
const SIZES_5 = ["2", "4", "6", "8", "10"];

// 🔥 IMPORTANTE: ahora es let porque vamos a crear/editar/borrar en memoria
let PRODUCTS = [
    {
        id: "remera",
        type: "remera",
        name: "Remera del Jardín",
        description: "Remera oficial Risas y Colores.",
        avatar: "https://example.com/remera.webp",
        active: true,
        variants: [
        { size: "2", price: 14900, stock: 10 },
        { size: "4", price: 14900, stock: 10 },
        { size: "6", price: 15900, stock: 10 },
        { size: "8", price: 15900, stock: 10 },
        { size: "10", price: 16900, stock: 10 },
        ],
    },
    {
        id: "buzo",
        type: "buzo",
        name: "Buzo del Jardín",
        description: "Buzo azul #4a90c2 con logo.",
        avatar: "https://example.com/buzo.webp",
        active: true,
        variants: [
        { size: "2", price: 24900, stock: 10 },
        { size: "4", price: 24900, stock: 10 },
        { size: "6", price: 25900, stock: 10 },
        { size: "8", price: 25900, stock: 10 },
        { size: "10", price: 26900, stock: 10 },
        ],
    },
    {
        id: "pantalon",
        type: "pantalon",
        name: "Pantalón Jogging",
        description: "Pantalón jogging largo azul #4a90c2.",
        avatar: "https://example.com/pantalon.webp",
        active: true,
        variants: [
        { size: "2", price: 19900, stock: 10 },
        { size: "4", price: 19900, stock: 10 },
        { size: "6", price: 20900, stock: 10 },
        { size: "8", price: 20900, stock: 10 },
        { size: "10", price: 21900, stock: 10 },
        ],
    },
    {
        id: "mochila",
        type: "mochila",
        name: "Mochila del Jardín",
        description: "Mochila azul con logo. Talle único.",
        avatar: "https://example.com/mochila.webp",
        active: true,
        variants: [{ size: "U", price: 23900, stock: 10 }],
    },
    ];

    const isValidUrl = (value) => {
    try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
    };

    const makeValidationError = (message, details = []) => {
    const err = new Error(message);
    err.code = "VALIDATION_ERROR";
    err.details = details;
    return err;
    };

    const validateVariant = (v, idx) => {
    const errors = [];

    if (!v || typeof v !== "object") {
        errors.push(`variants[${idx}] debe ser un objeto`);
        return errors;
    }

    if (typeof v.size !== "string" || !v.size.trim()) {
        errors.push(`variants[${idx}].size es obligatorio`);
    }

    if (typeof v.price !== "number" || Number.isNaN(v.price) || v.price <= 0) {
        errors.push(`variants[${idx}].price debe ser número > 0`);
    }

    if (!Number.isInteger(v.stock) || v.stock < 0) {
        errors.push(`variants[${idx}].stock debe ser entero >= 0`);
    }

    return errors;
    };

    const validateProduct = (p, { partial = false } = {}) => {
    const errors = [];

    const checkRequired = (cond, msg) => {
        if (!cond) errors.push(msg);
    };

    if (!partial || p.id !== undefined) {
        checkRequired(typeof p.id === "string" && p.id.trim(), "id es obligatorio");
    }

    if (!partial || p.type !== undefined) {
        checkRequired(ALLOWED_TYPES.has(p.type), "type inválido (remera|buzo|pantalon|mochila)");
    }

    if (!partial || p.name !== undefined) {
        checkRequired(typeof p.name === "string" && p.name.trim(), "name es obligatorio");
    }

    if (!partial || p.description !== undefined) {
        checkRequired(typeof p.description === "string" && p.description.trim(), "description es obligatorio");
    }

    if (!partial || p.avatar !== undefined) {
        checkRequired(typeof p.avatar === "string" && isValidUrl(p.avatar), "avatar debe ser URL válida");
    }

    if (!partial || p.active !== undefined) {
        checkRequired(typeof p.active === "boolean", "active debe ser boolean");
    }

    if (!partial || p.variants !== undefined) {
        checkRequired(Array.isArray(p.variants) && p.variants.length > 0, "variants debe ser un array con al menos 1 item");

        if (Array.isArray(p.variants)) {
        p.variants.forEach((v, idx) => errors.push(...validateVariant(v, idx)));

        // reglas de talles
        const sizes = p.variants.map((v) => v.size);
        const unique = new Set(sizes);

        if (unique.size !== sizes.length) {
            errors.push("variants tiene talles repetidos");
        }

        if (p.type === "mochila") {
            if (!(sizes.length === 1 && sizes[0] === "U")) {
            errors.push("mochila debe tener un solo talle: 'U'");
            }
        } else if (ALLOWED_TYPES.has(p.type) && p.type !== "mochila") {
            // debe tener exactamente los 5 talles definidos
            const ok =
            sizes.length === 5 &&
            SIZES_5.every((s) => unique.has(s));

            if (!ok) {
            errors.push(`para ${p.type} variants debe contener exactamente estos talles: ${SIZES_5.join(", ")}`);
            }
        }
        }
    }

    if (errors.length) throw makeValidationError("Validación fallida", errors);
    };

    export const list = async (filters) => {
    const { q, type, active } = filters;

    let result = [...PRODUCTS];

    if (q) {
        const needle = q.toLowerCase();
        result = result.filter(
        (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.description.toLowerCase().includes(needle)
        );
    }

    if (type) result = result.filter((p) => p.type === type);

    if (active === "true") result = result.filter((p) => p.active === true);
    if (active === "false") result = result.filter((p) => p.active === false);

    return result;
    };

    export const getById = async (id) => {
    return PRODUCTS.find((p) => p.id === id) || null;
    };

    export const create = async (payload) => {
    validateProduct(payload);

    const exists = PRODUCTS.some((p) => p.id === payload.id);
    if (exists) {
        const err = new Error("Ya existe un producto con ese id");
        err.code = "DUPLICATE_ID";
        throw err;
    }

    const newProduct = {
        id: payload.id,
        type: payload.type,
        name: payload.name,
        description: payload.description,
        avatar: payload.avatar,
        active: payload.active ?? true,
        variants: payload.variants,
    };

    PRODUCTS = [...PRODUCTS, newProduct];
    return newProduct;
    };

    export const update = async (id, patch) => {
    const current = PRODUCTS.find((p) => p.id === id);
    if (!current) return null;

    // No permitimos cambiar id por PATCH/PUT para simplificar
    if (patch.id && patch.id !== id) {
        throw makeValidationError("No se permite cambiar el id del producto", ["id no es editable"]);
    }

    const merged = { ...current, ...patch };

    // Validación completa del resultado final
    validateProduct(merged);

    PRODUCTS = PRODUCTS.map((p) => (p.id === id ? merged : p));
    return merged;
    };

    export const remove = async (id) => {
    const current = PRODUCTS.find((p) => p.id === id);
    if (!current) return null;

    PRODUCTS = PRODUCTS.filter((p) => p.id !== id);
    return current;
};
