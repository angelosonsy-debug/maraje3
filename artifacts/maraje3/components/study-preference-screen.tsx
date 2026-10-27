import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  FilterPicker,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { useLibrary } from "@/state/library-context";
import type { UserStudyPreference } from "@/types/catalog";

const c = uiColors;

export function StudyPreferenceScreen({
  mode,
}: {
  mode: "onboarding" | "settings";
}) {
  const router = useRouter();
  const { catalog, isPreferenceLoaded, preference } = useLibrary();

  useEffect(() => {
    if (mode === "onboarding" && isPreferenceLoaded && preference) {
      router.replace("/(tabs)");
    }
  }, [isPreferenceLoaded, mode, preference, router]);

  if (!isPreferenceLoaded) {
    return (
      <AppScreen>
        <ScreenHeading title="كليتي وفرقتي" back={() => router.back()} />
        <ActivityIndicator color={c.primary} />
      </AppScreen>
    );
  }

  if (mode === "onboarding" && preference) return null;

  return (
    <PreferenceForm
      key={`${mode}-${preference?.facultyId ?? "new"}-${preference?.academicYearId ?? "new"}`}
      mode={mode}
      initialPreference={preference}
    />
  );
}

function PreferenceForm({
  mode,
  initialPreference,
}: {
  mode: "onboarding" | "settings";
  initialPreference: UserStudyPreference | null;
}) {
  const router = useRouter();
  const { catalog, savePreference } = useLibrary();
  const [universityId, setUniversityId] = useState<number | undefined>(
    initialPreference?.universityId,
  );
  const [facultyId, setFacultyId] = useState<number | undefined>(
    initialPreference?.facultyId,
  );
  const [academicYearId, setAcademicYearId] = useState<number | undefined>(
    initialPreference?.academicYearId,
  );
  const [semesterId, setSemesterId] = useState<number | undefined>(
    initialPreference?.semesterId,
  );
  const [saving, setSaving] = useState(false);

  const facultyOptions = catalog.faculties
    .filter((faculty) => universityId === undefined || faculty.universityId === universityId)
    .map((faculty) => ({ id: faculty.id, label: faculty.nameAr }));
  const yearOptions = catalog.academicYears
    .filter((year) => facultyId !== undefined && year.facultyId === facultyId)
    .map((year) => ({ id: year.id, label: year.labelAr }));
  const semesterOptions = catalog.semesters
    .filter((semester) =>
      academicYearId !== undefined && semester.academicYearId === academicYearId,
    )
    .map((semester) => ({ id: semester.id, label: semester.labelAr }));

  const save = async () => {
    if (universityId === undefined || facultyId === undefined || academicYearId === undefined) {
      return;
    }
    setSaving(true);
    try {
      await savePreference({
        universityId,
        facultyId,
        academicYearId,
        ...(semesterId === undefined ? {} : { semesterId }),
      });
      if (mode === "onboarding") router.replace("/(tabs)");
      else router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen>
      <ScreenHeading
        title={mode === "onboarding" ? "ابدأ باختيار دراستك" : "كليتي وفرقتي"}
        subtitle={
          mode === "onboarding"
            ? "سنرتب المواد والملفات حسب كليتك."
            : "حدّث اختياراتك لتخصيص الرئيسية والبحث."
        }
        back={mode === "settings" ? () => router.back() : undefined}
      />
      <View style={styles.form}>
        <FilterPicker
          label="الجامعة"
          value={universityId}
          options={catalog.universities.map((university) => ({
            id: university.id,
            label: university.nameAr,
          }))}
          allowAll={false}
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
          allowAll={false}
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
          allowAll={false}
          onChange={(value) => {
            setAcademicYearId(typeof value === "number" ? value : undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الفصل الدراسي (اختياري)"
          value={semesterId}
          options={semesterOptions}
          onChange={(value) =>
            setSemesterId(typeof value === "number" ? value : undefined)
          }
        />
      </View>
      {catalog.subjects.length === 0 ? (
        <InlineNotice
          tone="warning"
          title="الكتالوج الدراسي غير متاح"
          description="اتصل بالخادم أو أعد المحاولة قبل حفظ اختياراتك."
        />
      ) : null}
      <PrimaryButton
        label={mode === "onboarding" ? "متابعة إلى مكتبتي" : "حفظ الاختيارات"}
        icon="check"
        disabled={
          saving ||
          universityId === undefined ||
          facultyId === undefined ||
          academicYearId === undefined ||
          (universityId !== undefined &&
            !facultyOptions.some((option) => option.id === facultyId)) ||
          (facultyId !== undefined &&
            !yearOptions.some((option) => option.id === academicYearId))
        }
        loading={saving}
        onPress={() => void save()}
        testID="save-study-preference"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  help: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12 },
});
