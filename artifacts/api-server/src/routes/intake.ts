import {
  db,
  examTypeEnum,
  materialCategoryEnum,
  subjectsTable,
  usersTable,
} from "@workspace/db";
import type { ExamType, MaterialCategory } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import express, { Router, type IRouter, type Request } from "express";
import { requireAdmin } from "./catalog";
import { requireBotSecret } from "../lib/bot-auth";
import { countTodaysSubmissionsFor, ingestMaterialFile } from "../lib/intake";
import { readDailyUploadQuota, readMaxUploadBytes } from "../lib/upload-validation";

const router: IRouter = Router();

function parseIntQuery(req: Request, name: string): number | null {
  const raw = req.query[name];
  if (typeof raw !== "string") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseStringQuery(req: Request, name: string): string | null {
  const raw = req.query[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function parseCategoryQuery(req: Request): MaterialCategory | null {
  const raw = parseStringQuery(req, "category");
  return raw && (materialCategoryEnum.enumValues as string[]).includes(raw)
    ? (raw as MaterialCategory)
    : null;
}

function parseExamTypeQuery(req: Request): ExamType | null {
  const raw = parseStringQuery(req, "examType");
  return raw && (examTypeEnum.enumValues as string[]).includes(raw)
    ? (raw as ExamType)
    : null;
}

/**
 * Raw-bytes intake routes — deliberately NOT part of the OpenAPI/orval JSON
 * contract, same reasoning as routes/uploads.ts's relay route: binary
 * transport doesn't fit a JSON/Zod body shape, so metadata travels as query
 * params instead and the body is the file's raw bytes.
 */

// Called only by artifacts/telegram-bot after it has already downloaded the
// file from Telegram's servers and walked the sender through the inline
// faculty→year→subject→category prompts. Same size/type/hash/daily-quota
// rules as a normal app upload (see lib/intake.ts).
router.post(
  "/internal/submissions",
  requireBotSecret,
  express.raw({ type: () => true, limit: readMaxUploadBytes() }),
  async (req, res): Promise<void> => {
    const subjectId = parseIntQuery(req, "subjectId");
    const titleAr = parseStringQuery(req, "titleAr");
    const category = parseCategoryQuery(req);
    const telegramUserId = parseStringQuery(req, "telegramUserId");
    const telegramUsername = parseStringQuery(req, "telegramUsername");

    if (!subjectId || !titleAr || !category || !telegramUserId) {
      res.status(400).json({
        error: "subjectId و titleAr و category و telegramUserId مطلوبة.",
      });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "لم يتم استلام محتوى الملف." });
      return;
    }

    try {
      const [subject] = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .limit(1);
      if (!subject) {
        res.status(400).json({ error: "المادة الدراسية غير موجودة." });
        return;
      }

      const [linkedUser] = await db
        .select({ id: usersTable.id, uploadSuspendedUntil: usersTable.uploadSuspendedUntil })
        .from(usersTable)
        .where(eq(usersTable.telegramUserId, telegramUserId))
        .limit(1);

      if (
        linkedUser?.uploadSuspendedUntil &&
        linkedUser.uploadSuspendedUntil.getTime() > Date.now()
      ) {
        res.status(403).json({
          error: "تم إيقاف الرفع من حساب هذا المستخدم مؤقتاً.",
        });
        return;
      }

      const todaysCount = await countTodaysSubmissionsFor({
        uploaderId: linkedUser?.id ?? null,
        telegramSubmitterId: linkedUser ? null : telegramUserId,
      });
      if (todaysCount >= readDailyUploadQuota()) {
        res.status(429).json({
          error: "تجاوزت الحد اليومي المسموح لرفع الملفات. حاول غداً.",
        });
        return;
      }

      const result = await ingestMaterialFile({
        bytes: req.body,
        subjectId,
        titleAr,
        titleEn: titleAr,
        category,
        examType: parseExamTypeQuery(req),
        source: "telegram",
        contributor: telegramUsername
          ? `@${telegramUsername} عبر تليجرام`
          : "مساهم عبر تليجرام",
        uploaderId: linkedUser?.id ?? null,
        telegramSubmitterId: linkedUser ? null : telegramUserId,
        publicationStatus: "pending",
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        materialId: result.material.id,
        duplicate: result.duplicate,
      });
    } catch (error) {
      req.log.error({ err: error }, "Telegram submission intake failed");
      res.status(503).json({ error: "تعذر حفظ الملف المرسل حالياً." });
    }
  },
);

// Admin seeding/group-handoff tool ("رفع بالجملة"). One call per file — the
// admin screen loops over several picked files with the same subjectId and
// sourceLabel. Published immediately (unlike student/bot submissions):
// there is no automated or AI step here, an administrator is directly
// curating and vouching for each file before it goes live, exactly as they
// already can one-by-one from the existing review queue.
router.post(
  "/catalog/admin/bulk-upload",
  requireAdmin,
  express.raw({ type: () => true, limit: readMaxUploadBytes() }),
  async (req, res): Promise<void> => {
    const subjectId = parseIntQuery(req, "subjectId");
    const titleAr = parseStringQuery(req, "titleAr");
    const titleEn = parseStringQuery(req, "titleEn") ?? titleAr;
    const category = parseCategoryQuery(req);
    const sourceLabel = parseStringQuery(req, "sourceLabel");

    if (!subjectId || !titleAr || !category) {
      res.status(400).json({ error: "subjectId و titleAr و category مطلوبة." });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "لم يتم استلام محتوى الملف." });
      return;
    }

    try {
      const [subject] = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .limit(1);
      if (!subject) {
        res.status(400).json({ error: "المادة الدراسية غير موجودة." });
        return;
      }

      const result = await ingestMaterialFile({
        bytes: req.body,
        subjectId,
        titleAr,
        titleEn: titleEn ?? titleAr,
        category,
        examType: parseExamTypeQuery(req),
        source: "bulk-admin",
        contributor: sourceLabel ? `جروب ${sourceLabel}` : "رفع إداري بالجملة",
        publicationStatus: "published",
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        materialId: result.material.id,
        duplicate: result.duplicate,
      });
    } catch (error) {
      req.log.error({ err: error }, "Admin bulk upload intake failed");
      res.status(503).json({ error: "تعذر حفظ الملف حالياً." });
    }
  },
);

export default router;
