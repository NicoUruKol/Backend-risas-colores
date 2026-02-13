import jwt from "jsonwebtoken";

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
        return res.status(500).json({
            ok: false,
            message: "Faltan variables de entorno (ADMIN_EMAIL, ADMIN_PASSWORD o JWT_SECRET)",
        });
        }

        if (!email || !password) {
        return res.status(400).json({ ok: false, message: "email y password son obligatorios" });
        }

        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ ok: false, message: "Credenciales inválidas" });
        }

        const token = jwt.sign({ role: "admin", email }, process.env.JWT_SECRET, { expiresIn: "2h" });

        return res.status(200).json({ ok: true, token });
    } catch (e) {
        return res.status(500).json({ ok: false, message: e?.message || "Error interno" });
    }
};

