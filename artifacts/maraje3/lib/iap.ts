import { Platform } from "react-native";
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getProducts,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type Purchase,
  type PurchaseError,
} from "react-native-iap";

// Stage 7-C Premium (one-time, non-consumable). This wrapper is
// code-complete and typechecks, but react-native-iap needs a real native
// build (it does nothing useful in Expo Go) and this sandbox has no
// development client, no AdMob/Play Store test device, and no real Google
// product configured — so none of this has actually been exercised end to
// end. Treat it as written, not verified.

export const PREMIUM_PRODUCT_ID =
  process.env.EXPO_PUBLIC_PREMIUM_PRODUCT_ID ?? "maraje3_premium_lifetime";

export type PurchaseResult = {
  purchase: Purchase;
  purchaseToken: string;
};

let connected = false;

export async function ensureIapConnection(): Promise<boolean> {
  if (connected) return true;
  try {
    connected = await initConnection();
    return connected;
  } catch {
    return false;
  }
}

export async function closeIapConnection(): Promise<void> {
  if (!connected) return;
  try {
    await endConnection();
  } finally {
    connected = false;
  }
}

export async function fetchPremiumProduct(): Promise<Product | null> {
  const ok = await ensureIapConnection();
  if (!ok) return null;
  const products = await getProducts({ skus: [PREMIUM_PRODUCT_ID] });
  return products[0] ?? null;
}

/**
 * Starts the native purchase sheet. The result arrives asynchronously via
 * `purchaseUpdatedListener` (see `subscribeToPurchaseUpdates` below), not as
 * this call's return value — react-native-iap's requestPurchase resolves
 * early on some platforms/versions.
 */
export async function startPremiumPurchase(): Promise<void> {
  const ok = await ensureIapConnection();
  if (!ok) throw new Error("تعذر الاتصال بمتجر التطبيقات.");
  if (Platform.OS === "ios") {
    await requestPurchase({ sku: PREMIUM_PRODUCT_ID });
  } else {
    await requestPurchase({ skus: [PREMIUM_PRODUCT_ID] });
  }
}

export function subscribeToPurchaseUpdates(
  onPurchase: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void,
) {
  const updateSub = purchaseUpdatedListener(onPurchase);
  const errorSub = purchaseErrorListener(onError);
  return () => {
    updateSub.remove();
    errorSub.remove();
  };
}

/** Acknowledges/finishes a purchase locally with the store after the server has verified it. */
export async function acknowledgePurchase(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/** Restore purchases — Android-only server verification (see routes/premium.ts); iOS restore is store-level only. */
export async function fetchExistingPurchases(): Promise<Purchase[]> {
  const ok = await ensureIapConnection();
  if (!ok) return [];
  return getAvailablePurchases();
}

export function purchaseTokenOf(purchase: Purchase): string | null {
  return purchase.purchaseToken ?? purchase.transactionId ?? null;
}
