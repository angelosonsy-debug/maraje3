function readPositiveInt(envName: string, fallback: number): number {
  const raw = process.env[envName]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// "منقذ الدفعة" — 10 published materials OR 500 total downloads across them.
export function readRescuerMaterialsThreshold(): number {
  return readPositiveInt("RESCUER_TITLE_MATERIALS_THRESHOLD", 10);
}
export function readRescuerDownloadsThreshold(): number {
  return readPositiveInt("RESCUER_TITLE_DOWNLOADS_THRESHOLD", 500);
}

// Free Premium unlock — 5 published materials AND 100 total downloads.
export function readPremiumMaterialsThreshold(): number {
  return readPositiveInt("PREMIUM_GRANT_MATERIALS_THRESHOLD", 5);
}
export function readPremiumDownloadsThreshold(): number {
  return readPositiveInt("PREMIUM_GRANT_DOWNLOADS_THRESHOLD", 100);
}

// There is no explicit start/end date anywhere on maraje3_semesters (it is
// just a catalog label), so "current semester" for the leaderboard is
// approximated as a rolling trailing window of download activity instead of
// a true semester boundary. Documented as an approximation in the Stage 4
// report — a real fix would add start/end dates to maraje3_semesters.
export function readLeaderboardWindowDays(): number {
  return readPositiveInt("LEADERBOARD_WINDOW_DAYS", 120);
}
