import { protectedProcedure, publicProcedure, router } from "../index.js";
import { BRANCH_MAP, tomorrowLocalDay } from "@SMS/poller";

import { appointmentsRouter } from "./appointments.js";
import { profilesRouter } from "./profiles.js";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return {
      status: "OK",
      timestamp: new Date().toISOString(),
      service: "SMS - Smart Medicine Scheduler",
    };
  }),
  getBranches: publicProcedure.query(() => {
    return Object.entries(BRANCH_MAP).map(([key, info]) => ({
      key,
      ...info,
    }));
  }),
  getScheduleHorizon: publicProcedure.query(() => {
    return {
      tomorrow: tomorrowLocalDay(),
      timezone: "America/Bogota",
    };
  }),
  profiles: profilesRouter,
  appointments: appointmentsRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});

export type AppRouter = typeof appRouter;
