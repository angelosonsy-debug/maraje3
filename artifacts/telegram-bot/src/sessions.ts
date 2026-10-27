import type { MaterialCategory } from "./api";

// A short-lived, in-memory, per-chat conversation state for the
// faculty→year→semester→subject→category inline-keyboard flow that starts
// when someone sends the bot a document/photo. Deliberately NOT persisted
// anywhere (no @grammyjs/conversations dependency, no DB table) — if the
// bot process restarts mid-flow the sender just has to resend the file,
// which is an acceptable trade-off for keeping this process dependency-light
// and stateless between restarts.

export type CategoryOption = { value: MaterialCategory; labelAr: string };

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "summary", labelAr: "تلخيص" },
  { value: "lecture-notes", labelAr: "محاضرات" },
  { value: "previous-exam", labelAr: "امتحان سابق" },
  { value: "model-answer", labelAr: "إجابة نموذجية" },
  { value: "revision", labelAr: "مراجعة" },
  { value: "practice", labelAr: "تدريبات" },
];

export type PendingFile = {
  fileId: string;
  contentType: string;
};

export type FlowStep = "faculty" | "academicYear" | "semester" | "subject" | "category";

export type FlowState = {
  step: FlowStep;
  file: PendingFile;
  facultyId?: number;
  academicYearId?: number;
  semesterId?: number;
  subjectId?: number;
  subjectLabel?: string;
};

const sessions = new Map<number, FlowState>();

export function startFlow(chatId: number, file: PendingFile): FlowState {
  const state: FlowState = { step: "faculty", file };
  sessions.set(chatId, state);
  return state;
}

export function getFlow(chatId: number): FlowState | undefined {
  return sessions.get(chatId);
}

export function clearFlow(chatId: number): void {
  sessions.delete(chatId);
}

export function updateFlow(chatId: number, patch: Partial<FlowState>): FlowState | undefined {
  const current = sessions.get(chatId);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  sessions.set(chatId, next);
  return next;
}

// Link-code flow ("/ربط") has no multi-step state — it is a single regex
// match handled inline in index.ts — so no session type is needed for it.
