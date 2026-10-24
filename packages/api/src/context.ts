import type { Session } from "@SMS/auth";
import type { Database } from "@SMS/db";

export type Context = {
  session: Session | null;
  db: Database;
};
