import { eq } from "drizzle-orm";

import type { Database } from "../index";
import { monitorState } from "../schema/profiles";

export type MonitorStateStatus = "AWAITING_CONFIRMATION" | "ACTIVE" | "PAUSED";
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
      if (status === "ACTIVE" || status === "PAUSED" || status === "AWAITING_CONFIRMATION") {
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
  };
}

export type MonitorStateRepository = ReturnType<typeof createMonitorStateRepository>;
