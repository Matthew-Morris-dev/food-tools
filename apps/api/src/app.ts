import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./auth";
import { env } from "./env";
import { requireSession } from "./middleware";
import { foodRoutes } from "./routes/foods";
import { exerciseRoutes } from "./routes/exercise";
import { goalRoutes, profileRoutes } from "./routes/goals";
import { logRoutes } from "./routes/log";
import { plannerRoutes } from "./routes/planner";
import { checkInRoutes, progressRoutes, weightRoutes } from "./routes/progress";
import { recipeRoutes } from "./routes/recipes";
import { savedMealRoutes } from "./routes/saved-meals";

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
  .route("/api/log", logRoutes)
  .route("/api/profile", profileRoutes)
  .route("/api/goals", goalRoutes)
  .route("/api/weights", weightRoutes)
  .route("/api/progress", progressRoutes)
  .route("/api/check-in", checkInRoutes)
  .route("/api/exercise", exerciseRoutes)
  .route("/api/saved-meals", savedMealRoutes)
  .route("/api/recipes", recipeRoutes)
  .route("/api/plan", plannerRoutes);

export type AppType = typeof app;
