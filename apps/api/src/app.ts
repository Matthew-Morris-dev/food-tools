import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./auth";
import { env } from "./env";
import { requireSession } from "./middleware";
import { foodRoutes } from "./routes/foods";
import { logRoutes } from "./routes/log";

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: [...env.trustedOrigins, ...(env.isDev ? ["http://localhost:8081"] : [])],
      credentials: true,
    }),
  )
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .get("/api/health", (c) => c.json({ ok: true }))
  .get("/api/me", requireSession, (c) => {
    const { user } = c.get("session");
    return c.json({ id: user.id, name: user.name, email: user.email });
  })
  .route("/api/foods", foodRoutes)
  .route("/api/log", logRoutes);

export type AppType = typeof app;
