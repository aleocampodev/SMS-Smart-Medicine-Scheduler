import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@SMS/db";
import * as schema from "@SMS/db/schema/index";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import { appRouter } from "../routers/index";
import { maskDocumentNumber } from "../sanitize";

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

  const db = drizzle({ client });
  await db.insert(schema.user).values([
    { id: "user_1", name: "User One", email: "one@example.com" },
    { id: "user_2", name: "User Two", email: "two@example.com" },
  ]);

  return { client, db };
}

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>["db"];

function callerFor(db: TestDb, userId: string) {
  return appRouter.createCaller({
    db: db as unknown as Database,
    session: {
      user: { id: userId, email: `${userId}@example.com`, name: userId },
    } as never,
  });
}

function anonymousCaller(db: TestDb) {
  return appRouter.createCaller({ db: db as unknown as Database, session: null });
}

async function expectTrpcCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    assert.fail(`Expected TRPCError code ${code}, but call succeeded`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    assert.equal(actual, code);
  }
}

const sampleProfile = {
  displayName: "Aleja",
  documentType: "CC",
  documentNumber: "1234567890",
  firstName: "Aleja",
  lastName: "Gómez",
  birthDate: "1995-04-20",
  phone: "3001234567",
  email: "aleja@example.com",
  healthEntity: "Sura",
};

async function run() {
  const { client, db } = await createTestDatabase();
  const userOne = callerFor(db, "user_1");
  const userTwo = callerFor(db, "user_2");

  console.log("Test 1: profile CRUD requires an authenticated session");
  await expectTrpcCode(anonymousCaller(db).profiles.list(), "UNAUTHORIZED");
  await expectTrpcCode(anonymousCaller(db).profiles.create(sampleProfile), "UNAUTHORIZED");
  console.log("✅ Passed: unauthenticated calls are rejected");

  console.log("\nTest 2: owner can create and list profiles");
  const created = await userOne.profiles.create(sampleProfile);
  assert.equal(created.userId, "user_1");
  assert.equal(created.documentNumber, "1234567890");
  assert.ok(created.id.length > 0);

  const oneProfiles = await userOne.profiles.list();
  assert.equal(oneProfiles.length, 1);
  assert.equal(oneProfiles[0]?.id, created.id);
  console.log("✅ Passed: create + list keep the profile scoped to its owner");

  console.log("\nTest 3: another user cannot read or mutate the profile");
  assert.equal((await userTwo.profiles.list()).length, 0);
  await expectTrpcCode(
    userTwo.profiles.update({ id: created.id, displayName: "Hacked" }),
    "NOT_FOUND",
  );
  await expectTrpcCode(userTwo.profiles.delete({ id: created.id }), "NOT_FOUND");

  const untouched = await userOne.profiles.list();
  assert.equal(untouched[0]?.displayName, "Aleja");
  console.log("✅ Passed: cross-user reads and writes are denied with NOT_FOUND");

  console.log("\nTest 4: owner can update and delete the profile");
  const updated = await userOne.profiles.update({ id: created.id, displayName: "Aleja Updated" });
  assert.equal(updated.displayName, "Aleja Updated");
  await expectTrpcCode(userOne.profiles.update({ id: created.id }), "BAD_REQUEST");

  const deleted = await userOne.profiles.delete({ id: created.id });
  assert.equal(deleted.id, created.id);
  assert.equal((await userOne.profiles.list()).length, 0);
  await expectTrpcCode(userOne.profiles.delete({ id: created.id }), "NOT_FOUND");
  console.log("✅ Passed: update and delete verified, empty updates rejected");

  console.log("\nTest 5: appointments are scoped through profile ownership");
  const profileOne = await userOne.profiles.create(sampleProfile);
  const profileTwo = await userTwo.profiles.create({
    ...sampleProfile,
    displayName: "María",
    documentNumber: "9876543210",
    email: "maria@example.com",
  });

  await expectTrpcCode(
    userTwo.appointments.create({
      profileId: profileOne.id,
      branchId: "6035",
      slotDate: "2026-11-02",
    }),
    "NOT_FOUND",
  );

  const appointment = await userOne.appointments.create({
    profileId: profileOne.id,
    branchId: "6035",
    slotDate: "2026-11-02",
    slotTime: "07:30",
  });
  assert.equal(appointment.status, "alerted");
  assert.equal(appointment.profileId, profileOne.id);

  assert.equal((await userOne.appointments.list()).length, 1);
  assert.equal((await userTwo.appointments.list()).length, 0);

  const found = await userTwo.appointments.list({ profileId: profileTwo.id });
  assert.equal(found.length, 0);
  console.log("✅ Passed: appointment creation and listing enforce ownership");

  console.log("\nTest 6: appointment status updates are owner-only");
  await expectTrpcCode(
    userTwo.appointments.updateStatus({ id: appointment.id, status: "booked" }),
    "NOT_FOUND",
  );

  const booked = await userOne.appointments.updateStatus({
    id: appointment.id,
    status: "booked",
    confirmationCode: "CONF-123",
  });
  assert.equal(booked.status, "booked");
  assert.equal(booked.confirmationCode, "CONF-123");
  await expectTrpcCode(
    userOne.appointments.updateStatus({ id: appointment.id, status: "unknown" as never }),
    "BAD_REQUEST",
  );
  console.log("✅ Passed: status transitions validated and owner-scoped");

  console.log("\nTest 7: deleting a profile cascades to its appointments");
  await userOne.profiles.delete({ id: profileOne.id });
  assert.equal((await userOne.appointments.list()).length, 0);

  const remaining = await db
    .select()
    .from(schema.appointment)
    .where(eq(schema.appointment.id, appointment.id));
  assert.equal(remaining.length, 0);
  console.log("✅ Passed: profile deletion cascades appointments");

  console.log("\nTest 8: national IDs are masked for logs and public messages");
  assert.equal(maskDocumentNumber("1234567890"), "******7890");
  assert.equal(maskDocumentNumber("1234"), "****");
  assert.equal(maskDocumentNumber(""), "****");
  console.log("✅ Passed: PII masking keeps only the last four digits");

  await client.close();
  console.log("\n🎉 ALL PROFILES & APPOINTMENTS API TESTS PASSED SUCCESSFULLY!");
}

run().catch((error) => {
  console.error("\n❌ TEST SUITE FAILED");
  console.error(error);
  process.exit(1);
});
