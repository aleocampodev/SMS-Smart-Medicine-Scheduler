import assert from "assert";
import {
  BRANCH_MAP,
  resolveBranch,
  tomorrowLocalDay,
  buildDayPayload,
  flattenAppointments,
  evaluateRules,
  filterUnnotified,
  getAdaptiveInterval,
  PollerEventBus,
} from "../../packages/poller/src/index.js";

console.log("===========================================================");
console.log("🧪 RUNNING FUNCTIONAL POLLER CORE UNIT TESTS (@sms/poller)");
console.log("===========================================================");

function testPayloadAndBranchResolution() {
  console.log("Test 1: Branch resolution and payload construction");

  // Real Qanty endpoint translates to Firestore doc ID
  const realRes = resolveBranch("6035", "https://qanty.com/p/appointments/list_day_schedule");
  assert.strictEqual(realRes.isRealQanty, true);
  assert.strictEqual(realRes.targetBranchId, BRANCH_MAP["6035"].branchId);
  assert.strictEqual(realRes.targetLineId, BRANCH_MAP["6035"].lineId);

  // Mock endpoint preserves literal branch ID
  const mockRes = resolveBranch("6035", "https://httpbin.org/post");
  assert.strictEqual(mockRes.isRealQanty, false);

  const tomorrow = tomorrowLocalDay();
  assert.match(tomorrow, /^\d{4}-\d{2}-\d{2}$/, "tomorrowLocalDay must return YYYY-MM-DD");

  const payload = buildDayPayload({
    companyId: "COMP123",
    branchKey: "118",
    endpoint: "https://qanty.com/p/appointments/list_day_schedule",
    day: tomorrow,
    sessionId: "session-xyz",
  });

  assert.strictEqual(payload.company_id, "COMP123");
  assert.strictEqual(payload.branch_id, BRANCH_MAP["118"].branchId);
  assert.strictEqual(payload.session, "session-xyz");
  assert.strictEqual(payload.day, tomorrow);

  console.log("✅ Passed: Branch resolution and day payload construction verified.\n");
}

function testParseFlattenAppointments() {
  console.log("Test 2: Parsing nested appointments dictionary");

  const nestedData = {
    appointments: {
      "2026-10-25T08:00:00": {
        "0": { id: "slot-1", status: "free", name: "2026-10-25 08:00" },
        "1": { id: "slot-2", status: "waiting", name: "2026-10-25 08:15" },
      },
    },
  };

  const flattened = flattenAppointments(nestedData, "6035", "Sede 6035");
  assert.strictEqual(flattened.length, 2);
  assert.strictEqual(flattened[0].id, "slot-1");
  assert.strictEqual(flattened[0].status, "free");
  assert.strictEqual(flattened[0].date, "2026-10-25");
  assert.strictEqual(flattened[0].time, "08:00");
  assert.strictEqual(flattened[0].branch_id, "6035");

  console.log("✅ Passed: flattenAppointments correctly unwrapped nested structure.\n");
}

function testRulesEvaluation() {
  console.log("Test 3: Pure rules evaluation");

  // Rule 1 failure: <= 2 items
  const r1 = evaluateRules([{ status: "free", date: "2026-12-01" }], "2026-10-22");
  assert.strictEqual(r1.hasAvailability, false);
  assert.match(r1.reasons[0], /Fails Rule 1/);

  // All 3 rules match
  const validItems = [
    { id: "1", status: "free", date: "2026-12-01", time: "08:00" },
    { id: "2", status: "free", date: "2026-12-01", time: "08:30" },
    { id: "3", status: "free", date: "2026-12-01", time: "09:00" },
  ];
  const r3 = evaluateRules(validItems, "2026-10-22", { branchId: "6035" });
  assert.strictEqual(r3.hasAvailability, true);
  assert.strictEqual(r3.matchingSlots.length, 3);

  // Deduplication
  const seen = new Set<string>();
  const first = filterUnnotified(r3.matchingSlots, seen);
  assert.strictEqual(first.newSlots.length, 3);
  const second = filterUnnotified(r3.matchingSlots, first.seen);
  assert.strictEqual(second.newSlots.length, 0);

  console.log("✅ Passed: Pure rules evaluation and deduplication verified.\n");
}

function testSchedulerPhases() {
  console.log("Test 4: Pure adaptive scheduler intervals and jitter");

  const morningDate = new Date(2026, 9, 23, 7, 30); // 07:30 peak
  const peak = getAdaptiveInterval(morningDate);
  assert.strictEqual(peak.phase, "PEAK");
  assert.ok(peak.intervalSeconds >= 30, "Interval must satisfy P-NET-01 (>= 30s)");

  const nightDate = new Date(2026, 9, 23, 3, 0); // 03:00 night
  const night = getAdaptiveInterval(nightDate);
  assert.strictEqual(night.phase, "NIGHT");
  assert.ok(night.intervalSeconds >= 800, "Night interval must be around 15 minutes");

  console.log("✅ Passed: Adaptive scheduler phases verified.\n");
}

async function testEventBus() {
  console.log("Test 5: PollerEventBus async emission and unsubscribe");

  const bus = new PollerEventBus();
  const received: string[] = [];

  const unsub = bus.on("availability:found", (e) => {
    received.push(e.branchId);
  });

  await bus.emit({
    type: "availability:found",
    branchId: "6035",
    timestamp: Date.now(),
  });

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0], "6035");

  unsub();
  await bus.emit({
    type: "availability:found",
    branchId: "118",
    timestamp: Date.now(),
  });

  assert.strictEqual(received.length, 1, "Unsubscribed handler must not be called");
  console.log("✅ Passed: PollerEventBus works as expected.\n");
}

async function run() {
  try {
    testPayloadAndBranchResolution();
    testParseFlattenAppointments();
    testRulesEvaluation();
    testSchedulerPhases();
    await testEventBus();
    console.log("🎉 ALL FUNCTIONAL POLLER TESTS PASSED SUCCESSFULLY!");
  } catch (error: any) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

run();
