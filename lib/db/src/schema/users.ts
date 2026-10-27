import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { facultiesTable } from "./catalog";

export const userRoleEnum = pgEnum("maraje3_user_role", ["student", "admin"]);

export const userStatusEnum = pgEnum("maraje3_user_status", [
  "active",
  "suspended",
]);

export const usersTable = pgTable(
  "maraje3_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleSub: text("google_sub").notNull(),
    displayName: text("display_name").notNull(),
    photoUrl: text("photo_url"),
    facultyId: integer("faculty_id").references(() => facultiesTable.id, {
      onDelete: "set null",
    }),
    role: userRoleEnum("role").notNull().default("student"),
    status: userStatusEnum("status").notNull().default("active"),
    uploadSuspendedUntil: timestamp("upload_suspended_until", {
      withTimezone: true,
    }),
    strikes: integer("strikes").notNull().default(0),
    // Resets to 0 on any published upload; incremented on each rejection.
    // Distinct from `strikes` (a cumulative lifetime count) because the
    // suspension threshold is "N rejections in a row", not "N ever".
    consecutiveRejections: integer("consecutive_rejections")
      .notNull()
      .default(0),
    hideIdentity: boolean("hide_identity").notNull().default(false),
    // Auto-granted (never revoked) once a contributor's published materials
    // cross the Stage-4 thresholds (see lib/engagement-config.ts on the
    // server). Stage 7 wires this into actually unlocking Premium features;
    // for now it only drives an in-app "you unlocked Premium free" notice.
    premiumGranted: boolean("premium_granted").notNull().default(false),
    // Stage 6 Telegram linkage ("/ربط" bot command) — lets submissions sent
    // through the bot be attributed to a real account and counted toward
    // its titles, instead of staying anonymous. Both null until the user
    // completes the link flow (see telegram.ts / routes/telegram.ts).
    telegramUserId: text("telegram_user_id"),
    telegramChatId: text("telegram_chat_id"),
    // Stage 7 Premium (one-time purchase, react-native-iap) — distinct from
    // premiumGranted above (which is a free unlock earned by contribution).
    // Set only after the server verifies the purchase against the Google
    // Play Developer API (routes/premium.ts). The effective "is this user
    // premium" check anywhere in the app/server is
    // `premiumGranted || premiumPurchased` — never one column alone.
    premiumPurchased: boolean("premium_purchased").notNull().default(false),
    // Last verified purchase token/productId, kept for Restore purchases and
    // for re-verifying if Google ever revokes/refunds it. Not a secret, but
    // not shown to the client beyond "you have Premium".
    premiumPurchaseToken: text("premium_purchase_token"),
    premiumProductId: text("premium_product_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("maraje3_users_google_sub_idx").on(table.googleSub),
    uniqueIndex("maraje3_users_telegram_user_id_idx").on(
      table.telegramUserId,
    ),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
