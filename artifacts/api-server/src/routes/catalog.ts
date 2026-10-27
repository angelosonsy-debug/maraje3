import {
  AdminManageResponse,
  GetCatalogTreeResponse,
  GetCatalogAdminAccessResponse,
  GetCatalogAdminCatalogResponse,
  GetCatalogResponse,
  ManageCatalogAdminBody,
  ManageCatalogAdminResponse,
  SearchCatalogQueryParams,
  SearchCatalogResponse,
  type AdminManageRequest,
  type Material,
} from "@workspace/api-zod";
import {
  academicYearsTable,
  db,
  facultiesTable,
  materialRequestsTable,
  materialsTable,
  semestersTable,
  subjectsTable,
  universitiesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { adminAuthFailureLimiter } from "../middlewares/rate-limit";
import {
  buildMaterialSearchText,
  normalizeArabic,
} from "../lib/material-search";
import {
  readSuspensionDays,
  readSuspensionStrikeThreshold,
} from "../lib/upload-validation";
import { maybeGrantPremium } from "../lib/contributor-stats";

/**
 * Applies the strikes/suspension side effect of an admin review decision on
 * a student upload: a rejection increments both the lifetime strike count
 * and the consecutive-rejection counter, suspending uploads once the
 * consecutive counter hits the configured threshold; a publish resets the
 * consecutive counter (it does not erase past strikes).
 */
async function applyUploadReviewOutcome(
  uploaderId: string,
  outcome: "rejected" | "published",
): Promise<void> {
  if (outcome === "published") {
    await db
      .update(usersTable)
      .set({ consecutiveRejections: 0 })
      .where(eq(usersTable.id, uploaderId));
    // A fresh publish can push a contributor over the free-Premium
    // thresholds (Stage 4) — cheap no-op once premiumGranted is already set.
    await maybeGrantPremium(uploaderId);
    return;
  }

  const [user] = await db
    .select({
      consecutiveRejections: usersTable.consecutiveRejections,
      strikes: usersTable.strikes,
    })
    .from(usersTable)
    .where(eq(usersTable.id, uploaderId))
    .limit(1);
  if (!user) return;

  const nextConsecutive = user.consecutiveRejections + 1;
  const threshold = readSuspensionStrikeThreshold();
  const shouldSuspend = nextConsecutive >= threshold;

  await db
    .update(usersTable)
    .set({
      strikes: user.strikes + 1,
      consecutiveRejections: shouldSuspend ? 0 : nextConsecutive,
      ...(shouldSuspend
        ? {
            uploadSuspendedUntil: new Date(
              Date.now() + readSuspensionDays() * 24 * 60 * 60 * 1000,
            ),
          }
        : {}),
    })
    .where(eq(usersTable.id, uploaderId));
}

const router: IRouter = Router();
const adminToken = process.env.MARAJE3_ADMIN_TOKEN?.trim() ?? "";

function tokenMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: (error?: unknown) => void,
): void {
  if (!adminToken) {
    res.status(503).json({ error: "Administrator access is not configured." });
    return;
  }

  const authorization = req.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!tokenMatches(candidate, adminToken)) {
    res.status(401).json({ error: "Administrator access was not accepted." });
    return;
  }

  next();
}

router.use("/catalog/admin", adminAuthFailureLimiter);

async function loadCatalog(includeDrafts = false) {
  const [
    universities,
    faculties,
    academicYears,
    semesters,
    subjects,
    materials,
  ] = await Promise.all([
    db.select().from(universitiesTable).orderBy(universitiesTable.id),
    db.select().from(facultiesTable).orderBy(facultiesTable.id),
    db.select().from(academicYearsTable).orderBy(academicYearsTable.rank),
    db.select().from(semestersTable).orderBy(semestersTable.rank),
    db.select().from(subjectsTable).orderBy(subjectsTable.id),
    includeDrafts
      ? db.select().from(materialsTable).orderBy(materialsTable.updatedAt)
      : db
          .select()
          .from(materialsTable)
          .where(eq(materialsTable.publicationStatus, "published"))
          .orderBy(materialsTable.updatedAt),
  ]);

  return {
    universities,
    faculties,
    academicYears,
    semesters,
    subjects,
    materials,
  };
}

router.get("/catalog/tree", async (req, res): Promise<void> => {
  try {
    const [
      universities,
      faculties,
      academicYears,
      semesters,
      subjects,
      materialCounts,
    ] = await Promise.all([
      db.select().from(universitiesTable).orderBy(universitiesTable.id),
      db.select().from(facultiesTable).orderBy(facultiesTable.id),
      db.select().from(academicYearsTable).orderBy(academicYearsTable.rank),
      db.select().from(semestersTable).orderBy(semestersTable.rank),
      db.select().from(subjectsTable).orderBy(subjectsTable.id),
      db
        .select({
          subjectId: materialsTable.subjectId,
          count: sql<number>`count(*)::int`,
        })
        .from(materialsTable)
        .where(eq(materialsTable.publicationStatus, "published"))
        .groupBy(materialsTable.subjectId),
    ]);
    const countsBySubject = new Map(
      materialCounts.map((item) => [item.subjectId, Number(item.count)]),
    );
    const tree = GetCatalogTreeResponse.parse({
      universities,
      faculties,
      academicYears,
      semesters,
      subjects: subjects.map((subject) => ({
        ...subject,
        materialCount: countsBySubject.get(subject.id) ?? 0,
      })),
    });
    const payload = JSON.stringify(tree);
    const etag = `"${createHash("sha256").update(payload).digest("base64url")}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (
      req
        .get("if-none-match")
        ?.split(",")
        .map((value) => value.trim())
        .some((value) => value === etag || value === "*")
    ) {
      res.status(304).end();
      return;
    }
    res.json(tree);
  } catch (error) {
    req.log.error({ err: error }, "Catalog tree request failed");
    res.status(503).json({ error: "تعذر تحميل الهيكل الدراسي حالياً." });
  }
});

router.get("/catalog", async (req, res): Promise<void> => {
  try {
    res.json(GetCatalogResponse.parse(await loadCatalog()));
  } catch (error) {
    req.log.error({ err: error }, "Catalog request failed");
    res.status(503).json({ error: "تعذر تحميل المواد حالياً." });
  }
});

router.get("/catalog/search", async (req, res): Promise<void> => {
  const parsed = SearchCatalogQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معايير البحث غير صالحة." });
    return;
  }

  try {
    const catalog = GetCatalogResponse.parse(await loadCatalog());
    const subjectsById = new Map(catalog.subjects.map((item) => [item.id, item]));
    const semestersById = new Map(
      catalog.semesters.map((item) => [item.id, item]),
    );
    const yearsById = new Map(
      catalog.academicYears.map((item) => [item.id, item]),
    );
    const facultiesById = new Map(
      catalog.faculties.map((item) => [item.id, item]),
    );
    const universitiesById = new Map(
      catalog.universities.map((item) => [item.id, item]),
    );
    const query = normalizeArabic(parsed.data.q ?? "");

    const materials = catalog.materials.filter((material) => {
      const subject = subjectsById.get(material.subjectId);
      const semester = subject
        ? semestersById.get(subject.semesterId)
        : undefined;
      const academicYear = semester
        ? yearsById.get(semester.academicYearId)
        : undefined;
      const faculty = academicYear
        ? facultiesById.get(academicYear.facultyId)
        : undefined;
      const university = faculty
        ? universitiesById.get(faculty.universityId)
        : undefined;

      if (!subject || !semester || !academicYear || !faculty || !university) {
        return false;
      }
      if (
        parsed.data.universityId !== undefined &&
        university.id !== parsed.data.universityId
      ) {
        return false;
      }
      if (
        parsed.data.facultyId !== undefined &&
        faculty.id !== parsed.data.facultyId
      ) {
        return false;
      }
      if (
        parsed.data.academicYearId !== undefined &&
        academicYear.id !== parsed.data.academicYearId
      ) {
        return false;
      }
      if (
        parsed.data.semesterId !== undefined &&
        semester.id !== parsed.data.semesterId
      ) {
        return false;
      }
      if (
        parsed.data.subjectId !== undefined &&
        subject.id !== parsed.data.subjectId
      ) {
        return false;
      }
      if (parsed.data.category && material.category !== parsed.data.category) {
        return false;
      }

      if (!query) return true;
      const searchable = normalizeArabic(
        [
          material.titleAr,
          material.titleEn,
          material.descriptionAr,
          material.descriptionEn,
          subject.nameAr,
          subject.nameEn,
          faculty.nameAr,
          faculty.nameEn,
          university.nameAr,
          university.nameEn,
        ].join(" "),
      );
      return searchable.includes(query);
    });

    res.json(SearchCatalogResponse.parse({ materials }));
  } catch (error) {
    req.log.error({ err: error }, "Catalog search failed");
    res.status(503).json({ error: "تعذر البحث في المواد حالياً." });
  }
});

router.get(
  "/catalog/admin/access",
  requireAdmin,
  (_req, res): void => {
    res.json(GetCatalogAdminAccessResponse.parse({ enabled: true }));
  },
);

router.get(
  "/catalog/admin/catalog",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      res.json(
        GetCatalogAdminCatalogResponse.parse(await loadCatalog(true)),
      );
    } catch (error) {
      req.log.error({ err: error }, "Admin catalog request failed");
      res.status(503).json({ error: "تعذر تحميل إدارة المحتوى حالياً." });
    }
  },
);

type EntityType = AdminManageRequest["entityType"];
type EntityTarget = {
  table: unknown;
  fields: Record<string, string>;
  parentColumn?: string;
};

const entityTargets: Record<EntityType, EntityTarget> = {
  university: {
    table: universitiesTable,
    fields: { nameAr: "nameAr", nameEn: "nameEn", city: "city" },
  },
  faculty: {
    table: facultiesTable,
    parentColumn: "universityId",
    fields: { nameAr: "nameAr", nameEn: "nameEn" },
  },
  academicYear: {
    table: academicYearsTable,
    parentColumn: "facultyId",
    fields: { labelAr: "labelAr", labelEn: "labelEn", rank: "rank" },
  },
  semester: {
    table: semestersTable,
    parentColumn: "academicYearId",
    fields: { labelAr: "labelAr", labelEn: "labelEn", rank: "rank" },
  },
  subject: {
    table: subjectsTable,
    parentColumn: "semesterId",
    fields: { nameAr: "nameAr", nameEn: "nameEn", code: "code" },
  },
  material: {
    table: materialsTable,
    parentColumn: "subjectId",
    fields: {
      titleAr: "titleAr",
      titleEn: "titleEn",
      category: "category",
      descriptionAr: "descriptionAr",
      descriptionEn: "descriptionEn",
      fileFormat: "fileFormat",
      documentUrl: "documentUrl",
      fileSizeBytes: "fileSizeBytes",
      contributor: "contributor",
      professorName: "professorName",
      examYear: "examYear",
      examType: "examType",
      appearedInExam: "appearedInExam",
      publicationStatus: "publicationStatus",
      rejectionReason: "rejectionReason",
      authorized: "authorized",
    },
  },
};

function valuesFor(
  entityType: EntityType,
  body: AdminManageRequest,
): Record<string, unknown> {
  const target = entityTargets[entityType];
  const values: Record<string, unknown> = {};
  for (const [source, destination] of Object.entries(target.fields)) {
    if (body[source as keyof AdminManageRequest] !== undefined) {
      values[destination] = body[source as keyof AdminManageRequest];
    }
  }
  if (target.parentColumn && body.parentId !== undefined) {
    values[target.parentColumn] = body.parentId;
  }

  if (entityType === "material" && body.action !== "delete") {
    if (!body.titleAr?.trim() && body.action === "create") {
      throw new Error("Arabic material title is required.");
    }
    if (!body.titleEn?.trim() && body.action === "create") {
      throw new Error("English material title is required.");
    }
    if (!body.category && body.action === "create") {
      throw new Error("Material category is required.");
    }
    if (
      body.publicationStatus === "published" &&
      body.documentUrl &&
      body.authorized !== true
    ) {
      throw new Error(
        "Confirm that you have permission to distribute the document.",
      );
    }
    if (body.documentUrl) {
      let parsed: URL;
      try {
        parsed = new URL(body.documentUrl);
      } catch {
        throw new Error("Document address must be a valid HTTPS URL.");
      }
      if (parsed.protocol !== "https:") {
        throw new Error("Document address must use HTTPS.");
      }
    }
  }

  return values;
}

function textField(
  body: AdminManageRequest,
  key: keyof AdminManageRequest,
  action: AdminManageRequest["action"],
  requiredOnCreate: boolean,
): void {
  const value = body[key];
  if (action === "create" && requiredOnCreate && typeof value !== "string") {
    throw new Error(`${String(key)} is required.`);
  }
  if (value !== undefined && typeof value === "string" && !value.trim()) {
    throw new Error(`${String(key)} cannot be empty.`);
  }
}

router.post(
  "/catalog/admin/manage",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ManageCatalogAdminBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات التعديل غير صالحة." });
      return;
    }

    const body = parsed.data as AdminManageRequest;
    const target = entityTargets[body.entityType];

    try {
      if (body.action === "delete") {
        if (!body.id) {
          res.status(400).json({ error: "معرّف السجل مطلوب للحذف." });
          return;
        }
        const [deleted] = await db
          .delete(target.table as never)
          .where(eq((target.table as typeof universitiesTable).id, body.id))
          .returning({ id: (target.table as typeof universitiesTable).id });
        if (!deleted) {
          res.status(404).json({ error: "السجل غير موجود." });
          return;
        }
        res.json(
          ManageCatalogAdminResponse.parse({
            entityType: body.entityType,
            action: body.action,
            id: deleted.id,
            success: true,
          }),
        );
        return;
      }

      if (body.action === "update" && !body.id) {
        res.status(400).json({ error: "معرّف السجل مطلوب للتعديل." });
        return;
      }

      const values = valuesFor(body.entityType, body);
      let materialReviewUploaderId: string | null = null;
      let materialReviewFulfilledRequestId: number | null = null;
      if (body.entityType === "material") {
        const [existing] =
          body.action === "update"
            ? await db
                .select()
                .from(materialsTable)
                .where(eq(materialsTable.id, body.id!))
                .limit(1)
            : [];
        materialReviewUploaderId = existing?.uploaderId ?? null;
        materialReviewFulfilledRequestId = existing?.fulfilledRequestId ?? null;
        const materialData = {
          ...existing,
          ...values,
        } as {
          subjectId: number;
          titleAr: string;
          titleEn: string;
          descriptionAr?: string | null;
          descriptionEn?: string | null;
          professorName?: string | null;
        };
        if (!Number.isInteger(materialData.subjectId)) {
          res.status(400).json({ error: "المادة الدراسية مطلوبة." });
          return;
        }
        values.searchText = await buildMaterialSearchText(materialData);
      }
      const requiredTextFields: Partial<
        Record<EntityType, Array<keyof AdminManageRequest>>
      > = {
        university: ["nameAr", "nameEn"],
        faculty: ["nameAr", "nameEn"],
        academicYear: ["labelAr", "labelEn"],
        semester: ["labelAr", "labelEn"],
        subject: ["nameAr", "nameEn"],
        material: ["titleAr", "titleEn"],
      };
      for (const field of requiredTextFields[body.entityType] ?? []) {
        textField(
          body,
          field,
          body.action,
          body.action === "create",
        );
      }

      if (body.action === "create") {
        if (target.parentColumn && body.parentId === undefined) {
          res.status(400).json({ error: "السجل الأب مطلوب." });
          return;
        }
        const [created] = await db
          .insert(target.table as never)
          .values(values as never)
          .returning({ id: (target.table as typeof universitiesTable).id });
        res.json(
          ManageCatalogAdminResponse.parse({
            entityType: body.entityType,
            action: body.action,
            id: created.id,
            success: true,
          }),
        );
        return;
      }

      if (Object.keys(values).length === 0) {
        res.status(400).json({ error: "أدخل تغييراً واحداً على الأقل." });
        return;
      }
      const [updated] = await db
        .update(target.table as never)
        .set(values as never)
        .where(eq((target.table as typeof universitiesTable).id, body.id!))
        .returning({ id: (target.table as typeof universitiesTable).id });
      if (!updated) {
        res.status(404).json({ error: "السجل غير موجود." });
        return;
      }

      if (
        body.entityType === "material" &&
        materialReviewUploaderId &&
        (values.publicationStatus === "rejected" ||
          values.publicationStatus === "published")
      ) {
        await applyUploadReviewOutcome(
          materialReviewUploaderId,
          values.publicationStatus,
        );
      }

      if (
        body.entityType === "material" &&
        values.publicationStatus === "published" &&
        materialReviewFulfilledRequestId
      ) {
        // Only flips an still-open request — an admin editing an
        // already-published/fulfilling material again shouldn't re-fire
        // this or stomp a request someone else already closed/fulfilled.
        await db
          .update(materialRequestsTable)
          .set({ status: "fulfilled", fulfilledByMaterialId: updated.id })
          .where(
            and(
              eq(materialRequestsTable.id, materialReviewFulfilledRequestId),
              eq(materialRequestsTable.status, "open"),
            ),
          );
      }

      res.json(
        ManageCatalogAdminResponse.parse({
          entityType: body.entityType,
          action: body.action,
          id: updated.id,
          success: true,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Catalog change failed";
      if (
        message.includes("required") ||
        message.includes("cannot be empty") ||
        message.includes("Confirm that") ||
        message.includes("HTTPS")
      ) {
        res.status(400).json({ error: message });
        return;
      }

      const databaseError = error as { code?: string };
      if (databaseError.code === "23503" || databaseError.code === "23505") {
        res.status(409).json({
          error: "لا يمكن حذف هذا السجل لوجود عناصر مرتبطة به.",
        });
        return;
      }

      req.log.error({ err: error }, "Catalog administration failed");
      res.status(500).json({ error: "تعذر حفظ التغيير حالياً." });
    }
  },
);

export default router;
