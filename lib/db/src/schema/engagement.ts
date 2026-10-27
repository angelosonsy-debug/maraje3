import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { materialsTable } from "./catalog";
import { usersTable } from "./users";

// One row per (material, device, calendar day) that actually counted —
// de-duplicates "once per device per file per day" downloads. `day` is the
// UTC calendar date (YYYY-MM-DD) computed by the route handler, not a
// generated column, so the unique index below is what actually enforces the
// dedup; the row only exists for downloads that were accepted.
export const downloadsTable = pgTable(
  "maraje3_downloads",
  {
    id: serial("id").primaryKey(),
    materialId: integer("material_id")
      .notNull()
      .references(() => materialsTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    day: text("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("maraje3_downloads_dedup_idx").on(
      table.materialId,
      table.deviceId,
      table.day,
    ),
    index("maraje3_downloads_material_id_idx").on(table.materialId),
    index("maraje3_downloads_created_at_idx").on(table.createdAt),
  ],
);

// One row per (material, device) ever — "شكراً" is a single lifetime tap per
// device per file, unlike downloads which reset their dedup daily.
export const thanksTable = pgTable(
  "maraje3_thanks",
  {
    id: serial("id").primaryKey(),
    materialId: integer("material_id")
      .notNull()
      .references(() => materialsTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("maraje3_thanks_dedup_idx").on(
      table.materialId,
      table.deviceId,
    ),
    index("maraje3_thanks_material_id_idx").on(table.materialId),
  ],
);

export type Download = typeof downloadsTable.$inferSelect;
export type InsertDownload = typeof downloadsTable.$inferInsert;
export type Thanks = typeof thanksTable.$inferSelect;
export type InsertThanks = typeof thanksTable.$inferInsert;
