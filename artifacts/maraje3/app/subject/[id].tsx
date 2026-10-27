import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  MaterialCard,
  ScreenHeading,
  SectionHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { ListBannerAd } from "@/components/ad-banner";
import {
  categoriesInOrder,
  getSubjectContext,
} from "@/lib/catalog";
import { useLibrary } from "@/state/library-context";
import { CATEGORY_LABELS } from "@/types/catalog";

const c = uiColors;

export default function SubjectScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { catalog } = useLibrary();
  const subjectId = Number(id);
  const context = getSubjectContext(catalog, subjectId);
  const materials = catalog.materials.filter(
    (material) => material.subjectId === subjectId,
  );

  if (!context.subject) {
    return (
      <AppScreen>
        <ScreenHeading title="المادة" back={() => router.back()} />
        <EmptyState
          icon="alert-circle"
          title="المادة غير متاحة"
          description="قد يكون الكتالوج قد تغيّر منذ آخر مرة فتحت فيها هذه المادة."
          actionLabel="استكشف المكتبة"
          onAction={() => router.replace("/(tabs)/explore")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading
        title={context.subject.nameAr}
        subtitle={context.subject.nameEn}
        back={() => router.back()}
      />
      <View style={styles.contextCard}>
        <Text style={styles.pathText}>
          {[
            context.university?.nameAr,
            context.faculty?.nameAr,
            context.academicYear?.labelAr,
            context.semester?.labelAr,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
        {context.subject.code ? (
          <Text style={styles.codeText}>كود المادة: {context.subject.code}</Text>
        ) : null}
      </View>

      <Pressable
        style={styles.flashcardsButton}
        onPress={() =>
          router.push(`/flashcards/${subjectId}` as `/flashcards/${string}`)
        }
        testID="subject-flashcards-button"
      >
        <Feather name="layers" size={17} color={c.accentForeground} />
        <Text style={styles.flashcardsButtonText}>بطاقات المراجعة (Flashcards)</Text>
        <Feather name="chevron-left" size={16} color={c.mutedForeground} />
      </Pressable>

      {materials.length === 0 ? (
        <EmptyState
          icon="file"
          title="لا توجد مواد منشورة بعد"
          description="ستظهر هنا الملخصات والملاحظات ونماذج التدريب عندما يضيفها المسؤولون."
        />
      ) : (
        <View style={styles.resources}>
          {categoriesInOrder().map((category) => {
            const group = materials.filter(
              (material) => material.category === category,
            );
            if (group.length === 0) return null;
            return (
              <View key={category} style={styles.group}>
                <SectionHeading title={CATEGORY_LABELS[category]} />
                {group.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    onPress={() =>
                      router.push(
                        `/material/${material.id}` as `/material/${string}`,
                      )
                    }
                  />
                ))}
              </View>
            );
          })}
        </View>
      )}
      {materials.length > 0 ? <ListBannerAd /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  contextCard: { padding: 15, borderRadius: 17, backgroundColor: c.secondary, gap: 5 },
  pathText: { color: c.foreground, fontFamily: font.medium, fontSize: 12, lineHeight: 21, textAlign: "right" },
  codeText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 11, textAlign: "right" },
  resources: { gap: 17 },
  group: { gap: 8 },
  flashcardsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: c.secondary,
  },
  flashcardsButtonText: {
    flex: 1,
    color: c.foreground,
    fontFamily: font.semibold,
    fontSize: 13,
    textAlign: "right",
  },
});
