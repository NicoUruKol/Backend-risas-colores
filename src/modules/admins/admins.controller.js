import {
    createAdmin,
    listAdminsSafe,
    changeMyPassword,
    deactivateAdmin,
} from "./admins.service.js";

export const listAdmins = async (req, res, next) => {
    try {
        const data = await listAdminsSafe();
        return res.json({ ok: true, data });
    } catch (e) {
        next(e);
    }
};

export const postAdmin = async (req, res, next) => {
    try {
        const { email, password, role } = req.body || {};
        const data = await createAdmin({ email, password, role });
        return res.status(201).json({ ok: true, data });
    } catch (e) {
        const code = e?.statusCode || 500;
        return res.status(code).json({ ok: false, message: e?.message || "Error interno" });
    }
};

export const patchMyPassword = async (req, res, next) => {
    try {
        const adminId = req.admin?.adminId;
        const { currentPassword, newPassword } = req.body || {};

        await changeMyPassword({ adminId, currentPassword, newPassword });
        return res.json({ ok: true });
    } catch (e) {
        const code = e?.statusCode || 500;
        return res.status(code).json({ ok: false, message: e?.message || "Error interno" });
    }
};

export const patchDeactivateAdmin = async (req, res, next) => {
    try {
        const targetAdminId = req.params?.id;
        const actorAdminId = req.admin?.adminId;

        const data = await deactivateAdmin({ targetAdminId, actorAdminId });
        return res.json({ ok: true, data });
    } catch (e) {
        const code = e?.statusCode || 500;
        return res.status(code).json({ ok: false, message: e?.message || "Error interno" });
    }
};