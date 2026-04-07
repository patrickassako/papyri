const ACTIVE_PROFILE_KEY = 'papyri_active_profile';

function emitProfileChange(profile) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('papyri:profile-changed', { detail: profile || null }));
}

export function getActiveProfile() {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getActiveProfileId() {
  return getActiveProfile()?.id || null;
}

export function setActiveProfile(profile) {
  if (!profile?.id) return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
  emitProfileChange(profile);
}

export function clearActiveProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  emitProfileChange(null);
}
