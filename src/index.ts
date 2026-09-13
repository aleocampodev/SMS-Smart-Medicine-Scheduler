import { env } from './config/env.js';
import { loadProfiles } from './config/profiles.js';
import { QantyClient } from './poller/qantyClient.js';
import { RulesEngine } from './poller/rulesEngine.js';
import { AdaptiveScheduler } from './poller/adaptiveScheduler.js';
import { TelegramBotService } from './bot/telegramBot.js';

async function main() {
  console.log('====================================================');
  console.log('💊 SMS - Smart Medicine Scheduler Starting...');
  console.log('====================================================');

  const profiles = loadProfiles();
  console.log(`[Config] Perfiles cargados: ${profiles.length}`);
  profiles.forEach((p) => console.log(`  - ${p.displayName} (${p.documentType} ${p.documentNumber})`));

  const qantyClient = new QantyClient();
  const rulesEngine = new RulesEngine();
  const botService = new TelegramBotService();

  // Iniciar bot de Telegram
  await botService.start();

  console.log(`[Poller] Iniciando ciclo de monitoreo cada ${env.POLL_INTERVAL_SECONDS} segundos...`);

  const pollCycle = async () => {
    try {
      console.log(`\n[Poller] [${new Date().toISOString()}] Consultando disponibilidad en Qanty...`);
      const rawData = await qantyClient.fetchDaySchedule();

      const evaluation = rulesEngine.evaluate(rawData);
      console.log(`[RulesEngine] Resultado de evaluación:`, evaluation.reasons);

      if (evaluation.hasAvailability) {
        const newSlots = rulesEngine.filterUnnotifiedSlots(evaluation.matchingSlots);

        if (newSlots.length > 0) {
          console.log(`[Poller] ¡${newSlots.length} nuevos slots detectados para alertar!`);
          for (const slot of newSlots) {
            await botService.sendAvailabilityAlert(slot, profiles);
          }
        } else {
          console.log(`[Poller] Citas encontradas ya fueron notificadas previamente.`);
        }
      }
    } catch (err: any) {
      console.error(`[Poller] Error en ciclo de sondeo:`, err.message);
    }
  };

  const adaptiveScheduler = new AdaptiveScheduler();

  // Programar ejecuciones inteligentes según el ciclo diario (Opción A)
  const scheduleNextPoll = () => {
    const adaptive = adaptiveScheduler.getAdaptiveInterval(new Date(), env.POLL_INTERVAL_SECONDS);
    console.log(`[Scheduler:Adaptive] ${adaptive.description}`);

    setTimeout(async () => {
      await pollCycle();
      scheduleNextPoll();
    }, adaptive.intervalMs);
  };

  // Ejecutar primer ciclo inmediatamente y programar siguientes con horario inteligente
  await pollCycle();
  scheduleNextPoll();
}

main().catch((err) => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
