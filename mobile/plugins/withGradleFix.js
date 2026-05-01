/**
 * Config plugin — AGP 8.x compatibility for expo-modules-core
 *
 * Root cause: In expo-modules-core ≤1.11.x, useExpoPublishing() registers
 * afterEvaluate (which accesses components.release) BEFORE declaring
 * singleVariant("release"). In AGP 8.1+, components are created lazily,
 * so AGP's component-creation listener is registered AFTER expo's afterEvaluate
 * listener, causing components.release to be unavailable.
 *
 * Fix: patches/expo-modules-core+1.11.14.patch swaps the order in
 * useExpoPublishing() so singleVariant is declared first.
 * That patch is applied via patch-package (postinstall script).
 *
 * This plugin file is kept as a no-op placeholder so app.json doesn't break.
 */

module.exports = function withGradleFix(config) {
  return config;
};
