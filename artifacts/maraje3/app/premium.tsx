import { Feather } from "@expo/vector-icons";
import { useVerifyPremiumPurchase } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { Product, Purchase, PurchaseError } from "react-native-iap";
import {
  AppScreen,
  InlineNotice,
  PrimaryButton,
  ScreenHeading,
  font,
  uiColors,
} from "@/components/library-ui";
import {
  acknowledgePurchase,
  fetchExistingPurchases,
  fetchPremiumProduct,
  purchaseTokenOf,
  startPremiumPurchase,
  subscribeToPurchaseUpdates,
  PREMIUM_PRODUCT_ID,
} from "@/lib/iap";
import { useAuth } from "@/state/auth-context";

const c = uiColors;

const BENEFITS = [
  { icon: "slash" as const, label: "بدون إعلانات نهائياً" },
  { icon: "download" as const, label: "تنزيل غير محدود يومياً" },
  { icon: "zap" as const, label: "دفعة واحدة فقط — بدون اشتراك متكرر" },
];

export default function PremiumScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const verifyMutation = useVerifyPremiumPurchase();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const isPremium = user?.isPremium ?? false;

  useEffect(() => {
    let active = true;
    fetchPremiumProduct()
      .then((p) => {
        if (active) setProduct(p);
      })
      .finally(() => {
        if (active) setIsLoadingProduct(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const verifyAndFinish = async (purchase: Purchase) => {
      const token = purchaseTokenOf(purchase);
      if (!token) return;
      try {
        await verifyMutation.mutateAsync({
          data: { purchaseToken: token, productId: PREMIUM_PRODUCT_ID },
        });
        await acknowledgePurchase(purchase);
        await refreshUser();
        setIsPurchasing(false);
        Alert.alert("تم فتح Premium 🎉", "بدون إعلانات وتنزيل غير محدود من الآن.");
      } catch {
        setIsPurchasing(false);
        Alert.alert(
          "تعذر تأكيد عملية الشراء",
          "تواصل الدعم لو خُصم المبلغ ولم يتفعّل Premium.",
        );
      }
    };

    const onError = (error: PurchaseError) => {
      setIsPurchasing(false);
      if (error.code !== "E_USER_CANCELLED") {
        Alert.alert("تعذرت عملية الشراء", error.message);
      }
    };

    const unsubscribe = subscribeToPurchaseUpdates(
      (purchase) => void verifyAndFinish(purchase),
      onError,
    );
    return unsubscribe;
  }, [refreshUser, verifyMutation]);

  const purchase = async () => {
    setIsPurchasing(true);
    try {
      await startPremiumPurchase();
      // Resolution continues in the purchaseUpdatedListener above.
    } catch (error) {
      setIsPurchasing(false);
      Alert.alert(
        "تعذر بدء عملية الشراء",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    }
  };

  const restore = async () => {
    setIsPurchasing(true);
    try {
      const purchases = await fetchExistingPurchases();
      const match = purchases.find((p) => p.productId === PREMIUM_PRODUCT_ID);
      if (!match) {
        Alert.alert("لا توجد مشتريات سابقة", "لم نجد عملية شراء Premium مرتبطة بهذا الحساب.");
        return;
      }
      const token = purchaseTokenOf(match);
      if (!token) throw new Error("تعذر قراءة بيانات الشراء.");
      await verifyMutation.mutateAsync({
        data: { purchaseToken: token, productId: PREMIUM_PRODUCT_ID },
      });
      await refreshUser();
      Alert.alert("تم استعادة Premium ✅");
    } catch (error) {
      Alert.alert(
        "تعذرت الاستعادة",
        error instanceof Error ? error.message : "حاول مرة أخرى لاحقاً.",
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="مراجعي Premium"
        subtitle="دفعة واحدة، بدون اشتراك متكرر"
        back={() => router.back()}
      />

      {isPremium ? (
        <InlineNotice
          icon="star"
          title="Premium مفعّل بالفعل"
          description={
            user?.premiumGranted
              ? "فتحته مجاناً لمساهماتك في المكتبة 🎉"
              : "استمتع بدون إعلانات وبتنزيل غير محدود."
          }
        />
      ) : (
        <>
          <View style={styles.benefitsCard}>
            {BENEFITS.map((b) => (
              <View key={b.label} style={styles.benefitRow}>
                <Feather name={b.icon} size={16} color={c.accentForeground} />
                <Text style={styles.benefitText}>{b.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>السعر</Text>
            <Text style={styles.priceValue}>
              {isLoadingProduct
                ? "جارٍ التحميل..."
                : product?.localizedPrice ?? product?.price ?? "غير متاح الآن"}
            </Text>
          </View>

          <PrimaryButton
            label="فتح Premium الآن"
            icon="star"
            loading={isPurchasing}
            onPress={() => void purchase()}
            testID="purchase-premium"
          />
          <PrimaryButton
            label="استعادة المشتريات"
            variant="secondary"
            icon="refresh-cw"
            loading={isPurchasing}
            onPress={() => void restore()}
            testID="restore-premium"
          />

          <InlineNotice
            title="ملاحظة"
            description="الشراء يحتاج بناءً أصلياً للتطبيق (غير متاح من Expo Go)."
          />
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  benefitsCard: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: c.secondary },
  benefitRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  benefitText: { color: c.foreground, fontFamily: font.medium, fontSize: 13, textAlign: "right" },
  priceCard: { alignItems: "center", gap: 4, padding: 20, borderRadius: 18, backgroundColor: c.secondary },
  priceLabel: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  priceValue: { color: c.foreground, fontFamily: font.semibold, fontSize: 22 },
});
