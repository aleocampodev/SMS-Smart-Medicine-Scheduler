import { AdaptiveScheduler } from '../poller/adaptiveScheduler.js';

function testAdaptiveScheduler() {
  console.log('🧪 Testing Adaptive Daily Scheduler (AdaptiveScheduler)...\n');
  const scheduler = new AdaptiveScheduler();

  // Case 1: Morning Peak Hours (07:30 AM)
  const d1 = new Date('2026-09-15T07:30:00');
  const res1 = scheduler.getAdaptiveInterval(d1);
  console.assert(res1.phase === 'PEAK', `07:30 should be PEAK, got: ${res1.phase}`);
  console.assert(res1.intervalSeconds >= 30 && res1.intervalSeconds <= 55, `Peak interval out of bounds: ${res1.intervalSeconds}`);
  console.log('✅ Case 1 passed: 07:30 AM ->', res1.description);

  // Case 2: Midday Peak Hours (12:15 PM)
  const d2 = new Date('2026-09-15T12:15:00');
  const res2 = scheduler.getAdaptiveInterval(d2);
  console.assert(res2.phase === 'PEAK', `12:15 should be PEAK, got: ${res2.phase}`);
  console.log('✅ Case 2 passed: 12:15 PM ->', res2.description);

  // Case 3: Regular Business Day Hours (03:00 PM)
  const d3 = new Date('2026-09-15T15:00:00');
  const res3 = scheduler.getAdaptiveInterval(d3);
  console.assert(res3.phase === 'DAYTIME', `15:00 should be DAYTIME, got: ${res3.phase}`);
  console.assert(res3.intervalSeconds >= 100 && res3.intervalSeconds <= 140, `Normal interval out of bounds: ${res3.intervalSeconds}`);
  console.log('✅ Case 3 passed: 03:00 PM ->', res3.description);

  // Case 4: Evening Hours (08:30 PM)
  const d4 = new Date('2026-09-15T20:30:00');
  const res4 = scheduler.getAdaptiveInterval(d4);
  console.assert(res4.phase === 'EVENING', `20:30 should be EVENING, got: ${res4.phase}`);
  console.log('✅ Case 4 passed: 08:30 PM ->', res4.description);

  // Case 5: Midnight Reset Window (11:58 PM)
  const d5 = new Date('2026-09-15T23:58:00');
  const res5 = scheduler.getAdaptiveInterval(d5);
  console.assert(res5.phase === 'PEAK', `23:58 should be PEAK, got: ${res5.phase}`);
  console.log('✅ Case 5 passed: 11:58 PM ->', res5.description);

  // Case 6: Deep Night Repose (03:30 AM)
  const d6 = new Date('2026-09-15T03:30:00');
  const res6 = scheduler.getAdaptiveInterval(d6);
  console.assert(res6.phase === 'NIGHT', `03:30 should be NIGHT, got: ${res6.phase}`);
  console.assert(res6.intervalSeconds >= 800 && res6.intervalSeconds <= 1000, `Night interval out of bounds: ${res6.intervalSeconds}`);
  console.log('✅ Case 6 passed: 03:30 AM ->', res6.description);

  console.log('\n🎉 ALL ADAPTIVE SCHEDULER PHASES VERIFIED SUCCESSFULLY!');
}

testAdaptiveScheduler();
