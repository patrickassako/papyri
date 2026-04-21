/**
 * Config plugin to fix "Could not get unknown property 'release'"
 * in expo-modules-core with AGP 8.3+
 *
 * Root cause: ExpoModulesCorePlugin.gradle calls `components.release`
 * before AGP registers the software component in AGP 8.3+.
 *
 * Fix: force resolution of AGP to 8.1.4 (compatible with Expo SDK 50)
 * and add singleVariant("release") to all android library subprojects.
 */

const { withAndroidBuildGradle } = require('@expo/config-plugins');

// Patch appended to the END of android/build.gradle (root)
const PATCH = `

// ─── Papyri build fix: expo-modules-core + AGP 8.3 compatibility ───────────
// Force AGP 8.1.4 which is stable with Expo SDK 50
configurations.all {
    resolutionStrategy.eachDependency { details ->
        if (details.requested.group == 'com.android.tools.build'
                && details.requested.name == 'gradle') {
            details.useVersion '8.1.4'
        }
    }
}

subprojects {
    plugins.withId("com.android.library") {
        android {
            publishing {
                singleVariant("release") {}
            }
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
`;

module.exports = function withGradleFix(config) {
  return withAndroidBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Only patch once
    if (contents.includes('Papyri build fix')) {
      return config;
    }

    config.modResults.contents = contents + PATCH;
    return config;
  });
};
