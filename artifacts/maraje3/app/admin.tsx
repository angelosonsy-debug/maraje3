import { Feather } from "@expo/vector-icons";
import {
  getBaseUrl,
  getCatalogAdminAccess,
  getGetCatalogAdminCatalogQueryKey,
  getGetCatalogQueryKey,
  getGetAdminReportsQueryKey,
  getGetAdminFlashcardDecksQueryKey,
  getGetAdminFlashcardDeckQueryKey,
  useGetCatalogAdminCatalog,
  useGetAdminReports,
  useGetAdminFlashcardDecks,
  useGetAdminFlashcardDeck,
  useCreateAdminFlashcardDeck,
  useManageAdminFlashcardDeck,
  useManageCatalogAdmin,
  useManageAdminRequest,
  useResolveAdminReport,
  type ExamType,
  type AdminManageRequest,
  type MaterialCategory,
  type PublicationStatus,
  type Report,
  type ReportStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { clearAdminSession, configureAdminSession } from "@/lib/admin-session";
import { parseFlashcardPaste } from "@/lib/flashcard-paste";
import { CATEGORY_LABELS } from "@/types/catalog";
import type { AdminEntityType, CatalogResponse } from "@/types/catalog";

const c = uiColors;
const ENTITY_TABS: Array<{ id: AdminEntityType; label: string }> = [
  { id: "material", label: "المواد" },
  { id: "university", label: "الجامعات" },
  { id: "faculty", label: "الكليات" },
  { id: "academicYear", label: "الفرق" },
  { id: "semester", label: "الفصول" },
  { id: "subject", label: "المقررات" },
];
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

type AdminForm = {
  parentId: string;
  nameAr: string;
  nameEn: string;
  labelAr: string;
  labelEn: string;
  rank: string;
  city: string;
  code: string;
  titleAr: string;
  titleEn: string;
  category: MaterialCategory;
  descriptionAr: string;
  descriptionEn: string;
  fileFormat: string;
  documentUrl: string;
  fileSizeBytes: string;
  contributor: string;
  professorName: string;
  examYear: string;
  examType: ExamType | "";
  appearedInExam: boolean;
  publicationStatus: PublicationStatus;
  rejectionReason: string;
  authorized: boolean;
};

const EMPTY_FORM: AdminForm = {
  parentId: "",
  nameAr: "",
  nameEn: "",
  labelAr: "",
  labelEn: "",
  rank: "1",
  city: "",
  code: "",
  titleAr: "",
  titleEn: "",
  category: "summary",
  descriptionAr: "",
  descriptionEn: "",
  fileFormat: "PDF",
  documentUrl: "",
  fileSizeBytes: "",
  contributor: "",
  professorName: "",
  examYear: "",
  examType: "",
  appearedInExam: false,
  publicationStatus: "draft",
  rejectionReason: "",
  authorized: false,
};

const PUBLICATION_STATUS_OPTIONS: Array<{ id: PublicationStatus; label: string }> = [
  { id: "draft", label: "مسودة غير منشورة" },
  { id: "pending", label: "بانتظار المراجعة" },
  { id: "published", label: "منشور للطلاب" },
  { id: "rejected", label: "مرفوض" },
];

const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
};

type RowRecord = Record<string, unknown> & { id: number };

export default function AdminScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tokenInput, setTokenInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [entityType, setEntityType] = useState<AdminEntityType>("material");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AdminForm>(EMPTY_FORM);
  const [formVisible, setFormVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [panel, setPanel] = useState<
    "catalog" | "reports" | "bulk" | "flashcards"
  >("catalog");
  const [adminToken, setAdminToken] = useState("");
  const adminQuery = useGetCatalogAdminCatalog({
    query: {
      queryKey: getGetCatalogAdminCatalogQueryKey(),
      enabled: verified,
    },
  });
  const mutation = useManageCatalogAdmin();
  const baseCatalog = adminQuery.data ?? null;

  useEffect(() => () => clearAdminSession(), []);

  const unlock = async () => {
    const candidate = tokenInput.trim();
    if (!candidate) {
      Alert.alert("رمز المسؤول مطلوب", "أدخل الرمز المُعدّ على الخادم.");
      return;
    }
    configureAdminSession(candidate);
    setWorking(true);
    try {
      await getCatalogAdminAccess();
      setVerified(true);
      setAdminToken(candidate);
      setTokenInput("");
    } catch (error) {
      clearAdminSession();
      const message =
        error instanceof Error && error.message.includes("503")
          ? "لم يُفعّل مسؤول التطبيق بعد. يجب إعداد MARAJE3_ADMIN_TOKEN في أسرار المشروع."
          : "تعذر التحقق من الرمز. تأكد من صحته ومن اتصال التطبيق بالخادم.";
      Alert.alert("تعذر فتح الإدارة", message);
    } finally {
      setWorking(false);
    }
  };

  const signOut = () => {
    clearAdminSession();
    setVerified(false);
    setAdminToken("");
    setFormVisible(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const records: RowRecord[] = useMemo(() => {
    if (!baseCatalog) return [];
    const rows: unknown[] = (() => {
      switch (entityType) {
        case "university":
          return baseCatalog.universities;
        case "faculty":
          return baseCatalog.faculties;
        case "academicYear":
          return baseCatalog.academicYears;
        case "semester":
          return baseCatalog.semesters;
        case "subject":
          return baseCatalog.subjects;
        case "material":
          return baseCatalog.materials;
      }
    })();
    return rows as RowRecord[];
  }, [baseCatalog, entityType]);

  const parentOptions = useMemo(
    () => makeParentOptions(entityType, baseCatalog),
    [baseCatalog, entityType],
  );

  const beginCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const beginEdit = (record: RowRecord) => {
    const parentKey = parentFieldFor(entityType);
    setEditingId(record.id);
    setForm({
      ...EMPTY_FORM,
      parentId:
        parentKey && typeof record[parentKey] === "number"
          ? String(record[parentKey])
          : "",
      nameAr: readString(record, "nameAr"),
      nameEn: readString(record, "nameEn"),
      labelAr: readString(record, "labelAr"),
      labelEn: readString(record, "labelEn"),
      rank: readString(record, "rank", "1"),
      city: readString(record, "city"),
      code: readString(record, "code"),
      titleAr: readString(record, "titleAr"),
      titleEn: readString(record, "titleEn"),
      category: readString(record, "category", "summary") as MaterialCategory,
      descriptionAr: readString(record, "descriptionAr"),
      descriptionEn: readString(record, "descriptionEn"),
      fileFormat: readString(record, "fileFormat", "PDF"),
      documentUrl: readString(record, "documentUrl"),
      fileSizeBytes: readString(record, "fileSizeBytes"),
      contributor: readString(record, "contributor"),
      professorName: readString(record, "professorName"),
      examYear: readString(record, "examYear"),
      examType: readString(record, "examType") as ExamType | "",
      appearedInExam: record.appearedInExam === true,
      publicationStatus: readString(
        record,
        "publicationStatus",
        "draft",
      ) as PublicationStatus,
      rejectionReason: readString(record, "rejectionReason"),
      authorized: record.authorized === true,
    });
    setFormVisible(true);
  };

  const saveRecord = async () => {
    const payload = makeRequest(entityType, editingId, form);
    if (!payload) {
      Alert.alert("راجع البيانات", "أكمل الحقول المطلوبة قبل الحفظ.");
      return;
    }

    setWorking(true);
    try {
      await mutation.mutateAsync({ data: payload });
      setFormVisible(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await adminQuery.refetch();
      await queryClient.invalidateQueries({
        queryKey: getGetCatalogQueryKey(),
      });
      Alert.alert("تم الحفظ", "حُدّثت بيانات الكتالوج.");
    } catch (error) {
      Alert.alert(
        "تعذر الحفظ",
        error instanceof Error ? error.message : "تحقق من البيانات وحاول مجدداً.",
      );
    } finally {
      setWorking(false);
    }
  };

  const deleteRecord = (record: RowRecord) => {
    Alert.alert(
      "حذف السجل",
      "لا يمكن حذف سجل مرتبط بمواد أو عناصر أخرى. هل تريد المتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await mutation.mutateAsync({
                data: {
                  action: "delete",
                  entityType,
                  id: record.id,
                },
              });
              await adminQuery.refetch();
              await queryClient.invalidateQueries({
                queryKey: getGetCatalogQueryKey(),
              });
            } catch (error) {
              Alert.alert(
                "تعذر الحذف",
                error instanceof Error
                  ? error.message
                  : "قد يكون السجل مرتبطاً بعناصر أخرى.",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  const quickApprove = async (record: RowRecord) => {
    setWorking(true);
    try {
      await mutation.mutateAsync({
        data: {
          action: "update",
          entityType: "material",
          id: record.id,
          publicationStatus: "published",
        },
      });
      await adminQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
    } catch (error) {
      Alert.alert(
        "تعذر القبول",
        error instanceof Error ? error.message : "حاول مرة أخرى.",
      );
    } finally {
      setWorking(false);
    }
  };

  const quickReject = (record: RowRecord) => {
    beginEdit(record);
    setForm((current) => ({ ...current, publicationStatus: "rejected" }));
  };

  const chooseEntity = (next: AdminEntityType) => {
    setEntityType(next);
    setFormVisible(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="إدارة المحتوى"
        subtitle={
          verified
            ? "إدارة الكتالوج المشترك"
            : "دخول مخصص لمسؤولي الكتالوج"
        }
        back={() => router.back()}
        right={
          verified ? (
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="إنهاء جلسة الإدارة"
              style={styles.iconButton}
            >
              <Feather name="log-out" size={17} color={c.foreground} />
            </Pressable>
          ) : null
        }
      />

      {!verified ? (
        <View style={styles.loginPanel}>
          <View style={styles.loginIcon}>
            <Feather name="shield" size={23} color={c.accentForeground} />
          </View>
          <Text style={styles.loginTitle}>دخول المسؤول</Text>
          <Text style={styles.loginDescription}>
            يُتحقق من رمز الوصول على الخادم. لا يُحفظ الرمز على هذا الجهاز.
          </Text>
          <TextEntry
            label="رمز المسؤول"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="أدخل الرمز المُعدّ في أسرار المشروع"
            secureTextEntry
          />
          <PrimaryButton
            label="التحقق والدخول"
            icon="lock"
            loading={working}
            onPress={() => void unlock()}
            testID="admin-unlock"
          />
          <InlineNotice
            title="الدخول مغلق افتراضياً"
            description="يحتاج MARAJE3_ADMIN_TOKEN إلى إعداد آمن على الخادم قبل تمكين إدارة المحتوى."
          />
        </View>
      ) : (
        <>
          <View style={styles.panelToggle}>
            <Pressable
              onPress={() => setPanel("catalog")}
              style={[
                styles.panelToggleButton,
                panel === "catalog" && styles.panelToggleButtonActive,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.panelToggleText,
                  panel === "catalog" && styles.panelToggleTextActive,
                ]}
              >
                الكتالوج
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPanel("reports")}
              style={[
                styles.panelToggleButton,
                panel === "reports" && styles.panelToggleButtonActive,
              ]}
              accessibilityRole="button"
              testID="admin-panel-reports"
            >
              <Text
                style={[
                  styles.panelToggleText,
                  panel === "reports" && styles.panelToggleTextActive,
                ]}
              >
                البلاغات
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPanel("bulk")}
              style={[
                styles.panelToggleButton,
                panel === "bulk" && styles.panelToggleButtonActive,
              ]}
              accessibilityRole="button"
              testID="admin-panel-bulk"
            >
              <Text
                style={[
                  styles.panelToggleText,
                  panel === "bulk" && styles.panelToggleTextActive,
                ]}
              >
                رفع بالجملة
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPanel("flashcards")}
              style={[
                styles.panelToggleButton,
                panel === "flashcards" && styles.panelToggleButtonActive,
              ]}
              accessibilityRole="button"
              testID="admin-panel-flashcards"
            >
              <Text
                style={[
                  styles.panelToggleText,
                  panel === "flashcards" && styles.panelToggleTextActive,
                ]}
              >
                بطاقات المراجعة
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {verified && panel === "reports" ? <AdminReportsPanel /> : null}

      {verified && panel === "bulk" ? (
        <AdminBulkUploadPanel adminToken={adminToken} catalog={baseCatalog} />
      ) : null}

      {verified && panel === "flashcards" ? (
        <AdminFlashcardsPanel catalog={baseCatalog} />
      ) : null}

      {verified && panel === "catalog" ? (
        <>
          <InlineNotice
            title="لا ترفع إلا مواد مصرحاً بتوزيعها"
            description="رفع الملفات العامة غير مفعّل خارج تدفق رفع الطلاب المراجَع. أضف روابط HTTPS مستضافة خارجياً بعد تأكيد حقوق النشر، أو راجع رفعات الطلاب المعلّقة من تبويب المواد."
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.entityTabs}
          >
            {ENTITY_TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => chooseEntity(tab.id)}
                style={[
                  styles.entityTab,
                  entityType === tab.id && styles.entityTabActive,
                ]}
                accessibilityRole="button"
                testID={`admin-tab-${tab.id}`}
              >
                <Text
                  style={[
                    styles.entityTabText,
                    entityType === tab.id && styles.entityTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {baseCatalog ? (
                  <Text
                    style={[
                      styles.entityCount,
                      entityType === tab.id && styles.entityCountActive,
                    ]}
                  >
                    {getEntityCount(tab.id, baseCatalog)}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {formVisible ? (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  {editingId ? "تعديل السجل" : "إضافة سجل"}
                </Text>
                <Pressable
                  onPress={() => setFormVisible(false)}
                  accessibilityLabel="إغلاق النموذج"
                  hitSlop={10}
                >
                  <Feather name="x" size={19} color={c.mutedForeground} />
                </Pressable>
              </View>
              {needsParent(entityType) && parentOptions.length > 0 ? (
                <FilterPicker
                  label={parentLabel(entityType)}
                  value={form.parentId ? Number(form.parentId) : undefined}
                  options={parentOptions}
                  allowAll={false}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parentId: value === undefined ? "" : String(value),
                    }))
                  }
                />
              ) : needsParent(entityType) ? (
                <InlineNotice
                  tone="warning"
                  title={`أضف ${parentLabel(entityType)} أولاً`}
                  description="أنشئ السجل الأب واحفظه، ثم ارجع لإضافة العناصر التابعة له."
                />
              ) : null}
              {entityType === "university" || entityType === "faculty" ? (
                <>
                  <TextEntry
                    label="الاسم بالعربية"
                    value={form.nameAr}
                    onChangeText={(nameAr) =>
                      setForm((current) => ({ ...current, nameAr }))
                    }
                  />
                  <TextEntry
                    label="الاسم بالإنجليزية"
                    value={form.nameEn}
                    onChangeText={(nameEn) =>
                      setForm((current) => ({ ...current, nameEn }))
                    }
                  />
                  {entityType === "university" ? (
                    <TextEntry
                      label="المدينة"
                      value={form.city}
                      onChangeText={(city) =>
                        setForm((current) => ({ ...current, city }))
                      }
                    />
                  ) : null}
                </>
              ) : null}
              {entityType === "academicYear" || entityType === "semester" ? (
                <>
                  <TextEntry
                    label="المسمى بالعربية"
                    value={form.labelAr}
                    onChangeText={(labelAr) =>
                      setForm((current) => ({ ...current, labelAr }))
                    }
                  />
                  <TextEntry
                    label="المسمى بالإنجليزية"
                    value={form.labelEn}
                    onChangeText={(labelEn) =>
                      setForm((current) => ({ ...current, labelEn }))
                    }
                  />
                  <TextEntry
                    label="الترتيب"
                    value={form.rank}
                    onChangeText={(rank) =>
                      setForm((current) => ({ ...current, rank }))
                    }
                    keyboardType="numeric"
                  />
                </>
              ) : null}
              {entityType === "subject" ? (
                <>
                  <TextEntry
                    label="اسم المادة بالعربية"
                    value={form.nameAr}
                    onChangeText={(nameAr) =>
                      setForm((current) => ({ ...current, nameAr }))
                    }
                  />
                  <TextEntry
                    label="اسم المادة بالإنجليزية"
                    value={form.nameEn}
                    onChangeText={(nameEn) =>
                      setForm((current) => ({ ...current, nameEn }))
                    }
                  />
                  <TextEntry
                    label="كود المادة (اختياري)"
                    value={form.code}
                    onChangeText={(code) =>
                      setForm((current) => ({ ...current, code }))
                    }
                  />
                </>
              ) : null}
              {entityType === "material" ? (
                <>
                  <TextEntry
                    label="عنوان المورد بالعربية"
                    value={form.titleAr}
                    onChangeText={(titleAr) =>
                      setForm((current) => ({ ...current, titleAr }))
                    }
                  />
                  <TextEntry
                    label="عنوان المورد بالإنجليزية"
                    value={form.titleEn}
                    onChangeText={(titleEn) =>
                      setForm((current) => ({ ...current, titleEn }))
                    }
                  />
                  <FilterPicker
                    label="نوع المورد"
                    value={form.category}
                    allowAll={false}
                    options={CATEGORIES.map((category) => ({
                      id: category,
                      label: CATEGORY_LABELS[category],
                    }))}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        category: value as MaterialCategory,
                      }))
                    }
                  />
                  <TextEntry
                    label="الوصف بالعربية"
                    value={form.descriptionAr}
                    onChangeText={(descriptionAr) =>
                      setForm((current) => ({ ...current, descriptionAr }))
                    }
                    multiline
                  />
                  <TextEntry
                    label="الوصف بالإنجليزية"
                    value={form.descriptionEn}
                    onChangeText={(descriptionEn) =>
                      setForm((current) => ({ ...current, descriptionEn }))
                    }
                    multiline
                  />
                  <TextEntry
                    label="رابط PDF خارجي (HTTPS)"
                    value={form.documentUrl}
                    onChangeText={(documentUrl) =>
                      setForm((current) => ({ ...current, documentUrl }))
                    }
                    keyboardType="url"
                    placeholder="https://..."
                  />
                  <TextEntry
                    label="حجم الملف بالبايت (اختياري)"
                    value={form.fileSizeBytes}
                    onChangeText={(fileSizeBytes) =>
                      setForm((current) => ({ ...current, fileSizeBytes }))
                    }
                    keyboardType="numeric"
                  />
                  <TextEntry
                    label="المساهم (اختياري)"
                    value={form.contributor}
                    onChangeText={(contributor) =>
                      setForm((current) => ({ ...current, contributor }))
                    }
                  />
                  <TextEntry
                    label="اسم الدكتور (اختياري)"
                    value={form.professorName}
                    onChangeText={(professorName) =>
                      setForm((current) => ({ ...current, professorName }))
                    }
                  />
                  <TextEntry
                    label="سنة الامتحان (اختياري)"
                    value={form.examYear}
                    onChangeText={(examYear) =>
                      setForm((current) => ({ ...current, examYear }))
                    }
                    keyboardType="numeric"
                  />
                  <FilterPicker
                    label="نوع الامتحان (اختياري)"
                    value={form.examType || undefined}
                    options={EXAM_TYPES}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        examType: typeof value === "string" ? value as ExamType : "",
                      }))
                    }
                  />
                  <Pressable
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        appearedInExam: !current.appearedInExam,
                      }))
                    }
                    style={styles.confirmRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: form.appearedInExam }}
                    testID="appeared-in-exam"
                  >
                    <Feather
                      name={form.appearedInExam ? "check-square" : "square"}
                      size={19}
                      color={form.appearedInExam ? c.accentForeground : c.mutedForeground}
                    />
                    <Text style={styles.confirmText}>طلع في الامتحان فعلًا</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        authorized: !current.authorized,
                      }))
                    }
                    style={styles.confirmRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: form.authorized }}
                    testID="copyright-confirmation"
                  >
                    <Feather
                      name={form.authorized ? "check-square" : "square"}
                      size={19}
                      color={form.authorized ? c.accentForeground : c.mutedForeground}
                    />
                    <Text style={styles.confirmText}>
                      أؤكد أنني مخوّل بتوزيع المستند المرتبط
                    </Text>
                  </Pressable>
                  <FilterPicker
                    label="حالة النشر"
                    value={form.publicationStatus}
                    allowAll={false}
                    options={PUBLICATION_STATUS_OPTIONS}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        publicationStatus: value as PublicationStatus,
                      }))
                    }
                  />
                  {form.publicationStatus === "rejected" ? (
                    <TextEntry
                      label="سبب الرفض (يظهر للطالب الذي رفع الملف)"
                      value={form.rejectionReason}
                      onChangeText={(rejectionReason) =>
                        setForm((current) => ({ ...current, rejectionReason }))
                      }
                      multiline
                    />
                  ) : null}
                </>
              ) : null}
              <View style={styles.formActions}>
                <PrimaryButton
                  label={editingId ? "حفظ التعديل" : "إضافة السجل"}
                  icon="check"
                  loading={working}
                  disabled={needsParent(entityType) && parentOptions.length === 0}
                  onPress={() => void saveRecord()}
                  testID="admin-save"
                />
                <PrimaryButton
                  label="إلغاء"
                  variant="secondary"
                  onPress={() => setFormVisible(false)}
                />
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={`إضافة ${ENTITY_TABS.find((item) => item.id === entityType)?.label ?? "سجل"}`}
              icon="plus"
              onPress={beginCreate}
              testID="admin-add"
            />
          )}

          {adminQuery.isError ? (
            <InlineNotice
              tone="warning"
              title="تعذر تحميل السجلات"
              description="تحقق من اتصال الخادم ثم أعد المحاولة."
              actionLabel="إعادة المحاولة"
              onAction={() => void adminQuery.refetch()}
            />
          ) : adminQuery.isLoading ? (
            <InlineNotice title="جارٍ تحميل بيانات الإدارة..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="لا توجد سجلات بعد"
              description="ابدأ بإضافة جامعة، ثم أضف الكليات والفرق والفصول والمقررات والمواد."
            />
          ) : (
            <View style={styles.recordList}>
              {records.map((record) => (
                <AdminRecordCard
                  key={record.id}
                  record={record}
                  entityType={entityType}
                  disabled={working}
                  onEdit={() => beginEdit(record)}
                  onDelete={() => deleteRecord(record)}
                  onQuickApprove={() => void quickApprove(record)}
                  onQuickReject={() => quickReject(record)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

const REPORT_STATUS_TABS: Array<{ id: ReportStatus; label: string }> = [
  { id: "open", label: "مفتوحة" },
  { id: "resolved", label: "محسومة" },
  { id: "dismissed", label: "متجاهَلة" },
];

const REPORT_REASON_LABELS: Record<string, string> = {
  copyright: "حقوق نشر",
  inappropriate: "محتوى غير لائق",
  wrong_info: "معلومات خاطئة",
  spam: "محتوى مزعج",
  other: "أخرى",
};

const REPORT_TARGET_LABELS: Record<string, string> = {
  material: "مادة",
  profile: "حساب",
  request: "طلب",
};

type BulkPickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

const BULK_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Stage 6-D "رفع بالجملة" — for admin seeding and group handoffs: picks
 * several files at once for one subject and publishes them immediately
 * (no pending review — an admin is directly vouching for each file, same
 * trust level as editing a record from the catalog panel). Titles default
 * to the file name; the admin can rename afterward from the catalog panel
 * like any other material. Each file is a separate POST (no multipart
 * batching) to keep this consistent with the raw-bytes relay pattern
 * already used for student uploads.
 */
function AdminBulkUploadPanel({
  adminToken,
  catalog,
}: {
  adminToken: string;
  catalog: CatalogResponse | null;
}) {
  const [facultyId, setFacultyId] = useState<number>();
  const [academicYearId, setAcademicYearId] = useState<number>();
  const [semesterId, setSemesterId] = useState<number>();
  const [subjectId, setSubjectId] = useState<number>();
  const [category, setCategory] = useState<MaterialCategory>("summary");
  const [sourceLabel, setSourceLabel] = useState("");
  const [files, setFiles] = useState<BulkPickedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<Record<string, "ok" | "error">>({});

  const faculties = catalog?.faculties ?? [];
  const yearOptions = (catalog?.academicYears ?? [])
    .filter((y) => facultyId === undefined || y.facultyId === facultyId)
    .map((y) => ({ id: y.id, label: y.labelAr }));
  const semesterOptions = (catalog?.semesters ?? [])
    .filter((s) => academicYearId === undefined || s.academicYearId === academicYearId)
    .map((s) => ({ id: s.id, label: s.labelAr }));
  const subjectOptions = (catalog?.subjects ?? [])
    .filter((s) => semesterId === undefined || s.semesterId === semesterId)
    .map((s) => ({ id: s.id, label: s.nameAr }));

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: BULK_ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets
      .filter((asset) => asset.mimeType && BULK_ALLOWED_MIME_TYPES.includes(asset.mimeType))
      .map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType!,
      }));
    setFiles(picked);
    setResults({});
  };

  const upload = async () => {
    if (!subjectId) {
      Alert.alert("اختر المادة", "حدد المادة الدراسية المرتبطة بالملفات.");
      return;
    }
    if (files.length === 0) {
      Alert.alert("اختر ملفات", "اختر ملفاً واحداً على الأقل لرفعه.");
      return;
    }

    setIsUploading(true);
    const nextResults: Record<string, "ok" | "error"> = {};
    const base = getBaseUrl() ?? "";
    for (const file of files) {
      const titleAr = stripExtension(file.name);
      const query = new URLSearchParams({
        subjectId: String(subjectId),
        titleAr,
        titleEn: titleAr,
        category,
        ...(sourceLabel.trim() ? { sourceLabel: sourceLabel.trim() } : {}),
      });
      try {
        const response = await FileSystem.uploadAsync(
          `${base}/api/catalog/admin/bulk-upload?${query.toString()}`,
          file.uri,
          {
            httpMethod: "POST",
            headers: {
              authorization: `Bearer ${adminToken}`,
              "content-type": file.mimeType,
            },
          },
        );
        nextResults[file.uri] =
          response.status >= 200 && response.status < 300 ? "ok" : "error";
      } catch {
        nextResults[file.uri] = "error";
      }
      setResults({ ...nextResults });
    }
    setIsUploading(false);
    const failed = Object.values(nextResults).filter((r) => r === "error").length;
    Alert.alert(
      "اكتمل الرفع بالجملة",
      failed === 0
        ? `اتنشر ${files.length} ملف بنجاح.`
        : `اتنشر ${files.length - failed} ملف، وفشل ${failed}.`,
    );
  };

  return (
    <View style={styles.bulkPanel}>
      <InlineNotice
        title="رفع بالجملة — للأدمن فقط"
        description="الملفات هنا تُنشر مباشرة بدون مراجعة لأنك بتأكد عليها بنفسك. استخدمها للبذر الأولي أو تسليم أرشيف جروب."
      />
      <FilterPicker
        label="الكلية"
        value={facultyId}
        options={faculties.map((f) => ({ id: f.id, label: f.nameAr }))}
        allowAll={false}
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
        allowAll={false}
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
        allowAll={false}
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
      <TextEntry
        label="مصدر الملفات (اختياري)"
        value={sourceLabel}
        onChangeText={setSourceLabel}
        placeholder="مثال: جروب أصدقاء الطب 2027"
      />

      <Pressable
        onPress={() => void pickFiles()}
        style={styles.filePicker}
        accessibilityRole="button"
        testID="bulk-pick-files"
      >
        <Feather name="upload" size={18} color={c.accentForeground} />
        <Text style={styles.filePickerText}>
          {files.length > 0 ? `${files.length} ملف مختار` : "اختر عدة ملفات"}
        </Text>
      </Pressable>

      {files.map((file) => (
        <View key={file.uri} style={styles.bulkFileRow}>
          <Text style={styles.bulkFileName} numberOfLines={1}>
            {file.name}
          </Text>
          {results[file.uri] === "ok" ? (
            <Feather name="check-circle" size={16} color="#16a34a" />
          ) : results[file.uri] === "error" ? (
            <Feather name="x-circle" size={16} color={c.destructive} />
          ) : null}
        </View>
      ))}

      <PrimaryButton
        label="رفع ونشر الكل"
        icon="upload-cloud"
        loading={isUploading}
        onPress={() => void upload()}
        testID="bulk-upload-submit"
      />
    </View>
  );
}

type FlashcardFilterStatus = "all" | PublicationStatus;

const FLASHCARD_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "مسودة",
  pending: "معلّق",
  published: "منشور",
  rejected: "مرفوض",
};

/**
 * Stage 7-A admin flashcards tab: two sub-tools in one panel —
 * (1) create-and-publish-directly, for the admin's own bulk "سؤال | إجابة"
 * paste (same "admin curation = the review step" reasoning as the Stage
 * 6-D bulk upload tool), and (2) the review queue for contributor-suggested
 * decks (pending → publish/reject, same path as everything else per rule
 * 5), with an inline card preview so publishing isn't a blind trust call.
 */
function AdminFlashcardsPanel({ catalog }: { catalog: CatalogResponse | null }) {
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState<number>();
  const [titleAr, setTitleAr] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FlashcardFilterStatus>("pending");
  const [expandedDeckId, setExpandedDeckId] = useState<number | null>(null);
  const [workingDeckId, setWorkingDeckId] = useState<number | null>(null);

  const subjectOptions = (catalog?.subjects ?? []).map((s) => ({
    id: s.id,
    label: s.nameAr,
  }));

  const decksQuery = useGetAdminFlashcardDecks({
    query: { queryKey: getGetAdminFlashcardDecksQueryKey() },
  });
  const createMutation = useCreateAdminFlashcardDeck();
  const manageMutation = useManageAdminFlashcardDeck();
  const deckDetailQuery = useGetAdminFlashcardDeck(expandedDeckId ?? 0, {
    query: {
      queryKey: getGetAdminFlashcardDeckQueryKey(expandedDeckId ?? 0),
      enabled: expandedDeckId !== null,
    },
  });

  const parsed = parseFlashcardPaste(pasteText);
  const decks = decksQuery.data?.decks ?? [];
  const filteredDecks =
    statusFilter === "all" ? decks : decks.filter((d) => d.status === statusFilter);

  const refreshDecks = () =>
    queryClient.invalidateQueries({ queryKey: getGetAdminFlashcardDecksQueryKey() });

  const create = async () => {
    if (!subjectId) {
      Alert.alert("اختر المادة", "حدد المادة الدراسية المرتبطة بالبطاقات.");
      return;
    }
    if (titleAr.trim().length < 3) {
      Alert.alert("اكتب عنواناً أوضح", "عنوان المجموعة يجب أن يكون 3 أحرف على الأقل.");
      return;
    }
    if (parsed.cards.length === 0) {
      Alert.alert("لا توجد بطاقات صالحة", "اكتب سطراً لكل بطاقة بصيغة: السؤال | الإجابة");
      return;
    }

    setIsCreating(true);
    try {
      await createMutation.mutateAsync({
        data: { subjectId, titleAr: titleAr.trim(), cards: parsed.cards },
      });
      setTitleAr("");
      setPasteText("");
      await refreshDecks();
      Alert.alert("تم النشر", `اتنشرت المجموعة بـ ${parsed.cards.length} بطاقة.`);
    } catch {
      Alert.alert("تعذر الإنشاء", "حاول مرة أخرى لاحقاً.");
    } finally {
      setIsCreating(false);
    }
  };

  const manage = async (deckId: number, action: "publish" | "reject" | "delete") => {
    setWorkingDeckId(deckId);
    try {
      await manageMutation.mutateAsync({ id: deckId, data: { action } });
      if (expandedDeckId === deckId) setExpandedDeckId(null);
      await refreshDecks();
    } catch {
      Alert.alert("تعذر تنفيذ الإجراء", "حاول مرة أخرى لاحقاً.");
    } finally {
      setWorkingDeckId(null);
    }
  };

  return (
    <View style={styles.bulkPanel}>
      <InlineNotice
        title="إنشاء مجموعة بطاقات ونشرها مباشرة"
        description='سطر لكل بطاقة بصيغة: السؤال | الإجابة. تُنشر فوراً لأنك بتأكد عليها بنفسك.'
      />
      <FilterPicker
        label="المادة"
        value={subjectId}
        options={subjectOptions}
        allowAll={false}
        onChange={(v) => setSubjectId(v as number | undefined)}
      />
      <TextEntry
        label="عنوان المجموعة"
        value={titleAr}
        onChangeText={setTitleAr}
        placeholder="مثال: مصطلحات الفصل الأول"
      />
      <TextEntry
        label="البطاقات"
        value={pasteText}
        onChangeText={setPasteText}
        placeholder={"السؤال | الإجابة\nسؤال تاني؟ | إجابة تانية"}
        multiline
        style={styles.bulkPasteInput}
      />
      <Text style={styles.bulkPasteHint}>
        {parsed.cards.length > 0
          ? `${parsed.cards.length} بطاقة جاهزة${parsed.skippedLines > 0 ? ` (تم تجاهل ${parsed.skippedLines} سطر)` : ""}`
          : "لسه مفيش بطاقات صالحة"}
      </Text>
      <PrimaryButton
        label="إنشاء ونشر"
        icon="upload-cloud"
        loading={isCreating}
        onPress={() => void create()}
        testID="admin-flashcards-create"
      />

      <View style={styles.flashcardStatusTabs}>
        {(["pending", "published", "rejected", "all"] as FlashcardFilterStatus[]).map(
          (status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={[
                styles.flashcardStatusTab,
                statusFilter === status && styles.flashcardStatusTabActive,
              ]}
            >
              <Text
                style={[
                  styles.flashcardStatusTabText,
                  statusFilter === status && styles.flashcardStatusTabTextActive,
                ]}
              >
                {status === "all" ? "الكل" : FLASHCARD_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      {decksQuery.isLoading ? (
        <InlineNotice title="جارٍ تحميل المجموعات..." />
      ) : filteredDecks.length === 0 ? (
        <EmptyState icon="layers" title="لا توجد مجموعات" description="لا توجد مجموعات بهذه الحالة." />
      ) : (
        filteredDecks.map((deck) => {
          const subject = (catalog?.subjects ?? []).find((s) => s.id === deck.subjectId);
          const expanded = expandedDeckId === deck.id;
          return (
            <View key={deck.id} style={styles.flashcardDeckRow}>
              <Pressable
                style={styles.flashcardDeckHeader}
                onPress={() => setExpandedDeckId(expanded ? null : deck.id)}
                testID={`admin-flashcard-deck-${deck.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.flashcardDeckTitle}>{deck.titleAr}</Text>
                  <Text style={styles.flashcardDeckSubtitle}>
                    {subject?.nameAr ?? "مادة غير معروفة"} · {deck.cardCount} بطاقة ·{" "}
                    {FLASHCARD_STATUS_LABELS[deck.status]}
                  </Text>
                </View>
                <Feather
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={c.mutedForeground}
                />
              </Pressable>

              {expanded ? (
                <View style={styles.flashcardDeckBody}>
                  {deckDetailQuery.isLoading ? (
                    <Text style={styles.bulkPasteHint}>جارٍ تحميل البطاقات...</Text>
                  ) : (
                    (deckDetailQuery.data?.cards ?? []).map((card) => (
                      <View key={card.id} style={styles.flashcardPreviewCard}>
                        <Text style={styles.flashcardPreviewQ}>س: {card.questionAr}</Text>
                        <Text style={styles.flashcardPreviewA}>ج: {card.answerAr}</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : null}

              <View style={styles.flashcardDeckActions}>
                {deck.status !== "published" ? (
                  <PrimaryButton
                    label="نشر"
                    icon="check"
                    loading={workingDeckId === deck.id}
                    onPress={() => void manage(deck.id, "publish")}
                    testID={`admin-flashcard-publish-${deck.id}`}
                  />
                ) : null}
                {deck.status !== "rejected" ? (
                  <PrimaryButton
                    label="رفض"
                    variant="secondary"
                    icon="x"
                    loading={workingDeckId === deck.id}
                    onPress={() => void manage(deck.id, "reject")}
                    testID={`admin-flashcard-reject-${deck.id}`}
                  />
                ) : null}
                <PrimaryButton
                  label="حذف"
                  variant="destructive"
                  icon="trash-2"
                  loading={workingDeckId === deck.id}
                  onPress={() =>
                    Alert.alert("حذف المجموعة؟", "هذا الإجراء نهائي.", [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "حذف",
                        style: "destructive",
                        onPress: () => void manage(deck.id, "delete"),
                      },
                    ])
                  }
                  testID={`admin-flashcard-delete-${deck.id}`}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function AdminReportsPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [workingId, setWorkingId] = useState<number | null>(null);
  const reportsQuery = useGetAdminReports(
    { status },
    { query: { queryKey: getGetAdminReportsQueryKey({ status }) } },
  );
  const resolveMutation = useResolveAdminReport();
  const manageRequestMutation = useManageAdminRequest();
  const reports = reportsQuery.data?.reports ?? [];

  const resolve = async (
    report: Report,
    action:
      | "unpublish"
      | "dismiss"
      | "suspend-uploads"
      | "suspend-account"
      | "reinstate-account",
  ) => {
    setWorkingId(report.id);
    try {
      await resolveMutation.mutateAsync({ id: report.id, data: { action } });
      await queryClient.invalidateQueries({
        queryKey: getGetAdminReportsQueryKey({ status }),
      });
      await queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: getGetCatalogAdminCatalogQueryKey(),
      });
    } catch (error) {
      Alert.alert(
        "تعذر تنفيذ الإجراء",
        error instanceof Error ? error.message : "حاول مرة أخرى.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  const deleteRequest = async (report: Report) => {
    const requestId = Number(report.targetId);
    if (!Number.isInteger(requestId)) return;
    setWorkingId(report.id);
    try {
      await manageRequestMutation.mutateAsync({
        id: requestId,
        data: { action: "delete" },
      });
      // The request itself doesn't go through the reports resolve flow
      // (it's a separate admin surface), so mark the report dismissed
      // afterward to keep it out of the "open" queue.
      await resolveMutation.mutateAsync({
        id: report.id,
        data: { action: "dismiss" },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetAdminReportsQueryKey({ status }),
      });
    } catch (error) {
      Alert.alert(
        "تعذر حذف الطلب",
        error instanceof Error ? error.message : "حاول مرة أخرى.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.entityTabs}
      >
        {REPORT_STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setStatus(tab.id)}
            style={[
              styles.entityTab,
              status === tab.id && styles.entityTabActive,
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.entityTabText,
                status === tab.id && styles.entityTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {reportsQuery.isError ? (
        <InlineNotice
          tone="warning"
          title="تعذر تحميل البلاغات"
          description="تحقق من اتصال الخادم ثم أعد المحاولة."
          actionLabel="إعادة المحاولة"
          onAction={() => void reportsQuery.refetch()}
        />
      ) : reportsQuery.isLoading ? (
        <InlineNotice title="جارٍ تحميل البلاغات..." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon="flag"
          title="لا توجد بلاغات"
          description="لا توجد بلاغات بهذه الحالة حالياً."
        />
      ) : (
        <View style={styles.recordList}>
          {reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportBadge}>
                  <Text style={styles.reportBadgeText}>
                    {REPORT_TARGET_LABELS[report.targetType] ?? report.targetType}{" "}
                    #{report.targetId}
                  </Text>
                </View>
                <Text style={styles.reportMeta}>
                  {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                </Text>
              </View>
              {report.details ? (
                <Text style={styles.reportDetails}>{report.details}</Text>
              ) : null}
              <Text style={styles.reportMeta}>
                {report.reporterUserId
                  ? "من مستخدم مسجّل"
                  : "من مستخدم بدون تسجيل دخول"}
              </Text>
              {report.status === "open" ? (
                <View style={styles.reportActions}>
                  {report.targetType === "material" ? (
                    <Pressable
                      disabled={workingId === report.id}
                      onPress={() => void resolve(report, "unpublish")}
                      style={styles.reportActionButton}
                    >
                      <Text style={[styles.reportActionText, { color: c.destructive }]}>
                        إلغاء النشر
                      </Text>
                    </Pressable>
                  ) : null}
                  {report.targetType === "request" ? (
                    <>
                      <Pressable
                        disabled={workingId === report.id}
                        onPress={() => void resolve(report, "unpublish")}
                        style={styles.reportActionButton}
                      >
                        <Text style={[styles.reportActionText, { color: c.destructive }]}>
                          إغلاق الطلب
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={workingId === report.id}
                        onPress={() => void deleteRequest(report)}
                        style={styles.reportActionButton}
                      >
                        <Text style={[styles.reportActionText, { color: c.destructive }]}>
                          حذف الطلب
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                  {report.targetType !== "request" ? (
                    <Pressable
                      disabled={workingId === report.id}
                      onPress={() => void resolve(report, "suspend-uploads")}
                      style={styles.reportActionButton}
                    >
                      <Text style={[styles.reportActionText, { color: c.destructive }]}>
                        تعليق الرفع
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={workingId === report.id}
                    onPress={() => void resolve(report, "dismiss")}
                    style={styles.reportActionButton}
                  >
                    <Text style={[styles.reportActionText, { color: c.mutedForeground }]}>
                      تجاهل
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {report.targetType !== "request" ? (
                // Full account block/unblock (Stage 8) — shown regardless of
                // the report's own open/resolved status, since an admin may
                // want to ban or reinstate the account independently of this
                // particular report's lifecycle.
                <View style={styles.reportActions}>
                  <Pressable
                    disabled={workingId === report.id}
                    onPress={() => void resolve(report, "suspend-account")}
                    style={styles.reportActionButton}
                  >
                    <Text style={[styles.reportActionText, { color: c.destructive }]}>
                      حظر الحساب
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={workingId === report.id}
                    onPress={() => void resolve(report, "reinstate-account")}
                    style={styles.reportActionButton}
                  >
                    <Text style={[styles.reportActionText, { color: c.mutedForeground }]}>
                      إلغاء الحظر
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function AdminRecordCard({
  record,
  entityType,
  disabled,
  onEdit,
  onDelete,
  onQuickApprove,
  onQuickReject,
}: {
  record: RowRecord;
  entityType: AdminEntityType;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onQuickApprove?: () => void;
  onQuickReject?: () => void;
}) {
  const title =
    readString(record, "titleAr") ||
    readString(record, "nameAr") ||
    readString(record, "labelAr") ||
    "سجل بدون اسم";
  const status = readString(record, "publicationStatus", "draft") as PublicationStatus;
  const isStudentUpload = !!readString(record, "uploaderId");
  const source = readString(record, "source", "app");
  const sourceLabel =
    source === "telegram" ? " · عبر تليجرام" : source === "bulk-admin" ? " · رفع بالجملة" : "";
  const detail =
    entityType === "material"
      ? `${CATEGORY_LABELS[readString(record, "category", "summary") as MaterialCategory]} · ${
          PUBLICATION_STATUS_LABELS[status]
        } · ${readString(record, "documentUrl") ? "ملف مرتبط" : "بدون ملف"}${
          isStudentUpload ? " · رفع طالب" : ""
        }${sourceLabel}`
      : `رقم السجل ${record.id}`;
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.recordDetail}>{detail}</Text>
      </View>
      {entityType === "material" && status === "pending" ? (
        <>
          <Pressable
            onPress={onQuickApprove}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="قبول ونشر"
            style={styles.recordAction}
          >
            <Feather name="check" size={17} color={c.accentForeground} />
          </Pressable>
          <Pressable
            onPress={onQuickReject}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="رفض"
            style={styles.recordAction}
          >
            <Feather name="x" size={17} color={c.destructive} />
          </Pressable>
        </>
      ) : null}
      <Pressable
        onPress={onEdit}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="تعديل السجل"
        style={styles.recordAction}
      >
        <Feather name="edit-2" size={17} color={c.accentForeground} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="حذف السجل"
        style={styles.recordAction}
      >
        <Feather name="trash-2" size={17} color={c.destructive} />
      </Pressable>
    </View>
  );
}

function parentFieldFor(entityType: AdminEntityType): string | null {
  switch (entityType) {
    case "university":
      return null;
    case "faculty":
      return "universityId";
    case "academicYear":
      return "facultyId";
    case "semester":
      return "academicYearId";
    case "subject":
      return "semesterId";
    case "material":
      return "subjectId";
  }
}

function needsParent(entityType: AdminEntityType): boolean {
  return parentFieldFor(entityType) !== null;
}

function parentLabel(entityType: AdminEntityType): string {
  switch (entityType) {
    case "faculty":
      return "الجامعة";
    case "academicYear":
      return "الكلية";
    case "semester":
      return "الفرقة";
    case "subject":
      return "الفصل الدراسي";
    case "material":
      return "المادة الدراسية";
    case "university":
      return "الجامعة";
  }
}

function makeParentOptions(
  entityType: AdminEntityType,
  catalog: CatalogResponse | null,
): Array<{ id: number; label: string }> {
  if (!catalog) return [];
  switch (entityType) {
    case "university":
      return [];
    case "faculty":
      return catalog.universities.map((item) => ({
        id: item.id,
        label: item.nameAr,
      }));
    case "academicYear":
      return catalog.faculties.map((item) => ({
        id: item.id,
        label: `${item.nameAr} · ${
          catalog.universities.find(
            (university) => university.id === item.universityId,
          )?.nameAr ?? ""
        }`,
      }));
    case "semester":
      return catalog.academicYears.map((item) => ({
        id: item.id,
        label: `${item.labelAr} · ${
          catalog.faculties.find((faculty) => faculty.id === item.facultyId)
            ?.nameAr ?? ""
        }`,
      }));
    case "subject":
      return catalog.semesters.map((item) => ({
        id: item.id,
        label: `${item.labelAr} · ${
          catalog.academicYears.find(
            (year) => year.id === item.academicYearId,
          )?.labelAr ?? ""
        }`,
      }));
    case "material":
      return catalog.subjects.map((item) => ({
        id: item.id,
        label: `${item.nameAr} · ${
          catalog.semesters.find((semester) => semester.id === item.semesterId)
            ?.labelAr ?? ""
        }`,
      }));
  }
}

function getEntityCount(
  entityType: AdminEntityType,
  catalog: CatalogResponse,
): number {
  switch (entityType) {
    case "university":
      return catalog.universities.length;
    case "faculty":
      return catalog.faculties.length;
    case "academicYear":
      return catalog.academicYears.length;
    case "semester":
      return catalog.semesters.length;
    case "subject":
      return catalog.subjects.length;
    case "material":
      return catalog.materials.length;
  }
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function makeRequest(
  entityType: AdminEntityType,
  id: number | null,
  form: AdminForm,
): AdminManageRequest | null {
  const action = id === null ? "create" : "update";
  const parentId = form.parentId ? Number(form.parentId) : undefined;
  if (needsParent(entityType) && (!parentId || !Number.isInteger(parentId))) {
    return null;
  }
  const base = {
    action,
    entityType,
    ...(id === null ? {} : { id }),
    ...(parentId === undefined ? {} : { parentId }),
  } as const;

  switch (entityType) {
    case "university":
      return form.nameAr.trim() && form.nameEn.trim()
        ? {
            ...base,
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim(),
            city: form.city.trim(),
          }
        : null;
    case "faculty":
      return form.nameAr.trim() && form.nameEn.trim()
        ? {
            ...base,
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim(),
          }
        : null;
    case "academicYear":
    case "semester":
      return form.labelAr.trim() && form.labelEn.trim()
        ? {
            ...base,
            labelAr: form.labelAr.trim(),
            labelEn: form.labelEn.trim(),
            rank: Math.max(1, Number.parseInt(form.rank, 10) || 1),
          }
        : null;
    case "subject":
      return form.nameAr.trim() && form.nameEn.trim()
        ? {
            ...base,
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim(),
            code: form.code.trim() || null,
          }
        : null;
    case "material":
      if (!form.titleAr.trim() || !form.titleEn.trim()) return null;
      if (
        form.publicationStatus === "published" &&
        form.documentUrl.trim() &&
        !form.authorized
      ) {
        return null;
      }
      return {
        ...base,
        titleAr: form.titleAr.trim(),
        titleEn: form.titleEn.trim(),
        category: form.category,
        descriptionAr: form.descriptionAr.trim(),
        descriptionEn: form.descriptionEn.trim(),
        fileFormat: form.fileFormat.trim() || "PDF",
        documentUrl: form.documentUrl.trim() || null,
        fileSizeBytes: form.fileSizeBytes
          ? Number.parseInt(form.fileSizeBytes, 10)
          : null,
        contributor: form.contributor.trim() || null,
        professorName: form.professorName.trim() || null,
        examYear: form.examYear.trim()
          ? Number.parseInt(form.examYear, 10)
          : null,
        examType: form.examType || null,
        appearedInExam: form.appearedInExam,
        publicationStatus: form.publicationStatus,
        rejectionReason:
          form.publicationStatus === "rejected"
            ? form.rejectionReason.trim() || null
            : null,
        authorized: form.authorized,
      };
  }
}

const styles = StyleSheet.create({
  iconButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: "center", justifyContent: "center" },
  loginPanel: { gap: 14, padding: 17, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  loginIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: c.secondary, alignItems: "center", justifyContent: "center" },
  loginTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 18, textAlign: "right" },
  loginDescription: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, lineHeight: 21, textAlign: "right" },
  panelToggle: { flexDirection: "row", gap: 7, padding: 4, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  panelToggleButton: { flex: 1, minHeight: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  panelToggleButtonActive: { backgroundColor: c.primary },
  panelToggleText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 13 },
  panelToggleTextActive: { color: c.primaryForeground },
  bulkPanel: { gap: 10 },
  filePicker: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  filePickerText: { flex: 1, color: c.foreground, fontFamily: font.medium, fontSize: 13, textAlign: "right" },
  bulkFileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 34, paddingHorizontal: 12, borderRadius: 11, backgroundColor: c.secondary },
  bulkFileName: { flex: 1, color: c.foreground, fontFamily: font.medium, fontSize: 12, textAlign: "right" },
  bulkPasteInput: { minHeight: 120, textAlignVertical: "top" },
  bulkPasteHint: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, textAlign: "right" },
  flashcardStatusTabs: { flexDirection: "row-reverse", gap: 6, marginTop: 4 },
  flashcardStatusTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: c.secondary },
  flashcardStatusTabActive: { backgroundColor: c.primary },
  flashcardStatusTabText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  flashcardStatusTabTextActive: { color: c.primaryForeground },
  flashcardDeckRow: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  flashcardDeckHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  flashcardDeckTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 14, textAlign: "right" },
  flashcardDeckSubtitle: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, textAlign: "right", marginTop: 2 },
  flashcardDeckBody: { gap: 6, paddingTop: 4 },
  flashcardPreviewCard: { padding: 10, borderRadius: 10, backgroundColor: c.secondary, gap: 3 },
  flashcardPreviewQ: { color: c.foreground, fontFamily: font.semibold, fontSize: 12, textAlign: "right" },
  flashcardPreviewA: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, textAlign: "right" },
  flashcardDeckActions: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  reportCard: { gap: 8, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  reportHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: c.secondary },
  reportBadgeText: { color: c.accentForeground, fontFamily: font.bold, fontSize: 10 },
  reportMeta: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12, textAlign: "right" },
  reportDetails: { color: c.foreground, fontFamily: font.regular, fontSize: 13, textAlign: "right", lineHeight: 20 },
  reportActions: { flexDirection: "row", gap: 7, marginTop: 4 },
  reportActionButton: { flex: 1, minHeight: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
  reportActionText: { fontFamily: font.medium, fontSize: 12 },
  entityTabs: { gap: 7, paddingVertical: 2 },
  entityTab: { minHeight: 38, borderRadius: 20, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  entityTabActive: { backgroundColor: c.primary, borderColor: c.primary },
  entityTabText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  entityTabTextActive: { color: c.primaryForeground },
  entityCount: { color: c.mutedForeground, fontFamily: font.bold, fontSize: 10 },
  entityCountActive: { color: c.primaryForeground },
  formCard: { gap: 13, padding: 15, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 16 },
  confirmRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9 },
  confirmText: { flex: 1, color: c.foreground, fontFamily: font.medium, fontSize: 12, textAlign: "right" },
  formActions: { gap: 8, marginTop: 3 },
  recordList: { gap: 8 },
  recordCard: { minHeight: 75, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 9 },
  recordInfo: { flex: 1, alignItems: "flex-start", gap: 2 },
  recordTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  recordDetail: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 10, textAlign: "right" },
  recordAction: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
});
