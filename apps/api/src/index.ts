import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { app } from "./app";
import { client, db } from "./db";
import { env } from "./env";

await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    void client.end().then(() => process.exit(0));
  });
}
