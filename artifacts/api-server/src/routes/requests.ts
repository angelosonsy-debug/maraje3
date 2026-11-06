import {
  CreateRequestBody,
  CreateRequestResponse,
  GetRequestsQueryParams,
  GetRequestsResponse,
  ManageAdminRequestBody,
  ManageAdminRequestParams,
  ManageAdminRequestResponse,
  RecordRequestMeTooHeader,
  RecordRequestMeTooParams,
  RecordRequestMeTooResponse,
} from "@workspace/api-zod";
import {
  db,
  facultiesTable,
  materialRequestsTable,
  requestMeTooTable,
  subjectsTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./catalog";
import { isAccountSuspended, requireUser } from "../lib/auth";

const router: IRouter = Router();

const DAILY_REQUEST_QUOTA = 3;

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function countTodaysRequests(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(materialRequestsTable)
    .where(
      and(
        eq(materialRequestsTable.requesterUserId, userId),
        gte(materialRequestsTable.createdAt, startOfTodayUtc()),
      ),
    );
  return row?.value ?? 0;
}

router.get("/requests", async (req, res): Promise<void> => {
  const parsed = GetRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معايير البحث غير صالحة." });
    return;
  }
  const { facultyId, subjectId, status } = parsed.data;

  try {
    const conditions = [eq(materialRequestsTable.facultyId, facultyId)];
    if (subjectId !== undefined) {
      conditions.push(eq(materialRequestsTable.subjectId, subjectId));
    }
    if (status) {
      conditions.push(eq(materialRequestsTable.status, status));
    }
    const requests = await db
      .select()
      .from(materialRequestsTable)
      .where(and(...conditions))
      .orderBy(
        desc(materialRequestsTable.meTooCount),
        desc(materialRequestsTable.createdAt),
      );
    res.json(GetRequestsResponse.parse({ requests }));
  } catch (error) {
    req.log.error({ err: error }, "Listing requests failed");
    res.status(503).json({ error: "تعذر تحميل لوحة مطلوب حالياً." });
  }
});

router.post("/requests", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الطلب غير صالحة." });
    return;
  }
  const user = req.user!;
  const body = parsed.data;

  if (isAccountSuspended(user)) {
    res.status(403).json({ error: "تم حظر حسابك من قِبل فريق الإدارة." });
    return;
  }

  try {
    const [faculty] = await db
      .select({ id: facultiesTable.id })
      .from(facultiesTable)
      .where(eq(facultiesTable.id, body.facultyId))
      .limit(1);
    if (!faculty) {
      res.status(400).json({ error: "الكلية غير موجودة." });
      return;
    }
    if (body.subjectId != null) {
      const [subject] = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, body.subjectId))
        .limit(1);
      if (!subject) {
        res.status(400).json({ error: "المادة الدراسية غير موجودة." });
        return;
      }
    }

    const todaysCount = await countTodaysRequests(user.id);
    if (todaysCount >= DAILY_REQUEST_QUOTA) {
      res.status(429).json({
        error: "تجاوزت الحد اليومي لعدد الطلبات (3 طلبات/يوم). حاول غداً.",
      });
      return;
    }

    const [created] = await db
      .insert(materialRequestsTable)
      .values({
        facultyId: body.facultyId,
        subjectId: body.subjectId ?? null,
        titleAr: body.titleAr.trim(),
        requesterUserId: user.id,
        status: "open",
      })
      .returning();

    res.json(CreateRequestResponse.parse({ request: created }));
  } catch (error) {
    req.log.error({ err: error }, "Creating a request failed");
    res.status(503).json({ error: "تعذر إنشاء الطلب حالياً." });
  }
});

router.post(
  "/requests/:id/me-too",
  async (req, res): Promise<void> => {
    const paramsParsed = RecordRequestMeTooParams.safeParse(req.params);
    const headerParsed = RecordRequestMeTooHeader.safeParse({
      "X-Device-Id": req.get("X-Device-Id"),
    });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "معرّف الطلب غير صالح." });
      return;
    }
    if (!headerParsed.success) {
      res.status(400).json({ error: "معرّف الجهاز مطلوب." });
      return;
    }

    try {
      const [request] = await db
        .select()
        .from(materialRequestsTable)
        .where(eq(materialRequestsTable.id, paramsParsed.data.id))
        .limit(1);
      if (!request) {
        res.status(404).json({ error: "الطلب غير موجود." });
        return;
      }

      const deviceId = headerParsed.data["X-Device-Id"];
      const [inserted] = await db
        .insert(requestMeTooTable)
        .values({ requestId: request.id, deviceId })
        .onConflictDoNothing()
        .returning({ id: requestMeTooTable.id });

      let meTooCount = request.meTooCount;
      if (inserted) {
        const [updated] = await db
          .update(materialRequestsTable)
          .set({ meTooCount: sql`${materialRequestsTable.meTooCount} + 1` })
          .where(eq(materialRequestsTable.id, request.id))
          .returning({ meTooCount: materialRequestsTable.meTooCount });
        meTooCount = updated?.meTooCount ?? request.meTooCount + 1;
      }

      res.json(
        RecordRequestMeTooResponse.parse({
          meTooCount,
          alreadyMeToo: !inserted,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Recording 'أنا كمان' failed");
      res.status(503).json({ error: "تعذر تسجيل طلبك حالياً." });
    }
  },
);

router.post(
  "/catalog/admin/requests/:id/manage",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = ManageAdminRequestParams.safeParse(req.params);
    const bodyParsed = ManageAdminRequestBody.safeParse(req.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      res.status(400).json({ error: "بيانات غير صالحة." });
      return;
    }

    try {
      if (bodyParsed.data.action === "delete") {
        const [deleted] = await db
          .delete(materialRequestsTable)
          .where(eq(materialRequestsTable.id, paramsParsed.data.id))
          .returning({ id: materialRequestsTable.id });
        if (!deleted) {
          res.status(404).json({ error: "الطلب غير موجود." });
          return;
        }
        res.json(
          ManageAdminRequestResponse.parse({ success: true, request: null }),
        );
        return;
      }

      const [updated] = await db
        .update(materialRequestsTable)
        .set({ status: "closed" })
        .where(eq(materialRequestsTable.id, paramsParsed.data.id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "الطلب غير موجود." });
        return;
      }
      res.json(
        ManageAdminRequestResponse.parse({ success: true, request: updated }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Managing a request failed");
      res.status(503).json({ error: "تعذر تنفيذ الإجراء حالياً." });
    }
  },
);

export default router;
