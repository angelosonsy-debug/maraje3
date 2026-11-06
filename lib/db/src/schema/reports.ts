import {
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reportTargetTypeEnum = pgEnum("maraje3_report_target_type", [
  "material",
  "profile",
  "request",
]);

export const reportReasonEnum = pgEnum("maraje3_report_reason", [
  "copyright",
  "inappropriate",
  "wrong_info",
  "spam",
  "other",
]);

export const reportStatusEnum = pgEnum("maraje3_report_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const reportsTable = pgTable(
  "maraje3_reports",
  {
    id: serial("id").primaryKey(),
    targetType: reportTargetTypeEnum("target_type").notNull(),
    // Not a foreign key, and deliberately text rather than integer: targetId
    // points at materials (serial integer id, stored as its string form),
    // user profiles (uuid), or (later) material_requests depending on
    // targetType — a single typed FK/column can't express that. Validity is
    // checked in the route handler instead.
    targetId: text("target_id").notNull(),
    reporterUserId: uuid("reporter_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    reporterDeviceId: text("reporter_device_id"),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("maraje3_reports_status_idx").on(table.status),
    index("maraje3_reports_target_idx").on(table.targetType, table.targetId),
  ],
);

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
