import {
  CreateReportBody,
  CreateReportResponse,
  GetAdminReportsQueryParams,
  GetAdminReportsResponse,
  ResolveAdminReportBody,
  ResolveAdminReportParams,
  ResolveAdminReportResponse,
} from "@workspace/api-zod";
import {
  db,
  materialRequestsTable,
  materialsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { Router, type IRouter } from "express";
import { requireAdmin } from "./catalog";
import { attachUserIfPresent } from "../lib/auth";
import { readSuspensionDays } from "../lib/upload-validation";

const router: IRouter = Router();

// Anonymous/public endpoint — rate-limited per IP since there's no account
// to key off for a reporter who isn't signed in.
const reportSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res): void => {
    res.status(429).json({ error: "بلاغات كثيرة. حاول مرة أخرى بعد قليل." });
  },
});

router.post(
  "/reports",
  reportSubmissionLimiter,
  attachUserIfPresent,
  async (req, res): Promise<void> => {
    const parsed = CreateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات البلاغ غير صالحة." });
      return;
    }
    const body = parsed.data;

    if (!req.user && !body.deviceId?.trim()) {
      res.status(400).json({ error: "معرّف الجهاز مطلوب للبلاغات بدون تسجيل دخول." });
      return;
    }

    try {
      const [created] = await db
        .insert(reportsTable)
        .values({
          targetType: body.targetType,
          targetId: body.targetId,
          reporterUserId: req.user?.id ?? null,
          reporterDeviceId: req.user ? null : (body.deviceId ?? null),
          reason: body.reason,
          details: body.details ?? null,
          status: "open",
        })
        .returning();

      res.json(
        CreateReportResponse.parse({
          id: created.id,
          status: created.status,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Report submission failed");
      res.status(503).json({ error: "تعذر إرسال البلاغ حالياً." });
    }
  },
);

router.get(
  "/catalog/admin/reports",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = GetAdminReportsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "معايير البحث غير صالحة." });
      return;
    }

    try {
      const reports = await db
        .select()
        .from(reportsTable)
        .where(
          parsed.data.status
            ? eq(reportsTable.status, parsed.data.status)
            : undefined,
        )
        .orderBy(desc(reportsTable.createdAt));
      res.json(GetAdminReportsResponse.parse({ reports }));
    } catch (error) {
      req.log.error({ err: error }, "Listing admin reports failed");
      res.status(503).json({ error: "تعذر تحميل البلاغات حالياً." });
    }
  },
);

router.post(
  "/catalog/admin/reports/:id/resolve",
  requireAdmin,
  async (req, res): Promise<void> => {
    const paramsParsed = ResolveAdminReportParams.safeParse(req.params);
    const bodyParsed = ResolveAdminReportBody.safeParse(req.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      res.status(400).json({ error: "بيانات غير صالحة." });
      return;
    }
    const { id } = paramsParsed.data;
    const { action, suspendDays } = bodyParsed.data;

    try {
      const [report] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, id))
        .limit(1);
      if (!report) {
        res.status(404).json({ error: "البلاغ غير موجود." });
        return;
      }

      const materialTargetId =
        report.targetType === "material" ? Number(report.targetId) : NaN;

      if (action === "unpublish") {
        if (report.targetType === "material" && Number.isInteger(materialTargetId)) {
          await db
            .update(materialsTable)
            .set({ publicationStatus: "rejected" })
            .where(eq(materialsTable.id, materialTargetId));
        } else if (report.targetType === "request") {
          const requestTargetId = Number(report.targetId);
          if (Number.isInteger(requestTargetId)) {
            await db
              .update(materialRequestsTable)
              .set({ status: "closed" })
              .where(eq(materialRequestsTable.id, requestTargetId));
          }
        }
      } else if (
        action === "suspend-uploads" ||
        action === "suspend-account" ||
        action === "reinstate-account"
      ) {
        // All three act on "whichever user this report points at" — a
        // profile report points at the user directly, a material report
        // points at it via the material's uploader. Shared resolution so
        // suspend-account/reinstate-account (full account block, Stage 8 —
        // Play's "ban violating users" requirement) and suspend-uploads
        // (Stage 4 — content-only, timed) stay consistent.
        let uploaderId: string | null = null;
        if (report.targetType === "profile") {
          uploaderId = report.targetId;
        } else if (
          report.targetType === "material" &&
          Number.isInteger(materialTargetId)
        ) {
          const [material] = await db
            .select({ uploaderId: materialsTable.uploaderId })
            .from(materialsTable)
            .where(eq(materialsTable.id, materialTargetId))
            .limit(1);
          uploaderId = material?.uploaderId ?? null;
        }
        if (uploaderId) {
          if (action === "suspend-uploads") {
            await db
              .update(usersTable)
              .set({
                uploadSuspendedUntil: new Date(
                  Date.now() +
                    (suspendDays ?? readSuspensionDays()) * 24 * 60 * 60 * 1000,
                ),
              })
              .where(eq(usersTable.id, uploaderId));
          } else if (action === "suspend-account") {
            // Full block: requireUser-protected creation endpoints
            // (uploads, requests, flashcard suggestions) reject a
            // suspended account outright — see isAccountSuspended() in
            // ../lib/auth. Browsing/downloading never required an account
            // to begin with (rule 6), so this can't lock anyone out of the
            // library itself.
            await db
              .update(usersTable)
              .set({ status: "suspended" })
              .where(eq(usersTable.id, uploaderId));
          } else {
            await db
              .update(usersTable)
              .set({ status: "active" })
              .where(eq(usersTable.id, uploaderId));
          }
        }
      }

      const [updated] = await db
        .update(reportsTable)
        .set({
          status: action === "dismiss" ? "dismissed" : "resolved",
        })
        .where(eq(reportsTable.id, id))
        .returning();

      res.json(
        ResolveAdminReportResponse.parse({ success: true, report: updated }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Resolving admin report failed");
      res.status(500).json({ error: "تعذر تنفيذ الإجراء حالياً." });
    }
  },
);

export default router;
