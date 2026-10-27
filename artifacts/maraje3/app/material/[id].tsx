import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getGetMaterialQueryKey,
  recordMaterialThanks,
  useCreateReport,
  useGetMaterial,
  type ReportReason,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppScreen,
  DemoBadge,
  EmptyState,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  font,
  formatFileSize,
  uiColors,
} from "@/components/library-ui";
import { showRewardedAdForDownload } from "@/lib/ads";
import { getAnonymousDeviceId } from "@/lib/device-id";
import { getMaterialContext } from "@/lib/catalog";
import {
  nextDownloadNeedsRewardedAd,
  recordDownloadForQuota,
} from "@/lib/download-quota";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";
import { CATEGORY_LABELS } from "@/types/catalog";

const THANKED_STORAGE_KEY = "maraje3.thanked-materials.v1";

async function readThankedIds(): Promise<number[]> {
  try {
    const stored = await AsyncStorage.getItem(THANKED_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => Number.isInteger(item))
      : [];
  } catch {
    return [];
  }
}

const REPORT_REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: "copyright", label: "انتهاك حقوق نشر" },
  { id: "inappropriate", label: "محتوى غير لائق" },
  { id: "wrong_info", label: "معلومات خاطئة" },
  { id: "spam", label: "محتوى مزعج" },
  { id: "other", label: "سبب آخر" },
];

const c = uiColors;

export default function MaterialDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const materialId = Number(id);
  const {
    catalog,
    isSaved,
    toggleSaved,
    recordRecent,
    downloadMaterial,
    downloads,
  } = useLibrary();
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [hasThanked, setHasThanked] = useState(false);
  const [isThanking, setIsThanking] = useState(false);
  const { user } = useAuth();
  const createReportMutation = useCreateReport();
  const material = catalog.materials.find((item) => item.id === materialId);
  const context = material ? getMaterialContext(catalog, material) : null;
  const downloaded = downloads.some((item) => item.materialId === materialId);
  // Fetched only for the detail screen's honor line/title badge — the
  // paginated catalog list deliberately doesn't carry uploaderSummary (see
  // Stage 4 report) to avoid a per-row stats query on every page.
  const detailQuery = useGetMaterial(materialId, {
    query: {
      queryKey: getGetMaterialQueryKey(materialId),
      enabled: Number.isInteger(materialId) && materialId > 0,
    },
  });
  const uploaderSummary = detailQuery.data?.uploaderSummary ?? null;
  const [thanksCount, setThanksCount] = useState(0);

  useEffect(() => {
    setThanksCount(detailQuery.data?.thanksCount ?? material?.thanksCount ?? 0);
  }, [detailQuery.data?.thanksCount, material?.thanksCount]);

  useEffect(() => {
    if (material) recordRecent(material.id);
  }, [material, recordRecent]);

  useEffect(() => {
    if (!material) return;
    let cancelled = false;
    void readThankedIds().then((ids) => {
      if (!cancelled) setHasThanked(ids.includes(material.id));
    });
    return () => {
      cancelled = true;
    };
  }, [material]);

  if (!material || !context) {
    return (
      <AppScreen>
        <ScreenHeading title="تفاصيل المادة" back={() => router.back()} />
        <EmptyState
          icon="alert-circle"
          title="المورد غير متاح"
          description="لم يعد هذا العنصر موجوداً في الكتالوج المتاح."
          actionLabel="العودة للمكتبة"
          onAction={() => router.replace("/(tabs)/explore")}
        />
      </AppScreen>
    );
  }

  const handleOpen = async () => {
    if (!material.documentUrl) return;
    try {
      await Linking.openURL(material.documentUrl);
    } catch {
      Alert.alert("تعذر فتح الملف", "تحقق من الرابط أو حاول مرة أخرى لاحقاً.");
    }
  };

  const submitReport = async (reason: ReportReason) => {
    if (!material) return;
    setReportSheetVisible(false);
    setIsReporting(true);
    try {
      const deviceId = user ? undefined : await getAnonymousDeviceId();
      await createReportMutation.mutateAsync({
        data: {
          targetType: "material",
          targetId: String(material.id),
          reason,
          deviceId,
        },
      });
      Alert.alert("تم إرسال البلاغ", "شكراً لك، سيراجع فريق الإدارة هذا المورد.");
    } catch (error) {
      Alert.alert(
        "تعذر إرسال البلاغ",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsReporting(false);
    }
  };

  const submitThanks = async () => {
    if (!material || material.id <= 0 || hasThanked || isThanking) return;
    setIsThanking(true);
    try {
      const deviceId = await getAnonymousDeviceId();
      const result = await recordMaterialThanks(material.id, {
        headers: { "X-Device-Id": deviceId },
      });
      setHasThanked(true);
      setThanksCount(result.thanksCount);
      const ids = await readThankedIds();
      if (!ids.includes(material.id)) {
        await AsyncStorage.setItem(
          THANKED_STORAGE_KEY,
          JSON.stringify([...ids, material.id]),
        );
      }
    } catch (error) {
      Alert.alert(
        "تعذر إرسال الشكر",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsThanking(false);
    }
  };

  const handleShare = async () => {
    if (!material) return;
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    const link = domain
      ? `https://${domain}/m/${material.id}`
      : `maraje3://material/${material.id}`;
    try {
      await Share.share({
        message: `شوف "${material.titleAr}" على مراجعي: ${link}`,
      });
    } catch {
      // Share sheet dismissal/cancellation — nothing to report.
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const isPremium = user?.isPremium ?? false;
      if (await nextDownloadNeedsRewardedAd(isPremium)) {
        const earned = await showRewardedAdForDownload();
        if (!earned) {
          Alert.alert(
            "محتاج مشاهدة إعلان",
            "وصلت لحد التنزيلات المجانية اليوم (3). شاهد إعلان مكافأة للتنزيل الرابع، أو افتح Premium لتنزيل غير محدود.",
          );
          return;
        }
      }
      await downloadMaterial(material);
      await recordDownloadForQuota();
      Alert.alert("اكتمل التنزيل", "أُضيف الملف إلى شاشة التنزيلات.");
    } catch (error) {
      Alert.alert(
        "تعذر التنزيل",
        error instanceof Error ? error.message : "تحقق من الاتصال وحاول مجدداً.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppScreen>
      <ScreenHeading title="تفاصيل المورد" back={() => router.back()} />
      <View style={styles.titleWrap}>
        <View style={styles.titleLine}>
          <Text style={styles.title}>{material.titleAr}</Text>
          {material.isDemo ? <DemoBadge /> : null}
        </View>
        <Text style={styles.englishTitle}>{material.titleEn}</Text>
        <View style={styles.category}>
          <Feather name="layers" size={14} color={c.accentForeground} />
          <Text style={styles.categoryText}>
            {CATEGORY_LABELS[material.category]}
          </Text>
        </View>
      </View>

      {material.isDemo ? (
        <InlineNotice
          icon="info"
          title="محتوى توضيحي"
          description="هذا سجل افتراضي لتجربة التطبيق، ولا يمثّل مادة أو امتحاناً جامعياً رسمياً."
        />
      ) : null}

      {uploaderSummary ? (
        <Pressable
          onPress={() =>
            router.push(
              `/contributor/${uploaderSummary.userId}` as `/contributor/${string}`,
            )
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.honorRow, pressed && styles.pressed]}
          testID="uploader-honor-line"
        >
          {uploaderSummary.photoUrl ? (
            <Image
              source={{ uri: uploaderSummary.photoUrl }}
              style={styles.honorAvatar}
            />
          ) : (
            <View style={[styles.honorAvatar, styles.honorAvatarFallback]}>
              <Feather name="user" size={16} color={c.accentForeground} />
            </View>
          )}
          <View style={styles.honorText}>
            <Text style={styles.honorName} numberOfLines={1}>
              رفعه: {uploaderSummary.displayName}
              {uploaderSummary.facultyNameAr
                ? ` · ${uploaderSummary.facultyNameAr}`
                : ""}
            </Text>
            {uploaderSummary.title ? (
              <Text style={styles.honorTitle}>{uploaderSummary.title}</Text>
            ) : null}
          </View>
          <Feather name="chevron-left" size={16} color={c.mutedForeground} />
        </Pressable>
      ) : null}

      <View style={styles.metadataCard}>
        <MetadataRow label="الجامعة" value={context.university?.nameAr} />
        <MetadataRow label="الكلية" value={context.faculty?.nameAr} />
        <MetadataRow label="الفرقة" value={context.academicYear?.labelAr} />
        <MetadataRow label="الفصل الدراسي" value={context.semester?.labelAr} />
        <MetadataRow label="المادة" value={context.subject?.nameAr} />
        <MetadataRow label="نوع الملف" value={material.fileFormat || "غير محدد"} />
        <MetadataRow
          label="حجم الملف"
          value={formatFileSize(material.fileSizeBytes) ?? "غير متاح"}
        />
        <MetadataRow
          label="المساهم"
          value={material.contributor ?? "غير محدد"}
        />
      </View>

      <View style={styles.description}>
        <Text style={styles.descriptionHeading}>عن هذا المورد</Text>
        <Text style={styles.descriptionText}>
          {material.descriptionAr || "لا يوجد وصف إضافي لهذا المورد."}
        </Text>
      </View>

      {material.documentUrl ? (
        <View style={styles.actions}>
          <PrimaryButton
            label="فتح المستند"
            icon="external-link"
            onPress={() => void handleOpen()}
            testID="open-material"
          />
          <PrimaryButton
            label={downloaded ? "تم التنزيل" : "تنزيل للاستخدام دون اتصال"}
            icon={downloaded ? "check" : "download"}
            onPress={() => void handleDownload()}
            loading={isDownloading}
            disabled={downloaded}
            variant="secondary"
            testID="download-material"
          />
        </View>
      ) : (
        <InlineNotice
          tone="warning"
          icon="file-minus"
          title="المستند غير متاح حالياً"
          description="لم يُرفق ملف PDF بهذا المورد. لن يظهر زر فتح أو تنزيل حتى يتوفر مستند فعلي."
        />
      )}

      <Pressable
        onPress={() => void toggleSaved(material.id)}
        accessibilityRole="button"
        style={styles.saveButton}
        testID="toggle-bookmark"
      >
        <Feather
          name={isSaved(material.id) ? "bookmark" : "bookmark"}
          size={18}
          color={c.accentForeground}
        />
        <Text style={styles.saveText}>
          {isSaved(material.id) ? "إزالة من المحفوظات" : "حفظ في المحفوظات"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => void handleShare()}
        accessibilityRole="button"
        style={styles.saveButton}
        testID="share-material"
      >
        <Feather name="share-2" size={18} color={c.accentForeground} />
        <Text style={styles.saveText}>مشاركة</Text>
      </Pressable>

      {!material.isDemo ? (
        <Pressable
          onPress={() => void submitThanks()}
          disabled={hasThanked || isThanking}
          accessibilityRole="button"
          style={[styles.saveButton, hasThanked && styles.thankedButton]}
          testID="thanks-button"
        >
          <Feather
            name="thumbs-up"
            size={18}
            color={hasThanked ? "#16a34a" : c.accentForeground}
          />
          <Text
            style={[styles.saveText, hasThanked && styles.thankedText]}
          >
            {hasThanked ? "شكرت هذا المورد" : "شكراً 👍"}
            {thanksCount > 0 ? ` (${thanksCount})` : ""}
          </Text>
        </Pressable>
      ) : null}

      {!material.isDemo ? (
        <Pressable
          onPress={() => setReportSheetVisible(true)}
          disabled={isReporting}
          accessibilityRole="button"
          style={styles.reportButton}
          testID="report-material"
        >
          <Feather name="flag" size={16} color={c.destructive} />
          <Text style={styles.reportText}>الإبلاغ عن هذا المورد</Text>
        </Pressable>
      ) : null}

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

function MetadataRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataValue}>{value || "غير متاح"}</Text>
      <Text style={styles.metadataLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleWrap: { gap: 6, alignItems: "flex-start", paddingVertical: 3 },
  titleLine: { alignSelf: "stretch", alignItems: "flex-start", gap: 8 },
  title: { color: c.foreground, fontFamily: font.bold, fontSize: 21, lineHeight: 32, textAlign: "right" },
  englishTitle: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12, textAlign: "right" },
  category: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: c.accent },
  categoryText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 11 },
  metadataCard: { paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  metadataRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  metadataLabel: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  metadataValue: { flex: 1, color: c.foreground, fontFamily: font.semibold, fontSize: 12, textAlign: "left" },
  description: { gap: 5, alignItems: "flex-start" },
  descriptionHeading: { color: c.foreground, fontFamily: font.bold, fontSize: 14 },
  descriptionText: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, lineHeight: 22, textAlign: "right" },
  actions: { gap: 9 },
  saveButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  saveText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 13 },
  reportButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  reportText: { color: c.destructive, fontFamily: font.medium, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { gap: 4, padding: 16, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: c.card },
  sheetTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 15, textAlign: "right", marginBottom: 6 },
  sheetOption: { minHeight: 46, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  sheetOptionText: { color: c.foreground, fontFamily: font.medium, fontSize: 14, textAlign: "right" },
  honorRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  honorAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: c.secondary },
  honorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  honorText: { flex: 1, alignItems: "flex-start", gap: 2 },
  honorName: { color: c.foreground, fontFamily: font.semibold, fontSize: 12, textAlign: "right" },
  honorTitle: { color: c.primary, fontFamily: font.bold, fontSize: 11, textAlign: "right" },
  thankedButton: { borderColor: "#16a34a", backgroundColor: "#16a34a1a" },
  thankedText: { color: "#16a34a" },
  pressed: { opacity: 0.85 },
});
