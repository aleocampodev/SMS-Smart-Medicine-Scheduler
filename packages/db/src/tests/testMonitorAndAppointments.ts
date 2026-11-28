import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "../index";
import { createAppointmentRepository } from "../repositories/appointments";
import { createMonitorStateRepository } from "../repositories/monitorState";
import { user } from "../schema/auth";
import { appointment, profile } from "../schema/profiles";

const MIGRATIONS_DIR = join(import.meta.dir, "../migrations");

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

  // Ensure monitor_state table exists even if migrations predate monitor_state
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
  await db.insert(user).values([{ id: "user_1", name: "User One", email: "one@example.com" }]);
  await db.insert(profile).values([
    {
      id: "profile_1",
      userId: "user_1",
      displayName: "Aleja",
      documentType: "CC",
      documentNumber: "1234567890",
      firstName: "Aleja",
      lastName: "Gómez",
      birthDate: "1995-04-20",
      phone: "3001234567",
      email: "aleja@example.com",
    },
  ]);

  return { client, db };
}

async function run() {
  const { client, db } = await createTestDatabase();
  const typedDb = db as unknown as Database;

  const monitorRepo = createMonitorStateRepository(typedDb);
  const appointmentRepo = createAppointmentRepository(typedDb);

  console.log("Test 1: monitorState defaults and status/branch persistence");
  assert.equal(await monitorRepo.getStatus(), "AWAITING_CONFIRMATION");
  assert.deepEqual(await monitorRepo.getSelectedBranches(["PISO3"]), ["PISO3"]);

  await monitorRepo.setStatus("SELECTING_BRANCH");
  assert.equal(await monitorRepo.getStatus(), "SELECTING_BRANCH");

  await monitorRepo.setSelectedBranches(["PISO3", "PISO6"]);
  await monitorRepo.setStatus("ACTIVE");
  assert.equal(await monitorRepo.getStatus(), "ACTIVE");
  assert.deepEqual(await monitorRepo.getSelectedBranches(), ["PISO3", "PISO6"]);
  console.log("✅ Passed: monitorState persists status and selectedBranches.");

  console.log("Test 2: appointment repository records booked and fallback null-profile rows");
  const booked = await appointmentRepo.record({
    profileId: "profile_1",
    branchId: "PISO3",
    slotDate: "2026-12-01",
    slotTime: "09:00",
    status: "booked",
    confirmationCode: "QNT-9912",
  });
  assert.equal(booked?.profileId, "profile_1");
  assert.equal(booked?.confirmationCode, "QNT-9912");

  const jsonOnly = await appointmentRepo.record({
    profileId: "json_only_profile",
    branchId: "PISO6",
    slotDate: "2026-12-02",
    status: "alerted",
  });
  assert.equal(jsonOnly?.profileId, null);

  const rows = await db.select().from(appointment);
  assert.equal(rows.length, 2);
  console.log("✅ Passed: appointment repository safely records DB and JSON-only profiles.");

  await client.close();
}

run().catch((err) => {
  console.error("❌ DB monitorState/appointment test failed:", err);
  process.exit(1);
});
