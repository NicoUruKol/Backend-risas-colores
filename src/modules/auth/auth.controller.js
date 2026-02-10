import jwt from "jsonwebtoken";

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ ok: false, message: "email y password son obligatorios" });
    }

    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ ok: false, message: "Credenciales inválidas" });
    }

    const token = jwt.sign(
        { role: "admin", email },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
    );

    return res.status(200).json({ ok: true, token });
};
