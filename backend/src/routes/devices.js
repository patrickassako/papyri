const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');
const { rejectKidProfile } = require('../middleware/family-access');

const MAX_DEVICES = 3;
const LOCK_TTL_MS = 15_000; // 15s — lock is stale if no heartbeat

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

    // Deduplication: if another entry exists with the same device_name + device_type,
    // it's the same physical device with a different UUID (e.g. after reinstall).
    // Replace it with the new device_id instead of creating a duplicate.
    if (device_name && device_type) {
      const { data: sameNameDevices } = await supabaseAdmin
        .from('user_devices')
        .select('id, device_id')
        .eq('user_id', userId)
        .eq('device_name', device_name)
        .eq('device_type', device_type)
        .neq('device_id', device_id);

      if (sameNameDevices && sameNameDevices.length > 0) {
        // Delete the stale duplicate entries
        const staleIds = sameNameDevices.map((d) => d.device_id);
        await supabaseAdmin
          .from('user_devices')
          .delete()
          .eq('user_id', userId)
          .in('device_id', staleIds);
      }
    }

    // If device_id starts with 'hw-' (stable hardware ID), also purge old random UUIDs
    if (device_id.startsWith('hw-')) {
      const { data: allDevices } = await supabaseAdmin
        .from('user_devices')
        .select('id, device_id, device_type')
        .eq('user_id', userId)
        .neq('device_id', device_id);

      const staleIds = (allDevices || [])
        .filter((d) => d.device_type === (device_type || 'mobile') && !d.device_id.startsWith('hw-'))
        .map((d) => d.device_id);

      if (staleIds.length > 0) {
        await supabaseAdmin
          .from('user_devices')
          .delete()
          .eq('user_id', userId)
          .in('device_id', staleIds);
      }
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

    // Only revoke sessions if the user is removing the CURRENT device (self-removal).
    // Removing another device should not sign out the current session.
    const currentDeviceId = req.headers['x-device-id'] || null;
    const isSelfRemoval = currentDeviceId && currentDeviceId === deviceId;

    if (isSelfRemoval) {
      try {
        await supabaseAdmin.auth.admin.signOut(userId);
      } catch (signOutErr) {
        console.error('[devices] signOut after delete error:', signOutErr.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Appareil supprimé.', sessions_revoked: isSelfRemoval });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /devices/reading-lock
 * Acquire exclusive reading lock. Fails with DEVICE_LIMIT_REACHED if the device is not registered.
 * If another fresh registered device held the lock, it is displaced (Spotify-style takeover)
 * and will detect the change via its next heartbeat (LOCK_LOST).
 */
router.post('/reading-lock', verifyJWT, rejectKidProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { device_id, content_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'device_id requis.' } });
    }

    // Verify the device is registered for this user (enforces the 3-device limit on reading too)
    const { data: registeredDevice } = await supabaseAdmin
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', device_id)
      .maybeSingle();

    if (!registeredDevice) {
      const { count } = await supabaseAdmin
        .from('user_devices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_LIMIT_REACHED',
          message: `Limite de ${MAX_DEVICES} appareils atteinte. Supprimez un appareil pour continuer.`,
          limit: MAX_DEVICES,
          registered: count || 0,
        },
      });
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
