import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { useLibrary } from "@/state/library-context";
import type { DownloadRecord } from "@/types/catalog";

const c = uiColors;

export default function DownloadsScreen() {
  const router = useRouter();
  const { downloads, openDownloaded, removeDownload } = useLibrary();

  const handleOpen = async (record: DownloadRecord) => {
    try {
      await openDownloaded(record);
    } catch (error) {
      Alert.alert(
        "تعذر فتح الملف",
        error instanceof Error ? error.message : "حاول تنزيله مرة أخرى.",
      );
    }
  };

  const handleRemove = (record: DownloadRecord) => {
    Alert.alert("حذف التنزيل", "سيُحذف الملف من هذا الجهاز.", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => void removeDownload(record),
      },
    ]);
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="التنزيلات"
        subtitle="ملفات PDF المتاحة دون اتصال"
      />
      {downloads.length === 0 ? (
        <EmptyState
          icon="download"
          title="لا توجد تنزيلات بعد"
          description="تظهر الملفات هنا بعد تنزيل مستند حقيقي من صفحة المادة. لن يظهر زر تنزيل للمستندات غير المتاحة."
          actionLabel="استكشف المواد"
          onAction={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View style={styles.list}>
          {downloads.map((record) => (
            <View key={record.materialId} style={styles.downloadCard}>
              <View style={styles.fileIcon}>
                <Feather name="file-text" size={20} color={c.accentForeground} />
              </View>
              <View style={styles.fileBody}>
                <Text style={styles.fileTitle} numberOfLines={2}>
                  {record.titleAr}
                </Text>
                <Text style={styles.fileMeta}>PDF · محفوظ على هذا الجهاز</Text>
                <Text style={styles.fileDate}>
                  {new Date(record.downloadedAt).toLocaleDateString("ar-EG")}
                </Text>
              </View>
              <Pressable
                onPress={() => void handleOpen(record)}
                accessibilityRole="button"
                accessibilityLabel="فتح الملف المحفوظ"
                style={styles.iconAction}
                testID={`open-download-${record.materialId}`}
              >
                <Feather name="external-link" size={18} color={c.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleRemove(record)}
                accessibilityRole="button"
                accessibilityLabel="حذف الملف المحفوظ"
                style={styles.iconAction}
                testID={`delete-download-${record.materialId}`}
              >
                <Feather name="trash-2" size={17} color={c.destructive} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9 },
  downloadCard: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  fileIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: c.secondary, alignItems: "center", justifyContent: "center" },
  fileBody: { flex: 1, alignItems: "flex-start", gap: 2 },
  fileTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  fileMeta: { color: c.accentForeground, fontFamily: font.medium, fontSize: 10 },
  fileDate: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 10 },
  iconAction: { width: 31, height: 38, alignItems: "center", justifyContent: "center" },
});
