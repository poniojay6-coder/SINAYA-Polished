import { startServer } from "./server";

try { startServer(); }
catch { console.error("API startup failed. Check PORT and DATABASE_URL in backend/.env."); process.exitCode = 1; }
