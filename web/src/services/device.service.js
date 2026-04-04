import { authFetch } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEVICE_KEY = 'papyri_device_id';

// ─── Device identity ──────────────────────────────────────────────────────────

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getDeviceName() {
  const ua = navigator.userAgent.toLowerCase();
  let browser = 'Navigateur';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  let os = 'Inconnu';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return `${browser} sur ${os}`;
}

function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
  return 'desktop';
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const deviceService = {
  getDeviceId,

  async register() {
    const res = await authFetch(`${API_URL}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(),
        device_name: getDeviceName(),
        device_type: getDeviceType(),
      }),
    });
    return res.json();
  },

  async list() {
    const res = await authFetch(`${API_URL}/devices`, {
      headers: { 'X-Device-Id': getDeviceId() },
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
    const res = await authFetch(`${API_URL}/devices/reading-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), content_id: contentId }),
    });
    return res.json();
  },

  async releaseLock() {
    try {
      await authFetch(`${API_URL}/devices/reading-lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: getDeviceId() }),
      });
    } catch {
      // Best-effort: don't throw on cleanup
    }
  },

  async heartbeat() {
    const res = await authFetch(`${API_URL}/devices/reading-lock/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId() }),
    });
    return res.json();
  },
};
