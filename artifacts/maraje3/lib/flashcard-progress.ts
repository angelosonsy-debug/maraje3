import AsyncStorage from "@react-native-async-storage/async-storage";

// Stage 7 flashcards: review progress is entirely local on the device (no
// server endpoint for it, per the phased prompt). Two small stores:
// 1) per-card known/unknown state, scoped per deck, so "راجع اللي ما
//    عرفتهوش" can filter a session down to the ones still marked unknown.
// 2) a simple daily session counter shown on the deck list.

const CARD_STATE_KEY = "maraje3.flashcard-progress.v1";
const SESSION_LOG_KEY = "maraje3.flashcard-sessions.v1";

export type CardKnownState = "known" | "unknown";

type ProgressStore = Record<string, Record<number, CardKnownState>>; // deckId -> cardId -> state

async function readStore(): Promise<ProgressStore> {
  try {
    const raw = await AsyncStorage.getItem(CARD_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressStore;
  } catch {
    return {};
  }
}

async function writeStore(store: ProgressStore): Promise<void> {
  try {
    await AsyncStorage.setItem(CARD_STATE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort — local progress loss is not worth surfacing an error for.
  }
}

export async function getDeckProgress(
  deckId: number,
): Promise<Record<number, CardKnownState>> {
  const store = await readStore();
  return store[String(deckId)] ?? {};
}

export async function setCardKnown(
  deckId: number,
  cardId: number,
  state: CardKnownState,
): Promise<void> {
  const store = await readStore();
  const deckKey = String(deckId);
  store[deckKey] = { ...(store[deckKey] ?? {}), [cardId]: state };
  await writeStore(store);
}

export async function resetDeckProgress(deckId: number): Promise<void> {
  const store = await readStore();
  delete store[String(deckId)];
  await writeStore(store);
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** Call once per completed review session (deck finished or closed). Returns today's running count. */
export async function recordSessionCompleted(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_LOG_KEY);
    const log = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const key = todayKey();
    log[key] = (log[key] ?? 0) + 1;
    await AsyncStorage.setItem(SESSION_LOG_KEY, JSON.stringify(log));
    return log[key];
  } catch {
    return 0;
  }
}

export async function getTodaysSessionCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_LOG_KEY);
    if (!raw) return 0;
    const log = JSON.parse(raw) as Record<string, number>;
    return log[todayKey()] ?? 0;
  } catch {
    return 0;
  }
}
