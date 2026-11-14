import { shouldPoll, summarizeBranchSlots, transitionMonitorStatus } from "@SMS/poller";
import { PlaywrightBooker } from "./automation/playwrightBooker.js";
import { env } from "./config/env.js";
import { loadProfiles, maskDocument } from "./config/profiles.js";
import { QantyClient } from "./poller/qantyClient.js";
import { RulesEngine } from "./poller/rulesEngine.js";
import { AdaptiveScheduler } from "./poller/adaptiveScheduler.js";
import { TelegramBotService } from "./bot/telegramBot.js";
import { InMemoryMonitorStateAdapter } from "./ports.js";

async function main() {
  console.log("====================================================");
  console.log("💊 SMS - Smart Medicine Scheduler Starting...");
  console.log("====================================================");

  const profiles = loadProfiles();
  console.log(`[Config] Loaded profiles: ${profiles.length}`);
  profiles.forEach((p) =>
    console.log(
      `  - ${p.displayName} (${p.documentType} ${maskDocument(p.documentNumber)})${p.targetBranch ? ` -> ${p.targetBranch}` : ""}`,
    ),
  );

  const qantyClient = new QantyClient();
  const rulesEngine = new RulesEngine();
  const booker = new PlaywrightBooker();
  const statePort = new InMemoryMonitorStateAdapter("AWAITING_CONFIRMATION", env.TARGET_BRANCH_IDS);

  const pollCycle = async () => {
    try {
      const currentStatus = await statePort.getStatus();
      if (!shouldPoll(currentStatus)) {
        console.log(
          `[Poller] Skipping web search (monitor status is ${currentStatus}). Waiting for Telegram confirmation.`,
        );
        return;
      }

      const targetBranches = await statePort.getSelectedBranches();
      console.log(
        `\n[Poller] [${new Date().toISOString()}] Checking appointment availability in Qanty for ${targetBranches.length} selected branch(es): ${targetBranches.join(", ")}...`,
      );

      for (const branchId of targetBranches) {
        console.log(`[Poller:Branch ${branchId}] Querying schedule...`);
        const rawData = await qantyClient.fetchDaySchedule({ branchId });

        const evaluation = rulesEngine.evaluate(rawData, { branchId });
        console.log(`[RulesEngine:Branch ${branchId}] Evaluation:`, evaluation.reasons);

        if (evaluation.hasAvailability) {
          const newSlots = rulesEngine.filterUnnotifiedSlots(evaluation.matchingSlots);
          const digest = summarizeBranchSlots(newSlots);

          if (digest) {
            const targetProfile = profiles.find((p) => p.targetBranch === branchId) || profiles[0];

            if (!targetProfile) {
              await botService.sendAvailabilityAlert(
                digest.earliestSlot,
                profiles,
                digest.totalCount,
              );
              continue;
            }

            console.log(
              `[Poller:Branch ${branchId}] 🚀 Auto-booking earliest slot for ${targetProfile.displayName} (${digest.totalCount} total free)...`,
            );
            const result = await booker.bookAppointment(digest.earliestSlot, targetProfile);
            await botService.notifyBookingOutcome(result, targetProfile);

            if (result.success) {
              const updated = transitionMonitorStatus(await statePort.getStatus(), "PAUSE");
              await statePort.setStatus(updated);
              console.log(
                `[Poller:Branch ${branchId}] ✅ Auto-booking succeeded. Monitor paused to avoid duplicate bookings.`,
              );
              return;
            }
          } else {
            console.log(
              `[Poller:Branch ${branchId}] Available slots were already notified previously.`,
            );
          }
        }
      }
    } catch (err: any) {
      console.error(`[Poller] Polling cycle error:`, err.message);
    }
  };

  const botService = new TelegramBotService({
    statePort,
    booker,
    onActivate: pollCycle,
  });

  // Start Telegram bot listener and ask the user before any web search
  await botService.start();
  await botService.sendClaimCheckPrompt();

  console.log(
    `[Poller] Monitoring armed for branches: ${env.TARGET_BRANCH_IDS.join(", ")} (waiting for Telegram confirmation; base interval: ${env.POLL_INTERVAL_SECONDS}s)...`,
  );

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

  scheduleNextPoll();
}

main().catch((err) => {
  console.error("[Fatal Error]:", err);
  process.exit(1);
});
