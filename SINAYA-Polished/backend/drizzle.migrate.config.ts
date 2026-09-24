import { defineConfig } from "drizzle-kit";
import config from "./drizzle.config";
import { getDatabaseUrl } from "./src/config/database";

export default defineConfig({
  ...config,
  dbCredentials: { url: getDatabaseUrl() },
});
