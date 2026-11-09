import assert from "node:assert/strict";

import {
  buildAllowedChatIds,
  isAllowedTelegramId,
  isAuthorizedTelegramContext,
  parseAllowedChatIds,
} from "../bot/allowlist.js";

function run() {
  console.log("===========================================================");
  console.log("🔐 RUNNING TELEGRAM ALLOWLIST TEST SUITE");
  console.log("===========================================================\n");

  console.log("Test 1: Parse comma, space, and newline separated IDs");
  const parsed = parseAllowedChatIds("123, 456\n789   -1001234567890,123");
  assert.deepEqual([...parsed], ["123", "456", "789", "-1001234567890"]);
  console.log("✅ Passed: IDs are trimmed, split, and deduplicated\n");

  console.log("Test 2: Empty and undefined values produce an empty allowlist");
  assert.equal(parseAllowedChatIds(undefined).size, 0);
  assert.equal(parseAllowedChatIds("").size, 0);
  assert.equal(parseAllowedChatIds(" , \n ").size, 0);
  console.log("✅ Passed: empty configuration denies everyone by default\n");

  console.log("Test 3: Invalid IDs fail fast");
  assert.throws(() => parseAllowedChatIds("@my_username"), /Invalid Telegram chat ID/);
  assert.throws(() => parseAllowedChatIds("123, abc"), /Invalid Telegram chat ID/);
  console.log("✅ Passed: invalid IDs raise a clear configuration error\n");

  console.log("Test 4: isAllowedTelegramId handles strings, numbers, and missing values");
  const allowed = new Set(["123", "-1001234567890"]);
  assert.equal(isAllowedTelegramId("123", allowed), true);
  assert.equal(isAllowedTelegramId(123, allowed), true);
  assert.equal(isAllowedTelegramId("-1001234567890", allowed), true);
  assert.equal(isAllowedTelegramId("999", allowed), false);
  assert.equal(isAllowedTelegramId(undefined, allowed), false);
  assert.equal(isAllowedTelegramId("not-an-id", allowed), false);
  console.log("✅ Passed: only valid, explicitly allowed IDs pass\n");

  console.log("Test 5: Context authorization checks both chat and sender");
  const contextAllowed = new Set(["123", "456"]);
  assert.equal(isAuthorizedTelegramContext({ chat: { id: 123 } }, contextAllowed), true);
  assert.equal(isAuthorizedTelegramContext({ from: { id: 456 } }, contextAllowed), true);
  assert.equal(
    isAuthorizedTelegramContext({ chat: { id: 999 }, from: { id: 456 } }, contextAllowed),
    true,
  );
  assert.equal(
    isAuthorizedTelegramContext({ chat: { id: 999 }, from: { id: 888 } }, contextAllowed),
    false,
  );
  assert.equal(isAuthorizedTelegramContext({}, contextAllowed), false);
  console.log("✅ Passed: allowed chat or allowed sender is enough; unrelated updates fail\n");

  console.log("Test 6: TELEGRAM_CHAT_ID is always allowed when configured");
  const withOwner = buildAllowedChatIds("456", "123");
  assert.deepEqual([...withOwner], ["456", "123"]);
  console.log("✅ Passed: owner chat ID is added to the allowlist\n");

  console.log("Test 7: Mock and empty owner chat IDs are ignored");
  assert.equal(buildAllowedChatIds("", "mock_chat_id").size, 0);
  assert.equal(buildAllowedChatIds("", "").size, 0);
  assert.deepEqual([...buildAllowedChatIds("", "123")], ["123"]);
  assert.throws(() => buildAllowedChatIds("", "not-an-id"), /Invalid Telegram chat ID/);
  console.log("✅ Passed: mock placeholders never grant access; invalid owner IDs fail fast\n");

  console.log("🎉 ALL TELEGRAM ALLOWLIST TESTS PASSED SUCCESSFULLY!");
}

run();
