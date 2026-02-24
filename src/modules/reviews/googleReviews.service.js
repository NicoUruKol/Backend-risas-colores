import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import crypto from "crypto";
import axios from "axios";
import cloudinary from "../../config/cloudinary.js";

/* =========================
    Config
========================= */
const COLL = "site_content";
const DOC = "google_reviews";
const MAX_ITEMS = 60;

const CLOUD_FOLDER = "risas-colores/google-reviews";
const CLOUD_TAG = "google-reviews";
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/* =========================
    Helpers
========================= */
function isValidHttpUrl(value) {
    if (!value) return true;
    try {
        const u = new URL(String(value));
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function isOurCloudinaryUrl(url = "") {
    return typeof url === "string" && url.includes("res.cloudinary.com/");
}

function canMirror(url = "") {
    return isValidHttpUrl(url) && !isOurCloudinaryUrl(url);
}

async function safeDestroyCloudinary(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
    } catch (e) {
        console.warn("Cloudinary destroy failed:", e?.message || e);
    }
}

async function fetchImageAsDataUri(imageUrl) {
    const resp = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 12000,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        validateStatus: (s) => s >= 200 && s < 300,
        headers: {
        "User-Agent": "RisasYColoresBot/1.0",
        },
    });

    const mime = String(resp.headers?.["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (!ALLOWED_MIME.has(mime)) {
        const err = new Error(`Tipo de imagen no permitido: ${mime || "desconocido"}`);
        err.statusCode = 400;
        throw err;
    }

    const bytes = Buffer.byteLength(resp.data);
    if (bytes > MAX_BYTES) {
        const err = new Error(`Imagen demasiado grande (max ${MAX_BYTES / 1024 / 1024}MB).`);
        err.statusCode = 400;
        throw err;
    }

    const base64 = Buffer.from(resp.data).toString("base64");
    return { dataUri: `data:${mime};base64,${base64}` };
}

async function mirrorImageToCloudinary(imageUrl, { reviewId } = {}) {
    if (!imageUrl) return null;
    if (!canMirror(imageUrl)) return null;

    const { dataUri } = await fetchImageAsDataUri(imageUrl);

    const hash = crypto.createHash("sha1").update(String(imageUrl)).digest("hex").slice(0, 12);
    const publicId = reviewId ? `review_${reviewId}_${hash}` : `review_${hash}`;

    const upload = await cloudinary.uploader.upload(dataUri, {
        folder: CLOUD_FOLDER,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
        tags: [CLOUD_TAG, "mirror"],
        transformation: [
        { width: 120, height: 120, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
        ],
    });

    return { url: upload.secure_url, public_id: upload.public_id };
    }

    function normalizeItem(x = {}) {
    return {
        id: String(x?.id || "").trim(),
        authorName: String(x?.authorName || "").trim(),
        authorPhotoUrl: String(x?.authorPhotoUrl || "").trim(),
        authorPhotoPublicId: String(x?.authorPhotoPublicId || "").trim(),
        rating: Number(x?.rating),
        relativeTime: String(x?.relativeTime || "").trim(),
        text: String(x?.text || "").trim(),
        active: x?.active !== false,
        createdAt: x?.createdAt ?? null,
        updatedAt: x?.updatedAt ?? null,
        source: "Google",
    };
    }

    function validateForSave(item) {
    if (!item.authorName) {
        const err = new Error("Falta authorName.");
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isFinite(item.rating) || item.rating < 1 || item.rating > 5) {
        const err = new Error("Rating inválido (1 a 5).");
        err.statusCode = 400;
        throw err;
    }
    if (!item.relativeTime) {
        const err = new Error("Falta relativeTime (ej: 'Hace una semana').");
        err.statusCode = 400;
        throw err;
    }
    if (!item.text || item.text.length < 20) {
        const err = new Error("El texto debe tener al menos 20 caracteres.");
        err.statusCode = 400;
        throw err;
    }
    if (!isValidHttpUrl(item.authorPhotoUrl)) {
        const err = new Error("authorPhotoUrl inválida (http/https).");
        err.statusCode = 400;
        throw err;
    }
}

async function readDoc() {
    const snap = await db.collection(COLL).doc(DOC).get();
    const data = snap.exists ? snap.data() : null;
    return data || { items: [], googleReviewsUrl: "" };
}

function sortItemsNewestFirst(items = []) {
    return [...items].sort((a, b) => {
        const ta = a?.createdAt?._seconds ? a.createdAt._seconds : 0;
        const tb = b?.createdAt?._seconds ? b.createdAt._seconds : 0;
        return tb - ta;
    });
}

/* =========================
    Público
========================= */
export async function getGoogleReviewsPublic() {
    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id && x.active);

    return {
        googleReviewsUrl: String(data.googleReviewsUrl || "").trim(),
        items: sortItemsNewestFirst(items),
    };
}

/* =========================
    Admin
========================= */
export async function getGoogleReviewsAdmin() {
    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id);

    return {
        googleReviewsUrl: String(data.googleReviewsUrl || "").trim(),
        items: sortItemsNewestFirst(items),
    };
}

export async function setGoogleReviewsUrlAdmin(googleReviewsUrl) {
    const url = String(googleReviewsUrl || "").trim();

    if (url && !isValidHttpUrl(url)) {
        const err = new Error("googleReviewsUrl inválida (http/https).");
        err.statusCode = 400;
        throw err;
    }

    const now = admin.firestore.Timestamp.now();

    await db.collection(COLL).doc(DOC).set(
        {
        googleReviewsUrl: url,
        updatedAt: now,
        },
        { merge: true }
    );

    return { googleReviewsUrl: url, updatedAt: now };
}

export async function createGoogleReviewAdmin(payload) {
    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id);

    if (items.length >= MAX_ITEMS) {
        const err = new Error(`Máximo ${MAX_ITEMS} reseñas.`);
        err.statusCode = 400;
        throw err;
    }

    const it = normalizeItem(payload);

    it.id = crypto.randomUUID();
    it.source = "Google";
    it.active = it.active !== false;

    validateForSave(it);

    if (it.authorPhotoUrl && canMirror(it.authorPhotoUrl)) {
        const mirrored = await mirrorImageToCloudinary(it.authorPhotoUrl, { reviewId: it.id });
        if (mirrored?.url) {
        it.authorPhotoUrl = mirrored.url;
        it.authorPhotoPublicId = mirrored.public_id || "";
        }
    }

    const now = admin.firestore.Timestamp.now();

    const toSave = {
        ...it,
        createdAt: now,
        updatedAt: now,
    };

    await db.collection(COLL).doc(DOC).set(
        {
        items: [...items, toSave],
        updatedAt: now,
        },
        { merge: true }
    );

    return { item: toSave };
}

export async function updateGoogleReviewAdmin(id, payload) {
    const reviewId = String(id || "").trim();
    if (!reviewId) {
        const err = new Error("Falta id.");
        err.statusCode = 400;
        throw err;
    }

    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id);

    const idx = items.findIndex((x) => x.id === reviewId);
    if (idx < 0) {
        const err = new Error("Reseña no encontrada.");
        err.statusCode = 404;
        throw err;
    }

    const current = items[idx];
    const next = normalizeItem({ ...current, ...payload, id: reviewId });
    next.source = "Google";

    const incomingUrl = typeof payload?.authorPhotoUrl !== "undefined" ? String(payload.authorPhotoUrl || "").trim() : null;
    const photoChanged = incomingUrl !== null && incomingUrl !== current.authorPhotoUrl;

    if (photoChanged) {
        if (current.authorPhotoPublicId) {
        await safeDestroyCloudinary(current.authorPhotoPublicId);
        }

        if (incomingUrl && canMirror(incomingUrl)) {
        const mirrored = await mirrorImageToCloudinary(incomingUrl, { reviewId });
        if (mirrored?.url) {
            next.authorPhotoUrl = mirrored.url;
            next.authorPhotoPublicId = mirrored.public_id || "";
        } else {
            next.authorPhotoUrl = incomingUrl;
            next.authorPhotoPublicId = "";
        }
        } else {
        next.authorPhotoUrl = incomingUrl || "";
        next.authorPhotoPublicId = "";
        }
    }

    validateForSave(next);

    const now = admin.firestore.Timestamp.now();

    const updated = {
        ...current,
        ...next,
        updatedAt: now,
    };

    const newItems = [...items];
    newItems[idx] = updated;

    await db.collection(COLL).doc(DOC).set(
        {
        items: newItems,
        updatedAt: now,
        },
        { merge: true }
    );

    return { item: updated };
}

export async function setGoogleReviewActiveAdmin(id, active) {
    const reviewId = String(id || "").trim();
    if (!reviewId) {
        const err = new Error("Falta id.");
        err.statusCode = 400;
        throw err;
    }

    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id);

    const idx = items.findIndex((x) => x.id === reviewId);
    if (idx < 0) {
        const err = new Error("Reseña no encontrada.");
        err.statusCode = 404;
        throw err;
    }

    const now = admin.firestore.Timestamp.now();

    const newItems = [...items];
    newItems[idx] = { ...items[idx], active: !!active, updatedAt: now };

    await db.collection(COLL).doc(DOC).set(
        {
        items: newItems,
        updatedAt: now,
        },
        { merge: true }
    );

    return { id: reviewId, active: !!active, updatedAt: now };
}

export async function deleteGoogleReviewAdmin(id) {
    const reviewId = String(id || "").trim();
    if (!reviewId) {
        const err = new Error("Falta id.");
        err.statusCode = 400;
        throw err;
    }

    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id);

    const target = items.find((x) => x.id === reviewId);

    const newItems = items.filter((x) => x.id !== reviewId);
    if (newItems.length === items.length) {
        const err = new Error("Reseña no encontrada.");
        err.statusCode = 404;
        throw err;
    }

    if (target?.authorPhotoPublicId) {
        await safeDestroyCloudinary(target.authorPhotoPublicId);
    }

    const now = admin.firestore.Timestamp.now();

    await db.collection(COLL).doc(DOC).set(
        {
        items: newItems,
        updatedAt: now,
        },
        { merge: true }
    );

    return { id: reviewId, deleted: true };
}