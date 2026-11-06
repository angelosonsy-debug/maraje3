import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { facultiesTable, materialsTable, subjectsTable } from "./catalog";
import { usersTable } from "./users";

export const requestStatusEnum = pgEnum("maraje3_request_status", [
  "open",
  "fulfilled",
  "closed",
]);

// "لوحة مطلوب" — a student asks for a file that doesn't exist yet; other
// students can "أنا كمان" it, and a contributor can upload against it
// (materialsTable.fulfilledRequestId), which flips this row to "fulfilled"
// once that upload is actually published (see applyUploadReviewOutcome in
// routes/catalog.ts) — never at upload time, to match the "no content
// without admin review" rule.
export const materialRequestsTable = pgTable(
  "maraje3_material_requests",
  {
    id: serial("id").primaryKey(),
    facultyId: integer("faculty_id")
      .notNull()
      .references(() => facultiesTable.id, { onDelete: "restrict" }),
    subjectId: integer("subject_id").references(() => subjectsTable.id, {
      onDelete: "set null",
    }),
    titleAr: text("title_ar").notNull(),
    requesterUserId: uuid("requester_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    requesterDeviceId: text("requester_device_id"),
    status: requestStatusEnum("status").notNull().default("open"),
    fulfilledByMaterialId: integer("fulfilled_by_material_id").references(
      () => materialsTable.id,
      { onDelete: "set null" },
    ),
    meTooCount: integer("me_too_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("maraje3_material_requests_faculty_id_idx").on(table.facultyId),
    index("maraje3_material_requests_status_idx").on(table.status),
    index("maraje3_material_requests_subject_id_idx").on(table.subjectId),
  ],
);

// One row per (request, device) — "أنا كمان" is a single lifetime tap per
// device per request, same dedup shape as maraje3_thanks.
export const requestMeTooTable = pgTable(
  "maraje3_request_me_too",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => materialRequestsTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("maraje3_request_me_too_dedup_idx").on(
      table.requestId,
      table.deviceId,
    ),
  ],
);

export type MaterialRequest = typeof materialRequestsTable.$inferSelect;
export type InsertMaterialRequest = typeof materialRequestsTable.$inferInsert;
export type RequestMeToo = typeof requestMeTooTable.$inferSelect;
