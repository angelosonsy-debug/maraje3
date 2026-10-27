// Stage 7-B AdMob needs a config plugin entry carrying the AdMob App ID
// (a build-time value baked into the native Info.plist/AndroidManifest —
// NOT a runtime env the JS bundle can read), which app.json alone can't
// express dynamically. Expo merges this function's return value over
// app.json's static config, so app.json stays the source of truth for
// everything else and this file only appends the ads plugin.
//
// Falls back to Google's own published AdMob *test* App IDs when
// ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID aren't set, so the app still
// prebuilds without real AdMob credentials — see .env.example.
module.exports = ({ config }) => {
  const androidAppId =
    process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713";
  const iosAppId =
    process.env.ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511";

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        "react-native-google-mobile-ads",
        {
          androidAppId,
          iosAppId,
          // UMP (regional) consent is requested at runtime from lib/ads.ts
          // instead of being forced here, per Stage 7's "ask for consent
          // according to region" requirement.
          delayAppMeasurementInit: true,
        },
      ],
    ],
  };
};
