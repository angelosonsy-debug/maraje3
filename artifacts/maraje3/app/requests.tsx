import { Feather } from "@expo/vector-icons";
import {
  getGetRequestsQueryKey,
  recordRequestMeToo,
  useCreateReport,
  useGetRequests,
  type ReportReason,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  FilterPicker,
  InlineNotice,
  LoadingState,
  PrimaryButton,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { getAnonymousDeviceId } from "@/lib/device-id";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

const REPORT_REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: "inappropriate", label: "محتوى غير لائق" },
  { id: "wrong_info", label: "معلومات خاطئة" },
  { id: "spam", label: "محتوى مزعج" },
  { id: "other", label: "سبب آخر" },
];

export default function RequestsBoardScreen() {
  const router = useRouter();
  const { catalog } = useLibrary();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [facultyId, setFacultyId] = useState<number | undefined>(
    user?.facultyId ?? catalog.faculties.find((f) => !f.isDemo)?.id,
  );
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [meTooWorkingId, setMeTooWorkingId] = useState<number | null>(null);
  const [reportSheetRequestId, setReportSheetRequestId] = useState<
    number | null
  >(null);
  const [isReporting, setIsReporting] = useState(false);
  const createReportMutation = useCreateReport();

  const facultyOptions = useMemo(
    () => catalog.faculties.map((f) => ({ id: f.id, label: f.nameAr })),
    [catalog.faculties],
  );
  const subjectOptions = useMemo(
    () =>
      catalog.subjects
        .filter((s) => {
          if (facultyId === undefined) return true;
          const semester = catalog.semesters.find(
            (sem) => sem.id === s.semesterId,
          );
          const year = catalog.academicYears.find(
            (y) => y.id === semester?.academicYearId,
          );
          return year?.facultyId === facultyId;
        })
        .map((s) => ({ id: s.id, label: s.nameAr })),
    [catalog.subjects, catalog.semesters, catalog.academicYears, facultyId],
  );

  const queryParams = { facultyId: facultyId ?? 0, subjectId };
  const query = useGetRequests(queryParams, {
    query: {
      queryKey: getGetRequestsQueryKey(queryParams),
      enabled: !!facultyId,
    },
  });
  const requests = query.data?.requests ?? [];

  const handleMeToo = async (requestId: number) => {
    if (meTooWorkingId !== null) return;
    setMeTooWorkingId(requestId);
    try {
      const deviceId = await getAnonymousDeviceId();
      await recordRequestMeToo(requestId, {
        headers: { "X-Device-Id": deviceId },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetRequestsQueryKey(queryParams),
      });
    } catch (error) {
      Alert.alert(
        "تعذر التسجيل",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setMeTooWorkingId(null);
    }
  };

  const submitReport = async (reason: ReportReason) => {
    if (reportSheetRequestId === null) return;
    const targetId = reportSheetRequestId;
    setReportSheetRequestId(null);
    setIsReporting(true);
    try {
      const deviceId = user ? undefined : await getAnonymousDeviceId();
      await createReportMutation.mutateAsync({
        data: {
          targetType: "request",
          targetId: String(targetId),
          reason,
          deviceId,
        },
      });
      Alert.alert("تم إرسال البلاغ", "شكراً لك، سيراجع فريق الإدارة هذا الطلب.");
    } catch (error) {
      Alert.alert(
        "تعذر إرسال البلاغ",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="لوحة مطلوب"
        subtitle="اطلب ملفاً غير متوفر، أو ساعد غيرك برفع ملف يحتاجه"
        back={() => router.back()}
      />

      <View style={styles.filters}>
        <FilterPicker
          label="الكلية"
          value={facultyId}
          options={facultyOptions}
          onChange={(value) => {
            setFacultyId(value as number | undefined);
            setSubjectId(undefined);
          }}
          allowAll={false}
        />
        <FilterPicker
          label="المادة"
          value={subjectId}
          options={subjectOptions}
          onChange={(value) => setSubjectId(value as number | undefined)}
        />
      </View>

      <PrimaryButton
        label="اطلب ملفاً جديداً"
        icon="plus-circle"
        onPress={() => router.push("/new-request")}
        testID="open-new-request"
      />

      {!facultyId ? (
        <EmptyState
          icon="help-circle"
          title="اختر كلية"
          description="اختر كلية لعرض الطلبات الخاصة بها."
        />
      ) : query.isLoading ? (
        <LoadingState label="جارٍ تحميل لوحة مطلوب..." />
      ) : query.isError ? (
        <InlineNotice
          tone="warning"
          title="تعذر تحميل لوحة مطلوب"
          description="تحقق من اتصالك وأعد المحاولة."
          actionLabel="إعادة المحاولة"
          onAction={() => void query.refetch()}
        />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="لا توجد طلبات حالياً"
          description="كن أول من يطلب ملفاً لهذه الكلية."
        />
      ) : (
        <View style={styles.list}>
          {requests.map((request) => {
            const subject = catalog.subjects.find(
              (s) => s.id === request.subjectId,
            );
            return (
              <View key={request.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      request.status === "fulfilled" && styles.statusFulfilled,
                      request.status === "closed" && styles.statusClosed,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {STATUS_LABELS[request.status]}
                    </Text>
                  </View>
                  {subject ? (
                    <Text style={styles.subjectText} numberOfLines={1}>
                      {subject.nameAr}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.titleText}>{request.titleAr}</Text>
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => void handleMeToo(request.id)}
                    disabled={
                      request.status !== "open" ||
                      meTooWorkingId === request.id
                    }
                    accessibilityRole="button"
                    style={[
                      styles.meTooButton,
                      request.status !== "open" && styles.actionDisabled,
                    ]}
                    testID={`me-too-${request.id}`}
                  >
                    <Feather
                      name="arrow-up-circle"
                      size={16}
                      color={c.accentForeground}
                    />
                    <Text style={styles.meTooText}>
                      أنا كمان ({request.meTooCount})
                    </Text>
                  </Pressable>
                  {request.status === "open" ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/upload",
                          params: { fulfillsRequestId: String(request.id) },
                        })
                      }
                      accessibilityRole="button"
                      style={styles.fulfillButton}
                      testID={`fulfill-${request.id}`}
                    >
                      <Feather name="upload" size={16} color="#fff" />
                      <Text style={styles.fulfillText}>عندي الملف ده</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setReportSheetRequestId(request.id)}
                    disabled={isReporting}
                    accessibilityRole="button"
                    style={styles.reportButton}
                    testID={`report-request-${request.id}`}
                  >
                    <Feather name="flag" size={14} color={c.destructive} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={reportSheetRequestId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReportSheetRequestId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setReportSheetRequestId(null)}
            accessibilityLabel="إغلاق"
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>اختر سبب البلاغ</Text>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason.id}
                onPress={() => void submitReport(reason.id)}
                style={styles.sheetOption}
              >
                <Text style={styles.sheetOptionText}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوح",
  fulfilled: "تم توفيره",
  closed: "مغلق",
};

const styles = StyleSheet.create({
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  list: { gap: 10 },
  card: {
    gap: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: c.secondary,
  },
  statusFulfilled: { backgroundColor: "#16a34a1a" },
  statusClosed: { backgroundColor: c.border },
  statusBadgeText: {
    color: c.mutedForeground,
    fontFamily: font.bold,
    fontSize: 10,
  },
  subjectText: {
    flex: 1,
    color: c.mutedForeground,
    fontFamily: font.medium,
    fontSize: 11,
    textAlign: "left",
  },
  titleText: {
    color: c.foreground,
    fontFamily: font.semibold,
    fontSize: 14,
    textAlign: "right",
    lineHeight: 21,
  },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  meTooButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  meTooText: {
    color: c.accentForeground,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  fulfillButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: c.primary,
  },
  fulfillText: { color: "#fff", fontFamily: font.semibold, fontSize: 12 },
  reportButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  actionDisabled: { opacity: 0.5 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    gap: 4,
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: c.card,
  },
  sheetTitle: {
    color: c.foreground,
    fontFamily: font.bold,
    fontSize: 15,
    textAlign: "right",
    marginBottom: 6,
  },
  sheetOption: {
    minHeight: 46,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  sheetOptionText: {
    color: c.foreground,
    fontFamily: font.medium,
    fontSize: 14,
    textAlign: "right",
  },
});
