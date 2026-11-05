import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "../index";
import { createProfileRepository } from "../repositories/profiles";
import { user } from "../schema/auth";
import { profile } from "../schema/profiles";

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

  const db = drizzle({ client });
  await db.insert(user).values([
    { id: "user_1", name: "User One", email: "one@example.com" },
    { id: "user_2", name: "User Two", email: "two@example.com" },
  ]);

  return { client, db };
}

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>["db"];

function repositoryFor(db: TestDb) {
  return createProfileRepository(db as unknown as Database);
}

const baseProfile = {
  documentType: "CC",
  firstName: "Aleja",
  lastName: "Gómez",
  birthDate: "1995-04-20",
  phone: "3001234567",
  email: "aleja@example.com",
};

async function run() {
  const { client, db } = await createTestDatabase();
  const repository = repositoryFor(db);

  console.log("Test 1: listAll returns every installation profile");
  await db.insert(profile).values([
    {
      ...baseProfile,
      id: "profile_1",
      userId: "user_1",
      displayName: "Aleja",
      documentNumber: "1234567890",
    },
    {
      ...baseProfile,
      id: "profile_2",
      userId: "user_2",
      displayName: "María",
      documentNumber: "9876543210",
      email: "maria@example.com",
    },
    {
      ...baseProfile,
      id: "profile_3",
      userId: null,
      displayName: "Global",
      documentNumber: "5555555555",
      email: "global@example.com",
    },
  ]);

  const all = await repository.listAll();
  assert.equal(all.length, 3);
  assert.deepEqual(
    all.map((record) => record.id),
    ["profile_1", "profile_2", "profile_3"],
  );
  console.log("✅ Passed: scheduler-wide reads include every owner");

  console.log("\nTest 2: listByUser only returns that user's profiles");
  const userOne = await repository.listByUser("user_1");
  assert.equal(userOne.length, 1);
  assert.equal(userOne[0]?.id, "profile_1");

  const unknownUser = await repository.listByUser("user_unknown");
  assert.equal(unknownUser.length, 0);
  console.log("✅ Passed: authenticated reads stay scoped");

  console.log("\nTest 3: getById returns the full record or undefined");
  const found = await repository.getById("profile_2");
  assert.equal(found?.displayName, "María");
  assert.equal(found?.documentNumber, "9876543210");
  assert.equal(found?.userId, "user_2");

  const missing = await repository.getById("profile_missing");
  assert.equal(missing, undefined);
  console.log("✅ Passed: booking lookups resolve by id");

  console.log("\nTest 4: records keep the fields the scheduler needs");
  const record = await repository.getById("profile_1");
  assert.equal(record?.documentType, "CC");
  assert.equal(record?.birthDate, "1995-04-20");
  assert.equal(record?.phone, "3001234567");
  assert.equal(record?.email, "aleja@example.com");
  console.log("✅ Passed: scheduler profile contract is preserved");

  await client.close();
  console.log("\n🎉 ALL PROFILE REPOSITORY TESTS PASSED SUCCESSFULLY!");
}

run().catch((error) => {
  console.error("\n❌ TEST SUITE FAILED");
  console.error(error);
  process.exit(1);
});
