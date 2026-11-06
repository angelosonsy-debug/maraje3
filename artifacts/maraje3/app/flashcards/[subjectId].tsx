import { Feather } from "@expo/vector-icons";
import {
  getGetFlashcardDecksQueryKey,
  useGetFlashcardDecks,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  LoadingState,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { getSubjectContext } from "@/lib/catalog";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

export default function FlashcardDecksScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { catalog } = useLibrary();
  const { user } = useAuth();
  const id = Number(subjectId);
  const context = getSubjectContext(catalog, id);
  const decksQuery = useGetFlashcardDecks(
    { subjectId: id },
    {
      query: {
        queryKey: getGetFlashcardDecksQueryKey({ subjectId: id }),
        enabled: Number.isFinite(id),
      },
    },
  );

  const decks = decksQuery.data?.decks ?? [];

  return (
    <AppScreen>
      <ScreenHeading
        title="بطاقات المراجعة"
        subtitle={context.subject?.nameAr}
        back={() => router.back()}
      />

      {user ? (
        <Pressable
          style={styles.suggestButton}
          onPress={() => router.push(`/flashcards/new?subjectId=${id}` as `/flashcards/new`)}
          testID="suggest-flashcard-deck"
        >
          <Feather name="plus-circle" size={16} color={c.accentForeground} />
          <Text style={styles.suggestButtonText}>اقترح مجموعة بطاقات</Text>
        </Pressable>
      ) : null}

      {decksQuery.isLoading ? (
        <LoadingState label="جارٍ تحميل مجموعات البطاقات..." />
      ) : decks.length === 0 ? (
        <EmptyState
          icon="layers"
          title="لا توجد بطاقات مراجعة بعد"
          description="لسه مفيش مجموعات بطاقات منشورة لهذه المادة."
        />
      ) : (
        <View style={styles.list}>
          {decks.map((deck) => (
            <Pressable
              key={deck.id}
              style={styles.deckCard}
              onPress={() =>
                router.push(`/flashcards/deck/${deck.id}` as `/flashcards/deck/${string}`)
              }
              testID={`flashcard-deck-${deck.id}`}
            >
              <View style={styles.deckIcon}>
                <Feather name="layers" size={18} color={c.accentForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deckTitle}>{deck.titleAr}</Text>
                <Text style={styles.deckSubtitle}>{deck.cardCount} بطاقة</Text>
              </View>
              <Feather name="chevron-left" size={18} color={c.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  suggestButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  suggestButtonText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 13 },
  list: { gap: 10 },
  deckCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: c.secondary,
  },
  deckIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: c.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  deckTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 14, textAlign: "right" },
  deckSubtitle: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, textAlign: "right", marginTop: 2 },
});
