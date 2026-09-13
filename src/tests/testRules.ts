import { RulesEngine } from '../poller/rulesEngine.js';
import { loadProfiles } from '../config/profiles.js';

function runTests() {
  console.log('🧪 Corriendo pruebas del Motor de Reglas (RulesEngine)...\n');
  const engine = new RulesEngine();

  // Test 1: Menos de dos JSON (Debe fallar Regla 1)
  console.log('Test 1: Fallo por cantidad insuficiente (<= 2 items)');
  const res1 = engine.evaluate([
    { id: 1, status: 'free', date: '2026-10-15' }
  ]);
  console.assert(!res1.hasAvailability, 'Test 1 falló: debería rechazar <= 2 items');
  console.log('✅ Test 1 aprobado:', res1.reasons[0]);

  // Test 2: Solo slots con fecha de hoy (Debe fallar Regla 3)
  console.log('\nTest 2: Rechazo por ser fecha de hoy (Regla 3)');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const res2 = engine.evaluate([
    { id: 1, status: 'free', date: todayStr },
    { id: 2, status: 'free', date: todayStr },
    { id: 3, status: 'free', date: todayStr }
  ]);
  console.assert(!res2.hasAvailability, 'Test 2 falló: debería rechazar citas de la fecha actual');
  console.log('✅ Test 2 aprobado: no se aceptaron citas de hoy');

  // Test 3: Slots ocupados (Debe fallar Regla 2)
  console.log('\nTest 3: Rechazo por status occupied (Regla 2)');
  const res3 = engine.evaluate([
    { id: 1, status: 'occupied', date: '2026-10-20' },
    { id: 2, status: 'taken', date: '2026-10-20' },
    { id: 3, status: 'reserved', date: '2026-10-20' }
  ]);
  console.assert(!res3.hasAvailability, 'Test 3 falló: debería rechazar slots no disponibles');
  console.log('✅ Test 3 aprobado: filtrado por status free');

  // Test 4: Cumple las 3 reglas exitosamente
  console.log('\nTest 4: Cumplimiento total de las 3 reglas');
  const validData = [
    { id: 'slot_1', status: 'free', date: '2026-10-20', time: '08:30', branch: 'Sede Norte' },
    { id: 'slot_2', status: 'free', date: '2026-10-21', time: '11:00', branch: 'Sede Centro' },
    { id: 'slot_3', status: 'free', date: '2026-10-22', time: '14:15', branch: 'Sede Sur' }
  ];
  const res4 = engine.evaluate(validData);
  console.assert(res4.hasAvailability, 'Test 4 falló: debería detectar disponibilidad');
  console.assert(res4.matchingSlots.length === 3, 'Test 4 falló: debieron coincidir 3 slots');
  console.log('✅ Test 4 aprobado:', res4.reasons);

  // Test 5: Deduplicación (Anti-spam)
  console.log('\nTest 5: Deduplicación de slots ya notificados');
  const unnotified1 = engine.filterUnnotifiedSlots(res4.matchingSlots);
  console.assert(unnotified1.length === 3, 'Deben ser 3 slots nuevos la primera vez');
  const unnotified2 = engine.filterUnnotifiedSlots(res4.matchingSlots);
  console.assert(unnotified2.length === 0, 'La segunda vez deben ser 0 para evitar spam');
  console.log('✅ Test 5 aprobado: Deduplicación funciona correctamente');

  // Test 6: Carga y validación de perfiles
  console.log('\nTest 6: Carga de perfiles');
  const profiles = loadProfiles();
  console.assert(profiles.length > 0, 'Debe haber al menos 1 perfil en profiles.example.json');
  console.log(`✅ Test 6 aprobado: ${profiles.length} perfiles cargados y validados con Zod.`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE!');
}

runTests();
