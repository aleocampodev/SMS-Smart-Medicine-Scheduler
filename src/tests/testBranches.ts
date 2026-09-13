import assert from 'assert';
import { env } from '../config/env.js';
import { QantyClient } from '../poller/qantyClient.js';

console.log('===========================================================');
console.log('🧪 RUNNING BRANCH CONFIGURATION & SELECTION UNIT TESTS');
console.log('===========================================================\n');

function testBranchConfigurationDefaults() {
  console.log('Test 1: Default branch configuration is Medellín 6035');
  assert.strictEqual(env.TARGET_BRANCH_ID, '6035', 'Default branch ID must be 6035');
  assert.strictEqual(env.TARGET_BRANCH_NAME, 'Medellin', 'Default branch name must be Medellin');
  assert.deepStrictEqual(env.TARGET_BRANCH_IDS, ['6035'], 'Default target branch IDs array must contain 6035');
  console.log('✅ Passed: Branch defaults correctly set to Medellín 6035.\n');
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

    // Call with specific branchId override (e.g. 6040)
    await client.fetchDaySchedule({ branchId: '6040' });
    assert.strictEqual(
      capturedPayload.branch_id,
      '6040',
      'Should respect custom branchId override when provided'
    );

    console.log('✅ Passed: QantyClient correctly applies default and custom branch IDs.\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function run() {
  try {
    testBranchConfigurationDefaults();
    await testQantyClientBranchIntegration();
    console.log('🎉 ALL BRANCH TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

run();
