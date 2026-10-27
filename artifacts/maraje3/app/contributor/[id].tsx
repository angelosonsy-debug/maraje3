import { Feather } from "@expo/vector-icons";
import {
  getGetContributorProfileQueryKey,
  useCreateReport,
  useGetContributorProfile,
  type ReportReason,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  LoadingState,
  ScreenHeading,
  SectionHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { getAnonymousDeviceId } from "@/lib/device-id";
import { useAuth } from "@/state/auth-context";
import { CATEGORY_LABELS } from "@/types/catalog";

const c = uiColors;

const REPORT_REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: "copyright", label: "انتهاك حقوق نشر" },
  { id: "inappropriate", label: "محتوى غير لائق" },
  { id: "wrong_info", label: "معلومات خاطئة" },
  { id: "spam", label: "محتوى مزعج" },
  { id: "other", label: "سبب آخر" },
];

export default function ContributorProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const query = useGetContributorProfile(id ?? "", {
    query: {
      queryKey: getGetContributorProfileQueryKey(id ?? ""),
      enabled: !!id,
    },
  });
  const profile = query.data;
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const createReportMutation = useCreateReport();

  const submitReport = async (reason: ReportReason) => {
    if (!profile) return;
    setReportSheetVisible(false);
    setIsReporting(true);
    try {
      const deviceId = user ? undefined : await getAnonymousDeviceId();
      await createReportMutation.mutateAsync({
        data: {
          targetType: "profile",
          targetId: profile.id,
          reason,
          deviceId,
        },
      });
      Alert.alert("تم إرسال البلاغ", "شكراً لك، سيراجع فريق الإدارة هذا البروفايل.");
    } catch (error) {
      Alert.alert(
        "تعذر إرسال البلاغ",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsReporting(false);
    }
  };

  if (query.isLoading) {
    return (
      <AppScreen>
        <ScreenHeading title="بروفايل المساهم" back={() => router.back()} />
        <LoadingState label="جارٍ تحميل البروفايل..." />
      </AppScreen>
    );
  }

  if (!profile) {
    return (
      <AppScreen>
        <ScreenHeading title="بروفايل المساهم" back={() => router.back()} />
        <EmptyState
          icon="user-x"
          title="المساهم غير متاح"
          description="قد يكون هذا الحساب قد اختار إخفاء هويته أو لم يعد موجوداً."
          actionLabel="العودة"
          onAction={() => router.back()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading title="بروفايل المساهم" back={() => router.back()} />
      <View style={styles.identity}>
        {profile.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Feather name="user" size={26} color={c.accentForeground} />
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          {profile.facultyNameAr ? (
            <Text style={styles.facultyName}>{profile.facultyNameAr}</Text>
          ) : null}
          {profile.title ? (
            <View style={styles.titleBadge}>
              <Feather name="award" size={12} color={c.primary} />
              <Text style={styles.titleBadgeText}>{profile.title}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatTile label="ملفات منشورة" value={profile.publishedCount} />
        <StatTile label="إجمالي التنزيلات" value={profile.totalDownloads} />
        <StatTile label="شكراً" value={profile.totalThanks} />
      </View>
      {profile.fulfilledRequestsCount > 0 ? (
        <View style={styles.statsRow}>
          <StatTile label="طلبات لبّاها" value={profile.fulfilledRequestsCount} />
        </View>
      ) : null}

      <SectionHeading title="ملفاته المنشورة" />
      {profile.materials.length === 0 ? (
        <EmptyState
          icon="file"
          title="لا توجد ملفات منشورة بعد"
          description="هتظهر هنا الملفات بمجرد موافقة فريق المراجعة عليها."
        />
      ) : (
        <View style={styles.list}>
          {profile.materials.map((material) => (
            <Pressable
              key={material.id}
              onPress={() =>
                router.push(`/material/${material.id}` as `/material/${string}`)
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.materialRow, pressed && styles.pressed]}
            >
              <View style={styles.materialIcon}>
                <Feather name="file-text" size={18} color={c.accentForeground} />
              </View>
              <View style={styles.materialBody}>
                <Text style={styles.materialTitle} numberOfLines={1}>
                  {material.titleAr}
                </Text>
                <View style={styles.materialMeta}>
                  <Text style={styles.materialMetaText}>
                    {CATEGORY_LABELS[material.category]}
                  </Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.materialMetaText}>
                    {material.downloadCount} تنزيل · {material.thanksCount} شكراً
                  </Text>
                </View>
              </View>
              <Feather name="chevron-left" size={17} color={c.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setReportSheetVisible(true)}
        disabled={isReporting}
        accessibilityRole="button"
        style={styles.reportButton}
        testID="report-contributor-profile"
      >
        <Feather name="flag" size={16} color={c.destructive} />
        <Text style={styles.reportText}>الإبلاغ عن هذا البروفايل</Text>
      </Pressable>

      <Modal
        visible={reportSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportSheetVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setReportSheetVisible(false)}
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 20, backgroundColor: c.secondary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, alignItems: "flex-start", gap: 4 },
  displayName: { color: c.foreground, fontFamily: font.bold, fontSize: 18, textAlign: "right" },
  facultyName: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, textAlign: "right" },
  titleBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: c.accent, marginTop: 2 },
  titleBadgeText: { color: c.primary, fontFamily: font.bold, fontSize: 11 },
  statsRow: { flexDirection: "row", gap: 10 },
  statTile: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  statValue: { color: c.foreground, fontFamily: font.bold, fontSize: 18 },
  statLabel: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11 },
  list: { gap: 8 },
  materialRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  materialIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.accent },
  materialBody: { flex: 1, alignItems: "flex-start", gap: 3 },
  materialTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  materialMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  materialMetaText: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.border },
  pressed: { opacity: 0.85 },
  reportButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  reportText: { color: c.destructive, fontFamily: font.medium, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { gap: 4, padding: 16, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: c.card },
  sheetTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 15, textAlign: "right", marginBottom: 6 },
  sheetOption: { minHeight: 46, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  sheetOptionText: { color: c.foreground, fontFamily: font.medium, fontSize: 14, textAlign: "right" },
});
