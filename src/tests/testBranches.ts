import assert from 'assert';
import { env } from '../config/env.js';
import { QantyClient, BRANCH_FIRESTORE_MAP } from '../poller/qantyClient.js';
import { RulesEngine } from '../poller/rulesEngine.js';

console.log('===========================================================');
console.log('🧪 RUNNING BRANCH CONFIGURATION & SELECTION UNIT TESTS');
console.log('===========================================================\n');

function testBranchConfigurationDefaults() {
  console.log('Test 1: Default branch configuration contains Medellín 6035 and 118');
  assert.strictEqual(env.TARGET_BRANCH_ID, '6035', 'Default branch ID must be 6035');
  assert.strictEqual(env.TARGET_BRANCH_NAME, 'Medellin', 'Default branch name must be Medellin');
  assert.deepStrictEqual(
    env.TARGET_BRANCH_IDS,
    ['6035', '118'],
    'Default target branch IDs array must contain both 6035 and 118'
  );
  console.log('✅ Passed: Branch defaults correctly include Medellín 6035 and 118.\n');
}

async function testQantyClientBranchIntegration() {
  console.log('Test 2: QantyClient uses configured branch ID in payload');

  const client = new QantyClient('https://httpbin.org/post');

  // Override fetch to verify the payload passed to the endpoint
  let capturedPayload: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    capturedPayload = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ success: true, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    // Call without explicit branchId - should use default (6035)
    await client.fetchDaySchedule();
    assert.strictEqual(
      capturedPayload.branch_id,
      '6035',
      'Should use configured TARGET_BRANCH_ID when none is provided'
    );

    // Call with specific branchId override (e.g. 118)
    await client.fetchDaySchedule({ branchId: '118' });
    assert.strictEqual(
      capturedPayload.branch_id,
      '118',
      'Should respect custom branchId override when provided'
    );

    console.log('✅ Passed: QantyClient correctly applies default and custom branch IDs.\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testRulesEngineBranchContext() {
  console.log('Test 3: RulesEngine properly tags branch context (Medellín 118 and 6035)');
  const engine = new RulesEngine();

  const mockItems = [
    { date: '2026-09-20', time: '09:00', status: 'free' },
    { date: '2026-09-20', time: '10:00', status: 'free' },
    { date: '2026-09-20', time: '11:00', status: 'free' },
  ];

  // Evaluate for branch 118
  const res118 = engine.evaluate(mockItems, { branchId: '118' });
  assert.strictEqual(res118.hasAvailability, true);
  assert.strictEqual(res118.matchingSlots[0]?.branch, 'Medellin (Branch 118)');
  assert.ok(String(res118.matchingSlots[0]?.id).startsWith('118_'));

  // Evaluate for branch 6035
  const res6035 = engine.evaluate(mockItems, { branchId: '6035' });
  assert.strictEqual(res6035.hasAvailability, true);
  assert.strictEqual(res6035.matchingSlots[0]?.branch, 'Medellin (Branch 6035)');
  assert.ok(String(res6035.matchingSlots[0]?.id).startsWith('6035_'));


  console.log('✅ Passed: RulesEngine isolates and tags branch context correctly.\n');
}

function testBranch118FirestoreMappingAndWaitingSlots() {
  console.log('Test 4: Branch 118 Firestore mapping & WAITING status processing');
  
  // 1. Verify Firestore ID mapping
  assert.ok(BRANCH_FIRESTORE_MAP['118'], 'Branch 118 mapping must exist');
  assert.strictEqual(
    BRANCH_FIRESTORE_MAP['118'].branchId,
    'P44gWuLwrWvKAMd7YrHF',
    'Branch 118 must map to Firestore ID P44gWuLwrWvKAMd7YrHF'
  );
  assert.strictEqual(
    BRANCH_FIRESTORE_MAP['118'].lineId,
    'G26hsHGJQWHLWsSUghdK',
    'Branch 118 line must map to G26hsHGJQWHLWsSUghdK (Agendamiento Nueva EPS)'
  );

  assert.ok(BRANCH_FIRESTORE_MAP['6035'], 'Branch 6035 mapping must exist');
  assert.strictEqual(
    BRANCH_FIRESTORE_MAP['6035'].branchId,
    'ZOLH5f1ydz6XQxFvpL0e',
    'Branch 6035 must map to Firestore ID ZOLH5f1ydz6XQxFvpL0e'
  );
  assert.strictEqual(
    BRANCH_FIRESTORE_MAP['6035'].lineId,
    '49P4qDGm7i87QLeyjG25',
    'Branch 6035 line must map to 49P4qDGm7i87QLeyjG25 (Agendamiento)'
  );

  // 2. Verify RulesEngine accepts Qanty WAITING status
  const engine = new RulesEngine();
  const qantyLiveMockSlots = [
    {
      name: '2026-09-20 08:00:00',
      duration: 900,
      status: 'WAITING',
      appointment_slot_idx: 0,
      date: '2026-09-20',
      time: '08:00:00',
    },
    {
      name: '2026-09-20 08:00:00',
      duration: 900,
      status: 'WAITING',
      appointment_slot_idx: 1,
      date: '2026-09-20',
      time: '08:00:00',
    },
    {
      name: '2026-09-20 08:15:00',
      duration: 900,
      status: 'WAITING',
      appointment_slot_idx: 0,
      date: '2026-09-20',
      time: '08:15:00',
    },
  ];

  const evalResult = engine.evaluate(qantyLiveMockSlots, { branchId: '118' });
  assert.strictEqual(evalResult.hasAvailability, true, 'WAITING status must pass Rule 2');
  assert.strictEqual(evalResult.matchingSlots.length, 3, 'Must match all 3 future WAITING slots');
  assert.strictEqual(evalResult.matchingSlots[0]?.status, 'waiting');

  console.log('✅ Passed: Branch 118 Firestore mapping and WAITING slots verified.\n');
}

async function run() {
  try {
    testBranchConfigurationDefaults();
    await testQantyClientBranchIntegration();
    testRulesEngineBranchContext();
    testBranch118FirestoreMappingAndWaitingSlots();
    console.log('🎉 ALL BRANCH TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

run();
