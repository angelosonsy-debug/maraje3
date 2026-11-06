import { Feather } from "@expo/vector-icons";
import {
  getBaseUrl,
  getGetCatalogQueryKey,
  getGetMyUploadsQueryKey,
  getGetRequestsQueryKey,
  useCreateMaterialUpload,
  usePresignUpload,
  type ExamType,
  type MaterialCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import {
  AppScreen,
  FilterPicker,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  TextEntry,
  font,
  uiColors,
} from "@/components/library-ui";
import { CATEGORY_LABELS } from "@/types/catalog";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

const CATEGORIES: MaterialCategory[] = [
  "summary",
  "lecture-notes",
  "previous-exam",
  "model-answer",
  "revision",
  "practice",
];
const EXAM_TYPES: Array<{ id: ExamType; label: string }> = [
  { id: "midterm", label: "منتصف الفصل" },
  { id: "final", label: "نهائي" },
  { id: "quiz", label: "اختبار قصير" },
  { id: "sheet", label: "ورقة أسئلة" },
  { id: "other", label: "أخرى" },
];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export default function UploadScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isAuthLoading } = auth;
  const { catalog } = useLibrary();
  const queryClient = useQueryClient();
  const { fulfillsRequestId: fulfillsRequestIdParam } = useLocalSearchParams<{
    fulfillsRequestId?: string;
  }>();
  const fulfillsRequestId = fulfillsRequestIdParam
    ? Number.parseInt(fulfillsRequestIdParam, 10)
    : undefined;

  const [universityId, setUniversityId] = useState<number>();
  const [facultyId, setFacultyId] = useState<number>();
  const [academicYearId, setAcademicYearId] = useState<number>();
  const [semesterId, setSemesterId] = useState<number>();
  const [subjectId, setSubjectId] = useState<number>();
  const [category, setCategory] = useState<MaterialCategory>("summary");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [professorName, setProfessorName] = useState("");
  const [examYear, setExamYear] = useState("");
  const [examType, setExamType] = useState<ExamType | "">("");
  const [appearedInExam, setAppearedInExam] = useState(false);
  const [acknowledgedRights, setAcknowledgedRights] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presignMutation = usePresignUpload();
  const createMutation = useCreateMaterialUpload();

  const facultyOptions = catalog.faculties
    .filter((f) => universityId === undefined || f.universityId === universityId)
    .map((f) => ({ id: f.id, label: f.nameAr }));
  const yearOptions = catalog.academicYears
    .filter((y) => facultyId === undefined || y.facultyId === facultyId)
    .map((y) => ({ id: y.id, label: y.labelAr }));
  const semesterOptions = catalog.semesters
    .filter((s) => academicYearId === undefined || s.academicYearId === academicYearId)
    .map((s) => ({ id: s.id, label: s.labelAr }));
  const subjectOptions = catalog.subjects
    .filter((s) => semesterId === undefined || s.semesterId === semesterId)
    .map((s) => ({ id: s.id, label: s.nameAr }));

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.mimeType || !ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
      Alert.alert(
        "صيغة غير مدعومة",
        "اختر ملف PDF أو صورة JPG أو PNG أو WEBP فقط.",
      );
      return;
    }
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size ?? 0,
    });
  };

  const resetForm = () => {
    setTitleAr("");
    setTitleEn("");
    setDescriptionAr("");
    setProfessorName("");
    setExamYear("");
    setExamType("");
    setAppearedInExam(false);
    setAcknowledgedRights(false);
    setFile(null);
  };

  const submit = async () => {
    if (!subjectId) {
      Alert.alert("اختر المادة", "حدد المادة الدراسية المرتبطة بالملف.");
      return;
    }
    if (!titleAr.trim() || !titleEn.trim()) {
      Alert.alert("العنوان مطلوب", "أدخل عنوان المورد بالعربية والإنجليزية.");
      return;
    }
    if (!file) {
      Alert.alert("اختر ملفاً", "أرفق ملف PDF أو صورة لرفعه.");
      return;
    }
    if (!acknowledgedRights) {
      Alert.alert(
        "تأكيد مطلوب",
        "يجب تأكيد أنك مخوّل بمشاركة هذا الملف قبل الرفع.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const presign = await presignMutation.mutateAsync({
        data: {
          fileName: file.name,
          contentType: file.mimeType,
          fileSizeBytes: file.size,
        },
      });

      if (file.size > presign.maxFileSizeBytes) {
        Alert.alert("الملف كبير جداً", "اختر ملفاً أصغر حجماً وحاول مجدداً.");
        return;
      }

      const headers: Record<string, string> = {
        "content-type": file.mimeType,
      };
      let uploadUrl = presign.uploadUrl;
      if (presign.uploadMode === "relay") {
        const base = getBaseUrl();
        const token = auth.getSessionToken();
        uploadUrl = `${base ?? ""}/api/uploads/relay/${presign.key}`;
        if (token) headers.authorization = `Bearer ${token}`;
      }
      if (!uploadUrl) {
        throw new Error("تعذر تجهيز رابط الرفع.");
      }

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, file.uri, {
        httpMethod: "PUT",
        headers,
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`فشل رفع الملف (${uploadResult.status}).`);
      }

      const created = await createMutation.mutateAsync({
        data: {
          key: presign.key,
          subjectId,
          titleAr: titleAr.trim(),
          titleEn: titleEn.trim(),
          category,
          descriptionAr: descriptionAr.trim() || undefined,
          professorName: professorName.trim() || undefined,
          examYear: examYear.trim() ? Number.parseInt(examYear, 10) : undefined,
          examType: examType || undefined,
          appearedInExam,
          acknowledgedRights: true,
          fulfillsRequestId,
        },
      });

      await queryClient.invalidateQueries({ queryKey: getGetMyUploadsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
      if (fulfillsRequestId) {
        await queryClient.invalidateQueries({
          queryKey: getGetRequestsQueryKey({ facultyId: facultyId ?? 0 }),
        });
      }

      resetForm();
      Alert.alert(
        created.duplicate ? "تم الرفع (ملف مكرر محتمل)" : "تم الرفع بنجاح",
        fulfillsRequestId
          ? "سيظهر الملف للطلاب بعد مراجعة فريق الإدارة له، وسيتحول الطلب المرتبط إلى \"تم توفيره\" فور نشره."
          : "سيظهر الملف للطلاب بعد مراجعة فريق الإدارة له.",
        [{ text: "حسناً", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert(
        "تعذر إتمام الرفع",
        error instanceof Error ? error.message : "تحقق من الاتصال وحاول مجدداً.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppScreen>
        <ScreenHeading title="رفع ملف" back={() => router.back()} />
        <InlineNotice title="جارٍ التحقق من تسجيل الدخول..." />
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <AppScreen>
        <ScreenHeading title="رفع ملف" back={() => router.back()} />
        <InlineNotice
          icon="lock"
          title="سجّل الدخول أولاً"
          description="يحتاج رفع الملفات إلى حساب جوجل حتى يمكن مراجعتها ونسبها إليك."
          actionLabel="الذهاب لتسجيل الدخول"
          onAction={() => router.push("/profile")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading title="رفع ملف للمراجعة" back={() => router.back()} />

      <InlineNotice
        title="يمر كل ملف بمراجعة الإدارة"
        description="لن يظهر ملفك للطلاب إلا بعد موافقة فريق الإدارة. رفع ملفات غير مصرح بتوزيعها قد يوقف حسابك عن الرفع."
      />

      {fulfillsRequestId ? (
        <InlineNotice
          tone="success"
          icon="gift"
          title="هتلبّي طلب مطلوب"
          description="هيتربط هذا الملف بالطلب، وهيتحول الطلب لحالة «تم توفيره» بمجرد نشره، وهيظهر في بروفايلك."
        />
      ) : null}

      <FilterPicker
        label="الجامعة"
        value={universityId}
        options={catalog.universities.map((u) => ({ id: u.id, label: u.nameAr }))}
        onChange={(v) => {
          setUniversityId(v as number | undefined);
          setFacultyId(undefined);
          setAcademicYearId(undefined);
          setSemesterId(undefined);
          setSubjectId(undefined);
        }}
      />
      <FilterPicker
        label="الكلية"
        value={facultyId}
        options={facultyOptions}
        onChange={(v) => {
          setFacultyId(v as number | undefined);
          setAcademicYearId(undefined);
          setSemesterId(undefined);
          setSubjectId(undefined);
        }}
      />
      <FilterPicker
        label="الفرقة"
        value={academicYearId}
        options={yearOptions}
        onChange={(v) => {
          setAcademicYearId(v as number | undefined);
          setSemesterId(undefined);
          setSubjectId(undefined);
        }}
      />
      <FilterPicker
        label="الفصل الدراسي"
        value={semesterId}
        options={semesterOptions}
        onChange={(v) => {
          setSemesterId(v as number | undefined);
          setSubjectId(undefined);
        }}
      />
      <FilterPicker
        label="المادة الدراسية"
        value={subjectId}
        options={subjectOptions}
        allowAll={false}
        onChange={(v) => setSubjectId(v as number | undefined)}
      />

      <FilterPicker
        label="نوع المورد"
        value={category}
        allowAll={false}
        options={CATEGORIES.map((item) => ({ id: item, label: CATEGORY_LABELS[item] }))}
        onChange={(v) => setCategory(v as MaterialCategory)}
      />

      <TextEntry label="عنوان المورد بالعربية" value={titleAr} onChangeText={setTitleAr} />
      <TextEntry label="عنوان المورد بالإنجليزية" value={titleEn} onChangeText={setTitleEn} />
      <TextEntry
        label="وصف مختصر (اختياري)"
        value={descriptionAr}
        onChangeText={setDescriptionAr}
        multiline
      />
      <TextEntry
        label="اسم الدكتور (اختياري)"
        value={professorName}
        onChangeText={setProfessorName}
      />
      <TextEntry
        label="سنة الامتحان (اختياري)"
        value={examYear}
        onChangeText={setExamYear}
        keyboardType="numeric"
      />
      <FilterPicker
        label="نوع الامتحان (اختياري)"
        value={examType || undefined}
        options={EXAM_TYPES}
        onChange={(v) => setExamType((v as ExamType) || "")}
      />
      <Pressable
        onPress={() => setAppearedInExam((current) => !current)}
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: appearedInExam }}
      >
        <Feather
          name={appearedInExam ? "check-square" : "square"}
          size={19}
          color={appearedInExam ? c.accentForeground : c.mutedForeground}
        />
        <Text style={styles.checkText}>طلع في الامتحان فعلًا</Text>
      </Pressable>

      <Pressable
        onPress={() => void pickFile()}
        style={styles.filePicker}
        accessibilityRole="button"
        testID="pick-upload-file"
      >
        <Feather name="upload" size={18} color={c.accentForeground} />
        <Text style={styles.filePickerText} numberOfLines={1}>
          {file ? file.name : "اختر ملف PDF أو صورة"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setAcknowledgedRights((current) => !current)}
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledgedRights }}
        testID="upload-rights-confirmation"
      >
        <Feather
          name={acknowledgedRights ? "check-square" : "square"}
          size={19}
          color={acknowledgedRights ? c.accentForeground : c.mutedForeground}
        />
        <Text style={styles.checkText}>
          أؤكد أنني مخوّل بمشاركة هذا الملف ولا أنتهك حقوق نشر أحد
        </Text>
      </Pressable>

      <PrimaryButton
        label="رفع الملف للمراجعة"
        icon="upload-cloud"
        loading={isSubmitting}
        onPress={() => void submit()}
        testID="submit-upload"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  checkRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 36 },
  checkText: { flex: 1, color: c.foreground, fontFamily: font.medium, fontSize: 13, textAlign: "right" },
  filePicker: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  filePickerText: { flex: 1, color: c.foreground, fontFamily: font.medium, fontSize: 13, textAlign: "right" },
});
