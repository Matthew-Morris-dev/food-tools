import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "./auth";

export type Session = typeof auth.$Infer.Session;
export type AuthEnv = { Variables: { session: Session } };

export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Not signed in" });
  c.set("session", session);
  await next();
});
