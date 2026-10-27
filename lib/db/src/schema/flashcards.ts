import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { publicationStatusEnum, subjectsTable } from "./catalog";
import { usersTable } from "./users";

// Stage 7 "light study mode" flashcards. Intentionally no SM-2 fields here
// (easiness/interval/dueAt) — the spec keeps review progress entirely local
// on the device (AsyncStorage), so a deck/card is just the shared content;
// adding spaced-repetition columns later is a plain `ALTER TABLE` whenever
// that becomes server-tracked, not a reason to pre-allocate unused columns
// now.
export const flashcardDecksTable = pgTable(
  "maraje3_flashcard_decks",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "restrict" }),
    titleAr: text("title_ar").notNull(),
    // Admin-created decks are inserted already "published"; a contributor's
    // suggested deck goes through the same pending → admin review path as
    // everything else (rule 5) and starts here. Reuses the shared
    // publicationStatusEnum (draft/pending/published/rejected) from
    // catalog.ts rather than a new two-value enum, so "reject" is available
    // alongside the "pending|published" states the spec names.
    status: publicationStatusEnum("status").notNull().default("pending"),
    createdByUserId: uuid("created_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("maraje3_flashcard_decks_subject_id_idx").on(table.subjectId),
    index("maraje3_flashcard_decks_status_idx").on(table.status),
  ],
);

export const flashcardsTable = pgTable(
  "maraje3_flashcards",
  {
    id: serial("id").primaryKey(),
    deckId: integer("deck_id")
      .notNull()
      .references(() => flashcardDecksTable.id, { onDelete: "cascade" }),
    questionAr: text("question_ar").notNull(),
    answerAr: text("answer_ar").notNull(),
    // For an MCQ/true-false card: the full set of choices to show, answerAr
    // being the correct one among them. Null for a plain flip card.
    options: jsonb("options").$type<string[] | null>(),
    explanationAr: text("explanation_ar"),
    // Lets a deck's cards keep a stable display order (paste order) without
    // relying on insertion id order once editing is possible.
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("maraje3_flashcards_deck_id_idx").on(table.deckId)],
);

export type FlashcardDeck = typeof flashcardDecksTable.$inferSelect;
export type Flashcard = typeof flashcardsTable.$inferSelect;
