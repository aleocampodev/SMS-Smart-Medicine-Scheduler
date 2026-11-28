import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@SMS/db";
import * as schema from "@SMS/db/schema/index";
import { drizzle } from "drizzle-orm/pglite";

import { appRouter } from "../routers/index";

const MIGRATIONS_DIR = join(import.meta.dir, "../../../db/src/migrations");

async function createTestDatabase() {
  const client = new PGlite();
  const migrationFolders = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => !entry.startsWith("."))
    .sort();

  for (const folder of migrationFolders) {
    const sql = readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim().length > 0) {
        await client.exec(statement);
      }
    }
  }

  await client.exec(`
    CREATE TABLE IF NOT EXISTS monitor_state (
      id text PRIMARY KEY,
      status text NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
      selected_branches text,
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE monitor_state ADD COLUMN IF NOT EXISTS selected_branches text;
  `);

  const db = drizzle({ client });
  await db
    .insert(schema.user)
    .values([{ id: "user_1", name: "User One", email: "one@example.com" }]);

  return { client, db };
}

async function run() {
  const { client, db } = await createTestDatabase();

  const authed = appRouter.createCaller({
    db: db as unknown as Database,
    session: {
      user: { id: "user_1", email: "one@example.com", name: "User One" },
    } as never,
  });

  const anon = appRouter.createCaller({
    db: db as unknown as Database,
    session: null,
  });

  console.log("Test 1: anonymous caller is rejected for monitor router");
  let rejected = false;
  try {
    await anon.monitor.get();
  } catch (err) {
    rejected = (err as { code?: string }).code === "UNAUTHORIZED";
  }
  assert.equal(rejected, true);
  console.log("✅ Passed: anonymous caller rejected with UNAUTHORIZED.");

  console.log("Test 2: monitor.get, setBranches, and setStatus persist state");
  const initial = await authed.monitor.get();
  assert.equal(initial.status, "AWAITING_CONFIRMATION");
  assert.deepEqual(initial.selectedBranches, ["PISO3", "PISO6"]);

  const afterBranches = await authed.monitor.setBranches({ branches: ["PISO3"] });
  assert.deepEqual(afterBranches.selectedBranches, ["PISO3"]);

  const afterStatus = await authed.monitor.setStatus({ status: "ACTIVE" });
  assert.equal(afterStatus.status, "ACTIVE");
  assert.deepEqual(afterStatus.selectedBranches, ["PISO3"]);
  console.log("✅ Passed: monitor router persists status and selectedBranches.");

  await client.close();
}

run().catch((err) => {
  console.error("❌ monitor router test failed:", err);
  process.exit(1);
});
