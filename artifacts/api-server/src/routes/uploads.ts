import {
  CreateMaterialUploadBody,
  CreateMaterialUploadResponse,
  GetMyUploadsResponse,
  PresignUploadBody,
  PresignUploadResponse,
} from "@workspace/api-zod";
import { db, materialRequestsTable, materialsTable } from "@workspace/db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import express, { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { isAccountSuspended, requireUser } from "../lib/auth";
import { buildMaterialSearchText } from "../lib/material-search";
import {
  getStorageDriver,
  StorageNotConfiguredError,
} from "../lib/storage";
import {
  fileExtensionFor,
  hashFileContents,
  isAllowedUploadContentType,
  readDailyUploadQuota,
  readMaxUploadBytes,
  sniffAllowedFileType,
} from "../lib/upload-validation";

const router: IRouter = Router();

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function countTodaysUploads(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(materialsTable)
    .where(
      and(
        eq(materialsTable.uploaderId, userId),
        gte(materialsTable.createdAt, startOfTodayUtc()),
      ),
    );
  return row?.value ?? 0;
}

function isUploadSuspended(user: { uploadSuspendedUntil: Date | null }): boolean {
  return (
    !!user.uploadSuspendedUntil && user.uploadSuspendedUntil.getTime() > Date.now()
  );
}

function keyBelongsToUser(key: string, userId: string): boolean {
  return key.startsWith(`uploads/${userId}/`);
}

router.post(
  "/uploads/presign",
  requireUser,
  async (req, res): Promise<void> => {
    const parsed = PresignUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات الرفع غير صالحة." });
      return;
    }
    const user = req.user!;

    if (isAccountSuspended(user)) {
      res.status(403).json({ error: "تم حظر حسابك من قِبل فريق الإدارة." });
      return;
    }

    if (isUploadSuspended(user)) {
      res.status(403).json({
        error: "تم إيقاف الرفع من حسابك مؤقتاً بسبب رفض ملفات متكررة.",
      });
      return;
    }

    if (!isAllowedUploadContentType(parsed.data.contentType)) {
      res.status(400).json({
        error: "صيغة الملف غير مدعومة. المسموح: PDF أو JPG أو PNG أو WEBP.",
      });
      return;
    }

    const maxBytes = readMaxUploadBytes();
    if (parsed.data.fileSizeBytes > maxBytes) {
      res.status(400).json({ error: "حجم الملف أكبر من الحد المسموح." });
      return;
    }

    const dailyQuota = readDailyUploadQuota();
    const todaysCount = await countTodaysUploads(user.id);
    if (todaysCount >= dailyQuota) {
      res.status(429).json({
        error: "تجاوزت الحد اليومي المسموح لرفع الملفات. حاول غداً.",
      });
      return;
    }

    let driver;
    try {
      driver = getStorageDriver();
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        res.status(503).json({ error: "رفع الملفات غير مُفعّل حالياً." });
        return;
      }
      throw error;
    }

    const extension = fileExtensionFor(parsed.data.contentType);
    const key = `uploads/${user.id}/${randomUUID()}.${extension}`;

    try {
      if (driver.mode === "presigned") {
        const uploadUrl = await driver.createPresignedPutUrl({
          key,
          contentType: parsed.data.contentType,
        });
        res.json(
          PresignUploadResponse.parse({
            key,
            uploadMode: "presigned",
            uploadUrl,
            maxFileSizeBytes: maxBytes,
          }),
        );
        return;
      }

      res.json(
        PresignUploadResponse.parse({
          key,
          uploadMode: "relay",
          uploadUrl: null,
          maxFileSizeBytes: maxBytes,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Upload presign failed");
      res.status(503).json({ error: "تعذر تجهيز الرفع حالياً." });
    }
  },
);

// Raw-bytes relay route. Deliberately NOT part of the OpenAPI/orval JSON
// contract — binary transport doesn't fit a JSON/Zod request/response
// shape. Only used when the storage driver is in "relay" mode (Replit);
// an R2-backed server uploads directly to the presigned URL instead and
// never calls this route.
router.put(
  "/uploads/relay/*key",
  requireUser,
  express.raw({
    type: () => true,
    limit: readMaxUploadBytes(),
  }),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const key = [req.params["key"] ?? []].flat().join("/");

    if (!keyBelongsToUser(key, user.id)) {
      res.status(403).json({ error: "غير مصرح برفع هذا الملف." });
      return;
    }
    if (isAccountSuspended(user)) {
      res.status(403).json({ error: "تم حظر حسابك من قِبل فريق الإدارة." });
      return;
    }
    if (isUploadSuspended(user)) {
      res.status(403).json({
        error: "تم إيقاف الرفع من حسابك مؤقتاً بسبب رفض ملفات متكررة.",
      });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "لم يتم استلام محتوى الملف." });
      return;
    }

    let driver;
    try {
      driver = getStorageDriver();
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        res.status(503).json({ error: "رفع الملفات غير مُفعّل حالياً." });
        return;
      }
      throw error;
    }
    if (driver.mode !== "relay") {
      res.status(400).json({ error: "ارفع هذا الملف عبر الرابط المباشر." });
      return;
    }

    const contentType = req.get("content-type") ?? "application/octet-stream";

    try {
      await driver.putObject(key, req.body, contentType);
      res.status(204).end();
    } catch (error) {
      req.log.error({ err: error }, "Upload relay failed");
      res.status(503).json({ error: "تعذر رفع الملف حالياً." });
    }
  },
);

// Download relay/proxy. Also outside the JSON contract (binary response).
// Must work without login (browsing/downloading never requires an
// account) — used for materials stored via the Replit driver; R2-backed
// materials point `documentUrl` straight at the public bucket and never
// hit this route.
router.get("/uploads/file/*key", async (req, res): Promise<void> => {
  const key = [req.params["key"] ?? []].flat().join("/");

  let driver;
  try {
    driver = getStorageDriver();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      res.status(503).json({ error: "رفع الملفات غير مُفعّل حالياً." });
      return;
    }
    throw error;
  }

  try {
    const bytes = await driver.getObject(key);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(bytes);
  } catch (error) {
    req.log.error({ err: error, key }, "File download failed");
    res.status(404).json({ error: "الملف غير موجود." });
  }
});

router.post("/uploads", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateMaterialUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الرفع غير صالحة." });
    return;
  }
  const user = req.user!;
  const body = parsed.data;

  if (isAccountSuspended(user)) {
    res.status(403).json({ error: "تم حظر حسابك من قِبل فريق الإدارة." });
    return;
  }
  if (isUploadSuspended(user)) {
    res.status(403).json({
      error: "تم إيقاف الرفع من حسابك مؤقتاً بسبب رفض ملفات متكررة.",
    });
    return;
  }
  if (!keyBelongsToUser(body.key, user.id)) {
    res.status(403).json({ error: "غير مصرح باستخدام هذا الملف." });
    return;
  }

  const dailyQuota = readDailyUploadQuota();
  const todaysCount = await countTodaysUploads(user.id);
  if (todaysCount >= dailyQuota) {
    res.status(429).json({
      error: "تجاوزت الحد اليومي المسموح لرفع الملفات. حاول غداً.",
    });
    return;
  }

  let driver;
  try {
    driver = getStorageDriver();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      res.status(503).json({ error: "رفع الملفات غير مُفعّل حالياً." });
      return;
    }
    throw error;
  }

  let bytes: Buffer;
  try {
    bytes = await driver.getObject(body.key);
  } catch (error) {
    req.log.error({ err: error }, "Could not re-download uploaded object");
    res.status(404).json({ error: "تعذر العثور على الملف المرفوع." });
    return;
  }

  const maxBytes = readMaxUploadBytes();
  if (bytes.length === 0 || bytes.length > maxBytes) {
    res.status(400).json({ error: "حجم الملف غير صالح." });
    return;
  }

  const realType = sniffAllowedFileType(bytes);
  if (!realType) {
    res.status(400).json({
      error: "نوع الملف غير مدعوم أو تالف. المسموح: PDF أو JPG أو PNG أو WEBP.",
    });
    return;
  }

  let fulfilledRequestId: number | null = null;
  if (body.fulfillsRequestId != null) {
    const [request] = await db
      .select({ id: materialRequestsTable.id, status: materialRequestsTable.status })
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, body.fulfillsRequestId))
      .limit(1);
    if (!request) {
      res.status(400).json({ error: "الطلب المرتبط غير موجود." });
      return;
    }
    if (request.status !== "open") {
      res.status(400).json({ error: "هذا الطلب لم يعد مفتوحاً." });
      return;
    }
    fulfilledRequestId = request.id;
  }

  const fileHash = hashFileContents(bytes);
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

  const searchText = await buildMaterialSearchText({
    subjectId: body.subjectId,
    titleAr: body.titleAr,
    titleEn: body.titleEn,
    descriptionAr: body.descriptionAr ?? null,
    descriptionEn: body.descriptionEn ?? null,
    professorName: body.professorName ?? null,
  });

  try {
    const [created] = await db
      .insert(materialsTable)
      .values({
        subjectId: body.subjectId,
        titleAr: body.titleAr,
        titleEn: body.titleEn,
        category: body.category,
        descriptionAr: body.descriptionAr ?? "",
        descriptionEn: body.descriptionEn ?? "",
        fileFormat: realType === "application/pdf" ? "PDF" : realType.split("/")[1]!.toUpperCase(),
        documentUrl: driver.getDownloadUrl(body.key),
        fileSizeBytes: bytes.length,
        uploaderId: user.id,
        professorName: body.professorName ?? null,
        examYear: body.examYear ?? null,
        examType: body.examType ?? null,
        appearedInExam: body.appearedInExam ?? false,
        searchText,
        publicationStatus: "pending",
        fileHash,
        fulfilledRequestId,
        authorized: true,
        isDemo: false,
      })
      .returning();

    res.json(
      CreateMaterialUploadResponse.parse({
        material: created,
        duplicate: !!existingByHash,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Material upload record creation failed");
    res.status(503).json({ error: "تعذر حفظ الملف المرفوع حالياً." });
  }
});

router.get("/uploads/mine", requireUser, async (req, res): Promise<void> => {
  try {
    const materials = await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.uploaderId, req.user!.id))
      .orderBy(sql`${materialsTable.createdAt} desc`);
    res.json(GetMyUploadsResponse.parse({ materials }));
  } catch (error) {
    req.log.error({ err: error }, "Listing own uploads failed");
    res.status(503).json({ error: "تعذر تحميل رفعاتك حالياً." });
  }
});

export default router;
