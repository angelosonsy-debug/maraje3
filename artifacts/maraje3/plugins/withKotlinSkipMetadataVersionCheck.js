// Several native modules pull in vendor AARs (currently Google's own
// com.google.android.gms:play-services-ads inside react-native-google-mobile-ads)
// that are published compiled with a newer Kotlin metadata format than the
// Kotlin compiler Expo SDK 57 ships by default can read. That fails the
// build with:
//
//   Module was compiled with an incompatible version of Kotlin. The binary
//   version of its metadata is 2.3.0, expected version is 2.1.0.
//
// Bumping the project's own Kotlin version (e.g. via expo-build-properties'
// android.kotlinVersion) was tried first, but only partially took effect:
// it bumped kotlin-stdlib/kotlin-reflect to the newer version on the
// classpath while some modules (including Expo's own expo-modules-core)
// kept compiling with the older compiler, producing a NEW, worse failure
// ("the compiler version 2.1.0 can read versions up to 2.2.0") that didn't
// exist before. Mixing a bumped stdlib with an unbumped compiler across
// subprojects is a known source of exactly this kind of breakage, so that
// approach was reverted.
//
// The targeted fix instead: keep the whole project on ONE consistent,
// Expo-default Kotlin compiler version, and pass the Kotlin compiler flag
// Gradle's own error message recommends — `-Xskip-metadata-version-check`
// — which tells kotlinc to stop gating on the metadata version header and
// just read the class file. This is JetBrains' own documented escape
// hatch for exactly this situation (a vendor library built with a newer
// Kotlin than the consuming project), and it's applied to every Kotlin
// compile task across every subproject so it keeps working regardless of
// which module happens to pull in the next vendor AAR with this issue.
//
// Applied via withProjectBuildGradle because `android/` is regenerated
// from scratch by `expo prebuild` on every build — this can't be a manual
// edit to the generated file.
const { withProjectBuildGradle } = require("expo/config-plugins");

const SNIPPET = `
// Added by withKotlinSkipMetadataVersionCheck.js — see that file for why.
allprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      freeCompilerArgs += ["-Xskip-metadata-version-check"]
    }
  }
}
`;

module.exports = function withKotlinSkipMetadataVersionCheck(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("-Xskip-metadata-version-check")) {
      config.modResults.contents += SNIPPET;
    }
    return config;
  });
};
