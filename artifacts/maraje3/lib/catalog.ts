import type {
  CatalogFilters,
  CatalogResponse,
  Material,
  MaterialCategory,
} from "@/types/catalog";

export function normalizeArabic(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, (letter) => (letter === "ؤ" ? "و" : "ي"))
    .replace(/\s+/g, " ")
    .trim();
}

export function getMaterialContext(catalog: CatalogResponse, material: Material) {
  const subject = catalog.subjects.find((item) => item.id === material.subjectId);
  const semester = subject
    ? catalog.semesters.find((item) => item.id === subject.semesterId)
    : undefined;
  const academicYear = semester
    ? catalog.academicYears.find((item) => item.id === semester.academicYearId)
    : undefined;
  const faculty = academicYear
    ? catalog.faculties.find((item) => item.id === academicYear.facultyId)
    : undefined;
  const university = faculty
    ? catalog.universities.find((item) => item.id === faculty.universityId)
    : undefined;

  return { subject, semester, academicYear, faculty, university };
}

export function getSubjectContext(catalog: CatalogResponse, subjectId: number) {
  const subject = catalog.subjects.find((item) => item.id === subjectId);
  const semester = subject
    ? catalog.semesters.find((item) => item.id === subject.semesterId)
    : undefined;
  const academicYear = semester
    ? catalog.academicYears.find((item) => item.id === semester.academicYearId)
    : undefined;
  const faculty = academicYear
    ? catalog.faculties.find((item) => item.id === academicYear.facultyId)
    : undefined;
  const university = faculty
    ? catalog.universities.find((item) => item.id === faculty.universityId)
    : undefined;

  return { subject, semester, academicYear, faculty, university };
}

export function materialMatchesFilters(
  catalog: CatalogResponse,
  material: Material,
  filters: CatalogFilters,
): boolean {
  const context = getMaterialContext(catalog, material);
  if (
    filters.universityId !== undefined &&
    context.university?.id !== filters.universityId
  ) {
    return false;
  }
  if (
    filters.facultyId !== undefined &&
    context.faculty?.id !== filters.facultyId
  ) {
    return false;
  }
  if (
    filters.academicYearId !== undefined &&
    context.academicYear?.id !== filters.academicYearId
  ) {
    return false;
  }
  if (
    filters.semesterId !== undefined &&
    context.semester?.id !== filters.semesterId
  ) {
    return false;
  }
  return filters.category === undefined || material.category === filters.category;
}

export function searchMaterials(
  catalog: CatalogResponse,
  query: string,
  filters: CatalogFilters = {},
): Material[] {
  const normalizedQuery = normalizeArabic(query);
  return catalog.materials.filter((material) => {
    if (!materialMatchesFilters(catalog, material, filters)) return false;
    if (!normalizedQuery) return true;

    const { subject, semester, academicYear, faculty, university } =
      getMaterialContext(catalog, material);
    const searchable = normalizeArabic(
      [
        material.titleAr,
        material.titleEn,
        material.descriptionAr,
        material.descriptionEn,
        subject?.nameAr,
        subject?.nameEn,
        semester?.labelAr,
        semester?.labelEn,
        academicYear?.labelAr,
        academicYear?.labelEn,
        faculty?.nameAr,
        faculty?.nameEn,
        university?.nameAr,
        university?.nameEn,
      ].join(" "),
    );
    return searchable.includes(normalizedQuery);
  });
}

export function filterSubjects(
  catalog: CatalogResponse,
  filters: Omit<CatalogFilters, "category">,
): CatalogResponse["subjects"] {
  return catalog.subjects.filter((subject) => {
    const semester = catalog.semesters.find(
      (item) => item.id === subject.semesterId,
    );
    const academicYear = semester
      ? catalog.academicYears.find(
          (item) => item.id === semester.academicYearId,
        )
      : undefined;
    const faculty = academicYear
      ? catalog.faculties.find((item) => item.id === academicYear.facultyId)
      : undefined;
    const university = faculty
      ? catalog.universities.find((item) => item.id === faculty.universityId)
      : undefined;
    return (
      (filters.universityId === undefined ||
        university?.id === filters.universityId) &&
      (filters.facultyId === undefined ||
        faculty?.id === filters.facultyId) &&
      (filters.academicYearId === undefined ||
        academicYear?.id === filters.academicYearId) &&
      (filters.semesterId === undefined ||
        semester?.id === filters.semesterId)
    );
  });
}

export function categoriesInOrder(): MaterialCategory[] {
  return [
    "summary",
    "lecture-notes",
    "previous-exam",
    "model-answer",
    "revision",
    "practice",
  ];
}

export function isCatalogData(value: unknown): value is CatalogResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [
    "universities",
    "faculties",
    "academicYears",
    "semesters",
    "subjects",
    "materials",
  ].every((key) => Array.isArray(record[key]));
}
