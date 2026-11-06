import {
  getGetRequestsQueryKey,
  useCreateRequest,
  type ApiError,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import {
  AppScreen,
  FilterPicker,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  TextEntry,
} from "@/components/library-ui";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

export default function NewRequestScreen() {
  const router = useRouter();
  const { catalog } = useLibrary();
  const { user, isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const createMutation = useCreateRequest();

  const [facultyId, setFacultyId] = useState<number | undefined>(
    user?.facultyId ?? undefined,
  );
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [titleAr, setTitleAr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const facultyOptions = catalog.faculties.map((f) => ({
    id: f.id,
    label: f.nameAr,
  }));
  const subjectOptions = catalog.subjects
    .filter((s) => {
      if (facultyId === undefined) return true;
      const semester = catalog.semesters.find((sem) => sem.id === s.semesterId);
      const year = catalog.academicYears.find(
        (y) => y.id === semester?.academicYearId,
      );
      return year?.facultyId === facultyId;
    })
    .map((s) => ({ id: s.id, label: s.nameAr }));

  const submit = async () => {
    if (!facultyId) {
      Alert.alert("اختر الكلية", "حدد الكلية المرتبطة بالملف المطلوب.");
      return;
    }
    if (titleAr.trim().length < 3) {
      Alert.alert("اكتب وصفاً أوضح", "وصف الطلب يجب أن يكون 3 أحرف على الأقل.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        data: {
          facultyId,
          subjectId: subjectId ?? undefined,
          titleAr: titleAr.trim(),
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetRequestsQueryKey({ facultyId, subjectId }),
      });
      Alert.alert("تم إرسال طلبك", "هيظهر طلبك في لوحة مطلوب الآن.", [
        { text: "حسناً", onPress: () => router.back() },
      ]);
    } catch (error) {
      const apiError = error as Partial<ApiError>;
      if (apiError?.status === 429) {
        Alert.alert(
          "تجاوزت الحد اليومي",
          "يمكنك إرسال 3 طلبات كحد أقصى يومياً. حاول غداً.",
        );
      } else {
        Alert.alert(
          "تعذر إرسال الطلب",
          error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppScreen>
        <ScreenHeading title="طلب ملف" back={() => router.back()} />
        <InlineNotice title="جارٍ التحقق من تسجيل الدخول..." />
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <AppScreen>
        <ScreenHeading title="طلب ملف" back={() => router.back()} />
        <InlineNotice
          icon="lock"
          title="سجّل الدخول أولاً"
          description="طلب ملف يحتاج تسجيل الدخول لمنع الطلبات الوهمية (حد 3 طلبات في اليوم)."
          actionLabel="الذهاب لتسجيل الدخول"
          onAction={() => router.push("/profile")}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeading
        title="اطلب ملفاً"
        subtitle="اطلب ملخصاً أو امتحاناً غير متوفر في المكتبة بعد"
        back={() => router.back()}
      />

      <InlineNotice
        title="حد 3 طلبات في اليوم"
        description="يمكنك إرسال 3 طلبات كحد أقصى يومياً لتجنّب الإزعاج."
      />

      <FilterPicker
        label="الكلية"
        value={facultyId}
        options={facultyOptions}
        allowAll={false}
        onChange={(value) => {
          setFacultyId(value as number | undefined);
          setSubjectId(undefined);
        }}
      />
      <FilterPicker
        label="المادة (اختياري)"
        value={subjectId}
        options={subjectOptions}
        onChange={(value) => setSubjectId(value as number | undefined)}
      />
      <TextEntry
        label="وصف الملف المطلوب"
        value={titleAr}
        onChangeText={setTitleAr}
        placeholder="مثال: ملخص الفصل الثالث لمادة التشريح"
        multiline
      />

      <PrimaryButton
        label="إرسال الطلب"
        icon="send"
        loading={isSubmitting}
        onPress={() => void submit()}
        testID="submit-new-request"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({});
