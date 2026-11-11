import { Platform } from "react-native";
import {
  AdEventType,
  AdsConsent,
  AdsConsentStatus,
  MobileAds,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

// Stage 7-B AdMob. Needs a custom development build (react-native-google-mobile-ads
// is a native module — it does nothing in Expo Go) and this sandbox has
// neither a dev client nor a real AdMob account, so none of this has been
// exercised on a device. Code-complete and typechecked, not verified.

function readUnitId(
  envVarAndroid: string | undefined,
  envVarIos: string | undefined,
  testId: string,
): string {
  // Always serve Google's test ad unit in development, per Stage 7's
  // "IDs من env/config مع test IDs in development" requirement.
  if (__DEV__) return testId;
  const fromEnv = Platform.select({ android: envVarAndroid, ios: envVarIos });
  return fromEnv || testId;
}

export const BANNER_UNIT_ID = readUnitId(
  process.env["EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID"],
  process.env["EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS"],
  TestIds.BANNER,
);

export const REWARDED_UNIT_ID = readUnitId(
  process.env["EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_ANDROID"],
  process.env["EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID_IOS"],
  TestIds.REWARDED,
);

let adsInitialized = false;

/**
 * Call once at app startup (see app/_layout.tsx). Requests UMP consent
 * where required by the user's region before initializing the SDK, per
 * Stage 7's consent requirement. Swallows all errors — ads are a nice-to-
 * have, never something that should block the app from starting.
 */
export async function initializeAds(): Promise<void> {
  if (adsInitialized) return;
  try {
    const consentInfo = await AdsConsent.requestInfoUpdate();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdsConsentStatus.REQUIRED
    ) {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }
  } catch {
    // Consent SDK unavailable/not configured — proceed with default (non-
    // personalized where applicable) ad requests rather than blocking.
  }
  try {
    await MobileAds().initialize();
    adsInitialized = true;
  } catch {
    // No native module (e.g. running in Expo Go) — ads simply won't show.
  }
}

const FREE_REWARDED_TIMEOUT_MS = 15000;

/**
 * Shows a rewarded ad and resolves once the flow is settled.
 * Returns true if the user earned the reward (or no ad could be loaded —
 * "لو الإعلان مش متاح يتمنح التنزيل" fallback) and false only if an ad
 * loaded but the user closed it without finishing.
 */
export function showRewardedAdForDownload(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let rewarded: RewardedAd;
    try {
      rewarded = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });
    } catch {
      finish(true); // no ads module available — fallback grants the download
      return;
    }

    const timeout = setTimeout(() => finish(true), FREE_REWARDED_TIMEOUT_MS);

    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => rewarded.show(),
    );
    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        clearTimeout(timeout);
        finish(true);
      },
    );
    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      clearTimeout(timeout);
      // If EARNED_REWARD already fired, finish() is a no-op by now.
      finish(false);
    });
    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      clearTimeout(timeout);
      finish(true); // couldn't load — fallback grants the download
    });

    try {
      rewarded.load();
    } catch {
      clearTimeout(timeout);
      finish(true);
    }

    // Best-effort cleanup once settled; these subscriptions are cheap to
    // leak for the rare case the promise never resolves, but we unsubscribe
    // as soon as we can anyway.
    void unsubscribeLoaded;
    void unsubscribeEarned;
    void unsubscribeClosed;
    void unsubscribeError;
  });
}
