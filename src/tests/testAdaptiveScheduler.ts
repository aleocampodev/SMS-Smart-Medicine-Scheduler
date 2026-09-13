import { AdaptiveScheduler } from '../poller/adaptiveScheduler.js';

function testAdaptiveScheduler() {
  console.log('🧪 Probando Sondeo Adaptativo Diario (AdaptiveScheduler)...\n');
  const scheduler = new AdaptiveScheduler();

  // Caso 1: Mañana Hora Pico (07:30 AM)
  const d1 = new Date('2026-09-15T07:30:00');
  const res1 = scheduler.getAdaptiveInterval(d1);
  console.assert(res1.phase === 'PEAK', `07:30 debería ser PEAK, obtenido: ${res1.phase}`);
  console.assert(res1.intervalSeconds >= 30 && res1.intervalSeconds <= 55, `Intervalo pico fuera de rango: ${res1.intervalSeconds}`);
  console.log('✅ Caso 1 aprobado: 07:30 AM ->', res1.description);

  // Caso 2: Mediodía Pico (12:15 PM)
  const d2 = new Date('2026-09-15T12:15:00');
  const res2 = scheduler.getAdaptiveInterval(d2);
  console.assert(res2.phase === 'PEAK', `12:15 debería ser PEAK, obtenido: ${res2.phase}`);
  console.log('✅ Caso 2 aprobado: 12:15 PM ->', res2.description);

  // Caso 3: Horario Hábil Normal (03:00 PM)
  const d3 = new Date('2026-09-15T15:00:00');
  const res3 = scheduler.getAdaptiveInterval(d3);
  console.assert(res3.phase === 'DAYTIME', `15:00 debería ser DAYTIME, obtenido: ${res3.phase}`);
  console.assert(res3.intervalSeconds >= 100 && res3.intervalSeconds <= 140, `Intervalo normal fuera de rango: ${res3.intervalSeconds}`);
  console.log('✅ Caso 3 aprobado: 03:00 PM ->', res3.description);

  // Caso 4: Tarde / Noche (08:30 PM)
  const d4 = new Date('2026-09-15T20:30:00');
  const res4 = scheduler.getAdaptiveInterval(d4);
  console.assert(res4.phase === 'EVENING', `20:30 debería ser EVENING, obtenido: ${res4.phase}`);
  console.log('✅ Caso 4 aprobado: 08:30 PM ->', res4.description);

  // Caso 5: Ventana Medianoche Reset (11:58 PM)
  const d5 = new Date('2026-09-15T23:58:00');
  const res5 = scheduler.getAdaptiveInterval(d5);
  console.assert(res5.phase === 'PEAK', `23:58 debería ser PEAK, obtenido: ${res5.phase}`);
  console.log('✅ Caso 5 aprobado: 11:58 PM ->', res5.description);

  // Caso 6: Noche Profunda Reposo (03:30 AM)
  const d6 = new Date('2026-09-15T03:30:00');
  const res6 = scheduler.getAdaptiveInterval(d6);
  console.assert(res6.phase === 'NIGHT', `03:30 debería ser NIGHT, obtenido: ${res6.phase}`);
  console.assert(res6.intervalSeconds >= 800 && res6.intervalSeconds <= 1000, `Intervalo nocturno fuera de rango: ${res6.intervalSeconds}`);
  console.log('✅ Caso 6 aprobado: 03:30 AM ->', res6.description);

  console.log('\n🎉 ¡TODAS LAS FASES DEL SONDEO ADAPTATIVO FUNCIONAN PERFECTAMENTE!');
}

testAdaptiveScheduler();
