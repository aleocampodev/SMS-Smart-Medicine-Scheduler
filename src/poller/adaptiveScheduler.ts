import { getAdaptiveInterval as getPureInterval } from "../../packages/poller/src/scheduler.js";
import type {
  AdaptiveIntervalResult,
  SchedulerPhase,
} from "../../packages/poller/src/scheduler.js";

export type { SchedulerPhase, AdaptiveIntervalResult };

// Thin OOP adapter over the functional core in packages/poller.
// Preserves the legacy class API and user-facing descriptions.
export class AdaptiveScheduler {
  public getCurrentTimeDetails(date: Date = new Date()): {
    hour: number;
    minute: number;
    timeDecimal: number;
  } {
    const hour = date.getHours();
    const minute = date.getMinutes();
    return { hour, minute, timeDecimal: hour + minute / 60 };
  }

  public getAdaptiveInterval(
    date: Date = new Date(),
    baseOverrideSeconds?: number,
  ): AdaptiveIntervalResult {
    const raw = getPureInterval(date, baseOverrideSeconds);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    if (raw.phase === "PEAK") {
      return {
        ...raw,
        description: `🔥 Peak Hours (${hour}:${minute}) — Fast check every ${raw.intervalSeconds}s`,
      };
    }
    if (raw.phase === "DAYTIME") {
      return {
        ...raw,
        description: `🟡 Regular Hours (${hour}:${minute}) — Cancellation tracking every ${raw.intervalSeconds}s (~2 min)`,
      };
    }
    if (raw.phase === "EVENING") {
      return {
        ...raw,
        description: `☕ Evening Hours (${hour}:${minute}) — Passive check every ${Math.round(raw.intervalSeconds / 60)} min`,
      };
    }
    return {
      ...raw,
      description: `💤 Night Repose (${hour}:${minute}) — Sleep mode protecting IP (~15 min)`,
    };
  }
}
