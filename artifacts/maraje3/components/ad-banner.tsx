import React from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { BANNER_UNIT_ID } from "@/lib/ads";
import { useAuth } from "@/state/auth-context";

/**
 * Stage 7-B banner — drop into a materials/search-results list (between
 * items or at the bottom), never inside the material viewer or a flashcard
 * review session (both forbidden by the spec). Hidden entirely for Premium
 * users ("بدون إعلانات"). Needs a development build; this native module
 * does nothing (and may not even be linked) under Expo Go.
 */
export function ListBannerAd() {
  const { user } = useAuth();
  if (user?.isPremium) return null;

  return (
    <View style={{ alignItems: "center", marginVertical: 8 }}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
