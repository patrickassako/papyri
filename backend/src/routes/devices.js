const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');
const { rejectKidProfile } = require('../middleware/family-access');

const MAX_DEVICES = 3;
const LOCK_TTL_MS = 30_000; // 30s — lock is stale if no heartbeat

function isLockFresh(heartbeatAt) {
  if (!heartbeatAt) return false;
  return Date.now() - new Date(heartbeatAt).getTime() < LOCK_TTL_MS;
}

/**
 * POST /devices/register
 * Register or update the current device. Rejects if user already has MAX_DEVICES different devices.
 */
router.post('/register', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_id, device_name, device_type } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'device_id requis.' } });
    }

    // Check if already registered → upsert
    const { data: existing } = await supabaseAdmin
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', device_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('user_devices')
        .update({ last_seen_at: new Date().toISOString(), device_name, device_type })
        .eq('user_id', userId)
        .eq('device_id', device_id);
      return res.status(200).json({ success: true, registered: false, message: 'Appareil mis à jour.' });
    }

    // Count existing devices
    const { count } = await supabaseAdmin
      .from('user_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count >= MAX_DEVICES) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_LIMIT_REACHED',
          message: `Limite de ${MAX_DEVICES} appareils atteinte. Supprimez un appareil pour continuer.`,
          limit: MAX_DEVICES,
        },
      });
    }

    await supabaseAdmin.from('user_devices').insert({
      user_id: userId,
      device_id,
      device_name: device_name || 'Appareil inconnu',
      device_type: device_type || 'desktop',
    });

    return res.status(201).json({ success: true, registered: true, message: 'Appareil enregistré.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /devices
 * List registered devices. Pass X-Device-Id header to mark current device.
 */
router.get('/', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: devices, error } = await supabaseAdmin
      .from('user_devices')
      .select('id, device_id, device_name, device_type, last_seen_at, created_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;

    // Reading lock
    const { data: lock } = await supabaseAdmin
      .from('reading_locks')
      .select('device_id, heartbeat_at, content_id')
      .eq('user_id', userId)
      .maybeSingle();

    const activeReaderId = lock && isLockFresh(lock.heartbeat_at) ? lock.device_id : null;
    const myDeviceId = req.headers['x-device-id'] || null;

    const enriched = (devices || []).map((d) => ({
      ...d,
      is_current: d.device_id === myDeviceId,
      is_reading: d.device_id === activeReaderId,
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      meta: { limit: MAX_DEVICES, count: enriched.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /devices/:deviceId
 * Remove a registered device (also releases its reading lock and revokes all sessions).
 */
router.delete('/:deviceId', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    await supabaseAdmin
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    // Release lock if this device held it
    await supabaseAdmin
      .from('reading_locks')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    // Revoke ALL sessions for this user so the removed device is truly disconnected.
    // This also signs out the current device — the frontend will redirect to login.
    try {
      await supabaseAdmin.auth.admin.signOut(userId);
    } catch (signOutErr) {
      console.error('[devices] signOut after delete error:', signOutErr.message);
      // Non-blocking — device is already removed from DB
    }

    return res.status(200).json({ success: true, message: 'Appareil supprimé.', sessions_revoked: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /devices/reading-lock
 * Acquire exclusive reading lock — always succeeds (Spotify-like takeover).
 * If another fresh device held the lock, it will detect the takeover via heartbeat (LOCK_LOST).
 */
router.post('/reading-lock', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_id, content_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'device_id requis.' } });
    }

    // Check if a different device currently holds a fresh lock (to report takeover info)
    const { data: existingLock } = await supabaseAdmin
      .from('reading_locks')
      .select('device_id, heartbeat_at')
      .eq('user_id', userId)
      .maybeSingle();

    const tookOver = !!(
      existingLock &&
      existingLock.device_id !== device_id &&
      isLockFresh(existingLock.heartbeat_at)
    );

    // Always upsert — new device wins (Spotify-style)
    await supabaseAdmin.from('reading_locks').upsert(
      {
        user_id: userId,
        device_id,
        content_id: content_id || null,
        locked_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return res.status(200).json({ success: true, took_over: tookOver });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /devices/reading-lock
 * Release reading lock (only if held by the requesting device).
 */
router.delete('/reading-lock', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_id } = req.body;

    const query = supabaseAdmin.from('reading_locks').delete().eq('user_id', userId);
    if (device_id) query.eq('device_id', device_id);
    await query;

    return res.status(200).json({ success: true, message: 'Verrou libéré.' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /devices/reading-lock/heartbeat
 * Refresh heartbeat. Returns LOCK_LOST if another device has taken over.
 */
router.post('/reading-lock/heartbeat', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DEVICE_ID' } });
    }

    // Verify this device still holds the lock before refreshing
    const { data: lock } = await supabaseAdmin
      .from('reading_locks')
      .select('device_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!lock || lock.device_id !== device_id) {
      return res.status(200).json({
        success: false,
        error: { code: 'LOCK_LOST', message: 'Un autre appareil a repris la lecture.' },
      });
    }

    await supabaseAdmin
      .from('reading_locks')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', device_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
