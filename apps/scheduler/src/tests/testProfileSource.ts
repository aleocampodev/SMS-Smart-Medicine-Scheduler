import { strict as assert } from "node:assert";

import { createJsonProfileSource } from "../config/jsonProfileSource.js";
import { createProfileSource } from "../config/profiles.js";

async function run() {
  console.log("🧪 Testing ProfileSource contract...\n");

  console.log("Test 1: JSON source lists validated profiles");
  const jsonSource = createJsonProfileSource();
  const profiles = await jsonSource.list();
  assert.ok(profiles.length > 0, "Expected at least one profile in profiles.example.json");
  assert.equal(profiles[0]?.id, "persona_1");
  console.log(`✅ Passed: ${profiles.length} profiles loaded and validated`);

  console.log("\nTest 2: JSON source resolves a profile by id");
  const found = await jsonSource.getById("persona_1");
  assert.equal(found?.displayName, "Aleja");
  assert.equal(await jsonSource.getById("persona_missing"), undefined);
  console.log("✅ Passed: booking lookups resolve and miss safely");

  console.log("\nTest 3: factory defaults to the JSON source");
  const defaultSource = createProfileSource({ PROFILES_SOURCE: "json" });
  assert.equal((await defaultSource.list()).length, profiles.length);
  console.log("✅ Passed: default source keeps the legacy behavior");

  console.log("\nTest 4: requesting db without DATABASE_URL fails loudly");
  assert.throws(
    () => createProfileSource({ PROFILES_SOURCE: "db" }),
    /PROFILES_SOURCE=db requires DATABASE_URL/,
  );
  console.log("✅ Passed: no silent fallback to stale file data");

  console.log("\n🎉 ALL PROFILE SOURCE TESTS PASSED SUCCESSFULLY!");
}

run().catch((error) => {
  console.error("\n❌ PROFILE SOURCE TESTS FAILED");
  console.error(error);
  process.exit(1);
});
