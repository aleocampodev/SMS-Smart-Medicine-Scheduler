import { TRPCError } from "@trpc/server";
import { profile } from "@SMS/db/schema/profiles";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

const profileFields = {
  displayName: z.string().trim().min(1),
  documentType: z.string().trim().min(1).default("CC"),
  documentNumber: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  birthDate: dateString,
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  healthEntity: z.string().trim().min(1).optional(),
  prescriptionCode: z.string().trim().optional(),
};

const createProfileInput = z.object(profileFields);

const updateProfileInput = z.object({
  id: z.string().min(1),
  displayName: profileFields.displayName.optional(),
  documentType: z.string().trim().min(1).optional(),
  documentNumber: profileFields.documentNumber.optional(),
  firstName: profileFields.firstName.optional(),
  lastName: profileFields.lastName.optional(),
  birthDate: profileFields.birthDate.optional(),
  phone: profileFields.phone.optional(),
  email: profileFields.email.optional(),
  healthEntity: profileFields.healthEntity,
  prescriptionCode: profileFields.prescriptionCode,
});

const profileIdInput = z.object({ id: z.string().min(1) });

export const profilesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(profile)
      .where(eq(profile.userId, ctx.session.user.id))
      .orderBy(asc(profile.createdAt));
  }),

  create: protectedProcedure.input(createProfileInput).mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(profile)
      .values({
        id: crypto.randomUUID(),
        userId: ctx.session.user.id,
        ...input,
      })
      .returning();

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Profile could not be created",
      });
    }

    return created;
  }),

  update: protectedProcedure.input(updateProfileInput).mutation(async ({ ctx, input }) => {
    const { id, ...changes } = input;

    if (Object.values(changes).every((value) => value === undefined)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "At least one field must be provided" });
    }

    const [updated] = await ctx.db
      .update(profile)
      .set(changes)
      .where(and(eq(profile.id, id), eq(profile.userId, ctx.session.user.id)))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    return updated;
  }),

  delete: protectedProcedure.input(profileIdInput).mutation(async ({ ctx, input }) => {
    const [deleted] = await ctx.db
      .delete(profile)
      .where(and(eq(profile.id, input.id), eq(profile.userId, ctx.session.user.id)))
      .returning();

    if (!deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    return deleted;
  }),
});
