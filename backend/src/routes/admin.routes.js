/**
 * AdminJS Routes - Epic 10
 * Protected back-office for admin users
 */

const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const { adminOptions, configureResources } = require('../config/adminjs');
const { supabaseAdmin } = require('../config/database');
const { logAdminLogin, logAdminLogout } = require('../services/audit.service');

/**
 * Custom authentication function for AdminJS
 * Uses Supabase Auth to verify credentials
 */
async function authenticate(email, password, req) {
  try {
    // Authenticate with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.log(`❌ Admin login failed: ${email}`);
      return null;
    }

    // Get profile to check role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Check if user has admin role
    const role = data.user.user_metadata?.role || profile?.role || 'user';

    if (role !== 'admin') {
      console.log(`❌ Admin login failed: ${email} (not admin role)`);
      return null;
    }

    // Log successful admin login
    const metadata = {
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      user_agent: req?.headers?.['user-agent'] || 'unknown',
    };

    await logAdminLogin(data.user.id, email, metadata);

    console.log(`✅ Admin login successful: ${email}`);

    // Return admin user object for AdminJS session
    return {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name || email,
      role: role,
      avatar_url: profile?.avatar_url || null,
    };

  } catch (error) {
    console.error('Admin authentication error:', error);
    return null;
  }
}

/**
 * Setup AdminJS with authentication
 */
function setupAdminJS() {
  // Configure resources (will be passed currentAdmin in routes)
  const adminOptionsWithResources = {
    ...adminOptions,
    resources: configureResources(),
  };

  const admin = new AdminJS(adminOptionsWithResources);

  // Build authenticated router
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'temp-dev-secret-min-32-chars-long',
    },
    null,
    {
      // Session configuration
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET || 'temp-dev-session-secret-min-32',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
      name: 'adminjs',
    },
    {
      // Additional options
      // This is where we could add custom logout handler
    }
  );

  return { admin, router };
}

// Export the setup function
module.exports = setupAdminJS;
