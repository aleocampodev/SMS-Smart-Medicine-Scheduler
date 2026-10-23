import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  documentType: text("document_type").notNull().default("CC"),
  documentNumber: text("document_number").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: text("birth_date").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  healthEntity: text("health_entity"),
  prescriptionCode: text("prescription_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const appointment = pgTable("appointment", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").references(() => profile.id, { onDelete: "cascade" }),
  branchId: text("branch_id").notNull(),
  slotDate: text("slot_date").notNull(),
  slotTime: text("slot_time"),
  status: text("status").notNull().default("alerted"),
  confirmationCode: text("confirmation_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
