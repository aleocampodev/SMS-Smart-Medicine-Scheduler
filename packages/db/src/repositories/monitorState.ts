import { eq } from "drizzle-orm";

import type { Database } from "../index.js";
import { monitorState } from "../schema/profiles.js";

export type MonitorStateStatus = "AWAITING_CONFIRMATION" | "SELECTING_BRANCH" | "ACTIVE" | "PAUSED";
export type MonitorStateRecord = typeof monitorState.$inferSelect;

const DEFAULT_ROW_ID = "default";

/**
 * Data-access boundary for persisting the Telegram pre-search gate status.
 */
export function createMonitorStateRepository(db: Database) {
  return {
    async getStatus(): Promise<MonitorStateStatus> {
      const [row] = await db
        .select()
        .from(monitorState)
        .where(eq(monitorState.id, DEFAULT_ROW_ID))
        .limit(1);

      const status = row?.status;
      if (
        status === "ACTIVE" ||
        status === "PAUSED" ||
        status === "SELECTING_BRANCH" ||
        status === "AWAITING_CONFIRMATION"
      ) {
        return status;
      }
      return "AWAITING_CONFIRMATION";
    },

    async setStatus(status: MonitorStateStatus): Promise<void> {
      await db
        .insert(monitorState)
        .values({ id: DEFAULT_ROW_ID, status })
        .onConflictDoUpdate({
          target: monitorState.id,
          set: { status, updatedAt: new Date() },
        });
    },

    async getSelectedBranches(fallback: string[] = ["PISO3", "PISO6"]): Promise<string[]> {
      const [row] = await db
        .select({ selectedBranches: monitorState.selectedBranches })
        .from(monitorState)
        .where(eq(monitorState.id, DEFAULT_ROW_ID))
        .limit(1);

      if (!row?.selectedBranches) {
        return [...fallback];
      }

      try {
        const parsed = JSON.parse(row.selectedBranches);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          return parsed;
        }
      } catch {
        // Fall back to comma-separated parsing if non-JSON string was stored
        const split = row.selectedBranches
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (split.length > 0) return split;
      }

      return [...fallback];
    },

    async setSelectedBranches(branches: string[]): Promise<void> {
      const serialized = JSON.stringify(branches);
      await db
        .insert(monitorState)
        .values({
          id: DEFAULT_ROW_ID,
          status: "AWAITING_CONFIRMATION",
          selectedBranches: serialized,
        })
        .onConflictDoUpdate({
          target: monitorState.id,
          set: { selectedBranches: serialized, updatedAt: new Date() },
        });
    },
  };
}

export type MonitorStateRepository = ReturnType<typeof createMonitorStateRepository>;
