import AsyncStorage from "@react-native-async-storage/async-storage";

// Stage 7-B: "after 3 free downloads a day, the 4th needs a rewarded ad (or
// Premium)". This is a client-side, device-local counter — downloads are
// already recorded server-side per material (engagement.ts) for stats, but
// the *daily free quota* itself is purely a local gate in front of that,
// same as the Stage 6 exam-reminder and flashcard-progress stores.

const STORAGE_KEY = "maraje3.daily-downloads.v1";
export const FREE_DAILY_DOWNLOADS = 3;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export async function getTodaysDownloadCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const log = JSON.parse(raw) as Record<string, number>;
    return log[todayKey()] ?? 0;
  } catch {
    return 0;
  }
}

export async function recordDownloadForQuota(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const log = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const key = todayKey();
    log[key] = (log[key] ?? 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Best-effort — worst case the gate undercounts for one session.
  }
}

/** True when the next download needs a rewarded ad (not Premium, under the free daily quota). */
export async function nextDownloadNeedsRewardedAd(isPremium: boolean): Promise<boolean> {
  if (isPremium) return false;
  const count = await getTodaysDownloadCount();
  return count >= FREE_DAILY_DOWNLOADS;
}
