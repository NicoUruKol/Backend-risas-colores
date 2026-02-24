import admin from "firebase-admin";
import { db } from "../../config/firebase.js";
import crypto from "crypto";

const COLL = "site_content";
const DOC = "google_reviews";

const MAX_ITEMS = 60;

function isValidHttpUrl(value) {
    if (!value) return true;
    try {
        const u = new URL(String(value));
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function normalizeItem(x = {}) {
    return {
        id: String(x?.id || "").trim(),
        authorName: String(x?.authorName || "").trim(),
        authorPhotoUrl: String(x?.authorPhotoUrl || "").trim(),
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

/* ===== Público ===== */
export async function getGoogleReviewsPublic() {
    const data = await readDoc();
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = raw.map(normalizeItem).filter((x) => x.id && x.active);

    return {
        googleReviewsUrl: String(data.googleReviewsUrl || "").trim(),
        items: sortItemsNewestFirst(items),
    };
}

/* ===== Admin ===== */
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

    // ✅ ahora toSave es JSON-safe
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

    const newItems = items.filter((x) => x.id !== reviewId);
    if (newItems.length === items.length) {
        const err = new Error("Reseña no encontrada.");
        err.statusCode = 404;
        throw err;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection(COLL).doc(DOC).set(
        {
        items: newItems,
        updatedAt: now,
        },
        { merge: true }
    );

    return { id: reviewId, deleted: true };
}