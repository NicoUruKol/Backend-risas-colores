import bcrypt from "bcryptjs";

/* ==============================
Modelos
============================== */
import {
    createAdminDoc,
    findAdminByEmail,
    getAdminById,
    listAdmins,
    setAdminActive,
    updateAdminPasswordById,
} from "./admins.model.js";

/* ==============================
Listar admins
============================== */
export async function listAdminsSafe() {
    const rows = await listAdmins();

    return rows.map((a) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        active: a.active !== false,
        createdAt: a.createdAt || null,
        lastLoginAt: a.lastLoginAt || null,
    }));
}

/* ==============================
Crear admin
============================== */
export async function createAdmin({ email, password, role }) {
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    if (!e || !p) {
        const err = new Error("email y password son obligatorios");
        err.statusCode = 400;
        throw err;
    }

    if (p.length < 6) {
        const err = new Error("Password mínimo 6 caracteres");
        err.statusCode = 400;
        throw err;
    }

    const exists = await findAdminByEmail(e);
    if (exists) {
        const err = new Error("Ya existe un admin con ese email");
        err.statusCode = 409;
        throw err;
    }

    const passHash = await bcrypt.hash(p, 10);

    const created = await createAdminDoc({
        email: e,
        passHash,
        role: role === "superadmin" ? "superadmin" : "admin",
        active: true,
    });

    return {
        id: created.id,
        email: created.email,
        role: created.role,
        active: created.active !== false,
    };
}

/* ==============================
Cambiar mi password
============================== */
export async function changeMyPassword({ adminId, currentPassword, newPassword }) {
    const cur = String(currentPassword || "");
    const next = String(newPassword || "");

    if (!cur || !next) {
        const err = new Error("Faltan datos");
        err.statusCode = 400;
        throw err;
    }

    if (next.length < 6) {
        const err = new Error("Password mínimo 6 caracteres");
        err.statusCode = 400;
        throw err;
    }

    const admin = await getAdminById(adminId);
    if (!admin) {
        const err = new Error("Admin no encontrado");
        err.statusCode = 404;
        throw err;
    }

    const ok = await bcrypt.compare(cur, String(admin.passHash || ""));
    if (!ok) {
        const err = new Error("Password actual incorrecta");
        err.statusCode = 401;
        throw err;
    }

    const passHash = await bcrypt.hash(next, 10);
    await updateAdminPasswordById(adminId, passHash);

    return { ok: true };
}

/* ==============================
Desactivar admin
============================== */
export async function deactivateAdmin({ targetAdminId, actorAdminId }) {
    const targetId = String(targetAdminId || "").trim();
    const actorId = String(actorAdminId || "").trim();

    if (!targetId) {
        const err = new Error("Falta id del admin");
        err.statusCode = 400;
        throw err;
    }

    if (targetId === actorId) {
        const err = new Error("No podés desactivarte a vos mismo");
        err.statusCode = 400;
        throw err;
    }

    const target = await getAdminById(targetId);
    if (!target) {
        const err = new Error("Admin no encontrado");
        err.statusCode = 404;
        throw err;
    }

    const updated = await setAdminActive(targetId, false);

    return {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        active: updated.active !== false,
    };
}

/* ==============================
Reactivar admin
============================== */
export async function reactivateAdmin({ targetAdminId }) {
    const targetId = String(targetAdminId || "").trim();

    if (!targetId) {
        const err = new Error("Falta id del admin");
        err.statusCode = 400;
        throw err;
    }

    const target = await getAdminById(targetId);
    if (!target) {
        const err = new Error("Admin no encontrado");
        err.statusCode = 404;
        throw err;
    }

    const updated = await setAdminActive(targetId, true);

    return {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        active: updated.active !== false,
    };
}