import { Feather } from "@expo/vector-icons";
import {
  getGetLeaderboardQueryKey,
  useGetLeaderboard,
  type LeaderboardScope,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  FilterPicker,
  LoadingState,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

const SCOPE_OPTIONS: Array<{ id: LeaderboardScope; label: string }> = [
  { id: "semester", label: "الفصل الحالي" },
  { id: "all-time", label: "كل الأوقات" },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { catalog } = useLibrary();
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<number | undefined>(
    user?.facultyId ?? catalog.faculties.find((f) => !f.isDemo)?.id,
  );
  const [scope, setScope] = useState<LeaderboardScope>("semester");

  const facultyOptions = useMemo(
    () => catalog.faculties.map((f) => ({ id: f.id, label: f.nameAr })),
    [catalog.faculties],
  );

  const query = useGetLeaderboard(
    { facultyId: facultyId ?? 0, scope },
    {
      query: {
        queryKey: getGetLeaderboardQueryKey({ facultyId: facultyId ?? 0, scope }),
        enabled: !!facultyId,
      },
    },
  );
  const entries = query.data?.entries ?? [];

  return (
    <AppScreen>
      <ScreenHeading
        title="لوحة الشرف"
        subtitle="أعلى المساهمين تنزيلاً لكل كلية"
        back={() => router.back()}
      />

      <View style={styles.filters}>
        <FilterPicker
          label="الكلية"
          value={facultyId}
          options={facultyOptions}
          onChange={(value) => setFacultyId(value as number | undefined)}
          allowAll={false}
        />
      </View>

      <View style={styles.scopeTabs}>
        {SCOPE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setScope(option.id)}
            style={[
              styles.scopeTab,
              scope === option.id && styles.scopeTabActive,
            ]}
          >
            <Text
              style={[
                styles.scopeTabText,
                scope === option.id && styles.scopeTabTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!facultyId ? (
        <EmptyState
          icon="users"
          title="اختر كلية"
          description="اختر كلية لعرض أعلى المساهمين فيها."
        />
      ) : query.isLoading ? (
        <LoadingState label="جارٍ تحميل لوحة الشرف..." />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="award"
          title="لا يوجد مساهمون بعد"
          description="لما يبدأ طلبة الكلية دي في الرفع والتنزيل، هيظهروا هنا."
        />
      ) : (
        <View style={styles.list}>
          {entries.map((entry, index) => (
            <Pressable
              key={entry.userId}
              onPress={() =>
                router.push(
                  `/contributor/${entry.userId}` as `/contributor/${string}`,
                )
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              {entry.photoUrl ? (
                <Image source={{ uri: entry.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Feather name="user" size={16} color={c.accentForeground} />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {entry.displayName}
                </Text>
                {entry.title ? (
                  <Text style={styles.title}>{entry.title}</Text>
                ) : null}
              </View>
              <View style={styles.downloadsBadge}>
                <Feather name="download" size={12} color={c.accentForeground} />
                <Text style={styles.downloadsText}>{entry.downloads}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  scopeTabs: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 14, backgroundColor: c.secondary },
  scopeTab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  scopeTabActive: { backgroundColor: c.card },
  scopeTabText: { color: c.mutedForeground, fontFamily: font.semibold, fontSize: 13 },
  scopeTabTextActive: { color: c.foreground },
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  rank: { width: 22, textAlign: "center", color: c.mutedForeground, fontFamily: font.bold, fontSize: 14 },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: c.secondary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, alignItems: "flex-start", gap: 2 },
  name: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  title: { color: c.primary, fontFamily: font.bold, fontSize: 11, textAlign: "right" },
  downloadsBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: c.accent },
  downloadsText: { color: c.accentForeground, fontFamily: font.bold, fontSize: 11 },
  pressed: { opacity: 0.85 },
});
