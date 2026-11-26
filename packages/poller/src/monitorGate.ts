import type { QantySlot } from "./rules.js";

export type MonitorStatus = "AWAITING_CONFIRMATION" | "SELECTING_BRANCH" | "ACTIVE" | "PAUSED";

export type MonitorEvent =
  | "CLAIM_YES"
  | "CLAIM_NO"
  | "BRANCH_SELECTED"
  | "RESUME"
  | "PAUSE"
  | "PROMPT";

export interface BranchSlotDigest {
  totalCount: number;
  earliestSlot: QantySlot;
}

/**
 * Pure guard: web polling is permitted ONLY when the user has confirmed
 * they still need medications AND selected target branches (status === "ACTIVE").
 */
export function shouldPoll(status: MonitorStatus): boolean {
  return status === "ACTIVE";
}

/**
 * Pure state transition table for the 2-step Telegram pre-search gate.
 */
export function transitionMonitorStatus(
  _current: MonitorStatus,
  event: MonitorEvent,
): MonitorStatus {
  switch (event) {
    case "CLAIM_YES":
    case "PAUSE":
      return "PAUSED";
    case "CLAIM_NO":
      return "SELECTING_BRANCH";
    case "BRANCH_SELECTED":
    case "RESUME":
      return "ACTIVE";
    case "PROMPT":
      return "AWAITING_CONFIRMATION";
  }
}

/**
 * Resolves a Telegram branch selection callback ("PISO3", "118", "ALL") into branch keys.
 */
export function resolveSelectedBranches(
  choice: string,
  defaultBranches: string[] = ["PISO3", "PISO6"],
): string[] {
  if (choice === "ALL") return [...defaultBranches];
  return [choice];
}

/**
 * Collapses N matching slots for a single branch into one digest
 * selecting the chronologically earliest slot to prevent alert flooding.
 */
export function summarizeBranchSlots(slots: QantySlot[]): BranchSlotDigest | null {
  if (slots.length === 0) return null;

  const sorted = [...slots].sort((a, b) => {
    const keyA = `${a.date}T${a.time ?? "23:59:59"}`;
    const keyB = `${b.date}T${b.time ?? "23:59:59"}`;
    return keyA.localeCompare(keyB);
  });

  return {
    totalCount: slots.length,
    earliestSlot: sorted[0]!,
  };
}

export interface DailyPromptDecision {
  trigger: boolean;
  localDay: string;
}

/**
 * Pure check for whether the daily afternoon Telegram claim-check prompt
 * should fire once for the current local day (default: 16:00 America/Bogota).
 */
export function shouldTriggerDailyClaimPrompt(
  now: Date,
  lastPromptDay: string | null,
  promptHour: number = 16,
  timeZone: string = "America/Bogota",
): DailyPromptDecision {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const localDay = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const localHour = Number(getPart("hour"));

  return {
    trigger: localHour >= promptHour && lastPromptDay !== localDay,
    localDay,
  };
}
