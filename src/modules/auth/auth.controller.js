import { loginWithEmailPassword } from "./auth.service.js";

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const { token } = await loginWithEmailPassword({ email, password });
        return res.status(200).json({ ok: true, token });
    } catch (e) {
        const code = e?.statusCode || 500;
        return res.status(code).json({ ok: false, message: e?.message || "Error interno" });
    }
};
