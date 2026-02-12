import admin from "firebase-admin";
import { db } from "../../config/firebase.js";

const COLL = "site_content";

function normalizeItems(items = []) {
    const arr = Array.isArray(items) ? items : [];

    return arr
        .map((it, idx) => ({
        public_id: String(it?.public_id || "").trim(),
        url: String(it?.url || "").trim(),
        active: it?.active !== false,
        order: Number.isFinite(Number(it?.order)) ? Number(it.order) : idx + 1,
        alt: it?.alt ? String(it.alt) : "",
    }))
    .filter((it) => it.public_id && it.url)
    .sort((a, b) => a.order - b.order);
}

function onlyActiveSorted(items = []) {
    return normalizeItems(items).filter((it) => it.active);
}

export async function getHomeHeroPublic() {
    const snap = await db.collection(COLL).doc("home_hero").get();
    const data = snap.exists ? snap.data() : null;

    if (!data) {
        return { title: "", subtitle: "", items: [] };
    }

    return {
        title: data.title || "",
        subtitle: data.subtitle || "",
        items: onlyActiveSorted(data.items || []),
    };
}

export async function getElJardinGalleryPublic() {
    const snap = await db.collection(COLL).doc("el_jardin_gallery").get();
    const data = snap.exists ? snap.data() : null;

    if (!data) return { items: [] };

    return { items: onlyActiveSorted(data.items || []) };
}

export async function upsertHomeHeroAdmin(payload) {
    const title = String(payload?.title || "").trim();
    const subtitle = String(payload?.subtitle || "").trim();
    const items = normalizeItems(payload?.items || []);

    await db.collection(COLL).doc("home_hero").set(
        {
        title,
        subtitle,
        items,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    return { title, subtitle, items };
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
