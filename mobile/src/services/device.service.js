import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { authFetch } from './auth.service';
import API_BASE_URL from '../config/api';

const API_URL = API_BASE_URL;
const DEVICE_KEY = 'papyri_device_id';

// ─── Device identity ──────────────────────────────────────────────────────────

let _cachedDeviceId = null;

export async function getDeviceId() {
  if (_cachedDeviceId) return _cachedDeviceId;

  // Prefer stable hardware ID (survives reinstalls) — Android: androidId, iOS: identifierForVendor
  let stableId = null;
  try {
    if (Platform.OS === 'android') {
      stableId = Application.androidId || null;
    } else if (Platform.OS === 'ios') {
      stableId = await Application.getIosIdForVendorAsync?.() || null;
    }
  } catch {
    // expo-application may not be available in some builds
  }

  if (stableId) {
    // Prefix to distinguish from old random UUIDs
    const id = `hw-${stableId}`;
    _cachedDeviceId = id;
    // Persist it so the device_id is consistent and old random entries can be cleaned up
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => {});
    return id;
  }

  // Fallback: reuse persisted UUID (or generate one if first install)
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  _cachedDeviceId = id;
  return id;
}

function getDeviceName() {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Mobile';
  return `App Papyri (${os})`;
}

function getDeviceType() {
  // Expo doesn't expose tablet detection by default — use 'mobile' for all native
  return 'mobile';
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const deviceService = {
  getDeviceId,

  async register() {
    const device_id = await getDeviceId();
    const res = await authFetch(`${API_URL}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id,
        device_name: getDeviceName(),
        device_type: getDeviceType(),
      }),
    });
    return res.json();
  },

  async list() {
    const device_id = await getDeviceId();
    const res = await authFetch(`${API_URL}/api/devices`, {
      headers: { 'X-Device-Id': device_id },
    });
    return res.json();
  },

  async remove(deviceId) {
    const res = await authFetch(`${API_URL}/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async acquireLock(contentId) {
    const device_id = await getDeviceId();
    const res = await authFetch(`${API_URL}/api/devices/reading-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id, content_id: contentId }),
    });
    return res.json();
  },

  async releaseLock() {
    try {
      const device_id = await getDeviceId();
      await authFetch(`${API_URL}/api/devices/reading-lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id }),
      });
    } catch {
      // Best-effort cleanup
    }
  },

  async heartbeat() {
    const device_id = await getDeviceId();
    const res = await authFetch(`${API_URL}/api/devices/reading-lock/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id }),
    });
    return res.json();
  },
};
