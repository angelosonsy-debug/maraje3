import {
  academicYearsTable,
  db,
  facultiesTable,
  semestersTable,
  subjectsTable,
  universitiesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export function normalizeArabic(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildMaterialSearchText(material: {
  subjectId: number;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  professorName?: string | null;
}): Promise<string> {
  const [context] = await db
    .select({
      subjectNameAr: subjectsTable.nameAr,
      subjectNameEn: subjectsTable.nameEn,
      facultyNameAr: facultiesTable.nameAr,
      facultyNameEn: facultiesTable.nameEn,
    })
    .from(subjectsTable)
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
    .where(eq(subjectsTable.id, material.subjectId))
    .limit(1);

  return normalizeArabic(
    [
      material.titleAr,
      material.titleEn,
      material.descriptionAr,
      material.descriptionEn,
      material.professorName,
      context?.subjectNameAr,
      context?.subjectNameEn,
      context?.facultyNameAr,
      context?.facultyNameEn,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
