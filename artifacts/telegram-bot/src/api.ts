import { readApiBaseUrl, readBotApiSecret } from "./config";

// Minimal hand-written shapes for just the fields this bot reads — kept
// decoupled from @workspace/api-zod on purpose (this is a separate
// deployable process, not part of the app/server TypeScript project
// references graph).
export type Faculty = { id: number; nameAr: string; universityId: number };
export type AcademicYear = { id: number; labelAr: string; facultyId: number };
export type Semester = { id: number; labelAr: string; academicYearId: number };
export type Subject = { id: number; nameAr: string; semesterId: number };

export type CatalogTree = {
  faculties: Faculty[];
  academicYears: AcademicYear[];
  semesters: Semester[];
  subjects: Subject[];
};

export type MaterialCategory =
  | "summary"
  | "lecture-notes"
  | "previous-exam"
  | "model-answer"
  | "revision"
  | "practice";

export class MaraApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

/** Public, unauthenticated — same endpoint the app itself uses to build its catalog pickers. */
export async function fetchCatalogTree(): Promise<CatalogTree> {
  const response = await fetch(`${readApiBaseUrl()}/api/catalog/tree`);
  if (!response.ok) {
    throw new MaraApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as CatalogTree;
}

export async function submitFile(params: {
  bytes: Buffer;
  contentType: string;
  subjectId: number;
  titleAr: string;
  category: MaterialCategory;
  telegramUserId: string;
  telegramUsername: string | null;
}): Promise<{ materialId: number; duplicate: boolean }> {
  const query = new URLSearchParams({
    subjectId: String(params.subjectId),
    titleAr: params.titleAr,
    category: params.category,
    telegramUserId: params.telegramUserId,
    ...(params.telegramUsername ? { telegramUsername: params.telegramUsername } : {}),
  });
  const response = await fetch(
    `${readApiBaseUrl()}/api/internal/submissions?${query.toString()}`,
    {
      method: "POST",
      headers: {
        "X-Bot-Secret": readBotApiSecret(),
        "content-type": params.contentType,
      },
      body: params.bytes,
    },
  );
  if (!response.ok) {
    throw new MaraApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as { materialId: number; duplicate: boolean };
}

export async function linkTelegramAccount(params: {
  code: string;
  telegramUserId: string;
  telegramChatId: string;
  telegramUsername: string | null;
}): Promise<{ success: boolean; displayName: string }> {
  const response = await fetch(`${readApiBaseUrl()}/api/internal/telegram/link`, {
    method: "POST",
    headers: {
      "X-Bot-Secret": readBotApiSecret(),
      "content-type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new MaraApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as { success: boolean; displayName: string };
}
