import { boolean, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Stage 6 "/ربط" flow: the app generates a short-lived one-time code
// (POST /telegram/link-code, signed-in user), the student sends
// "/ربط <code>" to the bot, and the bot calls an internal server endpoint
// (protected by BOT_API_SECRET) that consumes the code and writes
// users.telegramUserId/telegramChatId. A code is single-use and expires —
// `consumed` just prevents a race between two concurrent redemptions, since
// the row is also deleted once consumed.
export const telegramLinkCodesTable = pgTable(
  "maraje3_telegram_link_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    consumed: boolean("consumed").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("maraje3_telegram_link_codes_code_idx").on(table.code)],
);

export type TelegramLinkCode = typeof telegramLinkCodesTable.$inferSelect;
