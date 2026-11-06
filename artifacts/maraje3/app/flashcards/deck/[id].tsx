import { Feather } from "@expo/vector-icons";
import {
  getGetFlashcardDeckQueryKey,
  useGetFlashcardDeck,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  LoadingState,
  PrimaryButton,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import {
  getDeckProgress,
  recordSessionCompleted,
  setCardKnown,
  type CardKnownState,
} from "@/lib/flashcard-progress";
import type { Flashcard } from "@/types/catalog";

const c = uiColors;

export default function FlashcardDeckReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const deckQuery = useGetFlashcardDeck(deckId, {
    query: {
      queryKey: getGetFlashcardDeckQueryKey(deckId),
      enabled: Number.isFinite(deckId),
    },
  });

  const [progress, setProgress] = useState<Record<number, CardKnownState>>({});
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(deckId)) return;
    getDeckProgress(deckId).then((p) => {
      setProgress(p);
      setProgressLoaded(true);
    });
  }, [deckId]);

  const allCards = deckQuery.data?.cards ?? [];
  const cards: Flashcard[] = useMemo(() => {
    if (!unknownOnly) return allCards;
    return allCards.filter((card) => progress[card.id] !== "known");
  }, [allCards, unknownOnly, progress]);

  const currentCard = cards[index];
  const knownCount = allCards.filter((card) => progress[card.id] === "known").length;

  const handleAnswer = async (state: CardKnownState) => {
    if (!currentCard) return;
    const next = { ...progress, [currentCard.id]: state };
    setProgress(next);
    await setCardKnown(deckId, currentCard.id, state);
    setFlipped(false);
    if (index + 1 >= cards.length) {
      setSessionDone(true);
      await recordSessionCompleted();
    } else {
      setIndex(index + 1);
    }
  };

  const restartUnknownOnly = () => {
    setUnknownOnly(true);
    setIndex(0);
    setFlipped(false);
    setSessionDone(false);
  };

  const restartAll = () => {
    setUnknownOnly(false);
    setIndex(0);
    setFlipped(false);
    setSessionDone(false);
  };

  if (deckQuery.isLoading || !progressLoaded) {
    return (
      <AppScreen>
        <ScreenHeading title="مراجعة البطاقات" back={() => router.back()} />
        <LoadingState label="جارٍ تحميل البطاقات..." />
      </AppScreen>
    );
  }

  if (!deckQuery.data || allCards.length === 0) {
    return (
      <AppScreen>
        <ScreenHeading title="مراجعة البطاقات" back={() => router.back()} />
        <EmptyState
          icon="layers"
          title="المجموعة غير متاحة"
          description="قد تكون هذه المجموعة حُذفت أو لم تعد منشورة."
        />
      </AppScreen>
    );
  }

  const remainingUnknown = allCards.length - knownCount;

  if (sessionDone || cards.length === 0) {
    return (
      <AppScreen>
        <ScreenHeading title={deckQuery.data.titleAr} back={() => router.back()} />
        <View style={styles.summaryCard}>
          <Feather name="check-circle" size={28} color={c.accentForeground} />
          <Text style={styles.summaryTitle}>خلصت المراجعة! 🎉</Text>
          <Text style={styles.summaryText}>
            عرفت {knownCount} من {allCards.length} بطاقة
          </Text>
        </View>
        {remainingUnknown > 0 ? (
          <PrimaryButton
            label={`راجع اللي ما عرفتهوش (${remainingUnknown})`}
            icon="refresh-cw"
            onPress={restartUnknownOnly}
            testID="review-unknown-only"
          />
        ) : null}
        <PrimaryButton
          label="راجع من الأول"
          variant="secondary"
          icon="rotate-ccw"
          onPress={restartAll}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading
        title={deckQuery.data.titleAr}
        subtitle={`بطاقة ${index + 1} من ${cards.length}`}
        back={() => router.back()}
      />

      <Pressable
        style={styles.flipCard}
        onPress={() => setFlipped((f) => !f)}
        testID="flashcard-flip"
      >
        <Text style={styles.cardLabel}>{flipped ? "الإجابة" : "السؤال"}</Text>
        <Text style={styles.cardText}>
          {flipped ? currentCard?.answerAr : currentCard?.questionAr}
        </Text>
        {flipped && currentCard?.explanationAr ? (
          <Text style={styles.explanationText}>{currentCard.explanationAr}</Text>
        ) : null}
        {!flipped ? (
          <View style={styles.flipHint}>
            <Feather name="rotate-cw" size={13} color={c.mutedForeground} />
            <Text style={styles.flipHintText}>اضغط لعرض الإجابة</Text>
          </View>
        ) : null}
      </Pressable>

      {flipped ? (
        <View style={styles.answerRow}>
          <PrimaryButton
            label="لسه"
            variant="destructive"
            icon="x"
            onPress={() => handleAnswer("unknown")}
            testID="flashcard-unknown"
          />
          <PrimaryButton
            label="عرفتها"
            icon="check"
            onPress={() => handleAnswer("known")}
            testID="flashcard-known"
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flipCard: {
    minHeight: 220,
    borderRadius: 20,
    backgroundColor: c.secondary,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  cardLabel: {
    color: c.accentForeground,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  cardText: {
    color: c.foreground,
    fontFamily: font.semibold,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
  },
  explanationText: {
    color: c.mutedForeground,
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  flipHint: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 8 },
  flipHintText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  answerRow: { flexDirection: "row-reverse", gap: 10 },
  summaryCard: {
    alignItems: "center",
    gap: 8,
    padding: 28,
    borderRadius: 20,
    backgroundColor: c.secondary,
  },
  summaryTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 17 },
  summaryText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 14 },
});
