import "dotenv/config";
import express from "express";
import cors from "cors";

import authRouter from "./modules/auth/auth.routes.js";
import productsRouter from "./modules/products/products.routes.js";
import ordersRouter from "./modules/orders/orders.routes.js";
import stockMovementsRouter from "./modules/stockMovements/stockMovements.routes.js";
import paymentsRouter from "./modules/payments/payments.routes.js";

import mediaRouter from "./modules/media/media.routes.js";
import contentRouter from "./modules/content/content.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://risas-colores.vercel.app",
];

app.use(
    cors({
        origin: (origin, cb) => {
        // Permite requests sin Origin (Postman, server-to-server, health checks)
        if (!origin) return cb(null, true);

        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Importante para preflight
app.options(/.*/, cors());


app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send("✅ Backend Risas y Colores online. Usá /api/products");
});

// 🔐 Auth primero
app.use("/api/auth", authRouter);

// 🧺 Products
app.use("/api/products", productsRouter);

// 🧺 Compra
app.use("/api/orders", ordersRouter);

// 🧪 Log
app.use((req, res, next) => {
    console.log("➡️", req.method, req.url);
    next();
});

// pagos
app.use("/api/payments", paymentsRouter);

// resgistra movimiento
app.use("/api/stock-movements", stockMovementsRouter);

// 🖼️ Media (Cloudinary) - Admin
app.use("/api/media", mediaRouter);

// 🧩 Content (Firestore) - Público + Admin
app.use("/api/content", contentRouter);

// ❌ 404
app.use((req, res) => {
    res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

app.use(errorHandler);

export default app;
