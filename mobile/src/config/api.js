import { NativeModules, Platform } from 'react-native';

// 1) Optional explicit override via Expo env:
// EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

function getHostFromBundleUrl() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  // Example:
  // http://192.168.1.10:8081/index.bundle?platform=ios&dev=true
  const match = scriptURL.match(/^https?:\/\/([^:/]+)(?::\d+)?\//i);
  return match?.[1] || null;
}

function resolveDevApiUrl() {
  if (envApiUrl) return envApiUrl;

  const bundleHost = getHostFromBundleUrl();
  if (bundleHost) {
    return `http://${bundleHost}:3001`;
  }

  // Last-resort fallback by platform
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001'; // Android emulator -> host machine
  }
  return 'http://localhost:3001'; // iOS simulator / local fallback
}

const API_BASE_URL = __DEV__
  ? resolveDevApiUrl()
  : (envApiUrl || 'https://papyri-backend.onrender.com');

export default API_BASE_URL;
