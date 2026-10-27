import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getGetMyUploadsQueryKey,
  useCreateTelegramLinkCode,
  useGetMyUploads,
  type PublicationStatus,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Switch, Text, View } from "react-native";
import {
  AppScreen,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import { CATEGORY_LABELS } from "@/types/catalog";
import { useAuth } from "@/state/auth-context";
import { useLibrary } from "@/state/library-context";

const c = uiColors;

const UPLOAD_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
};
const UPLOAD_STATUS_COLORS: Record<PublicationStatus, string> = {
  draft: c.mutedForeground,
  pending: c.accentForeground,
  published: "#16a34a",
  rejected: c.destructive,
};

const PREMIUM_NOTICE_DISMISSED_KEY = "maraje3.premium-notice-dismissed.v1";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    isAuthLoading,
    isSignInInProgress,
    isGoogleSignInReady,
    signInWithGoogle,
    signOut,
    updateHideIdentity,
    deleteAccount,
  } = useAuth();
  const { catalog } = useLibrary();
  const [error, setError] = useState<string | null>(null);
  const [isSavingHideIdentity, setIsSavingHideIdentity] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [premiumNoticeDismissed, setPremiumNoticeDismissed] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState<string | null>(null);
  const createTelegramLinkCodeMutation = useCreateTelegramLinkCode();
  const myUploadsQuery = useGetMyUploads({
    query: { queryKey: getGetMyUploadsQueryKey(), enabled: !!user },
  });

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(PREMIUM_NOTICE_DISMISSED_KEY).then((value) => {
      if (!cancelled) setPremiumNoticeDismissed(value === "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissPremiumNotice = () => {
    setPremiumNoticeDismissed(true);
    void AsyncStorage.setItem(PREMIUM_NOTICE_DISMISSED_KEY, "1");
  };

  const handleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر تسجيل الدخول بجوجل.",
      );
    }
  };

  const handleToggleHideIdentity = async (next: boolean) => {
    setError(null);
    setIsSavingHideIdentity(true);
    try {
      await updateHideIdentity(next);
    } catch {
      setError("تعذر حفظ هذا الخيار الآن. حاول مرة أخرى.");
    } finally {
      setIsSavingHideIdentity(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "حذف الحساب",
      "هيتم حذف حسابك وفك ربط اسمك من الملفات التي رفعتها. الملفات المنشورة تفضل متاحة بدون اسمك. لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الحساب",
          style: "destructive",
          onPress: () => void handleDeleteAccount(),
        },
      ],
    );
  };

  const handleGenerateTelegramCode = async () => {
    setError(null);
    try {
      const result = await createTelegramLinkCodeMutation.mutateAsync();
      setTelegramLinkCode(result.code);
    } catch {
      setError("تعذر إنشاء كود الربط الآن. حاول مرة أخرى.");
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      router.back();
    } catch {
      setError("تعذر حذف الحساب الآن. حاول مرة أخرى.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppScreen>
        <ScreenHeading title="حسابي" back={() => router.back()} />
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <AppScreen>
        <ScreenHeading
          title="حسابي"
          subtitle="اختياري — يلزم فقط عند الرفع أو طلب ملف"
          back={() => router.back()}
        />
        <InlineNotice
          icon="info"
          title="التصفح والتنزيل لا يحتاجان تسجيل دخول"
          description="سجّل الدخول بحساب جوجل فقط عند رفع ملف، طلب ملف، أو تعديل بروفايلك كمساهم."
        />
        {!isGoogleSignInReady ? (
          <InlineNotice
            tone="warning"
            icon="alert-triangle"
            title="تسجيل الدخول بجوجل غير مُجهّز بعد"
            description="يلزم ضبط معرّفات Google OAuth لهذا التطبيق أولاً."
          />
        ) : null}
        {error ? (
          <InlineNotice tone="warning" icon="alert-triangle" title={error} />
        ) : null}
        <PrimaryButton
          label="تسجيل الدخول بجوجل"
          icon="log-in"
          loading={isSignInInProgress}
          disabled={!isGoogleSignInReady || isSignInInProgress}
          onPress={() => void handleSignIn()}
          testID="google-sign-in"
        />
        <PrimaryButton
          label="عن التطبيق"
          icon="info"
          variant="secondary"
          onPress={() => router.push("/about")}
          testID="profile-about-button-signed-out"
        />
      </AppScreen>
    );
  }

  const faculty = catalog.faculties.find((item) => item.id === user.facultyId);
  const myUploads = myUploadsQuery.data?.materials ?? [];

  return (
    <AppScreen>
      <ScreenHeading title="حسابي" back={() => router.back()} />
      <View style={styles.identity}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Feather name="user" size={26} color={c.accentForeground} />
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.facultyName}>
            {faculty?.nameAr ?? "لم تُحدَّد الكلية بعد"}
          </Text>
        </View>
      </View>

      {user.premiumGranted && !premiumNoticeDismissed ? (
        <InlineNotice
          tone="success"
          icon="gift"
          title="فتحت Premium مجاناً 🎉"
          description="بفضل ملفاتك المنشورة وتنزيلاتها، حسابك فتح مزايا Premium مجاناً: بدون إعلانات وتنزيل غير محدود."
          onAction={dismissPremiumNotice}
          actionLabel="تم"
        />
      ) : null}

      {error ? (
        <InlineNotice tone="warning" icon="alert-triangle" title={error} />
      ) : null}

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>إخفاء هويتي في الملفات</Text>
          <Text style={styles.rowDescription}>
            إخفاء اسمي وصورتي من الملفات التي أرفعها مستقبلاً.
          </Text>
        </View>
        <Switch
          value={user.hideIdentity}
          onValueChange={(next) => void handleToggleHideIdentity(next)}
          disabled={isSavingHideIdentity}
          trackColor={{ true: c.primary, false: c.border }}
          testID="hide-identity-switch"
        />
      </View>

      <PrimaryButton
        label="رفع ملف جديد"
        icon="upload-cloud"
        onPress={() => router.push("/upload")}
        testID="profile-upload-button"
      />

      <PrimaryButton
        label={user.isPremium ? "Premium مفعّل ✓" : "افتح Premium"}
        icon="star"
        variant={user.isPremium ? "secondary" : "primary"}
        onPress={() => router.push("/premium")}
        testID="profile-premium-button"
      />

      <View style={styles.telegramSection}>
        <Text style={styles.uploadsHeading}>ربط بوت تليجرام</Text>
        <Text style={styles.rowDescription}>
          اربط حسابك ببوت مراجعي على تليجرام عشان أي ملف تبعته من هناك يتحسب
          باسمك وفي ألقابك.
        </Text>
        {telegramLinkCode ? (
          <View style={styles.telegramCodeBox}>
            <Text style={styles.telegramCode}>{telegramLinkCode}</Text>
            <Text style={styles.rowDescription}>
              ابعت "/ربط {telegramLinkCode}" للبوت خلال 15 دقيقة.
            </Text>
          </View>
        ) : (
          <PrimaryButton
            label="إنشاء كود الربط"
            icon="link"
            variant="secondary"
            loading={createTelegramLinkCodeMutation.isPending}
            onPress={() => void handleGenerateTelegramCode()}
            testID="generate-telegram-code"
          />
        )}
      </View>

      <View style={styles.uploadsSection}>
        <Text style={styles.uploadsHeading}>رفعاتي</Text>
        {myUploadsQuery.isLoading ? (
          <Text style={styles.rowDescription}>جارٍ تحميل رفعاتك...</Text>
        ) : myUploads.length === 0 ? (
          <Text style={styles.rowDescription}>لم ترفع أي ملفات بعد.</Text>
        ) : (
          myUploads.map((material) => (
            <View key={material.id} style={styles.uploadRow}>
              <View style={styles.rowText}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {material.titleAr}
                  </Text>
                  {material.fulfilledRequestId ? (
                    <View style={styles.fulfilledBadge}>
                      <Feather name="check-circle" size={10} color="#16a34a" />
                      <Text style={styles.fulfilledBadgeText}>لبّيت طلب</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.rowDescription}>
                  {CATEGORY_LABELS[material.category]}
                  {material.rejectionReason
                    ? ` · ${material.rejectionReason}`
                    : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.uploadStatus,
                  { color: UPLOAD_STATUS_COLORS[material.publicationStatus] },
                ]}
              >
                {UPLOAD_STATUS_LABELS[material.publicationStatus]}
              </Text>
            </View>
          ))
        )}
      </View>

      <PrimaryButton
        label="عن التطبيق"
        icon="info"
        variant="secondary"
        onPress={() => router.push("/about")}
        testID="profile-about-button"
      />

      <PrimaryButton
        label="تسجيل الخروج"
        icon="log-out"
        variant="secondary"
        onPress={() => void signOut()}
        testID="sign-out"
      />

      <PrimaryButton
        label="حذف حسابي"
        icon="trash-2"
        variant="destructive"
        loading={isDeleting}
        disabled={isDeleting}
        onPress={confirmDeleteAccount}
        testID="delete-account"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.secondary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, alignItems: "flex-start", gap: 2 },
  displayName: { color: c.foreground, fontFamily: font.bold, fontSize: 17, textAlign: "right" },
  facultyName: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, textAlign: "right" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  rowText: { flex: 1, alignItems: "flex-start", gap: 2 },
  rowTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 14, textAlign: "right" },
  rowDescription: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12, textAlign: "right" },
  uploadsSection: { gap: 8 },
  telegramSection: { gap: 8, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  telegramCodeBox: { alignItems: "center", gap: 4, paddingVertical: 10 },
  telegramCode: { color: c.primary, fontFamily: font.bold, fontSize: 28, letterSpacing: 4 },
  uploadsHeading: { color: c.foreground, fontFamily: font.bold, fontSize: 15, textAlign: "right" },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  uploadStatus: { fontFamily: font.bold, fontSize: 11 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  fulfilledBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: "#16a34a1a",
  },
  fulfilledBadgeText: { color: "#16a34a", fontFamily: font.bold, fontSize: 9 },
});
