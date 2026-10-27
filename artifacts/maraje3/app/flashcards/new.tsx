import { useSuggestFlashcardDeck, type ApiError } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import {
  AppScreen,
  FilterPicker,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  TextEntry,
  font,
  uiColors,
} from "@/components/library-ui";
import { parseFlashcardPaste } from "@/lib/flashcard-paste";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

export default function SuggestFlashcardDeckScreen() {
  const router = useRouter();
  const { subjectId: subjectIdParam } = useLocalSearchParams<{ subjectId?: string }>();
  const { catalog } = useLibrary();
  const { user, isAuthLoading } = useAuth();
  const suggestMutation = useSuggestFlashcardDeck();

  const [subjectId, setSubjectId] = useState<number | undefined>(
    subjectIdParam ? Number(subjectIdParam) : undefined,
  );
  const [titleAr, setTitleAr] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjectOptions = useMemo(
    () => catalog.subjects.map((s) => ({ id: s.id, label: s.nameAr })),
    [catalog.subjects],
  );

  const parsed = useMemo(() => parseFlashcardPaste(pasteText), [pasteText]);

  const submit = async () => {
    if (!subjectId) {
      Alert.alert("اختر المادة", "حدد المادة المرتبطة بالبطاقات.");
      return;
    }
    if (titleAr.trim().length < 3) {
      Alert.alert("اكتب عنواناً أوضح", "عنوان المجموعة يجب أن يكون 3 أحرف على الأقل.");
      return;
    }
    if (parsed.cards.length === 0) {
      Alert.alert(
        "لا توجد بطاقات صالحة",
        "اكتب سطراً لكل بطاقة بصيغة: السؤال | الإجابة",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await suggestMutation.mutateAsync({
        data: { subjectId, titleAr: titleAr.trim(), cards: parsed.cards },
      });
      Alert.alert(
        "تم إرسال المجموعة",
        "هتظهر البطاقات بعد مراجعة الأدمن لها.",
        [{ text: "حسناً", onPress: () => router.back() }],
      );
    } catch (error) {
      const apiError = error as Partial<ApiError>;
      Alert.alert(
        "تعذر إرسال المجموعة",
        apiError?.message ?? "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppScreen>
        <ScreenHeading title="اقترح بطاقات مراجعة" back={() => router.back()} />
        <InlineNotice title="جارٍ التحقق من تسجيل الدخول..." />
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <AppScreen>
        <ScreenHeading title="اقترح بطاقات مراجعة" back={() => router.back()} />
        <InlineNotice
          icon="lock"
          title="سجّل الدخول أولاً"
          description="اقتراح مجموعة بطاقات يحتاج تسجيل الدخول حتى تُنسب لك."
          actionLabel="الذهاب لتسجيل الدخول"
          onAction={() => router.push("/profile")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading
        title="اقترح بطاقات مراجعة"
        subtitle="هتتراجع من الأدمن قبل ما تظهر للطلاب"
        back={() => router.back()}
      />

      <FilterPicker
        label="المادة"
        value={subjectId}
        options={subjectOptions}
        allowAll={false}
        onChange={(value) => setSubjectId(value as number | undefined)}
      />
      <TextEntry
        label="عنوان المجموعة"
        value={titleAr}
        onChangeText={setTitleAr}
        placeholder="مثال: مصطلحات الفصل الأول"
      />
      <TextEntry
        label="البطاقات (سطر لكل بطاقة: السؤال | الإجابة)"
        value={pasteText}
        onChangeText={setPasteText}
        placeholder={"ما هو...؟ | الإجابة هنا\nسؤال تاني؟ | إجابة تانية"}
        multiline
        style={styles.pasteInput}
      />
      <Text style={styles.hint}>
        {parsed.cards.length > 0
          ? `${parsed.cards.length} بطاقة جاهزة${parsed.skippedLines > 0 ? ` (تم تجاهل ${parsed.skippedLines} سطر غير صالح)` : ""}`
          : "اكتب كل بطاقة في سطر مستقل بصيغة: السؤال | الإجابة"}
      </Text>

      <PrimaryButton
        label="إرسال للمراجعة"
        icon="send"
        loading={isSubmitting}
        onPress={() => void submit()}
        testID="submit-flashcard-deck"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pasteInput: { minHeight: 140, textAlignVertical: "top" },
  hint: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, textAlign: "right" },
});
