export type SchedulerPhase = 'PEAK' | 'DAYTIME' | 'EVENING' | 'NIGHT';

export interface AdaptiveIntervalResult {
  intervalMs: number;
  intervalSeconds: number;
  phase: SchedulerPhase;
  description?: string;
}

export function getAdaptiveInterval(
  date: Date = new Date(),
  baseOverrideSeconds?: number
): AdaptiveIntervalResult {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeDecimal = hour + minute / 60;

  // Window 1: Midnight schedule reset (23:55 to 00:20)
  const isMidnightWindow = (hour === 23 && minute >= 55) || (hour === 0 && minute <= 20);

  // Window 2: Morning peak opening (06:45 to 09:15)
  const isMorningPeak = timeDecimal >= 6.75 && timeDecimal <= 9.25;

  // Window 3: Midday cancellation peak (11:50 to 13:15)
  const isMiddayPeak = timeDecimal >= 11.83 && timeDecimal <= 13.25;

  // PHASE 1: PEAK HOURS (Fast Polling: 35s - 50s)
  if (isMidnightWindow || isMorningPeak || isMiddayPeak) {
    const base = baseOverrideSeconds || 40;
    const jitter = Math.floor(Math.random() * 16) - 5; // -5s to +10s
    const seconds = Math.max(30, base + jitter);
    return {
      intervalMs: seconds * 1000,
      intervalSeconds: seconds,
      phase: 'PEAK',
    };
  }

  // PHASE 2: STANDARD BUSINESS DAY (09:15 to 18:00) - Polling every ~2 minutes
  if (timeDecimal > 9.25 && timeDecimal < 18.0) {
    const jitter = Math.floor(Math.random() * 31) - 15; // -15s to +15s
    const seconds = 120 + jitter; // ~105s to 135s (~2 mins)
    return {
      intervalMs: seconds * 1000,
      intervalSeconds: seconds,
      phase: 'DAYTIME',
    };
  }

  // PHASE 3: EVENING (18:00 to 23:55) - Polling every ~5 minutes
  if (timeDecimal >= 18.0 && !(hour === 23 && minute >= 55)) {
    const jitter = Math.floor(Math.random() * 41) - 20; // -20s to +20s
    const seconds = 300 + jitter; // ~280s to 320s (~5 mins)
    return {
      intervalMs: seconds * 1000,
      intervalSeconds: seconds,
      phase: 'EVENING',
    };
  }

  // PHASE 4: DEEP NIGHT / SLEEP (00:20 to 06:45) - Polling every ~15 minutes to protect IP
  const jitter = Math.floor(Math.random() * 121) - 60; // -60s to +60s
  const seconds = 900 + jitter; // ~14 to 16 min
  return {
    intervalMs: seconds * 1000,
    intervalSeconds: seconds,
    phase: 'NIGHT',
  };
}
