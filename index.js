import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./src/modules/auth/auth.routes.js";


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

// 🧪 Log
app.use((req, res, next) => {
    console.log("➡️", req.method, req.url);
    next();
});

// ❌ 404
app.use((req, res) => {
    res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`✅ API corriendo en http://localhost:${PORT}`);
});
