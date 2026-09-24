import express from "express";
import { sql } from "drizzle-orm";
import type { Database } from "./types/database";
import { foundationRoutes } from "./routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { HttpError } from "./utils/httpError";
import type { WeatherProvider } from './services/weather/openMeteo.provider';
import { SupabaseAuthenticator, type Authenticator } from './services/auth/auth.service';
import { authenticate } from './middleware/auth';
import { ownership } from './middleware/ownership';

export function createApp(db: Database, weatherProvider?: WeatherProvider, auth: Authenticator = new SupabaseAuthenticator()) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    const allowed = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
    if (origin && !allowed.includes(origin)) { next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Browser origin is not allowed.')); return; }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin); res.vary('Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_req, res) => { res.json({ status: "ok", service: "SINAYA", mode: "local-development" }); });
  app.get("/ready", async (_req, res) => {
    try {
      // Check the current schema as well as the network connection; returns no rows.
      await db.execute(sql`select p.farm_id, f.operator_id, c.receives_alerts, l.requires_native_review
        from ponds p cross join farms f cross join farm_contacts c cross join languages l limit 0`);
      await db.execute(sql`select u.pond_id, r.source from sensor_units u cross join sensor_readings r limit 0`);
      await db.execute(sql`select f.auth_user_id, a.snapshot, d.simulated from farmers f cross join assessments a cross join sms_deliveries d limit 0`);
      res.json({ status: "ready" });
    } catch { throw new HttpError(503, "DATABASE_UNAVAILABLE", "Database connection or foundation schema is not ready."); }
  });
  app.use("/api", (req, _res, next) => {
    if (["POST", "PATCH"].includes(req.method) && !req.is("application/json")) {
      next(new HttpError(415, "JSON_REQUIRED", "Use Content-Type: application/json."));
      return;
    }
    next();
  }, authenticate(db, auth), ownership(db), foundationRoutes(db, weatherProvider));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
