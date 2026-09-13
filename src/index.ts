import { env } from './config/env.js';
import { loadProfiles, maskDocument } from './config/profiles.js';
import { QantyClient } from './poller/qantyClient.js';
import { RulesEngine } from './poller/rulesEngine.js';
import { AdaptiveScheduler } from './poller/adaptiveScheduler.js';
import { TelegramBotService } from './bot/telegramBot.js';

async function main() {
  console.log('====================================================');
  console.log('💊 SMS - Smart Medicine Scheduler Starting...');
  console.log('====================================================');

  const profiles = loadProfiles();
  console.log(`[Config] Loaded profiles: ${profiles.length}`);
  profiles.forEach((p) => console.log(`  - ${p.displayName} (${p.documentType} ${maskDocument(p.documentNumber)})`));

  const qantyClient = new QantyClient();
  const rulesEngine = new RulesEngine();
  const botService = new TelegramBotService();

  // Start Telegram bot listener
  await botService.start();

  console.log(`[Poller] Starting monitoring loop for branches: ${env.TARGET_BRANCH_IDS.join(', ')} (base interval: ${env.POLL_INTERVAL_SECONDS}s)...`);

  const pollCycle = async () => {
    try {
      console.log(`\n[Poller] [${new Date().toISOString()}] Checking appointment availability in Qanty for ${env.TARGET_BRANCH_IDS.length} target branches...`);

      for (const branchId of env.TARGET_BRANCH_IDS) {
        console.log(`[Poller:Branch ${branchId}] Querying schedule...`);
        const rawData = await qantyClient.fetchDaySchedule({ branchId });

        const evaluation = rulesEngine.evaluate(rawData, { branchId });
        console.log(`[RulesEngine:Branch ${branchId}] Evaluation:`, evaluation.reasons);

        if (evaluation.hasAvailability) {
          const newSlots = rulesEngine.filterUnnotifiedSlots(evaluation.matchingSlots);

          if (newSlots.length > 0) {
            console.log(`[Poller:Branch ${branchId}] 🚨 Found ${newSlots.length} new available slots to notify!`);
            for (const slot of newSlots) {
              await botService.sendAvailabilityAlert(slot, profiles);
            }
          } else {
            console.log(`[Poller:Branch ${branchId}] Available slots were already notified previously.`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Poller] Polling cycle error:`, err.message);
    }
  };


  const adaptiveScheduler = new AdaptiveScheduler();

  // Schedule next polling using smart adaptive daily timeline (Option A)
  const scheduleNextPoll = () => {
    const adaptive = adaptiveScheduler.getAdaptiveInterval(new Date(), env.POLL_INTERVAL_SECONDS);
    console.log(`[Scheduler:Adaptive] ${adaptive.description}`);

    setTimeout(async () => {
      await pollCycle();
      scheduleNextPoll();
    }, adaptive.intervalMs);
  };

  // Run initial check immediately and schedule subsequent checks
  await pollCycle();
  scheduleNextPoll();
}

main().catch((err) => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
