import { maskDocument } from '../config/profiles.js';
import { PlaywrightBooker } from '../automation/playwrightBooker.js';

async function testGuardrails() {
  console.log('🛡️ Running OpenSpec Guardrails test suite...\n');

  // Test Guardrail G-SEC-02: Data Masking
  console.log('Test G-SEC-02: National Document / PII Masking');
  const masked1 = maskDocument('1234567890');
  console.assert(masked1 === '******7890', `Expected '******7890', got '${masked1}'`);
  const masked2 = maskDocument('10987654321');
  console.assert(masked2 === '*******4321', `Expected '*******4321', got '${masked2}'`);
  console.log('✅ G-SEC-02 passed: Document IDs masked protecting PII (e.g. ' + masked1 + ')');

  // Test Guardrail G-ACT-02: Concurrency Mutex (Single Lock)
  console.log('\nTest G-ACT-02: Concurrency Mutex Lock in PlaywrightBooker');
  const booker = new PlaywrightBooker();
  
  // Simulate active lock
  (booker as any).isBookingInProgress = true;
  const rejectResult = await booker.bookAppointment(
    { date: '2026-10-15', status: 'free' },
    {
      id: 'test_user',
      displayName: 'Test User',
      documentType: 'CC',
      documentNumber: '123456789',
      firstName: 'Test',
      lastName: 'User',
      birthDate: '1990-01-01',
      phone: '3000000000',
      email: 'test@example.com'
    }
  );

  console.assert(!rejectResult.success, 'Expected rejection for parallel booking session');
  console.assert(rejectResult.message.includes('G-ACT-02'), 'Message must cite guardrail G-ACT-02');
  console.log('✅ G-ACT-02 passed: Parallel execution correctly rejected');

  console.log('\n🎉 ALL OPENSPEC GUARDRAILS VERIFIED SUCCESSFULLY!');
}

testGuardrails().catch(console.error);
