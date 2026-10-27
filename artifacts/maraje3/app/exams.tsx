import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  FilterPicker,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  TextEntry,
  font,
  uiColors,
} from "@/components/library-ui";
import {
  addExam,
  daysUntil,
  ensureNotificationPermission,
  examTypeLabel,
  readExams,
  removeExam,
  type UpcomingExam,
} from "@/lib/exams";
import { useLibrary } from "@/state/library-context";
import type { ExamType } from "@/types/catalog";

const c = uiColors;

const EXAM_TYPES: Array<{ id: ExamType; label: string }> = [
  { id: "midterm", label: "منتصف الفصل" },
  { id: "final", label: "نهائي" },
  { id: "quiz", label: "اختبار قصير" },
  { id: "sheet", label: "ورقة أسئلة" },
  { id: "other", label: "أخرى" },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function ExamsScreen() {
  const router = useRouter();
  const { catalog, downloads } = useLibrary();
  const [exams, setExams] = useState<UpcomingExam[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [subjectId, setSubjectId] = useState<number>();
  const [examDate, setExamDate] = useState("");
  const [examType, setExamType] = useState<ExamType>("midterm");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void readExams().then((stored) => {
      setExams(stored);
      setIsLoaded(true);
    });
  }, []);

  const subjectOptions = useMemo(
    () => catalog.subjects.map((s) => ({ id: s.id, label: s.nameAr })),
    [catalog.subjects],
  );

  const savedCountFor = (targetSubjectId: number) =>
    downloads.filter((d) => {
      const material = catalog.materials.find((m) => m.id === d.materialId);
      return material?.subjectId === targetSubjectId;
    }).length;

  const submit = async () => {
    if (!subjectId) {
      Alert.alert("اختر المادة", "حدد المادة الدراسية المرتبطة بالامتحان.");
      return;
    }
    if (!DATE_PATTERN.test(examDate)) {
      Alert.alert("تاريخ غير صالح", "اكتب التاريخ بصيغة YYYY-MM-DD، مثال: 2026-11-20.");
      return;
    }

    setIsSaving(true);
    try {
      await ensureNotificationPermission();
      const subjectLabel =
        catalog.subjects.find((s) => s.id === subjectId)?.nameAr ?? "المادة";
      await addExam({ subjectId, subjectLabel, examDate, examType });
      setExams(await readExams());
      setFormVisible(false);
      setSubjectId(undefined);
      setExamDate("");
      setExamType("midterm");
    } catch {
      Alert.alert("تعذر الحفظ", "حاول مرة أخرى.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = (exam: UpcomingExam) => {
    Alert.alert("حذف الامتحان", "هل تريد حذف هذا الامتحان من عداد مراجعي؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          await removeExam(exam.id);
          setExams(await readExams());
        },
      },
    ]);
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="عداد الامتحانات"
        subtitle="تابع امتحاناتك القادمة وخذ تذكيراً قبلها"
        back={() => router.back()}
      />

      <InlineNotice
        title="محفوظ على جهازك فقط"
        description="المواعيد هنا محلية بالكامل ولا تُرسل لأي سيرفر، وهتوصلك تذكيرات قبل الامتحان بـ 7 و3 و1 يوم وصباح يوم الامتحان."
      />

      {!formVisible ? (
        <PrimaryButton
          label="إضافة امتحان"
          icon="plus-circle"
          onPress={() => setFormVisible(true)}
          testID="add-exam-button"
        />
      ) : (
        <View style={styles.form}>
          <FilterPicker
            label="المادة"
            value={subjectId}
            options={subjectOptions}
            allowAll={false}
            onChange={(v) => setSubjectId(v as number | undefined)}
          />
          <TextEntry
            label="تاريخ الامتحان (YYYY-MM-DD)"
            value={examDate}
            onChangeText={setExamDate}
            placeholder="2026-11-20"
          />
          <FilterPicker
            label="نوع الامتحان"
            value={examType}
            options={EXAM_TYPES}
            allowAll={false}
            onChange={(v) => setExamType(v as ExamType)}
          />
          <View style={styles.formActions}>
            <PrimaryButton
              label="حفظ"
              icon="check"
              loading={isSaving}
              onPress={() => void submit()}
              testID="save-exam"
            />
            <PrimaryButton
              label="إلغاء"
              variant="secondary"
              onPress={() => setFormVisible(false)}
            />
          </View>
        </View>
      )}

      {!isLoaded ? null : exams.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="لا توجد امتحانات مضافة"
          description="أضف أول امتحان عشان تبدأ تاخد تذكيرات."
        />
      ) : (
        <View style={styles.list}>
          {exams.map((exam) => {
            const subject = catalog.subjects.find((s) => s.id === exam.subjectId);
            const remaining = daysUntil(exam.examDate);
            const savedCount = savedCountFor(exam.subjectId);
            return (
              <View key={exam.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.subjectName} numberOfLines={1}>
                    {subject?.nameAr ?? "مادة"}
                  </Text>
                  <Pressable onPress={() => handleRemove(exam)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={c.destructive} />
                  </Pressable>
                </View>
                <Text style={styles.countdown}>
                  {remaining > 0
                    ? `باقي ${remaining} يوم`
                    : remaining === 0
                      ? "امتحانك النهارده"
                      : "الامتحان انتهى"}
                </Text>
                <Text style={styles.meta}>
                  {examTypeLabel(exam.examType)} · {exam.examDate}
                </Text>
                <Text style={styles.meta}>حفظت {savedCount} ملف من المادة دي</Text>
                <PrimaryButton
                  label="فتح ملفات المادة"
                  icon="book-open"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/subject/${exam.subjectId}` as `/subject/${string}`)
                  }
                />
              </View>
            );
          })}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  formActions: { flexDirection: "row", gap: 8 },
  list: { gap: 10 },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subjectName: { flex: 1, color: c.foreground, fontFamily: font.bold, fontSize: 15, textAlign: "right" },
  countdown: { color: c.primary, fontFamily: font.bold, fontSize: 18, textAlign: "right" },
  meta: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12, textAlign: "right" },
});
