import { createApp } from "./app";
import { env } from "./config/env";
import { createDatabase } from "./db";

export function startServer() {
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error("Invalid PORT.");
  const connection = createDatabase();
  // Keep the development server local; API requests require Supabase access tokens.
  const server = createApp(connection.db).listen(env.port, "127.0.0.1", () => {
    console.log(`SINAYA development API: http://127.0.0.1:${env.port}`);
  });
  server.on("error", () => {
    console.error("API could not start. Check PORT and database configuration.");
    void connection.close().then(() => { process.exitCode = 1; }, () => { process.exitCode = 1; });
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => { process.exit(1); }, 10000).unref();
    server.close(() => {
      void connection.close().then(() => { clearTimeout(timeout); }, () => { process.exitCode = 1; clearTimeout(timeout); });
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}
