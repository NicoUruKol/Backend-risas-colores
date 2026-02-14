import "dotenv/config";
import admin from "firebase-admin";
import fs from "fs";



function loadServiceAccount() {
    // 1) Vercel-friendly (recomendado): JSON en base64
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (b64) {
        const json = Buffer.from(b64, "base64").toString("utf8");
        return JSON.parse(json);
    }

    // 2) Alternativa: JSON directo en env
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
        const parsed = JSON.parse(raw);

        // Si el private_key viene con \\n, lo convertimos a saltos reales
        if (parsed?.private_key?.includes("\\n")) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }

        return parsed;
    }

    // 3) Fallback local: path a archivo (NO recomendado para Vercel)
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (path) {
        return JSON.parse(fs.readFileSync(path, "utf8"));
    }

    throw new Error(
        "Faltan credenciales Firebase Admin. Seteá FIREBASE_SERVICE_ACCOUNT_B64 (recomendado) o FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS."
    );
}

if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;


