import { createAuth } from "@SMS/auth";
import { createDb } from "@SMS/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
