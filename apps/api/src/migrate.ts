import { readFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";
import { createAuth } from "./auth";
import { config } from "./config";
import { createPool } from "./db";
import { createMailer } from "./mail";
export async function migrate(pool: Pool, auth: ReturnType<typeof createAuth>) {
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  await pool.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
}
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const settings = config(),
    pool = createPool(settings.databaseURL);
  try {
    await migrate(
      pool,
      createAuth(pool, settings, createMailer(pool, settings)),
    );
    console.log("Database migrations complete");
  } finally {
    await pool.end();
  }
}
