import admin from "firebase-admin";
import { db } from "../../config/firebase.js";

const COLL = "site_content";

const MAX_HERO = 5;

function normalizeItems(items = []) {
    const arr = Array.isArray(items) ? items : [];

    return arr
        .map((it, idx) => ({
        public_id: String(it?.public_id || "").trim(),
        url: String(it?.url || "").trim(),
        title: String(it?.title || "").trim(),
        subtitle: String(it?.subtitle || "").trim(),
        active: it?.active !== false,
        order: Number.isFinite(Number(it?.order)) ? Number(it.order) : idx + 1,
        alt: it?.alt ? String(it.alt) : "",
        }))
        .filter((it) => it.public_id && it.url)
        .sort((a, b) => a.order - b.order);
}

function onlyActiveSorted(items = []) {
    const normalized = normalizeItems(items);
    return normalized.filter((it) => it.active).sort((a, b) => a.order - b.order);
}

export async function getHomeHeroPublic() {
    const snap = await db.collection(COLL).doc("home_hero").get();
    const data = snap.exists ? snap.data() : null;

    if (!data) return { items: [] };

    return {
        items: onlyActiveSorted(data.items || []).slice(0, MAX_HERO),
    };
}

export async function getElJardinGalleryPublic() {
    const snap = await db.collection(COLL).doc("el_jardin_gallery").get();
    const data = snap.exists ? snap.data() : null;

    if (!data) return { items: [] };

    return { items: onlyActiveSorted(data.items || []) };
}

export async function upsertHomeHeroAdmin(payload) {
    const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
    const items = normalizeItems(itemsRaw).slice(0, MAX_HERO);

    if (items.length > MAX_HERO) {
        const err = new Error(`Máximo ${MAX_HERO} slides en el Hero.`);
        err.statusCode = 400;
        throw err;
    }

    // Regla: si está active, debe tener title + subtitle
    for (const it of items) {
        if (it.active) {
        if (!it.title) {
            const err = new Error("Falta título en un slide activo.");
            err.statusCode = 400;
            throw err;
        }
        if (!it.subtitle) {
            const err = new Error("Falta subtítulo en un slide activo.");
            err.statusCode = 400;
            throw err;
        }
        }
    }

    await db.collection(COLL).doc("home_hero").set(
        {
        items,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return { items };
}

export async function upsertElJardinGalleryAdmin(payload) {
    const items = normalizeItems(payload?.items || []);

    await db.collection(COLL).doc("el_jardin_gallery").set(
        {
        items,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return { items };
}