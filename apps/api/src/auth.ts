import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: env.baseUrl,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Set DISABLE_SIGNUP=true once your accounts exist, so nobody else can register
    disableSignUp: process.env.DISABLE_SIGNUP === "true",
  },
  plugins: [expo()],
  trustedOrigins: [
    "foodtools://",
    "foodtools://*",
    ...env.trustedOrigins,
    ...(env.isDev ? ["exp://", "exp://**", "http://localhost:8081"] : []),
  ],
});
