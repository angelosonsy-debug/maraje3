import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const materialCategoryEnum = pgEnum("maraje3_material_category", [
  "summary",
  "lecture-notes",
  "previous-exam",
  "model-answer",
  "revision",
  "practice",
]);

export const publicationStatusEnum = pgEnum("maraje3_publication_status", [
  "draft",
  "pending",
  "published",
  "rejected",
]);

export const examTypeEnum = pgEnum("maraje3_exam_type", [
  "midterm",
  "final",
  "quiz",
  "sheet",
  "other",
]);

// Stage 6 growth channels: a material can arrive through the app's own
// upload flow, the Telegram bot (grammY, artifacts/telegram-bot), or an
// admin's bulk-upload tool (seeding/group handoffs). Purely informational —
// shown in the admin review queue so moderators know where a pending
// submission came from.
export const materialSourceEnum = pgEnum("maraje3_material_source", [
  "app",
  "telegram",
  "bulk-admin",
]);

export const universitiesTable = pgTable("maraje3_universities", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  city: text("city").notNull().default(""),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const facultiesTable = pgTable("maraje3_faculties", {
  id: serial("id").primaryKey(),
  universityId: integer("university_id")
    .notNull()
    .references(() => universitiesTable.id, { onDelete: "restrict" }),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const academicYearsTable = pgTable("maraje3_academic_years", {
  id: serial("id").primaryKey(),
  facultyId: integer("faculty_id")
    .notNull()
    .references(() => facultiesTable.id, { onDelete: "restrict" }),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en").notNull(),
  rank: integer("rank").notNull().default(1),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const semestersTable = pgTable("maraje3_semesters", {
  id: serial("id").primaryKey(),
  academicYearId: integer("academic_year_id")
    .notNull()
    .references(() => academicYearsTable.id, { onDelete: "restrict" }),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en").notNull(),
  rank: integer("rank").notNull().default(1),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const subjectsTable = pgTable("maraje3_subjects", {
  id: serial("id").primaryKey(),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semestersTable.id, { onDelete: "restrict" }),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  code: text("code"),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const materialsTable = pgTable(
  "maraje3_materials",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "restrict" }),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    category: materialCategoryEnum("category").notNull(),
    descriptionAr: text("description_ar").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    fileFormat: text("file_format").notNull().default("PDF"),
    documentUrl: text("document_url"),
    fileSizeBytes: integer("file_size_bytes"),
    contributor: text("contributor"),
    uploaderId: uuid("uploader_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    professorName: text("professor_name"),
    examYear: integer("exam_year"),
    examType: examTypeEnum("exam_type"),
    appearedInExam: boolean("appeared_in_exam").notNull().default(false),
    searchText: text("search_text").notNull().default(""),
    publicationStatus: publicationStatusEnum("publication_status")
      .notNull()
      .default("draft"),
    rejectionReason: text("rejection_reason"),
    fileHash: text("file_hash"),
    // Denormalized counters, kept in sync by the engagement routes (one
    // increment per distinct device/day for downloads, once per device ever
    // for thanks — see lib/contributor-stats.ts and the maraje3_downloads /
    // maraje3_thanks tables that enforce the dedup).
    downloadCount: integer("download_count").notNull().default(0),
    thanksCount: integer("thanks_count").notNull().default(0),
    // Set at upload time when the student picked "عندي الملف ده" against an
    // open request; the request itself only flips to "fulfilled" once this
    // material is actually published (see applyUploadReviewOutcome).
    // Deliberately NOT a Drizzle `.references()` FK: materialRequestsTable
    // (requests.ts) already has a real FK pointing the other way
    // (fulfilledByMaterialId -> materials.id), and a FK declared on both
    // sides of the same two-table pair creates a genuine TypeScript type
    // cycle (unlike the one-way users.ts<->catalog.ts cross-references
    // elsewhere in this schema, which aren't a 2-symbol cycle). If the
    // linked request row is later deleted, this id is left dangling —
    // harmless, since it's only read via `IS NOT NULL` for the "لبّيت طلب"
    // contributor badge, never dereferenced to the request itself.
    fulfilledRequestId: integer("fulfilled_request_id"),
    // Where this submission came from (see materialSourceEnum doc comment
    // above). The free-text `contributor` column above already carries the
    // display attribution for a non-account source (e.g. "@username عبر
    // تليجرام" or "جروب أصدقاء الطب 2027") — this column is just the
    // filterable/machine-readable tag for the admin review queue.
    source: materialSourceEnum("source").notNull().default("app"),
    // Only set for source="telegram" rows without a linked app account yet
    // (see users.telegramUserId) — lets the bot's daily submission quota be
    // enforced per Telegram sender even before they run "/ربط". Not a
    // Drizzle FK (no users row necessarily exists with this id).
    telegramSubmitterId: text("telegram_submitter_id"),
    authorized: boolean("authorized").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("maraje3_materials_subject_id_idx").on(table.subjectId),
    index("maraje3_materials_publication_status_idx").on(
      table.publicationStatus,
    ),
    index("maraje3_materials_search_text_trgm_idx").using(
      "gin",
      table.searchText.op("gin_trgm_ops"),
    ),
    index("maraje3_materials_file_hash_idx").on(table.fileHash),
    index("maraje3_materials_uploader_id_idx").on(table.uploaderId),
    index("maraje3_materials_fulfilled_request_id_idx").on(
      table.fulfilledRequestId,
    ),
    index("maraje3_materials_source_idx").on(table.source),
    index("maraje3_materials_telegram_submitter_id_idx").on(
      table.telegramSubmitterId,
    ),
  ],
);
