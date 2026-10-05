import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "./auth";
import { env } from "./env";

type Session = typeof auth.$Infer.Session;

const requireSession = createMiddleware<{ Variables: { session: Session } }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Not signed in" });
  c.set("session", session);
  await next();
});

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
  });

export type AppType = typeof app;
