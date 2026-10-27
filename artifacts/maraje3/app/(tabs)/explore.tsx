import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  FilterPicker,
  SearchField,
  ScreenHeading,
  SubjectCard,
  font,
  uiColors,
} from "@/components/library-ui";
import { filterSubjects, getSubjectContext } from "@/lib/catalog";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ universityId?: string }>();
  const { catalog } = useLibrary();
  const [universityId, setUniversityId] = useState<number | undefined>();
  const [facultyId, setFacultyId] = useState<number | undefined>();
  const [academicYearId, setAcademicYearId] = useState<number | undefined>();
  const [semesterId, setSemesterId] = useState<number | undefined>();

  useEffect(() => {
    if (params.universityId) {
      const id = Number(params.universityId);
      if (Number.isInteger(id)) setUniversityId(id);
    }
  }, [params.universityId]);

  const facultyOptions = useMemo(
    () =>
      catalog.faculties
        .filter(
          (faculty) =>
            universityId === undefined || faculty.universityId === universityId,
        )
        .map((faculty) => ({
          id: faculty.id,
          label: `${faculty.nameAr} · ${
            catalog.universities.find((item) => item.id === faculty.universityId)
              ?.nameAr ?? ""
          }`,
        })),
    [catalog, universityId],
  );
  const yearOptions = useMemo(
    () =>
      catalog.academicYears
        .filter(
          (year) => facultyId === undefined || year.facultyId === facultyId,
        )
        .filter((year) => {
          if (facultyId !== undefined) return true;
          if (universityId === undefined) return true;
          return catalog.faculties.find((item) => item.id === year.facultyId)
            ?.universityId === universityId;
        })
        .map((year) => ({
          id: year.id,
          label: `${year.labelAr} · ${
            catalog.faculties.find((item) => item.id === year.facultyId)
              ?.nameAr ?? ""
          }`,
        })),
    [catalog, facultyId, universityId],
  );
  const semesterOptions = useMemo(
    () =>
      catalog.semesters
        .filter(
          (semester) =>
            academicYearId === undefined ||
            semester.academicYearId === academicYearId,
        )
        .filter((semester) => {
          if (academicYearId !== undefined) return true;
          const year = catalog.academicYears.find(
            (item) => item.id === semester.academicYearId,
          );
          if (!year) return false;
          if (facultyId !== undefined) return year.facultyId === facultyId;
          if (universityId !== undefined) {
            return catalog.faculties.find(
              (item) => item.id === year.facultyId,
            )?.universityId === universityId;
          }
          return true;
        })
        .map((semester) => ({
          id: semester.id,
          label: `${semester.labelAr} · ${
            catalog.academicYears.find(
              (item) => item.id === semester.academicYearId,
            )?.labelAr ?? ""
          }`,
        })),
    [academicYearId, catalog, facultyId, universityId],
  );

  const subjects = filterSubjects(catalog, {
    universityId,
    facultyId,
    academicYearId,
    semesterId,
  });

  return (
    <AppScreen>
      <ScreenHeading
        title="استكشف المكتبة"
        subtitle="اختر من مستويات الدراسة للوصول للمادة"
      />
      <SearchField
        value=""
        editable={false}
        onPress={() => router.push("/search")}
        placeholder="ابحث عن جامعة أو مادة"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterPicker
          label="الجامعة"
          value={universityId}
          options={catalog.universities.map((item) => ({
            id: item.id,
            label: item.nameAr,
          }))}
          onChange={(value) => {
            setUniversityId(typeof value === "number" ? value : undefined);
            setFacultyId(undefined);
            setAcademicYearId(undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الكلية"
          value={facultyId}
          options={facultyOptions}
          onChange={(value) => {
            setFacultyId(typeof value === "number" ? value : undefined);
            setAcademicYearId(undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الفرقة"
          value={academicYearId}
          options={yearOptions}
          onChange={(value) => {
            setAcademicYearId(typeof value === "number" ? value : undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الفصل"
          value={semesterId}
          options={semesterOptions}
          onChange={(value) =>
            setSemesterId(typeof value === "number" ? value : undefined)
          }
        />
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>المواد الدراسية</Text>
        <Text style={styles.resultsCount}>{subjects.length} مادة</Text>
      </View>
      {subjects.length === 0 ? (
        <EmptyState
          icon="search"
          title="لا توجد مواد بهذا الاختيار"
          description="غيّر التصفية أو اختر جامعة أخرى لاستكشاف مواد إضافية."
          actionLabel="مسح التصفية"
          onAction={() => {
            setUniversityId(undefined);
            setFacultyId(undefined);
            setAcademicYearId(undefined);
            setSemesterId(undefined);
          }}
        />
      ) : (
        <View style={styles.subjectList}>
          {subjects.map((subject) => {
            const context = getSubjectContext(catalog, subject.id);
            const resourceCount = catalog.materials.filter(
              (item) => item.subjectId === subject.id,
            ).length;
            return (
              <SubjectCard
                key={subject.id}
                title={subject.nameAr}
                subtitle={[
                  context.university?.nameAr,
                  context.faculty?.nameAr,
                  context.academicYear?.labelAr,
                  context.semester?.labelAr,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                resourceCount={resourceCount}
                isDemo={subject.isDemo}
                onPress={() =>
                  router.push(`/subject/${subject.id}` as `/subject/${string}`)
                }
              />
            );
          })}
        </View>
      )}
      <View style={styles.hierarchyHint}>
        <Feather name="info" size={15} color={c.accentForeground} />
        <Text style={styles.hierarchyText}>
          الجامعة ← الكلية ← الفرقة ← الفصل ← المادة
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filterRow: { gap: 7, paddingVertical: 2 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultsTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 16 },
  resultsCount: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  subjectList: { gap: 9 },
  hierarchyHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 7 },
  hierarchyText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 11, textAlign: "center" },
});
