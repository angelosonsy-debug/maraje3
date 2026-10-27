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
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readPublicBaseUrl(): string | null {
  return process.env["PUBLIC_BASE_URL"]?.trim().replace(/\/+$/, "") || null;
}

function readStoreUrl(): string | null {
  return process.env["PUBLIC_STORE_URL"]?.trim() || null;
}

/**
 * Lightweight, no-login share page for a single material — NOT mounted
 * under /api (see app.ts): it's meant to be the literal link people paste,
 * e.g. https://<PUBLIC_BASE_URL>/m/42. Shows a preview (title, subject,
 * faculty, contributor if attribution is allowed) with OpenGraph tags for
 * link unfurling, plus an "افتح في التطبيق" deep link (maraje3://material/id,
 * via the app's existing expo-router + `scheme: "maraje3"` config — no
 * extra linking setup needed) and a store-link fallback. It never serves
 * the file itself.
 */
router.get("/m/:id", async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params["id"] ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).type("html").send(notFoundHtml());
    return;
  }

  try {
    const [row] = await db
      .select({
        material: materialsTable,
        subjectNameAr: subjectsTable.nameAr,
        facultyNameAr: facultiesTable.nameAr,
        universityNameAr: universitiesTable.nameAr,
      })
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
      .where(eq(materialsTable.id, id))
      .limit(1);

    if (!row || row.material.publicationStatus !== "published") {
      res.status(404).type("html").send(notFoundHtml());
      return;
    }

    let contributorLine: string | null = null;
    if (row.material.uploaderId) {
      const [uploader] = await db
        .select({
          displayName: usersTable.displayName,
          hideIdentity: usersTable.hideIdentity,
        })
        .from(usersTable)
        .where(eq(usersTable.id, row.material.uploaderId))
        .limit(1);
      if (uploader && !uploader.hideIdentity) {
        contributorLine = uploader.displayName;
      }
    } else if (row.material.contributor) {
      contributorLine = row.material.contributor;
    }

    const base = readPublicBaseUrl();
    const pageUrl = base ? `${base}/m/${id}` : `/m/${id}`;
    const deepLink = `maraje3://material/${id}`;
    const storeUrl = readStoreUrl();

    const title = row.material.titleAr;
    const description = [
      row.subjectNameAr,
      row.facultyNameAr,
      row.universityNameAr,
      contributorLine ? `رفعه: ${contributorLine}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — مراجعي</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f6f4ec; color: #123f4a; margin: 0; padding: 32px 20px; text-align: center; }
  .card { max-width: 420px; margin: 40px auto; background: #fff; border-radius: 18px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #5a6b70; font-size: 14px; margin: 0 0 20px; }
  a.btn { display: block; margin: 10px 0; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; }
  a.primary { background: #123f4a; color: #fff; }
  a.secondary { background: #eef0e8; color: #123f4a; }
  .badge { display: inline-block; background: #eef0e8; color: #123f4a; border-radius: 20px; padding: 4px 10px; font-size: 11px; margin-bottom: 10px; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">معاينة فقط — افتح التطبيق لتنزيل الملف</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a class="btn primary" href="${escapeHtml(deepLink)}">افتح في التطبيق</a>
    ${storeUrl ? `<a class="btn secondary" href="${escapeHtml(storeUrl)}">حمّل تطبيق مراجعي</a>` : ""}
  </div>
</body>
</html>`);
  } catch (error) {
    req.log.error({ err: error }, "Share page request failed");
    res.status(503).type("html").send(notFoundHtml());
  }
});

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>غير متاح — مراجعي</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
<h1>هذا المورد غير متاح</h1>
<p>ربما تمت إزالته أو لم يعد منشوراً.</p>
</body></html>`;
}

export default router;
