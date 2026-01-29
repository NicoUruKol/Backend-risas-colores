import "dotenv/config";
import express from "express";
import cors from "cors";

import productsRouter from "./src/modules/products/products.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send("✅ Backend Risas y Colores online. Usá /api/products");
});

// ✅ Products (IMPORTANTE: antes del 404)
app.use("/api/products", productsRouter);

// ✅ Log de rutas (para ver qué estás pegando)
app.use((req, res, next) => {
    console.log("➡️", req.method, req.url);
    next();
});

// ✅ 404 al final SIEMPRE
app.use((req, res) => {
    res.status(404).json({ ok: false, message: "Ruta no encontrada" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API corriendo en http://localhost:${PORT}`);
});
