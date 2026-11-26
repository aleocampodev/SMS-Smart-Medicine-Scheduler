import assert from "assert";
import {
  BRANCH_MAP,
  resolveSelectedBranches,
  shouldPoll,
  shouldTriggerDailyClaimPrompt,
  summarizeBranchSlots,
  transitionMonitorStatus,
  type MonitorStatus,
  type QantySlot,
} from "@SMS/poller";

console.log("===========================================================");
console.log("🧪 RUNNING MONITOR GATE & BRANCH DIGEST UNIT TESTS");
console.log("===========================================================\n");

function testShouldPollOnlyWhenActive() {
  console.log("Test 1: shouldPoll returns true only when status is ACTIVE");
  const states: Array<[MonitorStatus, boolean]> = [
    ["AWAITING_CONFIRMATION", false],
    ["SELECTING_BRANCH", false],
    ["PAUSED", false],
    ["ACTIVE", true],
  ];

  for (const [status, expected] of states) {
    assert.strictEqual(
      shouldPoll(status),
      expected,
      `Expected shouldPoll(${status}) to be ${expected}`,
    );
  }
  console.log("✅ Passed: web polling is blocked unless status is ACTIVE.\n");
}

function testMonitorStatusTransitions() {
  console.log("Test 2: transitionMonitorStatus handles 2-step claim-check & branch selection");
  assert.strictEqual(
    transitionMonitorStatus("AWAITING_CONFIRMATION", "CLAIM_YES"),
    "PAUSED",
    "Claiming medications must pause polling immediately",
  );
  assert.strictEqual(
    transitionMonitorStatus("AWAITING_CONFIRMATION", "CLAIM_NO"),
    "SELECTING_BRANCH",
    "Needing medications must ask which branch to monitor before polling",
  );
  assert.strictEqual(
    transitionMonitorStatus("SELECTING_BRANCH", "BRANCH_SELECTED"),
    "ACTIVE",
    "Selecting a branch must activate polling",
  );
  assert.strictEqual(
    transitionMonitorStatus("ACTIVE", "CLAIM_YES"),
    "PAUSED",
    "Claiming medications while active must pause polling",
  );
  assert.strictEqual(
    transitionMonitorStatus("PAUSED", "RESUME"),
    "ACTIVE",
    "Manual /buscar must resume polling",
  );
  assert.strictEqual(
    transitionMonitorStatus("ACTIVE", "PAUSE"),
    "PAUSED",
    "Manual /pausar must pause polling",
  );
  assert.deepStrictEqual(resolveSelectedBranches("PISO3"), ["PISO3"]);
  assert.deepStrictEqual(resolveSelectedBranches("PISO6"), ["PISO6"]);
  assert.deepStrictEqual(resolveSelectedBranches("ALL", ["PISO3", "PISO6"]), ["PISO3", "PISO6"]);
  console.log("✅ Passed: all state transitions and branch choices behave deterministically.\n");
}

function testSummarizeBranchSlots() {
  console.log("Test 3: summarizeBranchSlots picks earliest slot and collapses count");
  assert.strictEqual(summarizeBranchSlots([]), null, "Empty slots must return null");

  const slots: QantySlot[] = [
    { id: "2", date: "2026-11-16", time: "10:30:00", status: "free", branch: "PISO3" },
    { id: "1", date: "2026-11-15", time: "09:00:00", status: "free", branch: "PISO3" },
    { id: "3", date: "2026-11-15", time: "07:30:00", status: "free", branch: "PISO3" },
  ];

  const digest = summarizeBranchSlots(slots);
  assert.ok(digest, "Digest must be returned for non-empty slots");
  assert.strictEqual(digest.totalCount, 3);
  assert.strictEqual(digest.earliestSlot.id, "3");
  console.log("✅ Passed: branch digest selects earliest slot and prevents alert flood.\n");
}

function testPiso3BranchMapping() {
  console.log("Test 4: BRANCH_MAP includes Promedan PISO3 and PISO6 mappings");
  const piso3 = BRANCH_MAP["PISO3"];
  assert.ok(piso3, "BRANCH_MAP must include PISO3");
  assert.strictEqual(piso3.branchId, "XVoySp4iyl9hC7nNhuEN");
  assert.strictEqual(piso3.lineId, "G26hsHGJQWHLWsSUghdK");

  const piso6 = BRANCH_MAP["PISO6"];
  assert.ok(piso6, "BRANCH_MAP must include PISO6");
  assert.strictEqual(piso6.branchId, "ZOLH5f1ydz6XQxFvpL0e");
  assert.strictEqual(piso6.lineId, "49P4qDGm7i87QLeyjG25");
  console.log("✅ Passed: Promedan PISO3 and PISO6 branch and line IDs verified.\n");
}

function testDailyAfternoonClaimPrompt() {
  console.log("Test 5: shouldTriggerDailyClaimPrompt fires once per day at afternoon hour");
  // 2026-11-16T20:59:00Z is 15:59 in America/Bogota (UTC-5) -> before 16:00
  const beforeAfternoon = new Date("2026-11-16T20:59:00Z");
  const resBefore = shouldTriggerDailyClaimPrompt(beforeAfternoon, null, 16, "America/Bogota");
  assert.strictEqual(resBefore.trigger, false);
  assert.strictEqual(resBefore.localDay, "2026-11-16");

  // 2026-11-16T21:00:00Z is 16:00 in America/Bogota -> triggers once
  const atAfternoon = new Date("2026-11-16T21:00:00Z");
  const resAt = shouldTriggerDailyClaimPrompt(atAfternoon, null, 16, "America/Bogota");
  assert.strictEqual(resAt.trigger, true);
  assert.strictEqual(resAt.localDay, "2026-11-16");

  // Same day after already prompting -> must not re-trigger
  const resRepeat = shouldTriggerDailyClaimPrompt(atAfternoon, "2026-11-16", 16, "America/Bogota");
  assert.strictEqual(resRepeat.trigger, false);

  // Next day at 16:05 -> triggers again
  const nextDay = new Date("2026-11-17T21:05:00Z");
  const resNext = shouldTriggerDailyClaimPrompt(nextDay, "2026-11-16", 16, "America/Bogota");
  assert.strictEqual(resNext.trigger, true);
  assert.strictEqual(resNext.localDay, "2026-11-17");
  console.log("✅ Passed: daily afternoon claim prompt triggers once per day in local timezone.\n");
}

testShouldPollOnlyWhenActive();
testMonitorStatusTransitions();
testSummarizeBranchSlots();
testPiso3BranchMapping();
testDailyAfternoonClaimPrompt();

console.log("🎉 ALL MONITOR GATE TESTS PASSED SUCCESSFULLY!");
