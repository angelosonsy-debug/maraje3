import {
  GetMaterialParams,
  GetMaterialResponse,
  GetMaterialsQueryParams,
  GetMaterialsResponse,
} from "@workspace/api-zod";
import {
  academicYearsTable,
  db,
  facultiesTable,
  materialsTable,
  semestersTable,
  subjectsTable,
  universitiesTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { normalizeArabic } from "../lib/material-search";
import {
  computeContributorTitle,
  getContributorStats,
} from "../lib/contributor-stats";

const router: IRouter = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function materialConditions(
  filters: ReturnType<typeof GetMaterialsQueryParams.parse>,
): SQL[] {
  const conditions: SQL[] = [
    eq(materialsTable.publicationStatus, "published"),
  ];
  if (filters.universityId !== undefined) {
    conditions.push(eq(universitiesTable.id, filters.universityId));
  }
  if (filters.facultyId !== undefined) {
    conditions.push(eq(facultiesTable.id, filters.facultyId));
  }
  if (filters.academicYearId !== undefined) {
    conditions.push(eq(academicYearsTable.id, filters.academicYearId));
  }
  if (filters.semesterId !== undefined) {
    conditions.push(eq(semestersTable.id, filters.semesterId));
  }
  if (filters.subjectId !== undefined) {
    conditions.push(eq(materialsTable.subjectId, filters.subjectId));
  }
  if (filters.category) {
    conditions.push(eq(materialsTable.category, filters.category));
  }
  if (filters.examType) {
    conditions.push(eq(materialsTable.examType, filters.examType));
  }
  if (filters.examYear !== undefined) {
    conditions.push(eq(materialsTable.examYear, filters.examYear));
  }
  if (filters.professorName?.trim()) {
    conditions.push(
      ilike(
        materialsTable.professorName,
        `%${escapeLikePattern(normalizeArabic(filters.professorName))}%`,
      ),
    );
  }
  const query = normalizeArabic(filters.q ?? "");
  if (query) {
    conditions.push(
      ilike(materialsTable.searchText, `%${escapeLikePattern(query)}%`),
    );
  }
  return conditions;
}

function joinedMaterialsQuery(conditions: SQL[]) {
  return db
    .select({ material: materialsTable })
    .from(materialsTable)
    .innerJoin(subjectsTable, eq(materialsTable.subjectId, subjectsTable.id))
    .innerJoin(semestersTable, eq(subjectsTable.semesterId, semestersTable.id))
    .innerJoin(
      academicYearsTable,
      eq(semestersTable.academicYearId, academicYearsTable.id),
    )
    .innerJoin(
      facultiesTable,
      eq(academicYearsTable.facultyId, facultiesTable.id),
    )
    .innerJoin(
      universitiesTable,
      eq(facultiesTable.universityId, universitiesTable.id),
    )
    .where(and(...conditions));
}

router.get("/materials", async (req, res): Promise<void> => {
  const parsed = GetMaterialsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معايير البحث أو ترقيم الصفحات غير صالحة." });
    return;
  }

  try {
    const filters = parsed.data;
    const conditions = materialConditions(filters);
    const [rows, countResult] = await Promise.all([
      joinedMaterialsQuery(conditions)
        .orderBy(desc(materialsTable.createdAt), desc(materialsTable.id))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(materialsTable)
        .innerJoin(subjectsTable, eq(materialsTable.subjectId, subjectsTable.id))
        .innerJoin(
          semestersTable,
          eq(subjectsTable.semesterId, semestersTable.id),
        )
        .innerJoin(
          academicYearsTable,
          eq(semestersTable.academicYearId, academicYearsTable.id),
        )
        .innerJoin(
          facultiesTable,
          eq(academicYearsTable.facultyId, facultiesTable.id),
        )
        .innerJoin(
          universitiesTable,
          eq(facultiesTable.universityId, universitiesTable.id),
        )
        .where(and(...conditions)),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json(
      GetMaterialsResponse.parse({
        materials: rows.map(({ material }) => material),
        page: filters.page,
        limit: filters.limit,
        total,
        hasMore: filters.page * filters.limit < total,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Material search failed");
    res.status(503).json({ error: "تعذر البحث في المواد حالياً." });
  }
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const parsed = GetMaterialParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "معرّف المادة غير صالح." });
    return;
  }
  try {
    const [material] = await db
      .select()
      .from(materialsTable)
      .where(
        and(
          eq(materialsTable.id, parsed.data.id),
          eq(materialsTable.publicationStatus, "published"),
        ),
      )
      .limit(1);
    if (!material) {
      res.status(404).json({ error: "المادة غير موجودة." });
      return;
    }

    let uploaderSummary = null;
    if (material.uploaderId) {
      const [uploader] = await db
        .select({
          displayName: usersTable.displayName,
          photoUrl: usersTable.photoUrl,
          hideIdentity: usersTable.hideIdentity,
          facultyNameAr: facultiesTable.nameAr,
        })
        .from(usersTable)
        .leftJoin(facultiesTable, eq(usersTable.facultyId, facultiesTable.id))
        .where(eq(usersTable.id, material.uploaderId))
        .limit(1);
      if (uploader && !uploader.hideIdentity) {
        const stats = await getContributorStats(material.uploaderId);
        uploaderSummary = {
          userId: material.uploaderId,
          displayName: uploader.displayName,
          photoUrl: uploader.photoUrl,
          facultyNameAr: uploader.facultyNameAr,
          title: computeContributorTitle(stats),
        };
      }
    }

    res.json(GetMaterialResponse.parse({ ...material, uploaderSummary }));
  } catch (error) {
    req.log.error({ err: error }, "Material detail request failed");
    res.status(503).json({ error: "تعذر تحميل المادة حالياً." });
  }
});

export default router;
