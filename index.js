import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./src/modules/auth/auth.routes.js";
import ordersRouter from "./src/modules/orders/orders.routes.js";
import stockMovementsRouter from "./src/modules/stockMovements/stockMovements.routes.js";
import paymentsRouter from "./src/modules/payments/payments.routes.js";
import { errorHandler } from "./src/middlewares/error.middleware.js";

import productsRouter from "./src/modules/products/products.routes.js";

const app = express();

app.use(cors());
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

app.use("/api/payments", paymentsRouter);

app.use("/api/stock-movements", stockMovementsRouter);

// ❌ 404
app.use((req, res) => {
    res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`✅ API corriendo en http://localhost:${PORT}`);
});
