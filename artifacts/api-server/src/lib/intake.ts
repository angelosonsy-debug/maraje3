import { db, materialsTable } from "@workspace/db";
import type { ExamType, MaterialCategory } from "@workspace/api-zod";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { buildMaterialSearchText } from "./material-search";
import {
  fileExtensionFor,
  hashFileContents,
  readMaxUploadBytes,
  sniffAllowedFileType,
} from "./upload-validation";
import { getStorageDriver, StorageNotConfiguredError } from "./storage";

export type IntakeSource = "telegram" | "bulk-admin";

export type IntakeParams = {
  bytes: Buffer;
  subjectId: number;
  titleAr: string;
  titleEn: string;
  category: MaterialCategory;
  professorName?: string | null;
  examYear?: number | null;
  examType?: ExamType | null;
  appearedInExam?: boolean;
  source: IntakeSource;
  /** Free-text attribution line shown instead of a real account (e.g. "@user عبر تليجرام" or "جروب أصدقاء الطب 2027"). */
  contributor?: string | null;
  /** A linked app account to attribute the upload to, if one exists. */
  uploaderId?: string | null;
  /** Telegram sender id, only for source="telegram" without a linked account — see schema doc comment. */
  telegramSubmitterId?: string | null;
  publicationStatus: "pending" | "published";
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Same "N per day" quota as the app's own upload flow (routes/uploads.ts),
 * applied to Telegram submissions — keyed by the linked account if one
 * exists, otherwise by the raw Telegram sender id (telegramSubmitterId).
 */
export async function countTodaysSubmissionsFor(identity: {
  uploaderId?: string | null;
  telegramSubmitterId?: string | null;
}): Promise<number> {
  const condition = identity.uploaderId
    ? eq(materialsTable.uploaderId, identity.uploaderId)
    : identity.telegramSubmitterId
      ? eq(materialsTable.telegramSubmitterId, identity.telegramSubmitterId)
      : null;
  if (!condition) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(materialsTable)
    .where(and(condition, gte(materialsTable.createdAt, startOfTodayUtc())));
  return row?.value ?? 0;
}

export type IntakeResult =
  | { ok: true; material: typeof materialsTable.$inferSelect; duplicate: boolean }
  | { ok: false; status: number; error: string };

/**
 * Shared "a file arrived from somewhere other than the app's own
 * presign+PUT upload flow" path — used by the Telegram bot bridge
 * (routes/intake.ts POST /internal/submissions) and the admin bulk-upload
 * tool (routes/intake.ts POST /catalog/admin/bulk-upload). Deliberately
 * mirrors routes/uploads.ts's validation (real magic-byte sniffing, size
 * cap, content hash dedup) rather than trusting the caller — the bot and
 * the admin UI are both still handing us untrusted bytes.
 */
export async function ingestMaterialFile(
  params: IntakeParams,
): Promise<IntakeResult> {
  const maxBytes = readMaxUploadBytes();
  if (params.bytes.length === 0 || params.bytes.length > maxBytes) {
    return { ok: false, status: 400, error: "حجم الملف غير صالح." };
  }

  const realType = sniffAllowedFileType(params.bytes);
  if (!realType) {
    return {
      ok: false,
      status: 400,
      error: "نوع الملف غير مدعوم أو تالف. المسموح: PDF أو JPG أو PNG أو WEBP.",
    };
  }

  let driver;
  try {
    driver = getStorageDriver();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return { ok: false, status: 503, error: "رفع الملفات غير مُفعّل حالياً." };
    }
    throw error;
  }

  const fileHash = hashFileContents(params.bytes);
  const [existingByHash] = await db
    .select({ id: materialsTable.id })
    .from(materialsTable)
    .where(
      and(
        eq(materialsTable.fileHash, fileHash),
        sql`${materialsTable.publicationStatus} <> 'rejected'`,
      ),
    )
    .limit(1);

  const extension = fileExtensionFor(realType);
  const key = `uploads/${params.source}/${randomUUID()}.${extension}`;
  await driver.putObject(key, params.bytes, realType);

  const searchText = await buildMaterialSearchText({
    subjectId: params.subjectId,
    titleAr: params.titleAr,
    titleEn: params.titleEn,
    professorName: params.professorName ?? null,
  });

  const [created] = await db
    .insert(materialsTable)
    .values({
      subjectId: params.subjectId,
      titleAr: params.titleAr,
      titleEn: params.titleEn,
      category: params.category,
      fileFormat:
        realType === "application/pdf" ? "PDF" : realType.split("/")[1]!.toUpperCase(),
      documentUrl: driver.getDownloadUrl(key),
      fileSizeBytes: params.bytes.length,
      contributor: params.contributor ?? null,
      uploaderId: params.uploaderId ?? null,
      professorName: params.professorName ?? null,
      examYear: params.examYear ?? null,
      examType: params.examType ?? null,
      appearedInExam: params.appearedInExam ?? false,
      searchText,
      publicationStatus: params.publicationStatus,
      fileHash,
      source: params.source,
      telegramSubmitterId: params.telegramSubmitterId ?? null,
      authorized: true,
      isDemo: false,
    })
    .returning();

  if (!created) {
    return { ok: false, status: 503, error: "تعذر حفظ الملف." };
  }

  return { ok: true, material: created, duplicate: !!existingByHash };
}
