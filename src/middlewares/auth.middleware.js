import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ ok: false, message: "Falta token" });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (!payload?.role || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ ok: false, message: "Acceso denegado" });
        }

        req.admin = payload; // {role,email,adminId,...}
        next();
    } catch {
        return res.status(401).json({ ok: false, message: "Token inválido o vencido" });
    }
}

export function requireSuperAdmin(req, res, next) {
    requireAdmin(req, res, () => {
        if (req.admin?.role !== "superadmin") {
        return res.status(403).json({ ok: false, message: "Solo superadmin" });
        }
        next();
    });
}

