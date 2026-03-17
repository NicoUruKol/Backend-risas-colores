import "dotenv/config";
import express from "express";
import cors from "cors";

import authRouter from "./modules/auth/auth.routes.js";
import productsRouter from "./modules/products/products.routes.js";
import ordersRouter from "./modules/orders/orders.routes.js";
import stockMovementsRouter from "./modules/stockMovements/stockMovements.routes.js";
import paymentsRouter from "./modules/payments/payments.routes.js";

import adminsRouter from "./modules/admins/admins.routes.js";
import mediaRouter from "./modules/media/media.routes.js";
import contentRouter from "./modules/content/content.routes.js";
import googleReviewsRouter from "./modules/reviews/googleReviews.router.js";

import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

/* ==============================
   CORS CONFIG (PRO)
============================== */

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://risas-colores.vercel.app",
    "https://risasycolores.com.ar",
    "https://www.risasycolores.com.ar",
];

const corsMiddleware = cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);

        const isAllowed =
            allowedOrigins.includes(origin) ||
            origin.endsWith("risasycolores.com.ar");

        if (isAllowed) return cb(null, true);

        return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});

app.use(corsMiddleware);
app.options(/.*/, corsMiddleware);

/* ==============================
   MIDDLEWARES BASE
============================== */

app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send("✅ Backend Risas y Colores online. Usá /api/products");
});

/* ==============================
   ROUTES
============================== */

// 🔐 Auth
app.use("/api/auth", authRouter);

// 🔐 Admins
app.use("/api/admins", adminsRouter);

// 🧺 Products
app.use("/api/products", productsRouter);

// 🧺 Orders
app.use("/api/orders", ordersRouter);

// 💳 Payments
app.use("/api/payments", paymentsRouter);

// 📦 Stock
app.use("/api/stock-movements", stockMovementsRouter);

// 🖼️ Media
app.use("/api/media", mediaRouter);

// 🧩 Content
app.use("/api/content", contentRouter);

// ⭐ Reviews
app.use("/api/reviews", googleReviewsRouter);

/* ==============================
   DEBUG LOG
============================== */

app.use((req, res, next) => {
    console.log("➡️", req.method, req.url);
    next();
});

/* ==============================
   404
============================== */

app.use((req, res) => {
    res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

/* ==============================
   ERROR HANDLER
============================== */

app.use(errorHandler);

export default app;