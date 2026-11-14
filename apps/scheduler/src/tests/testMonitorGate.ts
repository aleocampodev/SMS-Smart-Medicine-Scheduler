import assert from "assert";
import {
  BRANCH_MAP,
  resolveSelectedBranches,
  shouldPoll,
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
  assert.deepStrictEqual(resolveSelectedBranches("118"), ["118"]);
  assert.deepStrictEqual(resolveSelectedBranches("ALL", ["PISO3", "118"]), ["PISO3", "118"]);
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
  console.log("Test 4: BRANCH_MAP includes Promedan PISO3 mapping");
  const piso3 = BRANCH_MAP["PISO3"];
  assert.ok(piso3, "BRANCH_MAP must include PISO3");
  assert.strictEqual(piso3.branchId, "XVoySp4iyl9hC7nNhuEN");
  assert.strictEqual(piso3.lineId, "G26hsHGJQWHLWsSUghdK");
  console.log("✅ Passed: Promedan PISO3 branch and line IDs verified.\n");
}

testShouldPollOnlyWhenActive();
testMonitorStatusTransitions();
testSummarizeBranchSlots();
testPiso3BranchMapping();

console.log("🎉 ALL MONITOR GATE TESTS PASSED SUCCESSFULLY!");
