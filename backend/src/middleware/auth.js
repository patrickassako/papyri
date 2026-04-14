const { supabase, supabaseAdmin } = require('../config/database');

// Cache permissions par rôle (TTL 5 min) pour éviter une requête DB à chaque appel
const permissionsCache = new Map(); // key: roleName → { permissions: Set, expiresAt: number }
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getRolePermissions(roleName) {
  const cached = permissionsCache.get(roleName);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  // Fallback query if join syntax unsupported
  const { data: roleData } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();

  let permissions = new Set();
  if (roleData?.id) {
    const { data: rp } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions(key)')
      .eq('role_id', roleData.id);
    if (rp) rp.forEach(r => { if (r.permissions?.key) permissions.add(r.permissions.key); });
  }

  permissionsCache.set(roleName, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
  return permissions;
}

function clearPermissionsCache(roleName) {
  if (roleName) permissionsCache.delete(roleName);
  else permissionsCache.clear();
}

/**
 * Middleware to verify Supabase JWT access token
 * Migrated from custom JWT to Supabase Auth
 */
async function verifyJWT(req, res, next) {
  try {
    // Get token from Authorization header OR ?token= query param (used by WebView file streaming)
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token d\'authentification manquant.'
        }
      });
    }

    // Verify token with Supabase Auth using admin client
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token invalide ou expiré.'
        }
      });
    }

    // Get profile data using admin client
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Attach user info to request
    req.user = {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name,
      language: profile?.language,
      avatar_url: profile?.avatar_url,
      onboarding_completed: profile?.onboarding_completed,
      role: profile?.role || data.user.user_metadata?.role || 'user'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    // Distinguish network/connectivity errors from real auth failures
    const isNetworkError = error?.message?.includes('fetch failed')
      || error?.message?.includes('TIMEOUT')
      || error?.message?.includes('ECONNREFUSED')
      || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';

    if (isNetworkError) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service d\'authentification temporairement indisponible.'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentification échouée.'
      }
    });
  }
}

/**
 * Middleware to check if user has required role
 * Must be used after verifyJWT
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Non authentifié.'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Accès refusé.'
        }
      });
    }

    next();
  };
}

/**
 * Middleware to check if user has a specific permission key (ex: 'users.write')
 * Must be used after verifyJWT
 * Admins always pass (all permissions granted by seed).
 */
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Non authentifié.' } });
    }
    // Admin role always has full access (shortcut — avoids DB query)
    if (req.user.role === 'admin') return next();

    try {
      const permissions = await getRolePermissions(req.user.role);
      if (!permissions.has(permissionKey)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Permission requise : ${permissionKey}` },
        });
      }
      next();
    } catch (err) {
      console.error('requirePermission error:', err);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur vérification permissions.' } });
    }
  };
}

/**
 * Middleware qui vérifie la permission selon la méthode HTTP.
 * Admin = bypass automatique. Les rôles custom passent si la permission correspondante est accordée.
 *
 * @param {{ read?: string, write?: string, delete?: string }} permMap
 *   - read   : permission pour GET
 *   - write  : permission pour POST / PUT / PATCH
 *   - delete : permission pour DELETE (fallback sur write si absent)
 */
function requirePermissionForMethod(permMap = {}) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Non authentifié.' } });
    }
    // Admin bypass
    if (req.user.role === 'admin') return next();

    const methodPermMap = {
      GET:    permMap.read,
      POST:   permMap.write,
      PUT:    permMap.write,
      PATCH:  permMap.write,
      DELETE: permMap.delete || permMap.write,
    };
    const permKey = methodPermMap[req.method];
    if (!permKey) return next(); // pas de contrainte définie pour cette méthode

    try {
      const permissions = await getRolePermissions(req.user.role);
      if (!permissions.has(permKey)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Permission requise : ${permKey}` },
        });
      }
      next();
    } catch (err) {
      console.error('requirePermissionForMethod error:', err);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur vérification permissions.' } });
    }
  };
}

module.exports = {
  verifyJWT,
  authenticate: verifyJWT,
  requireRole,
  requirePermission,
  requirePermissionForMethod,
  clearPermissionsCache,
};
