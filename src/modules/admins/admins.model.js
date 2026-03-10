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

export async function listAdmins() {
    const snap = await db.collection(COL).orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAdminDoc({ email, passHash, role = "admin", active = true }) {
    const e = String(email || "").trim().toLowerCase();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const ref = db.collection(COL).doc(); // id random
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
    await db.collection(COL).doc(adminId).set(
        { passHash, updatedAt: now },
        { merge: true }
    );
}

export async function updateLastLogin(adminId) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection(COL).doc(adminId).set(
        { lastLoginAt: now, updatedAt: now },
        { merge: true }
    );
}

export async function countAdmins() {
    const snap = await db.collection(COL).limit(1).get();
    return snap.size; // 0 o 1 (por el limit)
}