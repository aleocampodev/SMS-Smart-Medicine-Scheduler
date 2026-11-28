import { eq } from "drizzle-orm";

import type { Database } from "../index.js";
import { appointment, profile } from "../schema/profiles.js";

export type AppointmentStatus = "alerted" | "booked" | "cancelled" | "failed";

export interface RecordAppointmentInput {
  profileId?: string | null;
  branchId: string;
  slotDate: string;
  slotTime?: string | null;
  status: AppointmentStatus;
  confirmationCode?: string | null;
}

/**
 * Data-access boundary for recording alerted and booked appointments from the scheduler.
 */
export function createAppointmentRepository(db: Database) {
  return {
    async record(input: RecordAppointmentInput) {
      let resolvedProfileId: string | null = null;
      if (input.profileId) {
        const [existingProfile] = await db
          .select({ id: profile.id })
          .from(profile)
          .where(eq(profile.id, input.profileId))
          .limit(1);
        resolvedProfileId = existingProfile?.id ?? null;
      }

      const [created] = await db
        .insert(appointment)
        .values({
          id: crypto.randomUUID(),
          profileId: resolvedProfileId,
          branchId: input.branchId,
          slotDate: input.slotDate,
          slotTime: input.slotTime ?? null,
          status: input.status,
          confirmationCode: input.confirmationCode ?? null,
        })
        .returning();

      return created;
    },
  };
}

export type AppointmentRepository = ReturnType<typeof createAppointmentRepository>;
