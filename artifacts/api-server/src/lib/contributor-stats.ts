import { db, materialsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  readPremiumDownloadsThreshold,
  readPremiumMaterialsThreshold,
  readRescuerDownloadsThreshold,
  readRescuerMaterialsThreshold,
} from "./engagement-config";

export const NEW_CONTRIBUTOR_TITLE = "مساهم جديد";
export const RESCUER_TITLE = "منقذ الدفعة";

export type ContributorStats = {
  publishedCount: number;
  totalDownloads: number;
  totalThanks: number;
};

/**
 * Published-material stats for one contributor. Intentionally scoped to
 * publicationStatus="published" only — pending/rejected uploads never count
 * toward titles, the leaderboard, or the Premium grant (rule from the
 * Stage 3/4 prompt: titles are built on published work only).
 */
export async function getContributorStats(
  uploaderId: string,
): Promise<ContributorStats> {
  const [row] = await db
    .select({
      publishedCount: sql<number>`count(*)::int`,
      totalDownloads: sql<number>`coalesce(sum(${materialsTable.downloadCount}), 0)::int`,
      totalThanks: sql<number>`coalesce(sum(${materialsTable.thanksCount}), 0)::int`,
    })
    .from(materialsTable)
    .where(
      and(
        eq(materialsTable.uploaderId, uploaderId),
        eq(materialsTable.publicationStatus, "published"),
      ),
    );
  return row ?? { publishedCount: 0, totalDownloads: 0, totalThanks: 0 };
}

/**
 * "أسطورة الكلية" (top contributor in their faculty) is deliberately NOT
 * decided here — it needs a faculty-wide ranking, which is only computed
 * where that ranking is already being built: the leaderboard endpoint and
 * the contributor's own public profile. This covers only the two tiers that
 * depend solely on the contributor's own numbers.
 */
export function computeContributorTitle(
  stats: ContributorStats,
): string | null {
  if (stats.publishedCount <= 0) return null;
  if (
    stats.publishedCount >= readRescuerMaterialsThreshold() ||
    stats.totalDownloads >= readRescuerDownloadsThreshold()
  ) {
    return RESCUER_TITLE;
  }
  return NEW_CONTRIBUTOR_TITLE;
}

/**
 * Checks whether a contributor just crossed the free-Premium thresholds and
 * grants it if so. Idempotent and cheap to call opportunistically (on
 * publish, and on each download of one of their materials) since it no-ops
 * immediately once premiumGranted is already true.
 */
export async function maybeGrantPremium(uploaderId: string): Promise<boolean> {
  const [user] = await db
    .select({ premiumGranted: usersTable.premiumGranted })
    .from(usersTable)
    .where(eq(usersTable.id, uploaderId))
    .limit(1);
  if (!user || user.premiumGranted) return false;

  const stats = await getContributorStats(uploaderId);
  const qualifies =
    stats.publishedCount >= readPremiumMaterialsThreshold() &&
    stats.totalDownloads >= readPremiumDownloadsThreshold();
  if (!qualifies) return false;

  await db
    .update(usersTable)
    .set({ premiumGranted: true })
    .where(eq(usersTable.id, uploaderId));
  return true;
}
