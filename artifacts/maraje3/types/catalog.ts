import type {
  AdminFlashcardDeckSummary,
  AdminManageRequest,
  CatalogResponse,
  CatalogTreeResponse,
  ContributorProfileResponse,
  ExamType,
  Flashcard,
  FlashcardDeckDetail,
  FlashcardDeckSummary,
  GetMaterialsParams,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScope,
  Material,
  MaterialCategory,
  MaterialDetail,
  MaterialRequest,
  RequestStatus,
  UploaderSummary,
} from "@workspace/api-client-react";

export type {
  AdminFlashcardDeckSummary,
  AdminManageRequest,
  CatalogResponse,
  CatalogTreeResponse,
  ContributorProfileResponse,
  ExamType,
  Flashcard,
  FlashcardDeckDetail,
  FlashcardDeckSummary,
  GetMaterialsParams,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScope,
  Material,
  MaterialCategory,
  MaterialDetail,
  MaterialRequest,
  RequestStatus,
  UploaderSummary,
};
export type AppCatalog = CatalogTreeResponse & { materials: Material[] };
export type UserStudyPreference = {
  universityId: number;
  facultyId: number;
  academicYearId: number;
  semesterId?: number;
};

export type CatalogSource = "server" | "cache" | "demo";

export type CatalogFilters = {
  universityId?: number;
  facultyId?: number;
  academicYearId?: number;
  semesterId?: number;
  category?: MaterialCategory;
  examType?: ExamType;
  examYear?: number;
  professorName?: string;
};

export type DownloadRecord = {
  materialId: number;
  titleAr: string;
  fileName: string;
  localUri: string;
  downloadedAt: string;
  fileSizeBytes: number | null;
};

export type ParentOption = {
  id: number;
  label: string;
};

export type AdminEntityType = AdminManageRequest["entityType"];

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  summary: "ملخصات دراسية",
  "lecture-notes": "ملاحظات المحاضرات",
  "previous-exam": "نماذج امتحانات",
  "model-answer": "إجابات نموذجية",
  revision: "أوراق مراجعة",
  practice: "أسئلة تدريبية",
};
