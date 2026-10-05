import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

// Use BETTER_AUTH_SECRET if set; otherwise create one on first start and keep it in
// AUTH_SECRET_FILE, so `docker compose up` works without any configuration.
function authSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  const file = process.env.AUTH_SECRET_FILE ?? ".auth-secret";
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(32).toString("base64url"), { mode: 0o600 });
  }
  return readFileSync(file, "utf8").trim();
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  authSecret: authSecret(),
  // Public URL the app uses to reach this API, e.g. http://192.168.1.10:3000
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  port: Number(process.env.PORT ?? 3000),
  // Extra comma-separated origins allowed to call the API (e.g. a web build of the app)
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  isDev: process.env.NODE_ENV !== "production",
};
