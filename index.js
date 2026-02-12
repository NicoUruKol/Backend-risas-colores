import app from "./src/app.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
    console.log(`✅ API corriendo en http://localhost:${PORT}`);
});
