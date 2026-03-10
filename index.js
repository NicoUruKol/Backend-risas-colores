import app from "./src/app.js";
import { ensureInitialAdmin } from "./src/modules/auth/auth.service.js";

const PORT = process.env.PORT || 3000;

(async () => {
    await ensureInitialAdmin();
    app.listen(PORT, () => console.log("✅ Server on", PORT));
})();
