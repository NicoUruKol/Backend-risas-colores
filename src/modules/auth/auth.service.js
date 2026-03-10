import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { countAdmins, createAdminDoc, findAdminByEmail, updateLastLogin } from "../admins/admins.model.js";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

export async function ensureInitialAdmin() {
    const hasAny = (await countAdmins()) > 0;
    if (hasAny) return;

    const email = process.env.ADMIN_EMAIL;
    const pass = process.env.ADMIN_PASSWORD;
    const role = process.env.ADMIN_INIT_ROLE || "superadmin";

    if (!email || !pass || !process.env.JWT_SECRET) {
        throw new Error("Faltan env para seed inicial (ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET).");
    }

    const passHash = await bcrypt.hash(String(pass), 10);

    await createAdminDoc({
        email,
        passHash,
        role,
        active: true,
    });

    console.log("✅ Admin inicial creado desde .env:", email);
}

export async function loginWithEmailPassword({ email, password }) {
    if (!process.env.JWT_SECRET) {
        const e = new Error("Falta JWT_SECRET");
        e.statusCode = 500;
        throw e;
    }

    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    if (!e || !p) {
        const err = new Error("email y password son obligatorios");
        err.statusCode = 400;
        throw err;
    }

    const admin = await findAdminByEmail(e);

    // Si no existe admin, permito login SOLO si coincide con ENV y seed (por si se borró DB).
    if (!admin) {
        const envEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const envPass = String(process.env.ADMIN_PASSWORD || "");
        if (envEmail && envPass && e === envEmail && p === envPass) {
        // creo admin inicial on-demand
        const passHash = await bcrypt.hash(envPass, 10);
        const created = await createAdminDoc({
            email: envEmail,
            passHash,
            role: process.env.ADMIN_INIT_ROLE || "superadmin",
            active: true,
        });

        const token = jwt.sign(
            { role: created.role, email: created.email, adminId: created.id },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return { token };
        }

        const err = new Error("Credenciales inválidas");
        err.statusCode = 401;
        throw err;
    }

    if (admin.active === false) {
        const err = new Error("Admin inactivo");
        err.statusCode = 403;
        throw err;
    }

    const ok = await bcrypt.compare(p, String(admin.passHash || ""));
    if (!ok) {
        const err = new Error("Credenciales inválidas");
        err.statusCode = 401;
        throw err;
    }

    await updateLastLogin(admin.id);

    const token = jwt.sign(
        { role: admin.role || "admin", email: admin.email, adminId: admin.id },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return { token };
}