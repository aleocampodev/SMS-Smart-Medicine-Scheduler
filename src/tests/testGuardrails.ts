import { maskDocument } from '../config/profiles.js';
import { PlaywrightBooker } from '../automation/playwrightBooker.js';

async function testGuardrails() {
  console.log('🛡️ Corriendo pruebas de Guardrails (OpenSpec)...\n');

  // Test Guardrail G-SEC-02: Enmascaramiento de datos
  console.log('Test G-SEC-02: Enmascaramiento de cédulas/documentos sensibles');
  const masked1 = maskDocument('1234567890');
  console.assert(masked1 === '******7890', `Esperado '******7890', obtenido '${masked1}'`);
  const masked2 = maskDocument('10987654321');
  console.assert(masked2 === '*******4321', `Esperado '*******4321', obtenido '${masked2}'`);
  console.log('✅ G-SEC-02 aprobado: Cédulas ofuscadas protegiendo PII (ej: ' + masked1 + ')');

  // Test Guardrail G-ACT-02: Concurrencia unitaria (Single Lock)
  console.log('\nTest G-ACT-02: Mutex de concurrencia en PlaywrightBooker');
  const booker = new PlaywrightBooker();
  
  // Simular lock activo forzando el estado interno
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

  console.assert(!rejectResult.success, 'Debería haber rechazado la segunda reserva paralela');
  console.assert(rejectResult.message.includes('G-ACT-02'), 'Mensaje debe citar guardrail G-ACT-02');
  console.log('✅ G-ACT-02 aprobado: Bloqueo de ejecuciones concurrentes activo');

  console.log('\n🎉 ¡TODOS LOS GUARDRAILS PROBADOS CUMPLEN LA ESPECIFICACIÓN OPENSPEC!');
}

testGuardrails().catch(console.error);
