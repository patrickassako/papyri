import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceService } from '../services/device.service';

const HEARTBEAT_INTERVAL = 30_000; // 30s

/**
 * Gère le verrou de lecture exclusif (style Spotify).
 *
 * - Le nouveau device prend TOUJOURS le verrou (takeover forcé, jamais bloqué).
 * - L'ancien device détecte via heartbeat qu'il a été déplacé → lockState = 'displaced'.
 * - `enabled` : passer false libère le verrou (utile pour audio : lock seulement si isPlaying).
 *
 * @param {string|null} contentId
 * @param {boolean} [enabled=true]
 * @returns {{ lockState: 'idle'|'checking'|'locked'|'displaced'|'device_limit'|'error', reacquire: () => void }}
 */
export function useReadingLock(contentId, enabled = true) {
  const [lockState, setLockState] = useState('idle');
  const intervalRef = useRef(null);
  const acquiredRef = useRef(false);
  const cancelledRef = useRef(false);

  const stopHeartbeat = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const releaseLock = useCallback(() => {
    stopHeartbeat();
    if (acquiredRef.current) {
      acquiredRef.current = false;
      deviceService.releaseLock();
    }
  }, [stopHeartbeat]);

  const acquire = useCallback(async () => {
    if (!contentId || cancelledRef.current) return;
    setLockState('checking');
    try {
      await deviceService.register().catch(() => {});
      const res = await deviceService.acquireLock(contentId);
      if (cancelledRef.current) return;

      if (res.success) {
        acquiredRef.current = true;
        setLockState('locked');

        // Heartbeat — détecte si un autre device a pris le verrou
        intervalRef.current = setInterval(async () => {
          try {
            const hb = await deviceService.heartbeat();
            if (!hb.success && hb.error?.code === 'LOCK_LOST') {
              stopHeartbeat();
              acquiredRef.current = false;
              setLockState('displaced');
            }
          } catch {}
        }, HEARTBEAT_INTERVAL);
      } else if (res.error?.code === 'DEVICE_LIMIT_REACHED') {
        setLockState('device_limit');
      } else {
        setLockState('error');
      }
    } catch {
      if (!cancelledRef.current) setLockState('error');
    }
  }, [contentId, stopHeartbeat]);

  // Reprendre le verrou depuis l'état displaced
  const reacquire = useCallback(() => {
    stopHeartbeat();
    acquire();
  }, [acquire, stopHeartbeat]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!contentId) return;

    if (enabled) {
      acquire();
    } else {
      setLockState('idle');
      releaseLock();
    }

    return () => {
      cancelledRef.current = true;
      releaseLock();
    };
  }, [contentId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lockState, reacquire };
}
