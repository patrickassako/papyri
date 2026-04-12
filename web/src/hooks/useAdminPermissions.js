import { useEffect, useState } from 'react';
import * as adminService from '../services/admin.service';

let _cache = null; // cache en mémoire pour la session

/**
 * Retourne les permissions du user connecté dans le back-office.
 * - Admin : `isAdmin=true` + toutes les permissions
 * - Rôle custom : uniquement ses permissions assignées
 *
 * @returns {{ permissions: Set<string>, isAdmin: boolean, loading: boolean }}
 */
export function useAdminPermissions() {
  const [state, setState] = useState({
    permissions: _cache?.permissions || new Set(),
    isAdmin: _cache?.isAdmin || false,
    loading: !_cache,
  });

  useEffect(() => {
    if (_cache) return; // déjà chargé

    let cancelled = false;
    adminService.getMyPermissions()
      .then(data => {
        if (cancelled) return;
        const perms = new Set(data.permissions || []);
        _cache = { permissions: perms, isAdmin: Boolean(data.is_admin) };
        setState({ permissions: perms, isAdmin: Boolean(data.is_admin), loading: false });
      })
      .catch(() => {
        if (!cancelled) setState(s => ({ ...s, loading: false }));
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}

/** Invalide le cache (à appeler après login/logout ou changement de rôle) */
export function clearAdminPermissionsCache() {
  _cache = null;
}
