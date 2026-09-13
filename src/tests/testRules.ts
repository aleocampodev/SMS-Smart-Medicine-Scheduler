import { RulesEngine } from '../poller/rulesEngine.js';
import { loadProfiles } from '../config/profiles.js';

function runTests() {
  console.log('🧪 Running RulesEngine unit tests...\n');
  const engine = new RulesEngine();

  // Test 1: Fewer than two items (Must fail Rule 1)
  console.log('Test 1: Rejection on insufficient items (<= 2 items)');
  const res1 = engine.evaluate([
    { id: 1, status: 'free', date: '2026-10-15' }
  ]);
  console.assert(!res1.hasAvailability, 'Test 1 failed: should reject <= 2 items');
  console.log('✅ Test 1 passed:', res1.reasons[0]);

  // Test 2: Only slots with today date (Must fail Rule 3)
  console.log('\nTest 2: Rejection on same-day appointments (Rule 3)');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const res2 = engine.evaluate([
    { id: 1, status: 'free', date: todayStr },
    { id: 2, status: 'free', date: todayStr },
    { id: 3, status: 'free', date: todayStr }
  ]);
  console.assert(!res2.hasAvailability, 'Test 2 failed: should reject current date appointments');
  console.log('✅ Test 2 passed: same-day appointments successfully rejected');

  // Test 3: Occupied slots (Must fail Rule 2)
  console.log('\nTest 3: Rejection on occupied status (Rule 2)');
  const res3 = engine.evaluate([
    { id: 1, status: 'occupied', date: '2026-10-20' },
    { id: 2, status: 'taken', date: '2026-10-20' },
    { id: 3, status: 'reserved', date: '2026-10-20' }
  ]);
  console.assert(!res3.hasAvailability, 'Test 3 failed: should reject non-free slots');
  console.log('✅ Test 3 passed: non-free slots filtered out');

  // Test 4: Fully matches all 3 rules
  console.log('\nTest 4: Full match on all 3 business rules');
  const validData = [
    { id: 'slot_1', status: 'free', date: '2026-10-20', time: '08:30', branch: 'North Branch' },
    { id: 'slot_2', status: 'free', date: '2026-10-21', time: '11:00', branch: 'Downtown' },
    { id: 'slot_3', status: 'free', date: '2026-10-22', time: '14:15', branch: 'South Branch' }
  ];
  const res4 = engine.evaluate(validData);
  console.assert(res4.hasAvailability, 'Test 4 failed: should detect availability');
  console.assert(res4.matchingSlots.length === 3, 'Test 4 failed: expected 3 matching slots');
  console.log('✅ Test 4 passed:', res4.reasons);

  // Test 5: Deduplication (Anti-spam)
  console.log('\nTest 5: Deduplication of previously notified slots');
  const unnotified1 = engine.filterUnnotifiedSlots(res4.matchingSlots);
  console.assert(unnotified1.length === 3, 'Must return 3 new slots on first run');
  const unnotified2 = engine.filterUnnotifiedSlots(res4.matchingSlots);
  console.assert(unnotified2.length === 0, 'Must return 0 slots on second run to prevent spam');
  console.log('✅ Test 5 passed: Deduplication cache working correctly');

  // Test 6: Profiles loading and validation
  console.log('\nTest 6: User profiles loading');
  const profiles = loadProfiles();
  console.assert(profiles.length > 0, 'Expected at least 1 profile in profiles.example.json');
  console.log(`✅ Test 6 passed: ${profiles.length} profiles loaded and validated with Zod.`);

  console.log('\n🎉 ALL RULES ENGINE TESTS PASSED SUCCESSFULLY!');
}

runTests();
