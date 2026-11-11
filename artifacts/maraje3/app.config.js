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
      // react-native-iap ships an Android "store" product-flavor dimension
      // (amazon vs. play) so the same package can target either app store.
      // It was installed as a dependency in Stage 7 but never registered
      // as a plugin here, so `expo prebuild` generated android/app without
      // picking a flavor — Gradle then refused to resolve the dependency
      // with "cannot choose between... amazonDebugApiElements /
      // playDebugApiElements" (seen in CI). Registering the plugin makes it
      // add `missingDimensionStrategy "store", "play"` to the generated
      // android/app/build.gradle automatically on every prebuild.
      // paymentProvider: "Play Store" is already the plugin's own default;
      // it's spelled out here so the choice (this app is Play-Store-only,
      // never Amazon Appstore) is explicit rather than implicit.
      ["react-native-iap", { paymentProvider: "Play Store" }],
      // react-native-google-mobile-ads 16.5.0 pulls in Google's own
      // com.google.android.gms:play-services-ads:25.4.0 AAR, which Google
      // now ships compiled with Kotlin metadata version 2.3.0. Expo SDK 57's
      // default Kotlin compiler can't read that metadata and fails the
      // build with "Module was compiled with an incompatible version of
      // Kotlin... binary version of its metadata is 2.3.0, expected version
      // is 2.1.0" (seen in CI). A first attempt bumped the whole project's
      // Kotlin version via expo-build-properties' android.kotlinVersion —
      // that only half-worked: it bumped kotlin-stdlib/kotlin-reflect on
      // the classpath but NOT the compiler actually used for some modules
      // (including Expo's own expo-modules-core), producing a second,
      // worse failure from mixing bumped-stdlib with an unbumped compiler.
      // That approach was reverted. This local plugin instead keeps the
      // whole project on ONE consistent Kotlin version and passes the
      // `-Xskip-metadata-version-check` compiler flag Gradle's own error
      // message recommends, applied to every Kotlin compile task so it
      // keeps covering whichever module hits this next. See
      // plugins/withKotlinSkipMetadataVersionCheck.js for the full
      // reasoning.
      "./plugins/withKotlinSkipMetadataVersionCheck",
    ],
  };
};
