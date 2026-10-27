import {
  GetContributorProfileParams,
  GetContributorProfileResponse,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
  RecordMaterialDownloadHeader,
  RecordMaterialDownloadParams,
  RecordMaterialDownloadResponse,
  RecordMaterialThanksHeader,
  RecordMaterialThanksParams,
  RecordMaterialThanksResponse,
} from "@workspace/api-zod";
import {
  db,
  downloadsTable,
  facultiesTable,
  materialsTable,
  thanksTable,
  usersTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { attachUserIfPresent } from "../lib/auth";
import {
  computeContributorTitle,
  getContributorStats,
  maybeGrantPremium,
} from "../lib/contributor-stats";
import { readLeaderboardWindowDays } from "../lib/engagement-config";

const router: IRouter = Router();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadPublishedMaterial(id: number) {
  const [material] = await db
    .select()
    .from(materialsTable)
    .where(
      and(eq(materialsTable.id, id), eq(materialsTable.publicationStatus, "published")),
    )
    .limit(1);
  return material ?? null;
}

router.post(
  "/materials/:id/download",
  attachUserIfPresent,
  async (req, res): Promise<void> => {
    const paramsParsed = RecordMaterialDownloadParams.safeParse(req.params);
    const headerParsed = RecordMaterialDownloadHeader.safeParse({
      "X-Device-Id": req.get("X-Device-Id"),
    });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "معرّف المادة غير صالح." });
      return;
    }
    if (!headerParsed.success) {
      res.status(400).json({ error: "معرّف الجهاز مطلوب." });
      return;
    }

    try {
      const material = await loadPublishedMaterial(paramsParsed.data.id);
      if (!material) {
        res.status(404).json({ error: "المادة غير موجودة." });
        return;
      }

      // Self-downloads of your own upload are never counted (anti-gaming
      // rule from the Stage 4 prompt).
      const isOwnMaterial =
        !!req.user && req.user.id === material.uploaderId;
      if (isOwnMaterial) {
        res.json(
          RecordMaterialDownloadResponse.parse({
            downloadCount: material.downloadCount,
          }),
        );
        return;
      }

      const deviceId = headerParsed.data["X-Device-Id"];
      const [inserted] = await db
        .insert(downloadsTable)
        .values({
          materialId: material.id,
          deviceId,
          userId: req.user?.id ?? null,
          day: todayUtc(),
        })
        .onConflictDoNothing()
        .returning({ id: downloadsTable.id });

      let downloadCount = material.downloadCount;
      if (inserted) {
        const [updated] = await db
          .update(materialsTable)
          .set({ downloadCount: sql`${materialsTable.downloadCount} + 1` })
          .where(eq(materialsTable.id, material.id))
          .returning({ downloadCount: materialsTable.downloadCount });
        downloadCount = updated?.downloadCount ?? material.downloadCount + 1;

        if (material.uploaderId) {
          await maybeGrantPremium(material.uploaderId);
        }
      }

      res.json(RecordMaterialDownloadResponse.parse({ downloadCount }));
    } catch (error) {
      req.log.error({ err: error }, "Recording a download failed");
      res.status(503).json({ error: "تعذر تسجيل التنزيل حالياً." });
    }
  },
);

router.post(
  "/materials/:id/thanks",
  attachUserIfPresent,
  async (req, res): Promise<void> => {
    const paramsParsed = RecordMaterialThanksParams.safeParse(req.params);
    const headerParsed = RecordMaterialThanksHeader.safeParse({
      "X-Device-Id": req.get("X-Device-Id"),
    });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "معرّف المادة غير صالح." });
      return;
    }
    if (!headerParsed.success) {
      res.status(400).json({ error: "معرّف الجهاز مطلوب." });
      return;
    }

    try {
      const material = await loadPublishedMaterial(paramsParsed.data.id);
      if (!material) {
        res.status(404).json({ error: "المادة غير موجودة." });
        return;
      }

      const isOwnMaterial =
        !!req.user && req.user.id === material.uploaderId;
      if (isOwnMaterial) {
        res.json(
          RecordMaterialThanksResponse.parse({
            thanksCount: material.thanksCount,
            alreadyThanked: false,
          }),
        );
        return;
      }

      const deviceId = headerParsed.data["X-Device-Id"];
      const [inserted] = await db
        .insert(thanksTable)
        .values({
          materialId: material.id,
          deviceId,
          userId: req.user?.id ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: thanksTable.id });

      let thanksCount = material.thanksCount;
      if (inserted) {
        const [updated] = await db
          .update(materialsTable)
          .set({ thanksCount: sql`${materialsTable.thanksCount} + 1` })
          .where(eq(materialsTable.id, material.id))
          .returning({ thanksCount: materialsTable.thanksCount });
        thanksCount = updated?.thanksCount ?? material.thanksCount + 1;
      }

      res.json(
        RecordMaterialThanksResponse.parse({
          thanksCount,
          alreadyThanked: !inserted,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Recording thanks failed");
      res.status(503).json({ error: "تعذر إرسال الشكر حالياً." });
    }
  },
);

router.get(
  "/contributors/:id",
  async (req, res): Promise<void> => {
    const parsed = GetContributorProfileParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "معرّف المساهم غير صالح." });
      return;
    }

    try {
      const [contributor] = await db
        .select({
          id: usersTable.id,
          displayName: usersTable.displayName,
          photoUrl: usersTable.photoUrl,
          hideIdentity: usersTable.hideIdentity,
          facultyNameAr: facultiesTable.nameAr,
        })
        .from(usersTable)
        .leftJoin(facultiesTable, eq(usersTable.facultyId, facultiesTable.id))
        .where(eq(usersTable.id, parsed.data.id))
        .limit(1);

      if (!contributor || contributor.hideIdentity) {
        res.status(404).json({ error: "لم يتم العثور على هذا المساهم." });
        return;
      }

      const [stats, materials, fulfilledRequestsRow] = await Promise.all([
        getContributorStats(contributor.id),
        db
          .select({
            id: materialsTable.id,
            titleAr: materialsTable.titleAr,
            titleEn: materialsTable.titleEn,
            category: materialsTable.category,
            subjectId: materialsTable.subjectId,
            downloadCount: materialsTable.downloadCount,
            thanksCount: materialsTable.thanksCount,
            createdAt: materialsTable.createdAt,
          })
          .from(materialsTable)
          .where(
            and(
              eq(materialsTable.uploaderId, contributor.id),
              eq(materialsTable.publicationStatus, "published"),
            ),
          )
          .orderBy(desc(materialsTable.createdAt))
          .limit(50),
        db
          .select({ value: count() })
          .from(materialsTable)
          .where(
            and(
              eq(materialsTable.uploaderId, contributor.id),
              eq(materialsTable.publicationStatus, "published"),
              isNotNull(materialsTable.fulfilledRequestId),
            ),
          ),
      ]);

      res.json(
        GetContributorProfileResponse.parse({
          id: contributor.id,
          displayName: contributor.displayName,
          photoUrl: contributor.photoUrl,
          facultyNameAr: contributor.facultyNameAr,
          title: computeContributorTitle(stats),
          publishedCount: stats.publishedCount,
          totalDownloads: stats.totalDownloads,
          totalThanks: stats.totalThanks,
          fulfilledRequestsCount: fulfilledRequestsRow[0]?.value ?? 0,
          materials,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Loading contributor profile failed");
      res.status(503).json({ error: "تعذر تحميل بروفايل المساهم حالياً." });
    }
  },
);

router.get("/leaderboard", async (req, res): Promise<void> => {
  const parsed = GetLeaderboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معايير لوحة الشرف غير صالحة." });
    return;
  }
  const { facultyId, scope } = parsed.data;

  try {
    const [faculty] = await db
      .select({ id: facultiesTable.id })
      .from(facultiesTable)
      .where(eq(facultiesTable.id, facultyId))
      .limit(1);
    if (!faculty) {
      res.status(404).json({ error: "الكلية غير موجودة." });
      return;
    }

    let entries: Array<{
      userId: string;
      displayName: string;
      photoUrl: string | null;
      downloads: number;
      materialsCount: number;
    }>;

    if (scope === "all-time") {
      // All-time ranking uses the pre-aggregated downloadCount column — no
      // need to scan the raw download-event log.
      const rows = await db
        .select({
          userId: usersTable.id,
          displayName: usersTable.displayName,
          photoUrl: usersTable.photoUrl,
          downloads: sql<number>`coalesce(sum(${materialsTable.downloadCount}), 0)::int`,
          materialsCount: sql<number>`count(*)::int`,
        })
        .from(materialsTable)
        .innerJoin(usersTable, eq(materialsTable.uploaderId, usersTable.id))
        .where(
          and(
            eq(usersTable.facultyId, facultyId),
            eq(materialsTable.publicationStatus, "published"),
            eq(usersTable.hideIdentity, false),
          ),
        )
        .groupBy(usersTable.id, usersTable.displayName, usersTable.photoUrl)
        .orderBy(desc(sql`coalesce(sum(${materialsTable.downloadCount}), 0)`))
        .limit(10);
      entries = rows;
    } else {
      // "semester" scope: see readLeaderboardWindowDays doc comment — this
      // is a trailing-window approximation, not a true semester boundary,
      // ranked by actual download *events* in that window rather than the
      // lifetime counter.
      const since = new Date(
        Date.now() - readLeaderboardWindowDays() * 24 * 60 * 60 * 1000,
      );
      const rows = await db
        .select({
          userId: usersTable.id,
          displayName: usersTable.displayName,
          photoUrl: usersTable.photoUrl,
          downloads: sql<number>`count(distinct ${downloadsTable.id})::int`,
          materialsCount: sql<number>`count(distinct ${materialsTable.id})::int`,
        })
        .from(downloadsTable)
        .innerJoin(materialsTable, eq(downloadsTable.materialId, materialsTable.id))
        .innerJoin(usersTable, eq(materialsTable.uploaderId, usersTable.id))
        .where(
          and(
            eq(usersTable.facultyId, facultyId),
            eq(materialsTable.publicationStatus, "published"),
            eq(usersTable.hideIdentity, false),
            gte(downloadsTable.createdAt, since),
          ),
        )
        .groupBy(usersTable.id, usersTable.displayName, usersTable.photoUrl)
        .orderBy(desc(sql`count(distinct ${downloadsTable.id})`))
        .limit(10);
      entries = rows;
    }

    const statsByUser = new Map(
      await Promise.all(
        entries.map(async (entry) => {
          const stats = await getContributorStats(entry.userId);
          return [entry.userId, computeContributorTitle(stats)] as const;
        }),
      ),
    );

    res.json(
      GetLeaderboardResponse.parse({
        facultyId,
        scope,
        entries: entries.map((entry) => ({
          ...entry,
          title: statsByUser.get(entry.userId) ?? null,
        })),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Loading leaderboard failed");
    res.status(503).json({ error: "تعذر تحميل لوحة الشرف حالياً." });
  }
});

export default router;
