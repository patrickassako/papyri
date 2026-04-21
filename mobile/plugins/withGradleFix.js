/**
 * Config plugin to fix "Could not get unknown property 'release'"
 * in expo-modules-core with AGP 8.x
 *
 * Root cause: AGP 8.x no longer auto-creates software components (release/debug).
 * ExpoModulesCorePlugin.gradle accesses `components.release` before it's registered.
 *
 * Fix 1: gradle.properties — android.disableAutomaticComponentCreation=false
 *   → restores old AGP 7.x behavior where components.release auto-exists
 *
 * Fix 2: root build.gradle — add singleVariant("release") to all android lib subprojects
 *   → ensures each library subproject explicitly declares the release variant
 */

const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

// gradle.properties fix — re-enable automatic component creation (AGP 7.x behavior)
function addGradleProperty(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    // Remove any existing value for this key
    const filtered = props.filter(p => p.key !== 'android.disableAutomaticComponentCreation');
    filtered.push({
      type: 'property',
      key: 'android.disableAutomaticComponentCreation',
      value: 'false',
    });
    config.modResults = filtered;
    return config;
  });
}

// root build.gradle fix — singleVariant patch for all android library subprojects
const GRADLE_PATCH = `

// ─── Papyri Gradle fix: expo-modules-core + AGP 8.x compatibility ────────────
subprojects {
    plugins.withId("com.android.library") {
        android {
            publishing {
                singleVariant("release") {}
            }
        }
    }
}
// ──────────────────────────────────────────────────────────────────────────────
`;

function patchRootBuildGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('Papyri Gradle fix')) {
      return config; // already patched
    }
    config.modResults.contents += GRADLE_PATCH;
    return config;
  });
}

module.exports = function withGradleFix(config) {
  config = addGradleProperty(config);
  config = patchRootBuildGradle(config);
  return config;
};
