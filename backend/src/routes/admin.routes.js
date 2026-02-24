/**
 * AdminJS Routes - Epic 10
 * Protected back-office for admin users
 * Uses Supabase REST adapter (no DATABASE_URL needed)
 */

const AdminJSModule = require('adminjs');
const AdminJS = AdminJSModule.default || AdminJSModule;
const AdminJSExpress = require('@adminjs/express');
const { buildAdminOptions } = require('../config/adminjs');
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/database');
const { logAdminLogin } = require('../services/audit.service');
const { consumeToken } = require('../services/admin-invoice-token.service');

// Dedicated Supabase client for admin auth ONLY
// Separate from supabaseAdmin to avoid polluting its auth state
// (signInWithPassword changes the client's auth context, breaking service_role bypass)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Custom authentication function for AdminJS
 * Uses a DEDICATED Supabase client for auth to avoid polluting supabaseAdmin state
 */
async function authenticate(email, password, req) {
  try {
    // Use dedicated auth client — NOT supabaseAdmin
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.log(`❌ Admin login failed: ${email}`);
      return null;
    }

    // Check role in profile (use supabaseAdmin for data queries)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const role = data.user.user_metadata?.role || profile?.role || 'user';

    if (role !== 'admin') {
      console.log(`❌ Admin login rejected (not admin): ${email}`);
      return null;
    }

    // Log successful admin login
    await logAdminLogin(data.user.id, email, {
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      user_agent: req?.headers?.['user-agent'] || 'unknown',
    });

    console.log(`✅ Admin login: ${email}`);

    return {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name || email,
      role,
    };

  } catch (err) {
    console.error('Admin auth error:', err.message);
    return null;
  }
}

/**
 * Setup AdminJS with Supabase adapter and authentication
 * @returns {Promise<{admin: AdminJS, router: Express.Router}>}
 */
async function setupAdminJS() {
  const adminOptions = await buildAdminOptions();
  const admin = new AdminJS(adminOptions);

  // Bundle custom components (required for ComponentLoader)
  if (process.env.NODE_ENV === 'production') {
    await admin.initialize();
  } else {
    await admin.watch();
  }

  // Build authenticated router with session
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'papyri-admin-cookie-dev-secret-32chars-min',
    },
    null,
    {
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET || 'papyri-admin-session-dev-secret-32chars-min',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24h
        sameSite: 'lax',
      },
      name: 'adminjs',
    }
  );

  return { admin, router };
}

/**
 * Express router for custom admin utility endpoints (mounted alongside admin)
 */
const express = require('express');
const adminUtilRouter = express.Router();

/**
 * GET /admin/invoice-token/:token
 * Serves a one-time PDF invoice for the admin panel.
 * No auth required — the token is short-lived (60s) and single-use.
 */
adminUtilRouter.get('/invoice-token/:token', (req, res) => {
  const entry = consumeToken(req.params.token);
  if (!entry) {
    return res.status(410).send(
      '<html><body style="font-family:sans-serif;padding:2rem">' +
      '<h2>Lien expiré</h2><p>Ce lien de prévisualisation a expiré ou a déjà été utilisé.' +
      ' Retournez dans le panel admin pour en générer un nouveau.</p></body></html>'
    );
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`);
  res.setHeader('Content-Length', entry.buffer.length);
  res.send(entry.buffer);
});

module.exports = setupAdminJS;
module.exports.adminUtilRouter = adminUtilRouter;
