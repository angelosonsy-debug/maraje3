import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  MaterialCard,
  ScreenHeading,
  uiColors,
} from "@/components/library-ui";
import { getMaterialContext } from "@/lib/catalog";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

export default function SavedScreen() {
  const router = useRouter();
  const { catalog, savedIds, toggleSaved } = useLibrary();
  const saved = savedIds
    .map((id) => catalog.materials.find((material) => material.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <AppScreen>
      <ScreenHeading
        title="المحفوظات"
        subtitle="المواد التي تريد الرجوع إليها"
      />
      {saved.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="لا توجد مواد محفوظة بعد"
          description="احفظ أي مادة من صفحة التفاصيل لتجدها هنا حتى بعد إغلاق التطبيق."
          actionLabel="استكشف المواد"
          onAction={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View style={styles.list}>
          {saved.map((material) => (
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
              trailing={
                <Pressable
                  onPress={() => void toggleSaved(material.id)}
                  accessibilityRole="button"
                  accessibilityLabel="إزالة من المحفوظات"
                  hitSlop={10}
                  style={styles.removeButton}
                  testID={`remove-saved-${material.id}`}
                >
                  <Feather name="bookmark" size={17} color={c.accentForeground} />
                </Pressable>
              }
            />
          ))}
          {savedIds.length > saved.length ? (
            <EmptyState
              icon="alert-circle"
              title="بعض المواد لم تعد متاحة"
              description="تغير الكتالوج منذ حفظ هذه العناصر. العناصر المتاحة فقط معروضة."
            />
          ) : null}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9 },
  removeButton: { padding: 4 },
});
