import type { MonitorStatus } from "@SMS/poller";
import type { BookingResult, Profile, QantySlot } from "./types/index.js";

/**
 * Outbound port for deterministic appointment booking.
 */
export interface BookingPort {
  bookAppointment(slot: QantySlot, profile: Profile): Promise<BookingResult>;
}

/**
 * Outbound port for user notifications and pre-search confirmation prompts.
 */
export interface NotificationPort {
  start(): Promise<void>;
  sendClaimCheckPrompt(): Promise<void>;
  sendAvailabilityAlert(
    slot: QantySlot,
    profiles: Profile[],
    totalBranchSlots?: number,
  ): Promise<void>;
  notifyBookingOutcome(result: BookingResult, profile: Profile): Promise<void>;
}

/**
 * Persistence port for the Telegram pre-search medication-claim gate and branch target.
 */
export interface MonitorStatePort {
  getStatus(): Promise<MonitorStatus>;
  setStatus(status: MonitorStatus): Promise<void>;
  getSelectedBranches(): Promise<string[]>;
  setSelectedBranches(branches: string[]): Promise<void>;
}

/**
 * Default in-memory state adapter when PostgreSQL is not attached.
 */
export class InMemoryMonitorStateAdapter implements MonitorStatePort {
  private status: MonitorStatus;
  private selectedBranches: string[];

  constructor(
    initialStatus: MonitorStatus = "AWAITING_CONFIRMATION",
    initialBranches: string[] = ["PISO3", "PISO6"],
  ) {
    this.status = initialStatus;
    this.selectedBranches = [...initialBranches];
  }

  public async getStatus(): Promise<MonitorStatus> {
    return this.status;
  }

  public async setStatus(status: MonitorStatus): Promise<void> {
    this.status = status;
  }

  public async getSelectedBranches(): Promise<string[]> {
    return [...this.selectedBranches];
  }

  public async setSelectedBranches(branches: string[]): Promise<void> {
    this.selectedBranches = [...branches];
  }
}
