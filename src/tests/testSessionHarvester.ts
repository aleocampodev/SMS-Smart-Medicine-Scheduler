import assert from 'assert';
import { SessionHarvester } from '../poller/sessionHarvester.js';

console.log('===========================================================');
console.log('🧪 RUNNING SESSION HARVESTER UNIT TESTS');
console.log('===========================================================\n');

function testSingletonInstance() {
  console.log('Test 1: SessionHarvester singleton pattern');
  const instance1 = SessionHarvester.getInstance();
  const instance2 = SessionHarvester.getInstance();
  assert.strictEqual(instance1, instance2, 'getInstance() must always return identical instance');
  console.log('✅ Passed: Singleton instance verified.\n');
}

async function testSessionCachingAndInvalidation() {
  console.log('Test 2: Session caching and invalidation lifecycle');
  const harvester = new SessionHarvester();

  // Inject a mock active session
  const mockSession = {
    cookieString: 'session_id=abc123mock; _GRECAPTCHA=mocktoken',
    authorizationToken: 'token_xyz_999',
    companyId: 'test_company',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000, // Valid for 1 hour
  };

  (harvester as any).currentSession = mockSession;

  // 1. Check getSession returns the cached session without refreshing
  const cached = await harvester.getSession();
  assert.strictEqual(cached.cookieString, mockSession.cookieString);
  assert.strictEqual(cached.authorizationToken, 'token_xyz_999');
  console.log('✅ Passed: In-memory cached session returned without browser launch.');

  // 2. Check getHeaders generates properly formatted headers
  const headers = await harvester.getHeaders();
  assert.strictEqual(headers['Cookie'], mockSession.cookieString);
  assert.strictEqual(headers['Authorization'], 'Bearer token_xyz_999');
  assert.ok(headers['User-Agent'].includes('Mozilla/5.0'));
  console.log('✅ Passed: Generated headers match session credentials.');

  // 3. Check invalidation
  harvester.invalidateSession();
  assert.strictEqual((harvester as any).currentSession, null);
  console.log('✅ Passed: Invalidation successfully clears session cache.\n');
}

async function run() {
  try {
    testSingletonInstance();
    await testSessionCachingAndInvalidation();
    console.log('🎉 ALL SESSION HARVESTER TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

run();
