# CI/CD — automatic Android APK build on push

`.github/workflows/android-apk-build.yml` runs on every push to `main` that
touches the app (`artifacts/maraje3/**`), a workspace lib it depends on
(`lib/**`), or the lockfile — and can also be run manually from the Actions
tab (**Run workflow**).

**No Expo/EAS account, no `EXPO_TOKEN`, nothing to sign up for.** It builds
the native Android project directly on the GitHub-hosted runner with
`expo prebuild` + Gradle, exactly like building any plain React Native app
in CI, and uploads the resulting `.apk` as a downloadable build artifact on
the workflow run itself.

## What it does

1. Installs the workspace (pnpm), JDK 17, and the Android SDK
   (`android-actions/setup-android`).
2. Runs the same typecheck suite used in every stage report
   (`pnpm run typecheck:libs`, then the app's own `typecheck`) as a gate —
   a build that wouldn't typecheck isn't worth the Gradle time.
3. `npx expo prebuild --platform android --clean` generates a fresh
   `android/` native project from `app.json`/`app.config.js`.
4. `./gradlew assembleDebug` builds the APK.
5. Uploads it as a workflow artifact named `maraje3-debug-apk`.

## Getting the APK

GitHub repo → **Actions** tab → open the finished run → **Artifacts**
section at the bottom → download `maraje3-debug-apk` (a zip containing the
`.apk`). Transfer it to an Android phone (or an emulator) and install it —
Android will ask to allow installs from that source the first time if
you're sideloading from outside the Play Store.

## Debug signing — what it means for you

The APK is signed with Gradle's own auto-generated debug keystore, not a
release key. **This is fine and normal for installing/testing on a real
device** — it runs exactly like a release build would. What it is **not**
suitable for is uploading to Google Play, which requires:

- A release-signed `.aab` (Android App Bundle, not an `.apk`), and
- A signing key you control (an "upload key"), not the shared debug
  keystore.

If/when you're ready for an actual Play Store submission, that's a
separate, deliberate step — either add a release keystore as a GitHub
secret and a release-build job, or use `eas build --profile production`
(see `docs/play-checklist.md`, item 7) with an Expo account. Neither is
wired up by this workflow, by design — you asked for a zero-setup APK you
can install right away, not a store-ready bundle.

## AdMob app IDs during this build

`app.config.js` reads `ADMOB_ANDROID_APP_ID`/`ADMOB_IOS_APP_ID` at prebuild
time; the workflow passes them through from optional GitHub secrets of the
same names, and falls back to Google's own published AdMob **test** app
IDs when those secrets aren't set (which is the default — nothing to
configure unless you already have a real AdMob account).
