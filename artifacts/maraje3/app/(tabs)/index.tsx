import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppScreen,
  DemoBadge,
  InlineNotice,
  MaterialCard,
  SearchField,
  SectionHeading,
  SubjectCard,
  font,
  uiColors,
} from "@/components/library-ui";
import {
  getMaterialContext,
  getSubjectContext,
  materialMatchesFilters,
} from "@/lib/catalog";
import { daysUntil, examTypeLabel, readExams, type UpcomingExam } from "@/lib/exams";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

export default function HomeScreen() {
  const router = useRouter();
  const [nearestExam, setNearestExam] = useState<UpcomingExam | null>(null);

  useEffect(() => {
    void readExams().then((exams) => {
      const upcoming = exams
        .filter((exam) => daysUntil(exam.examDate) >= 0)
        .sort((a, b) => a.examDate.localeCompare(b.examDate));
      setNearestExam(upcoming[0] ?? null);
    });
  }, []);

  const {
    catalog,
    source,
    isOffline,
    isRefreshing,
    refreshCatalog,
    recentIds,
    savedIds,
    downloads,
    preference,
    isPreferenceLoaded,
  } = useLibrary();
  const { user } = useAuth();

  const recentlyViewed = recentIds
    .map((id) => catalog.materials.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const recentlyAdded = [...catalog.materials]
    .sort(
      (a, b) =>
        Date.parse(String(b.createdAt)) - Date.parse(String(a.createdAt)),
    )
    .slice(0, 4);
  const myMaterials = preference
    ? [...catalog.materials]
        .filter((item) =>
          materialMatchesFilters(catalog, item, {
            facultyId: preference.facultyId,
            academicYearId: preference.academicYearId,
            semesterId: preference.semesterId,
          }),
        )
        .sort(
          (a, b) =>
            Date.parse(String(b.createdAt)) - Date.parse(String(a.createdAt)),
        )
        .slice(0, 6)
    : [];

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refreshCatalog()}>
      <View style={styles.hero}>
        <Pressable
          onLongPress={() => router.push("/admin")}
          delayLongPress={5000}
          style={styles.logoTouchTarget}
          accessibilityLabel="شعار مراجع"
          accessibilityRole="button"
          testID="admin-secret-entry"
        >
          <Image
            source={require("@/assets/images/icon_2.png")}
            style={styles.appIcon}
            accessibilityLabel="شعار مراجع"
          />
        </Pressable>
        <View style={styles.welcome}>
          <Text style={styles.greeting}>أهلاً بك في مراجع</Text>
          <Text style={styles.tagline}>مكتبتك الأكاديمية، في مكان واحد</Text>
        </View>
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => router.push("/exams")}
            style={styles.settingsButton}
            accessibilityLabel="عداد الامتحانات"
            accessibilityRole="button"
            testID="home-exams-button"
          >
            <Feather name="calendar" size={18} color={c.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/requests")}
            style={styles.settingsButton}
            accessibilityLabel="لوحة مطلوب"
            accessibilityRole="button"
            testID="home-requests-button"
          >
            <Feather name="help-circle" size={18} color={c.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/leaderboard")}
            style={styles.settingsButton}
            accessibilityLabel="لوحة الشرف"
            accessibilityRole="button"
            testID="home-leaderboard-button"
          >
            <Feather name="award" size={18} color={c.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/upload")}
            style={styles.settingsButton}
            accessibilityLabel="رفع ملف"
            accessibilityRole="button"
            testID="home-upload-button"
          >
            <Feather name="upload-cloud" size={18} color={c.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/profile")}
            style={styles.settingsButton}
            accessibilityLabel={user ? "حسابي" : "تسجيل الدخول"}
            accessibilityRole="button"
            testID="home-account-button"
          >
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.accountAvatar} />
            ) : (
              <Feather
                name="user"
                size={18}
                color={user ? c.accentForeground : c.mutedForeground}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.settingsButton}
            accessibilityLabel="تغيير كليتي وفرقتي"
            accessibilityRole="button"
            testID="home-settings-button"
          >
            <Feather name="settings" size={18} color={c.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <SearchField
        value=""
        editable={false}
        onPress={() => router.push("/search")}
        placeholder="ابحث عن مادة أو موضوع"
      />

      {nearestExam ? (
        <Pressable
          onPress={() => router.push("/exams")}
          style={({ pressed }) => [styles.examCard, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="home-exam-countdown"
        >
          <View style={styles.examIcon}>
            <Feather name="calendar" size={18} color={c.accentForeground} />
          </View>
          <View style={styles.examText}>
            <Text style={styles.examTitle}>
              باقي {daysUntil(nearestExam.examDate)} يوم على امتحان{" "}
              {catalog.subjects.find((s) => s.id === nearestExam.subjectId)?.nameAr ??
                "مادتك"}
            </Text>
            <Text style={styles.examSubtitle}>
              {examTypeLabel(nearestExam.examType)} · {nearestExam.examDate}
            </Text>
          </View>
          <Feather name="chevron-left" size={16} color={c.mutedForeground} />
        </Pressable>
      ) : null}

      {isOffline ? (
        <InlineNotice
          tone="warning"
          icon="wifi-off"
          title={
            source === "cache"
              ? "أنت تعمل دون اتصال"
              : "تعذر الاتصال بالمكتبة المشتركة"
          }
          description={
            source === "cache"
              ? "نعرض آخر نسخة محفوظة على هذا الجهاز."
              : "نعرض محتوى توضيحياً على الجهاز حتى يعود الاتصال."
          }
          actionLabel="إعادة المحاولة"
          onAction={() => void refreshCatalog()}
        />
      ) : source === "demo" ? (
        <InlineNotice
          title="كتالوج توضيحي للتجربة"
          description="العناوين والمواد هنا أمثلة افتراضية، وليست ملفات أو امتحانات جامعية حقيقية."
          icon="info"
        />
      ) : catalog.materials.some((item) => item.isDemo) ? (
        <InlineNotice
          title="بعض العناصر تجريبية"
          description="تحقق من شارة «تجريبي» قبل استخدام أي عنصر؛ الملفات غير المتاحة لن تظهر كتنزيلات."
          icon="info"
        />
      ) : null}

      <View style={styles.quickStats}>
        <QuickLink
          icon="bookmark"
          label="المحفوظات"
          value={savedIds.length}
          onPress={() => router.push("/(tabs)/saved")}
        />
        <QuickLink
          icon="download"
          label="التنزيلات"
          value={downloads.length}
          onPress={() => router.push("/(tabs)/downloads")}
        />
      </View>

      {isPreferenceLoaded && preference && myMaterials.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading
            title="موادك"
            actionLabel="استكشف"
            onAction={() => router.push("/(tabs)/explore")}
          />
          <View style={styles.list}>
            {myMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                context={
                  getMaterialContext(catalog, material).subject?.nameAr ??
                  "مادة دراسية"
                }
                onPress={() =>
                  router.push(
                    `/material/${material.id}` as `/material/${string}`,
                  )
                }
              />
            ))}
          </View>
        </View>
      ) : isPreferenceLoaded && !preference ? (
        <InlineNotice
          icon="user"
          title="حدد كليتك وفرقتك لرؤية موادك مباشرة"
          description="هنرتب لك المواد والملفات حسب كليتك وفرقتك."
          actionLabel="تحديد الكلية"
          onAction={() => router.push("/onboarding")}
        />
      ) : null}

      {recentlyViewed.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading title="تابع من حيث توقفت" />
          {recentlyViewed.slice(0, 2).map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              context={
                getMaterialContext(catalog, material).subject?.nameAr ??
                "مادة دراسية"
              }
              onPress={() =>
                router.push(`/material/${material.id}` as `/material/${string}`)
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeading
          title="تصفح الجامعات"
          actionLabel="استكشف"
          onAction={() => router.push("/(tabs)/explore")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {catalog.universities.map((university) => (
            <Pressable
              key={university.id}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/explore",
                  params: { universityId: String(university.id) },
                })
              }
              style={({ pressed }) => [
                styles.universityCard,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.universityIcon}>
                <Feather name="map-pin" size={18} color={c.accentForeground} />
              </View>
              <Text style={styles.universityName}>{university.nameAr}</Text>
              <Text style={styles.universityCity}>{university.city}</Text>
              {university.isDemo ? <DemoBadge compact /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="مواد مقترحة"
          actionLabel="كل المواد"
          onAction={() => router.push("/(tabs)/explore")}
        />
        <View style={styles.list}>
          {catalog.subjects.slice(0, 3).map((subject) => {
            const context = getSubjectContext(catalog, subject.id);
            const resourceCount = catalog.materials.filter(
              (item) => item.subjectId === subject.id,
            ).length;
            return (
              <SubjectCard
                key={subject.id}
                title={subject.nameAr}
                subtitle={[
                  context.faculty?.nameAr,
                  context.academicYear?.labelAr,
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
      </View>

      <View style={styles.section}>
        <SectionHeading title="أضيفت مؤخراً" />
        <View style={styles.list}>
          {recentlyAdded.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              context={
                getMaterialContext(catalog, material).subject?.nameAr ??
                "مادة دراسية"
              }
              onPress={() =>
                router.push(`/material/${material.id}` as `/material/${string}`)
              }
            />
          ))}
        </View>
      </View>

    </AppScreen>
  );
}

function QuickLink({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.quickIcon}>
        <Feather name={icon} size={18} color={c.accentForeground} />
      </View>
      <View style={styles.quickText}>
        <Text style={styles.quickValue}>{value}</Text>
        <Text style={styles.quickLabel}>{label}</Text>
      </View>
      <Feather name="chevron-left" size={15} color={c.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  examCard: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 58, paddingHorizontal: 13, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  examIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.accent },
  examText: { flex: 1, alignItems: "flex-start", gap: 2 },
  examTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  examSubtitle: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11, textAlign: "right" },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 3 },
  logoTouchTarget: { borderRadius: 18 },
  appIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.primary },
  welcome: { flex: 1, alignItems: "flex-start", gap: 2 },
  heroActions: { flexDirection: "row", gap: 8 },
  accountAvatar: { width: 38, height: 38, borderRadius: 13 },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  greeting: { color: c.foreground, fontFamily: font.bold, fontSize: 21, textAlign: "right" },
  tagline: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, textAlign: "right" },
  quickStats: { flexDirection: "row", gap: 10 },
  quickLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 68, paddingHorizontal: 11, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.secondary },
  quickText: { flex: 1, alignItems: "flex-start" },
  quickValue: { color: c.foreground, fontFamily: font.bold, fontSize: 15 },
  quickLabel: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 10 },
  section: { gap: 8 },
  horizontalList: { gap: 9, paddingVertical: 2 },
  universityCard: { width: 152, minHeight: 142, padding: 13, gap: 7, alignItems: "flex-start", borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  universityIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.secondary, alignItems: "center", justifyContent: "center" },
  universityName: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  universityCity: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11 },
  list: { gap: 8 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
