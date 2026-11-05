import { TRPCError } from "@trpc/server";
import type { Database } from "@SMS/db";
import { appointment, profile } from "@SMS/db/schema/profiles";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const appointmentStatus = z.enum(["alerted", "booked", "cancelled", "failed"]);

const createAppointmentInput = z.object({
  profileId: z.string().min(1),
  branchId: z.string().trim().min(1),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date"),
  slotTime: z.string().trim().min(1).optional(),
  confirmationCode: z.string().trim().min(1).optional(),
});

const listAppointmentsInput = z.object({ profileId: z.string().min(1).optional() }).optional();

const updateAppointmentStatusInput = z.object({
  id: z.string().min(1),
  status: appointmentStatus,
  confirmationCode: z.string().trim().min(1).optional(),
});

async function assertOwnedProfile(db: Database, userId: string, profileId: string) {
  const [owned] = await db
    .select({ id: profile.id })
    .from(profile)
    .where(and(eq(profile.id, profileId), eq(profile.userId, userId)))
    .limit(1);

  if (!owned) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }
}

export const appointmentsRouter = router({
  list: protectedProcedure.input(listAppointmentsInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({ appointment })
      .from(appointment)
      .innerJoin(profile, eq(appointment.profileId, profile.id))
      .where(
        and(
          eq(profile.userId, ctx.session.user.id),
          input?.profileId ? eq(appointment.profileId, input.profileId) : undefined,
        ),
      )
      .orderBy(asc(appointment.createdAt));

    return rows.map((row) => row.appointment);
  }),

  create: protectedProcedure.input(createAppointmentInput).mutation(async ({ ctx, input }) => {
    await assertOwnedProfile(ctx.db, ctx.session.user.id, input.profileId);

    const [created] = await ctx.db
      .insert(appointment)
      .values({
        id: crypto.randomUUID(),
        ...input,
      })
      .returning();

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Appointment could not be created",
      });
    }

    return created;
  }),

  updateStatus: protectedProcedure
    .input(updateAppointmentStatusInput)
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: appointment.id })
        .from(appointment)
        .innerJoin(profile, eq(appointment.profileId, profile.id))
        .where(and(eq(appointment.id, input.id), eq(profile.userId, ctx.session.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      }

      const [updated] = await ctx.db
        .update(appointment)
        .set({
          status: input.status,
          ...(input.confirmationCode !== undefined
            ? { confirmationCode: input.confirmationCode }
            : {}),
        })
        .where(eq(appointment.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Appointment could not be updated",
        });
      }

      return updated;
    }),
});
