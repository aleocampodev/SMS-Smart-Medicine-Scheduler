import { createMonitorStateRepository } from "@SMS/db/repositories/monitorState";
import { z } from "zod";

import { protectedProcedure, router } from "../index.js";

const monitorStatusSchema = z.enum([
  "AWAITING_CONFIRMATION",
  "SELECTING_BRANCH",
  "ACTIVE",
  "PAUSED",
]);

export const monitorRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const repo = createMonitorStateRepository(ctx.db);
    const [status, selectedBranches] = await Promise.all([
      repo.getStatus(),
      repo.getSelectedBranches(),
    ]);
    return { status, selectedBranches };
  }),

  setStatus: protectedProcedure
    .input(z.object({ status: monitorStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      const repo = createMonitorStateRepository(ctx.db);
      await repo.setStatus(input.status);
      return {
        status: await repo.getStatus(),
        selectedBranches: await repo.getSelectedBranches(),
      };
    }),

  setBranches: protectedProcedure
    .input(z.object({ branches: z.array(z.string().trim().min(1)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const repo = createMonitorStateRepository(ctx.db);
      await repo.setSelectedBranches(input.branches);
      return {
        status: await repo.getStatus(),
        selectedBranches: await repo.getSelectedBranches(),
      };
    }),
});
