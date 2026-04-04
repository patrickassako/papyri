import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { authFetch } from './auth.service';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const DEVICE_KEY = 'papyri_device_id';

// ─── Device identity ──────────────────────────────────────────────────────────

let _cachedDeviceId = null;

export async function getDeviceId() {
  if (_cachedDeviceId) return _cachedDeviceId;
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    // Generate a UUID v4
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
    const res = await authFetch(`${API_URL}/devices/register`, {
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
    const res = await authFetch(`${API_URL}/devices`, {
      headers: { 'X-Device-Id': device_id },
    });
    return res.json();
  },

  async remove(deviceId) {
    const res = await authFetch(`${API_URL}/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async acquireLock(contentId) {
    const device_id = await getDeviceId();
    const res = await authFetch(`${API_URL}/devices/reading-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id, content_id: contentId }),
    });
    return res.json();
  },

  async releaseLock() {
    try {
      const device_id = await getDeviceId();
      await authFetch(`${API_URL}/devices/reading-lock`, {
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
    const res = await authFetch(`${API_URL}/devices/reading-lock/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id }),
    });
    return res.json();
  },
};
