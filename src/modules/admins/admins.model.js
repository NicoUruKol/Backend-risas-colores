import admin from "firebase-admin";
import { db } from "../../config/firebase.js";

const COL = "admins";

export async function findAdminByEmail(email) {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return null;

    const snap = await db.collection(COL).where("email", "==", e).limit(1).get();
    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}

export async function getAdminById(adminId) {
    const id = String(adminId || "").trim();
    if (!id) return null;

    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() };
}

export async function listAdmins() {
    const snap = await db.collection(COL).orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAdminDoc({ email, passHash, role = "admin", active = true }) {
    const e = String(email || "").trim().toLowerCase();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const ref = db.collection(COL).doc();
    await ref.set({
        email: e,
        passHash,
        role,
        active: active !== false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
    });

    const created = await ref.get();
    return { id: created.id, ...created.data() };
}

export async function updateAdminPasswordById(adminId, passHash) {
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(COL).doc(String(adminId)).set(
        {
        passHash,
        updatedAt: now,
        },
        { merge: true }
    );
}

export async function updateLastLogin(adminId) {
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(COL).doc(String(adminId)).set(
        {
        lastLoginAt: now,
        updatedAt: now,
        },
        { merge: true }
    );
}

export async function setAdminActive(adminId, active) {
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(COL).doc(String(adminId)).set(
        {
        active: active === true,
        updatedAt: now,
        },
        { merge: true }
    );

    return getAdminById(adminId);
}

export async function countAdmins() {
    const snap = await db.collection(COL).limit(1).get();
    return snap.size;
}