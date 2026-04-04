/**
 * AdminJS Configuration - Epic 10
 * Uses custom Supabase REST adapter (no DATABASE_URL needed)
 */

const path = require('path');
const AdminJSModule = require('adminjs');
const AdminJS = AdminJSModule.default || AdminJSModule;
const { ComponentLoader } = AdminJSModule;
const { SupabaseDatabase, SupabaseResource } = require('../adapters/adminjs-supabase');
const { logResourceUpdated, logResourceCreated, logResourceDeleted } = require('../services/audit.service');
const { supabaseAdmin } = require('./database');
const meilisearch = require('../services/meilisearch.service');
const r2Service = require('../services/r2.service');
const { clearCache: clearSettingsCache, SETTINGS_ROW_ID, getSettings } = require('../services/settings.service');
const { generateInvoicePDFBuffer, buildInvoiceNumber } = require('../services/invoice.service');
const { storeToken } = require('../services/admin-invoice-token.service');
const notificationsService = require('../services/notifications.service');

// Register Supabase adapter with AdminJS
AdminJS.registerAdapter({
  Database: SupabaseDatabase,
  Resource: SupabaseResource,
});

// ─── Custom Components ──────────────────────────────────────────────────────
const componentLoader = new ComponentLoader();
const Components = {
  AutoSearchFilter: componentLoader.add(
    'AutoSearchFilter',
    path.join(__dirname, '..', 'admin', 'components', 'AutoSearchFilter.jsx')
  ),
  ContentsGrid: componentLoader.add(
    'ContentsGrid',
    path.join(__dirname, '..', 'admin', 'components', 'ContentsGrid.jsx')
  ),
  CoverShow: componentLoader.add(
    'CoverShow',
    path.join(__dirname, '..', 'admin', 'components', 'CoverShow.jsx')
  ),
  CoverEdit: componentLoader.add(
    'CoverEdit',
    path.join(__dirname, '..', 'admin', 'components', 'CoverEdit.jsx')
  ),
  FileEdit: componentLoader.add(
    'FileEdit',
    path.join(__dirname, '..', 'admin', 'components', 'FileEdit.jsx')
  ),
  Dashboard: componentLoader.add(
    'Dashboard',
    path.join(__dirname, '..', 'admin', 'components', 'Dashboard.jsx')
  ),
  InvoicePreview: componentLoader.add(
    'InvoicePreview',
    path.join(__dirname, '..', 'admin', 'components', 'InvoicePreview.jsx')
  ),
  LogoUpload: componentLoader.add(
    'LogoUpload',
    path.join(__dirname, '..', 'admin', 'components', 'LogoUpload.jsx')
  ),
  NotificationsTest: componentLoader.add(
    'NotificationsTest',
    path.join(__dirname, '..', 'admin', 'components', 'NotificationsTest.jsx')
  ),
  PublishersDashboard: componentLoader.add(
    'PublishersDashboard',
    path.join(__dirname, '..', 'admin', 'components', 'PublishersDashboard.jsx')
  ),
  PublishersManager: componentLoader.add(
    'PublishersManager',
    path.join(__dirname, '..', 'admin', 'components', 'PublishersManager.jsx')
  ),
  ContentValidation: componentLoader.add(
    'ContentValidation',
    path.join(__dirname, '..', 'admin', 'components', 'ContentValidation.jsx')
  ),
  PayoutsManager: componentLoader.add(
    'PayoutsManager',
    path.join(__dirname, '..', 'admin', 'components', 'PayoutsManager.jsx')
  ),
  UserReadingManager: componentLoader.add(
    'UserReadingManager',
    path.join(__dirname, '..', 'admin', 'components', 'UserReadingManager.jsx')
  ),
  PublisherContentCreate: componentLoader.add(
    'PublisherContentCreate',
    path.join(__dirname, '..', 'admin', 'components', 'PublisherContentCreate.jsx')
  ),
  GeographicPricingEditor: componentLoader.add(
    'GeographicPricingEditor',
    path.join(__dirname, '..', 'admin', 'components', 'GeographicPricingEditor.jsx')
  ),
  GeoRestrictionsEditor: componentLoader.add(
    'GeoRestrictionsEditor',
    path.join(__dirname, '..', 'admin', 'components', 'GeoRestrictionsEditor.jsx')
  ),
};

// ─── Audit Hook Helpers ──────────────────────────────────────────────────────

/**
 * Creates after-action hooks that log to audit trail
 */
function auditAfterHook(actionType) {
  return async (response, request, context) => {
    const { currentAdmin, record, resource } = context;
    if (!currentAdmin || !record) return response;

    const adminId = currentAdmin.id;
    const resourceName = resource.id();
    const resourceId = record.params?.id;
    const metadata = {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
      user_agent: request?.headers?.['user-agent'] || 'AdminJS',
    };

    try {
      if (actionType === 'edit') {
        await logResourceUpdated(adminId, resourceName, resourceId, {}, record.params, metadata);
      } else if (actionType === 'new') {
        await logResourceCreated(adminId, resourceName, resourceId, record.params, metadata);
      } else if (actionType === 'delete') {
        await logResourceDeleted(adminId, resourceName, resourceId, record.params, metadata);
      }
    } catch (err) {
      console.error('Audit hook error:', err.message);
    }

    return response;
  };
}

/**
 * Enriches a profile record with subscription + reading stats
 */
async function enrichProfileShow(response, request, context) {
  const { record } = context;
  if (!record) return response;

  const userId = record.params?.id;
  if (!userId) return response;

  try {
    // Get subscription info
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan_type, amount, currency, provider, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get reading stats
    const { count: totalReads } = await supabaseAdmin
      .from('reading_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: completedReads } = await supabaseAdmin
      .from('reading_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_completed', true);

    // Get content unlocks count
    const { count: unlockCount } = await supabaseAdmin
      .from('content_unlocks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Inject enriched data into record params
    record.params['__subscription_status'] = sub?.status || 'Aucun';
    record.params['__subscription_plan'] = sub ? `${sub.plan_type} (${sub.amount} ${sub.currency})` : '-';
    record.params['__subscription_provider'] = sub?.provider || '-';
    record.params['__subscription_expires'] = sub?.current_period_end || '-';
    record.params['__reading_total'] = totalReads || 0;
    record.params['__reading_completed'] = completedReads || 0;
    record.params['__content_unlocks'] = unlockCount || 0;
  } catch (err) {
    console.error('Profile enrichment error:', err.message);
  }

  return response;
}

// ─── Profile-specific Hooks ─────────────────────────────────────────────────

/**
 * Before hook for profile creation: create Supabase Auth user first
 * The trigger handle_new_user() will auto-create the profile row
 */
async function profileBeforeNew(request) {
  const { payload } = request;
  if (!payload) return request;

  const email = payload.email;
  const password = payload.password;

  if (!email) {
    throw new AdminJSModule.ValidationError({
      email: { message: 'L\'email est obligatoire' },
    });
  }
  if (!password || password.length < 6) {
    throw new AdminJSModule.ValidationError({
      password: { message: 'Le mot de passe doit faire au moins 6 caracteres' },
    });
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Skip email confirmation for admin-created users
    user_metadata: {
      full_name: payload.full_name || '',
      role: payload.role || 'user',
    },
  });

  if (authError) {
    throw new AdminJSModule.ValidationError({
      email: { message: `Erreur Supabase Auth: ${authError.message}` },
    });
  }

  // The trigger creates the profile row — we need to UPDATE it instead of INSERT
  // Store the auth user ID so the after hook can update the profile
  request._authUserId = authData.user.id;

  // Remove password from payload (not a DB column)
  delete payload.password;

  // Set the ID to match the auth user
  payload.id = authData.user.id;

  return request;
}

/**
 * After hook for profile creation: update profile with admin-provided data + audit
 */
async function profileAfterNew(response, request, context) {
  const { record, currentAdmin } = context;
  const authUserId = request._authUserId;

  if (authUserId) {
    // The trigger already created a minimal profile — update it with full data
    const payload = request.payload || {};
    const updates = {};
    if (payload.full_name) updates.full_name = payload.full_name;
    if (payload.role) updates.role = payload.role;
    if (payload.is_active !== undefined) updates.is_active = payload.is_active;

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('profiles').update(updates).eq('id', authUserId);
    }
  }

  // Audit
  if (currentAdmin && record) {
    await logResourceCreated(currentAdmin.id, 'profiles', record.params?.id || authUserId, {
      email: record.params?.email,
      role: record.params?.role,
    }, {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
    });
  }

  return response;
}

/**
 * Before hook for profile delete: remove from Supabase Auth too
 */
async function profileBeforeDelete(request, context) {
  const { record } = context;
  if (!record) return request;

  const userId = record.params?.id;
  if (!userId) return request;

  // Delete from Supabase Auth (cascades to profile via trigger or we delete profile after)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`Auth delete error for ${userId}:`, error.message);
    // Continue anyway — profile will still be deleted from DB
  }

  return request;
}

/**
 * After hook for profile delete: audit trail
 */
async function profileAfterDelete(response, request, context) {
  const { record, currentAdmin } = context;
  if (currentAdmin && record) {
    await logResourceDeleted(currentAdmin.id, 'profiles', record.params?.id, {
      email: record.params?.email,
      full_name: record.params?.full_name,
    }, {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
    });
  }
  return response;
}

// ─── Subscription-specific Hooks ─────────────────────────────────────────────

/**
 * Before hook for subscription edit: validate + auto-fill from selected plan
 */
async function subscriptionBeforeEdit(request) {
  const { payload } = request;
  if (!payload) return request;

  const validStatuses = ['ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED'];
  if (payload.status && !validStatuses.includes(payload.status)) {
    throw new AdminJSModule.ValidationError({
      status: { message: `Statut invalide. Acceptes: ${validStatuses.join(', ')}` },
    });
  }

  // If plan_id changed, auto-fill plan fields from subscription_plans
  if (payload.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', payload.plan_id)
      .single();

    if (plan) {
      payload.plan_type = plan.duration_days <= 31 ? 'monthly' : 'yearly';
      payload.amount = plan.base_price_cents;
      payload.currency = plan.currency || 'XAF';
      payload.users_limit = plan.included_users || 1;

      // Recalculate period dates based on new plan duration
      const now = new Date();
      payload.current_period_start = now.toISOString();
      const newEnd = new Date(now);
      newEnd.setDate(newEnd.getDate() + (plan.duration_days || 30));
      payload.current_period_end = newEnd.toISOString();

      // Store plan snapshot for historical reference
      payload.plan_snapshot = JSON.stringify({
        display_name: plan.display_name,
        base_price_cents: plan.base_price_cents,
        duration_days: plan.duration_days,
        switched_at: now.toISOString(),
      });
    }
  }

  // Auto-set updated_at
  payload.updated_at = new Date().toISOString();

  return request;
}

/**
 * Populate plan_id availableValues dynamically from subscription_plans table
 */
async function loadPlanChoices() {
  const { data: plans } = await supabaseAdmin
    .from('subscription_plans')
    .select('id, display_name, base_price_cents, currency, duration_days, is_active')
    .order('base_price_cents', { ascending: true });

  if (!plans) return [];
  return plans.map(p => ({
    value: p.id,
    label: `${p.display_name} — ${p.base_price_cents} ${p.currency || 'XAF'} / ${p.duration_days}j${p.is_active ? '' : ' (inactif)'}`,
  }));
}

// Cache choices (refreshed on server restart)
let _planChoicesCache = null;
async function getPlanChoices() {
  if (!_planChoicesCache) {
    _planChoicesCache = await loadPlanChoices();
  }
  return _planChoicesCache;
}

/**
 * Load rights_holders as availableValues for contents.rights_holder_id
 */
async function loadRightsHolderChoices() {
  const { data } = await supabaseAdmin
    .from('rights_holders')
    .select('id, name, email')
    .order('name', { ascending: true });

  if (!data) return [];
  return data.map(rh => ({
    value: rh.id,
    label: `${rh.name}${rh.email ? ' (' + rh.email + ')' : ''}`,
  }));
}

/**
 * Load categories as availableValues for content_categories
 */
async function loadCategoryChoices() {
  const { data } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (!data) return [];
  return data.map(c => ({
    value: c.id,
    label: c.name,
  }));
}

/**
 * Custom action: Activate subscription manually (geste commercial)
 */
const activateSubscriptionAction = {
  actionType: 'record',
  icon: 'Play',
  label: 'Activer',
  guard: 'Etes-vous sur de vouloir activer cet abonnement manuellement ?',
  isVisible: (context) => {
    const status = context?.record?.params?.status;
    return status !== 'ACTIVE';
  },
  handler: async (request, response, context) => {
    const { record, currentAdmin } = context;
    if (!record) return { record: record.toJSON(), notice: { message: 'Enregistrement non trouve', type: 'error' } };

    const subId = record.params.id;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30); // 30 jours par defaut

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'ACTIVE',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', subId);

    if (error) {
      return {
        record: record.toJSON(),
        notice: { message: `Erreur: ${error.message}`, type: 'error' },
      };
    }

    // Audit
    if (currentAdmin) {
      await logResourceUpdated(currentAdmin.id, 'subscriptions', subId,
        { status: record.params.status },
        { status: 'ACTIVE', action: 'activation_manuelle' },
        { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
      );
    }

    // Reload record
    const { data: updated } = await supabaseAdmin.from('subscriptions').select('*').eq('id', subId).single();

    return {
      record: { ...record.toJSON(), params: updated },
      notice: { message: 'Abonnement active avec succes (30 jours)', type: 'success' },
    };
  },
};

/**
 * Custom action: Extend subscription (add days)
 */
const extendSubscriptionAction = {
  actionType: 'record',
  icon: 'Calendar',
  label: 'Prolonger (+30j)',
  guard: 'Prolonger cet abonnement de 30 jours supplementaires ?',
  isVisible: (context) => {
    const status = context?.record?.params?.status;
    return status === 'ACTIVE' || status === 'EXPIRED';
  },
  handler: async (request, response, context) => {
    const { record, currentAdmin } = context;
    if (!record) return { record: record.toJSON(), notice: { message: 'Enregistrement non trouve', type: 'error' } };

    const subId = record.params.id;
    const currentEnd = record.params.current_period_end
      ? new Date(record.params.current_period_end)
      : new Date();

    // If expired, extend from now; if active, extend from current end
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate);
    newEnd.setDate(newEnd.getDate() + 30);

    const updates = {
      current_period_end: newEnd.toISOString(),
      status: 'ACTIVE',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('subscriptions').update(updates).eq('id', subId);

    if (error) {
      return {
        record: record.toJSON(),
        notice: { message: `Erreur: ${error.message}`, type: 'error' },
      };
    }

    // Audit
    if (currentAdmin) {
      await logResourceUpdated(currentAdmin.id, 'subscriptions', subId,
        { current_period_end: record.params.current_period_end },
        { current_period_end: newEnd.toISOString(), action: 'prolongation_30j' },
        { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
      );
    }

    const { data: updated } = await supabaseAdmin.from('subscriptions').select('*').eq('id', subId).single();

    return {
      record: { ...record.toJSON(), params: updated },
      notice: { message: `Abonnement prolonge jusqu'au ${newEnd.toLocaleDateString('fr-FR')}`, type: 'success' },
    };
  },
};

/**
 * Custom action: Cancel subscription (access stays until period end)
 */
const cancelSubscriptionAction = {
  actionType: 'record',
  icon: 'XCircle',
  label: 'Annuler',
  guard: 'Annuler cet abonnement ? L\'acces restera actif jusqu\'a la fin de la periode payee.',
  isVisible: (context) => {
    const status = context?.record?.params?.status;
    return status === 'ACTIVE';
  },
  handler: async (request, response, context) => {
    const { record, currentAdmin } = context;
    if (!record) return { record: record.toJSON(), notice: { message: 'Enregistrement non trouve', type: 'error' } };

    const subId = record.params.id;
    const now = new Date();

    const updates = {
      cancel_at_period_end: true,
      cancelled_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { error } = await supabaseAdmin.from('subscriptions').update(updates).eq('id', subId);

    if (error) {
      return {
        record: record.toJSON(),
        notice: { message: `Erreur: ${error.message}`, type: 'error' },
      };
    }

    // Audit
    if (currentAdmin) {
      await logResourceUpdated(currentAdmin.id, 'subscriptions', subId,
        { cancel_at_period_end: false },
        { cancel_at_period_end: true, cancelled_at: now.toISOString(), action: 'annulation_admin' },
        { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
      );
    }

    const periodEnd = record.params.current_period_end
      ? new Date(record.params.current_period_end).toLocaleDateString('fr-FR')
      : 'N/A';

    const { data: updated } = await supabaseAdmin.from('subscriptions').select('*').eq('id', subId).single();

    return {
      record: { ...record.toJSON(), params: updated },
      notice: { message: `Abonnement annule. Acces actif jusqu'au ${periodEnd}`, type: 'success' },
    };
  },
};

// ─── Invoice Actions ──────────────────────────────────────────────────────────

/**
 * Shows an HTML invoice preview with current app_settings.
 * Renders the InvoicePreview component inline in AdminJS (no PDF, no navigation away).
 */
const previewInvoiceAction = {
  actionType: 'resource',
  icon: 'Eye',
  label: 'Aperçu Facture',
  component: Components.InvoicePreview,
  handler: async (request, response, context) => {
    // Component handles its own data fetching via /admin/invoice-preview-data
    return {};
  },
};

/**
 * Downloads the PDF invoice for a specific payment record.
 * Used on the payments resource as "Télécharger Facture".
 */
const downloadPaymentInvoiceAction = {
  actionType: 'record',
  icon: 'Download',
  label: 'Télécharger Facture PDF',
  component: false,  // pas de page React — exécute le handler et redirige
  isVisible: (context) => context?.record?.params?.status === 'succeeded',
  handler: async (request, response, context) => {
    const { record } = context;
    if (!record) {
      return { record: record?.toJSON(), notice: { message: 'Paiement introuvable', type: 'error' } };
    }

    try {
      const payment = record.params;

      // Fetch user profile
      let user = { email: 'inconnu@papyri.app', full_name: '' };
      if (payment.user_id) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', payment.user_id)
          .maybeSingle();
        if (profile) {
          user = { email: profile.email || user.email, full_name: profile.full_name || '' };
        }
      }

      // Fetch subscription (optional)
      let subscription = null;
      if (payment.subscription_id) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('id', payment.subscription_id)
          .maybeSingle();
        subscription = sub;
      }

      const settings = await getSettings();
      const prefix = settings.invoice_prefix || 'INV';
      const invoiceNumber = buildInvoiceNumber(payment.id, payment.paid_at || payment.created_at, prefix);
      const filename = `${invoiceNumber}.pdf`;

      const buffer = await generateInvoicePDFBuffer({ payment, user, subscription, settings });
      const token = storeToken(buffer, filename);

      return {
        record: record.toJSON(),
        redirectUrl: `/admin/invoice-token/${token}`,
        notice: { message: `Facture ${invoiceNumber} générée`, type: 'success' },
      };
    } catch (err) {
      console.error('Download payment invoice action error:', err);
      return {
        record: record.toJSON(),
        notice: { message: `Erreur : ${err.message}`, type: 'error' },
      };
    }
  },
};

// ─── Category-specific Hooks ─────────────────────────────────────────────────

/**
 * Before hook for category create/edit: validate name + auto-generate slug
 */
async function categoryBeforeSave(request) {
  const { payload } = request;
  if (!payload) return request;

  if (!payload.name || !payload.name.trim()) {
    throw new AdminJSModule.ValidationError({
      name: { message: 'Le nom de la categorie est obligatoire' },
    });
  }

  payload.name = payload.name.trim();

  // Auto-generate slug from name if not provided
  if (!payload.slug || !payload.slug.trim()) {
    payload.slug = payload.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  return request;
}

// ─── Content-specific Hooks ──────────────────────────────────────────────────

const VALID_FORMATS = ['epub', 'pdf', 'mp3', 'm4a'];
const FORMAT_CONTENT_TYPES = {
  epub: 'ebook', pdf: 'ebook', mp3: 'audiobook', m4a: 'audiobook',
};

/**
 * Before hook for content creation: validate and set defaults
 */
async function contentBeforeNew(request) {
  const { payload } = request;
  if (!payload) return request;

  // Validate format
  if (payload.format && !VALID_FORMATS.includes(payload.format)) {
    throw new AdminJSModule.ValidationError({
      format: { message: `Format invalide. Acceptes: ${VALID_FORMATS.join(', ')}` },
    });
  }

  // Auto-set content_type from format
  if (payload.format && !payload.content_type) {
    payload.content_type = FORMAT_CONTENT_TYPES[payload.format];
  }

  // Auto-set published_at if publishing
  if (payload.is_published === true || payload.is_published === 'true') {
    if (!payload.published_at) {
      payload.published_at = new Date().toISOString();
    }
  }

  // Default access_type
  if (!payload.access_type) {
    payload.access_type = 'subscription';
  }

  return request;
}

/**
 * After hook for content creation: index in Meilisearch + audit
 */
async function contentAfterNew(response, request, context) {
  const { record, currentAdmin } = context;
  if (!record || !record.params?.id) return response;

  // Index in Meilisearch (silently)
  try {
    await meilisearch.indexContent(record.params);
    console.log(`✅ Content indexed in Meilisearch: ${record.params.title}`);
  } catch (err) {
    console.error('Meilisearch index error (non-blocking):', err.message);
  }

  // Audit
  if (currentAdmin) {
    await logResourceCreated(currentAdmin.id, 'contents', record.params.id, record.params, {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
    });
  }

  // Notify users when content is published immediately on creation
  if (record.params?.is_published === true || record.params?.is_published === 'true') {
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_active', true);
      const userIds = (profiles || []).map((p) => p.id);
      if (userIds.length > 0) {
        await notificationsService.notifyNewContent(userIds, record.params);
      }
    } catch (notifErr) {
      console.error('New content notification error (non-blocking):', notifErr.message);
    }
  }

  return response;
}

/**
 * After hook for content edit: re-index in Meilisearch + audit
 */
async function contentAfterEdit(response, request, context) {
  const { record, currentAdmin } = context;
  if (!record || !record.params?.id) return response;

  // Re-index in Meilisearch
  try {
    await meilisearch.indexContent(record.params);
  } catch (err) {
    console.error('Meilisearch re-index error (non-blocking):', err.message);
  }

  // Audit
  if (currentAdmin) {
    await logResourceUpdated(currentAdmin.id, 'contents', record.params.id, {}, record.params, {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
    });
  }

  // Notify users when a draft content is published via edit
  const justPublished = (record.params?.is_published === true || record.params?.is_published === 'true')
    && request?.payload?.is_published === 'true';
  if (justPublished) {
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_active', true);
      const userIds = (profiles || []).map((p) => p.id);
      if (userIds.length > 0) {
        await notificationsService.notifyNewContent(userIds, record.params);
      }
    } catch (notifErr) {
      console.error('Publish notification error (non-blocking):', notifErr.message);
    }
  }

  return response;
}

/**
 * After hook for content delete: remove from Meilisearch + R2 + audit
 */
async function contentAfterDelete(response, request, context) {
  const { record, currentAdmin } = context;
  if (!record) return response;

  const contentId = record.params?.id;
  const fileKey = record.params?.file_key;

  // Remove from Meilisearch
  try {
    if (contentId) await meilisearch.deleteContent(contentId);
  } catch (err) {
    console.error('Meilisearch delete error (non-blocking):', err.message);
  }

  // Audit
  if (currentAdmin) {
    await logResourceDeleted(currentAdmin.id, 'contents', contentId, {
      title: record.params?.title,
      file_key: fileKey,
    }, {
      ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel',
    });
  }

  return response;
}

// ─── Promo Code Hooks & Actions ──────────────────────────────────────────────

/**
 * Enrichit la vue détail d'un code promo avec les stats d'utilisation.
 */
async function enrichPromoCodeShow(response, request, context) {
  const { record } = context;
  if (!record) return response;

  const promoId = record.params?.id;
  if (!promoId) return response;

  try {
    const now = new Date();

    // Total remises accordées
    const { data: usages } = await supabaseAdmin
      .from('promo_code_usages')
      .select('discount_applied, used_at, user_id')
      .eq('promo_code_id', promoId)
      .order('used_at', { ascending: false });

    const totalDiscount = (usages || []).reduce((sum, u) => sum + Number(u.discount_applied || 0), 0);

    // Statut calculé
    const isActive = record.params?.is_active;
    const validUntil = record.params?.valid_until ? new Date(record.params.valid_until) : null;
    const maxUses = record.params?.max_uses;
    const usedCount = Number(record.params?.used_count || 0);

    let status;
    if (!isActive) {
      status = 'Inactif';
    } else if (validUntil && validUntil < now) {
      status = 'Expiré';
    } else if (maxUses !== null && maxUses !== undefined && usedCount >= Number(maxUses)) {
      status = 'Quota atteint';
    } else {
      status = 'Actif';
    }

    // Utilisations restantes
    let remaining;
    if (!maxUses) {
      remaining = 'Illimité';
    } else {
      remaining = `${Number(maxUses) - usedCount} restantes sur ${maxUses}`;
    }

    // Résumé des 5 dernières utilisations
    let usagesSummary = 'Aucune utilisation pour le moment.';
    if (usages && usages.length > 0) {
      usagesSummary = usages.slice(0, 5).map((u) => {
        const date = new Date(u.used_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        return `• ${date} — remise ${Number(u.discount_applied).toFixed(2)} EUR (user: ${u.user_id.slice(0, 8)}…)`;
      }).join('\n');
      if (usages.length > 5) {
        usagesSummary += `\n… et ${usages.length - 5} autre(s)`;
      }
    }

    record.params['__status']             = status;
    record.params['__remaining_uses']     = remaining;
    record.params['__total_discount_eur'] = `${totalDiscount.toFixed(2)} EUR (${(usages || []).length} utilisations)`;
    record.params['__recent_usages']      = usagesSummary;
  } catch (err) {
    console.error('Promo enrichment error:', err.message);
  }

  return response;
}

/**
 * Action "Désactiver/Réactiver" — toggle is_active directement depuis liste ou show.
 */
const togglePromoActiveAction = {
  name: 'toggleActive',
  actionType: 'record',
  icon: 'Power',
  label: 'Désactiver / Réactiver',
  guard: 'Confirmer le changement de statut du code promo ?',
  component: false,
  handler: async (request, response, context) => {
    const { record, currentAdmin } = context;
    if (!record) {
      throw new Error('Enregistrement introuvable.');
    }

    const currentValue = record.params?.is_active;
    const newValue = !currentValue;
    const promoId = record.params?.id;

    const { error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: newValue, updated_at: new Date().toISOString() })
      .eq('id', promoId);

    if (error) throw error;

    // Audit
    if (currentAdmin) {
      await logResourceUpdated(
        currentAdmin.id,
        'promo_codes',
        promoId,
        { is_active: currentValue },
        { is_active: newValue },
        { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
      ).catch(() => {});
    }

    // Rafraîchir l'enregistrement
    const { data: updated } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('id', promoId)
      .single();

    if (updated) {
      Object.assign(record.params, updated);
    }

    return {
      record: record.toJSON(currentAdmin),
      notice: {
        message: newValue ? 'Code promo activé.' : 'Code promo désactivé.',
        type: 'success',
      },
    };
  },
};

/**
 * Action "Dupliquer" — crée une copie du code avec un nouveau nom.
 */
const duplicatePromoCodeAction = {
  name: 'duplicate',
  actionType: 'record',
  icon: 'Copy',
  label: 'Dupliquer',
  guard: 'Créer une copie de ce code promo ?',
  component: false,
  handler: async (request, response, context) => {
    const { record, currentAdmin } = context;
    if (!record) throw new Error('Enregistrement introuvable.');

    const original = record.params;
    const newCode = `${original.code}_COPY_${Date.now().toString().slice(-4)}`;

    const { data: copy, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        code: newCode,
        description: original.description ? `Copie de ${original.code}` : null,
        discount_type: original.discount_type,
        discount_value: original.discount_value,
        max_uses: original.max_uses,
        valid_from: original.valid_from,
        valid_until: original.valid_until,
        applicable_plans: original.applicable_plans,
        is_active: false, // la copie est inactive par défaut
      })
      .select()
      .single();

    if (error) throw error;

    if (currentAdmin) {
      await logResourceCreated(
        currentAdmin.id,
        'promo_codes',
        copy.id,
        copy,
        { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
      ).catch(() => {});
    }

    return {
      record: record.toJSON(currentAdmin),
      notice: {
        message: `Code «${newCode}» créé (inactif). Modifiez-le avant de l'activer.`,
        type: 'success',
      },
      redirectUrl: `/admin/resources/promo_codes`,
    };
  },
};

// ─── AdminJS Options ─────────────────────────────────────────────────────────

async function buildAdminOptions() {
  // Load dynamic choices from DB at startup
  const planChoices = await getPlanChoices();
  const rightsHolderChoices = await loadRightsHolderChoices();
  const categoryChoices = await loadCategoryChoices();

  return {
  componentLoader,
  rootPath: '/admin',
  dashboard: {
    component: Components.Dashboard,
  },
  assets: {
    styles: ['/public/admin-custom.css'],
  },
  branding: {
    companyName: 'Papyri — Back-Office',
    softwareBrothers: false,
    logo: false,
    theme: {
      colors: {
        primary100: '#B5651D',
        primary80: '#D4A017',
        primary60: '#2E4057',
        love: '#B5651D',
      },
    },
  },
  locale: {
    language: 'fr',
    translations: {
      fr: {
        labels: {
          loginWelcome: 'Connexion Back-Office Papyri',
          navigation: 'Navigation',
          profiles: 'Utilisateurs',
          subscriptions: 'Abonnements',
          contents: 'Contenus',
          audit_logs: 'Journal d\'audit',
          categories: 'Categories',
          subscription_plans: 'Plans',
          reading_history: 'Historique lecture',
          content_unlocks: 'Contenus debloques',
          rights_holders: 'Ayants droit',
          content_categories: 'Categories ↔ Contenus',
          app_settings: 'Paramètres Facture',
          payments: 'Paiements',
          promo_codes: 'Codes Promo',
          promo_code_usages: 'Utilisations Promo',
          'test-notifications': 'Test Notifications',
        },
        actions: {
          list: 'Liste',
          show: 'Voir',
          edit: 'Modifier',
          delete: 'Supprimer',
          new: 'Nouveau',
          bulkDelete: 'Supprimer selection',
        },
        buttons: {
          save: 'Enregistrer',
          cancel: 'Annuler',
          filter: 'Filtrer',
        },
        messages: {
          successfullyCreated: 'Element cree avec succes',
          successfullyUpdated: 'Element modifie avec succes',
          successfullyDeleted: 'Element supprime avec succes',
          loginWelcome: 'Connectez-vous au back-office Papyri',
        },
      },
    },
  },
  pages: {
    'test-notifications': {
      label: 'Test Notifications',
      icon: 'Bell',
      component: Components.NotificationsTest,
      handler: async (request, response, context) => {
        return { data: {} };
      },
    },
    'publishers-dashboard': {
      label: 'Dashboard Éditeurs',
      icon: 'BarChart2',
      component: Components.PublishersDashboard,
      handler: async (request, response, context) => { return { data: {} }; },
    },
    'publishers-list': {
      label: 'Gérer les éditeurs',
      icon: 'BookOpen',
      component: Components.PublishersManager,
      handler: async (request, response, context) => { return { data: {} }; },
    },
    'content-validation': {
      label: 'Validation contenu',
      icon: 'CheckSquare',
      component: Components.ContentValidation,
      handler: async (request, response, context) => { return { data: {} }; },
    },
    'payouts': {
      label: 'Versements éditeurs',
      icon: 'DollarSign',
      component: Components.PayoutsManager,
      handler: async (request, response, context) => { return { data: {} }; },
    },
    'publisher-content-create': {
      label: 'Soumettre un contenu',
      icon: 'PlusCircle',
      component: Components.PublisherContentCreate,
      handler: async (request, response, context) => { return { data: {} }; },
    },
    'user-reading': {
      label: 'Gestion utilisateurs',
      icon: 'Users',
      component: Components.UserReadingManager,
      handler: async (request, response, context) => { return { data: {} }; },
    },
  },
  resources: [
    // ─── Utilisateurs (Full CRUD) ──────────────────────────────────────
    {
      resource: 'profiles',
      options: {
        navigation: { name: 'Gestion', icon: 'User' },
        listProperties: ['email', 'full_name', 'role', 'is_active', 'created_at'],
        showProperties: [
          'id', 'email', 'full_name', 'role', 'is_active',
          'avatar_url', 'onboarding_completed', 'analytics_consent',
          'created_at', 'updated_at',
          // Enriched virtual fields
          '__subscription_status', '__subscription_plan', '__subscription_provider', '__subscription_expires',
          '__reading_total', '__reading_completed', '__content_unlocks',
        ],
        editProperties: ['email', 'password', 'full_name', 'role', 'is_active'],
        filterProperties: ['__search', 'role', 'is_active'],
        properties: {
          __search: {
            label: 'Rechercher (email ou nom)',
            type: 'string',
            isVisible: { list: false, show: false, edit: false, filter: true },
            components: { filter: Components.AutoSearchFilter },
          },
          password: {
            type: 'password',
            isVisible: { list: false, filter: false, show: false, edit: true },
            label: 'Mot de passe',
          },
          email: {
            isVisible: { list: true, filter: false, show: true, edit: true },
          },
          role: {
            availableValues: [
              { value: 'user', label: 'Utilisateur' },
              { value: 'admin', label: 'Administrateur' },
            ],
          },
          is_active: {
            label: 'Actif (decocher = bloquer)',
          },
          // Virtual properties for enriched show view
          __subscription_status: { label: 'Statut abonnement', isVisible: { list: false, filter: false, show: true, edit: false } },
          __subscription_plan: { label: 'Plan actuel', isVisible: { list: false, filter: false, show: true, edit: false } },
          __subscription_provider: { label: 'Passerelle paiement', isVisible: { list: false, filter: false, show: true, edit: false } },
          __subscription_expires: { label: 'Expiration abonnement', isVisible: { list: false, filter: false, show: true, edit: false } },
          __reading_total: { label: 'Contenus commences', isVisible: { list: false, filter: false, show: true, edit: false } },
          __reading_completed: { label: 'Contenus termines', isVisible: { list: false, filter: false, show: true, edit: false } },
          __content_unlocks: { label: 'Contenus debloques', isVisible: { list: false, filter: false, show: true, edit: false } },
        },
        actions: {
          list: { isVisible: true },
          show: {
            isVisible: true,
            after: [enrichProfileShow],
          },
          new: {
            isVisible: true,
            before: [profileBeforeNew],
            after: [profileAfterNew],
          },
          edit: {
            isVisible: true,
            before: [async (request) => {
              // Strip email & password from edit — not editable on existing users
              if (request.payload) {
                delete request.payload.email;
                delete request.payload.password;
              }
              return request;
            }],
            after: [auditAfterHook('edit')],
          },
          delete: {
            isVisible: true,
            before: [profileBeforeDelete],
            after: [profileAfterDelete],
          },
          bulkDelete: {
            isVisible: false, // Trop dangereux — suppression un par un uniquement
          },
        },
      },
    },
    // ─── Abonnements (Story 10.3: Gestion manuelle) ────────────────────
    {
      resource: 'subscriptions',
      options: {
        navigation: { name: 'Gestion', icon: 'CreditCard' },
        listProperties: ['user_id', 'plan_type', 'status', 'provider', 'cancel_at_period_end', 'current_period_end', 'created_at'],
        showProperties: [
          'id', 'user_id', 'plan_id', 'plan_type', 'amount', 'currency',
          'status', 'provider', 'provider_subscription_id', 'provider_customer_id',
          'current_period_start', 'current_period_end',
          'cancel_at_period_end', 'cancelled_at', 'users_limit',
          'metadata', 'plan_snapshot', 'created_at', 'updated_at',
        ],
        editProperties: [
          'plan_id', 'status',
          'current_period_start', 'current_period_end',
          'cancel_at_period_end', 'users_limit',
        ],
        filterProperties: ['status', 'provider', 'plan_type', 'cancel_at_period_end'],
        properties: {
          status: {
            availableValues: [
              { value: 'ACTIVE', label: 'Actif' },
              { value: 'INACTIVE', label: 'Inactif' },
              { value: 'EXPIRED', label: 'Expire' },
              { value: 'CANCELLED', label: 'Annule' },
            ],
          },
          provider: {
            availableValues: [
              { value: 'flutterwave', label: 'Flutterwave' },
              { value: 'admin', label: 'Admin (manuel)' },
            ],
          },
          plan_type: {
            availableValues: [
              { value: 'monthly', label: 'Mensuel' },
              { value: 'yearly', label: 'Annuel' },
            ],
            label: 'Type de plan',
          },
          amount: { label: 'Montant' },
          currency: { label: 'Devise' },
          current_period_start: { label: 'Debut periode' },
          current_period_end: { label: 'Fin periode' },
          cancel_at_period_end: { label: 'Annulation en fin de periode' },
          cancelled_at: { label: 'Date annulation' },
          users_limit: { label: 'Limite utilisateurs' },
          user_id: { label: 'Utilisateur' },
          plan_id: {
            label: 'Plan d\'abonnement',
            availableValues: planChoices,
          },
        },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: {
            isVisible: true,
            before: [subscriptionBeforeEdit],
            after: [auditAfterHook('edit')],
          },
          new: { isVisible: false }, // Les abos sont crees via paiement ou action "Activer"
          delete: { isVisible: false }, // Pas de suppression — on annule
          bulkDelete: { isVisible: false },
          activate: activateSubscriptionAction,
          extend: extendSubscriptionAction,
          cancel: cancelSubscriptionAction,
        },
      },
    },
    // ─── Contenus (Story 10.4: CRUD complet) ────────────────────────
    {
      resource: 'contents',
      options: {
        navigation: { name: 'Contenu', icon: 'Book' },
        listProperties: ['title', 'author', 'content_type', 'format', 'language', 'is_published', 'access_type', 'created_at'],
        showProperties: [
          'id', 'title', 'author', 'description',
          'content_type', 'format', 'language',
          'cover_url', 'file_key', 'file_size_bytes', 'duration_seconds',
          'rights_holder_id', 'is_published', 'published_at',
          'access_type', 'is_purchasable', 'price_cents', 'price_currency', 'subscription_discount_percent',
          'created_at', 'updated_at',
        ],
        editProperties: [
          'title', 'author', 'description',
          'content_type', 'format', 'language',
          'cover_url', 'file_key', 'file_size_bytes', 'duration_seconds',
          'rights_holder_id', 'is_published', 'published_at',
          'access_type', 'is_purchasable', 'price_cents', 'price_currency', 'subscription_discount_percent',
        ],
        filterProperties: ['__search', 'content_type', 'format', 'language', 'is_published', 'access_type'],
        properties: {
          __search: {
            label: 'Rechercher (titre ou auteur)',
            type: 'string',
            isVisible: { list: false, show: false, edit: false, filter: true },
            components: { filter: Components.AutoSearchFilter },
          },
          description: { type: 'textarea' },
          content_type: {
            availableValues: [
              { value: 'ebook', label: 'Ebook' },
              { value: 'audiobook', label: 'Audiobook' },
            ],
          },
          format: {
            availableValues: [
              { value: 'epub', label: 'EPUB' },
              { value: 'pdf', label: 'PDF' },
              { value: 'mp3', label: 'MP3' },
              { value: 'm4a', label: 'M4A' },
            ],
          },
          access_type: {
            availableValues: [
              { value: 'subscription', label: 'Abonnement' },
              { value: 'paid', label: 'Payant' },
              { value: 'subscription_or_paid', label: 'Abonnement ou Payant' },
            ],
          },
          cover_url: { label: 'Couverture', components: { show: Components.CoverShow, edit: Components.CoverEdit } },
          file_key: { label: 'Fichier (EPUB/PDF/MP3/M4A)', components: { edit: Components.FileEdit } },
          file_size_bytes: { label: 'Taille (octets)' },
          duration_seconds: { label: 'Duree (secondes)' },
          rights_holder_id: {
            label: 'Ayant droit',
            availableValues: rightsHolderChoices,
          },
          price_cents: { label: 'Prix (centimes)' },
          subscription_discount_percent: { label: 'Remise abonnes (%)' },
        },
        actions: {
          list: { isVisible: true, component: Components.ContentsGrid },
          show: { isVisible: true },
          new: {
            isVisible: true,
            before: [contentBeforeNew],
            after: [contentAfterNew],
          },
          edit: {
            isVisible: true,
            before: [contentBeforeNew],
            after: [contentAfterEdit],
          },
          delete: {
            isVisible: true,
            after: [contentAfterDelete],
          },
          geoPricing: {
            actionType: 'record',
            label: 'Prix Géographiques',
            icon: 'Globe',
            isVisible: true,
            component: Components.GeographicPricingEditor,
            handler: async (request, response, context) => {
              return { record: context.record.toJSON(context.currentAdmin) };
            },
          },
          geoRestrictions: {
            actionType: 'record',
            label: 'Restrictions Géo',
            icon: 'Lock',
            isVisible: true,
            component: Components.GeoRestrictionsEditor,
            handler: async (request, response, context) => {
              return { record: context.record.toJSON(context.currentAdmin) };
            },
          },
        },
      },
    },
    // ─── Categories (Full CRUD) ──────────────────────────────────────
    {
      resource: 'categories',
      options: {
        navigation: { name: 'Contenu', icon: 'Tag' },
        listProperties: ['name', 'slug', 'description', 'created_at'],
        editProperties: ['name', 'slug', 'description'],
        showProperties: ['id', 'name', 'slug', 'description', 'created_at'],
        properties: {
          name: { label: 'Nom', isRequired: true },
          slug: { label: 'Slug (auto-genere si vide)' },
          description: { label: 'Description', type: 'textarea' },
        },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          new: {
            isVisible: true,
            before: [categoryBeforeSave],
            after: [auditAfterHook('new')],
          },
          edit: {
            isVisible: true,
            before: [categoryBeforeSave],
            after: [auditAfterHook('edit')],
          },
          delete: {
            isVisible: true,
            after: [auditAfterHook('delete')],
          },
        },
      },
    },
    // ─── Ayants droit (Full CRUD - Story 10.5) ─────────────────────────
    {
      resource: 'rights_holders',
      options: {
        navigation: { name: 'Contenu', icon: 'Briefcase' },
        listProperties: ['name', 'email', 'website', 'created_at'],
        editProperties: ['name', 'email', 'website'],
        showProperties: ['id', 'name', 'email', 'website', 'created_at', 'updated_at'],
        properties: {
          name: { label: 'Nom (editeur/auteur)', isRequired: true },
          email: { label: 'Email contact' },
          website: { label: 'Site web' },
        },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          new: {
            isVisible: true,
            after: [auditAfterHook('new')],
          },
          edit: {
            isVisible: true,
            after: [auditAfterHook('edit')],
          },
          delete: {
            isVisible: true,
            after: [auditAfterHook('delete')],
          },
        },
      },
    },
    // ─── Liaison Categories ↔ Contenus (Story 10.5) ──────────────────
    {
      resource: 'content_categories',
      options: {
        navigation: { name: 'Contenu', icon: 'Link' },
        listProperties: ['content_id', 'category_id'],
        editProperties: ['content_id', 'category_id'],
        properties: {
          content_id: { label: 'Contenu' },
          category_id: {
            label: 'Categorie',
            availableValues: categoryChoices,
          },
        },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          new: {
            isVisible: true,
            after: [auditAfterHook('new')],
          },
          edit: { isVisible: false }, // Composite key — on supprime et recrée
          delete: {
            isVisible: true,
            after: [auditAfterHook('delete')],
          },
        },
      },
    },
    // ─── Plans d'abonnement ───────────────────────────────────────────
    {
      resource: 'subscription_plans',
      options: {
        navigation: { name: 'Gestion', icon: 'DollarSign' },
        listProperties: ['display_name', 'slug', 'base_price_cents', 'currency', 'duration_days', 'is_active'],
        showProperties: [
          'id', 'display_name', 'slug', 'description', 'is_active',
          'base_price_cents', 'currency', 'duration_days',
          'included_users', 'extra_user_price_cents',
          'text_quota_per_user', 'audio_quota_per_user',
          'paid_books_discount_percent',
          'bonus_trigger', 'bonus_type', 'bonus_quantity_per_user', 'bonus_validity_days',
          'metadata', 'created_at', 'updated_at',
        ],
        properties: {
          display_name: { label: 'Nom du plan' },
          base_price_cents: { label: 'Prix (centimes)' },
          duration_days: { label: 'Duree (jours)' },
          included_users: { label: 'Utilisateurs inclus' },
          extra_user_price_cents: { label: 'Prix utilisateur supp. (centimes)' },
          text_quota_per_user: { label: 'Quota texte/utilisateur' },
          audio_quota_per_user: { label: 'Quota audio/utilisateur' },
          paid_books_discount_percent: { label: 'Remise livres payants (%)' },
          bonus_trigger: { label: 'Declencheur bonus' },
          bonus_type: { label: 'Type bonus' },
          bonus_quantity_per_user: { label: 'Quantite bonus/utilisateur' },
          bonus_validity_days: { label: 'Validite bonus (jours)' },
        },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
    // ─── Historique lecture ────────────────────────────────────────────
    {
      resource: 'reading_history',
      options: {
        navigation: { name: 'Activite', icon: 'Activity' },
        listProperties: ['user_id', 'content_id', 'progress_percent', 'is_completed', 'last_read_at'],
        showProperties: [
          'id', 'user_id', 'content_id', 'progress_percent', 'last_position',
          'total_time_seconds', 'is_completed', 'started_at', 'last_read_at',
          'completed_at', 'created_at',
        ],
        filterProperties: ['user_id', 'is_completed'],
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
    // ─── Contenus debloques ───────────────────────────────────────────
    {
      resource: 'content_unlocks',
      options: {
        navigation: { name: 'Activite', icon: 'Unlock' },
        listProperties: ['user_id', 'content_id', 'source', 'paid_amount_cents', 'unlocked_at'],
        filterProperties: ['source', 'user_id'],
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
    // ─── Paramètres Facture (app_settings — singleton) ────────────────
    {
      resource: 'app_settings',
      options: {
        navigation: { name: 'Systeme', icon: 'Settings' },
        listProperties: ['company_name', 'company_email', 'invoice_prefix', 'invoice_primary_color', 'updated_at'],
        showProperties: [
          'id',
          'company_name', 'company_tagline', 'company_address',
          'company_email', 'company_website', 'company_phone', 'company_vat_id',
          'invoice_prefix', 'invoice_primary_color', 'invoice_accent_color',
          'invoice_logo_url', 'invoice_footer_text', 'invoice_notes',
          'updated_by', 'updated_at',
        ],
        editProperties: [
          'company_name', 'company_tagline', 'company_address',
          'company_email', 'company_website', 'company_phone', 'company_vat_id',
          'invoice_prefix', 'invoice_primary_color', 'invoice_accent_color',
          'invoice_logo_url', 'invoice_footer_text', 'invoice_notes',
        ],
        filterProperties: [],
        properties: {
          company_name:        { label: 'Nom de la société', isRequired: true },
          company_tagline:     { label: 'Slogan / sous-titre' },
          company_address:     { label: 'Adresse' },
          company_email:       { label: 'Email de contact' },
          company_website:     { label: 'Site web' },
          company_phone:       { label: 'Téléphone' },
          company_vat_id:      { label: 'N° TVA / SIRET / IFU' },
          invoice_prefix:      { label: 'Préfixe factures (ex: INV)' },
          invoice_primary_color: { label: 'Couleur principale (hex, ex: #B5651D)' },
          invoice_accent_color:  { label: 'Couleur accent (hex, ex: #D4A017)' },
          invoice_logo_url: {
            label: 'Logo de la société',
            components: { edit: Components.LogoUpload },
          },
          invoice_footer_text: { label: 'Texte de bas de facture', type: 'textarea' },
          invoice_notes:       { label: 'Notes additionnelles (facultatif)', type: 'textarea' },
          updated_by:          { label: 'Modifié par' },
          updated_at:          { label: 'Dernière modification' },
        },
        actions: {
          list:       { isVisible: true },
          show:       { isVisible: true },
          new:        { isVisible: false }, // singleton — pas de création
          delete:     { isVisible: false }, // singleton — pas de suppression
          bulkDelete: { isVisible: false },
          edit: {
            isVisible: true,
            before: [async (request) => {
              // Prevent editing the fixed singleton row ID
              if (request.payload) {
                delete request.payload.id;
              }
              return request;
            }],
            after: [async (response, request, context) => {
              const { currentAdmin } = context;
              // Stamp updated_by with the admin's ID
              if (currentAdmin) {
                await supabaseAdmin
                  .from('app_settings')
                  .update({ updated_by: currentAdmin.id })
                  .eq('id', SETTINGS_ROW_ID);
              }
              // Invalidate the settings cache so next invoice uses new values
              clearSettingsCache();
              // Audit
              if (currentAdmin) {
                await logResourceUpdated(
                  currentAdmin.id, 'app_settings', SETTINGS_ROW_ID,
                  {}, request.payload || {},
                  { ip_address: request?.headers?.['x-forwarded-for'] || 'admin-panel' }
                );
              }
              return response;
            }],
          },
          // Custom action: generate a sample invoice with current settings
          previewInvoice: previewInvoiceAction,
        },
      },
    },
    // ─── Paiements (lecture seule + téléchargement facture) ───────────
    {
      resource: 'payments',
      options: {
        navigation: { name: 'Gestion', icon: 'FileText' },
        listProperties: ['user_id', 'amount', 'currency', 'status', 'provider', 'payment_method', 'paid_at', 'created_at'],
        showProperties: [
          'id', 'user_id', 'subscription_id',
          'amount', 'currency', 'status',
          'provider', 'provider_payment_id', 'payment_method',
          'metadata', 'error_message',
          'paid_at', 'failed_at', 'created_at',
        ],
        filterProperties: ['status', 'provider', 'payment_method', 'user_id'],
        sort: { sortBy: 'created_at', direction: 'desc' },
        properties: {
          user_id:            { label: 'Utilisateur' },
          subscription_id:    { label: 'Abonnement' },
          amount:             { label: 'Montant' },
          currency:           { label: 'Devise' },
          status: {
            label: 'Statut',
            availableValues: [
              { value: 'pending',   label: 'En attente' },
              { value: 'succeeded', label: 'Réussi' },
              { value: 'failed',    label: 'Échoué' },
              { value: 'cancelled', label: 'Annulé' },
            ],
          },
          provider: {
            label: 'Prestataire',
            availableValues: [
              { value: 'stripe',       label: 'Stripe' },
              { value: 'flutterwave', label: 'Flutterwave' },
            ],
          },
          payment_method:         { label: 'Méthode' },
          provider_payment_id:    { label: 'Réf. prestataire' },
          metadata:               { label: 'Métadonnées' },
          error_message:          { label: 'Message erreur' },
          paid_at:                { label: 'Payé le' },
          failed_at:              { label: 'Échoué le' },
        },
        actions: {
          list:       { isVisible: true },
          show:       { isVisible: true },
          edit:       { isVisible: false },
          new:        { isVisible: false },
          delete:     { isVisible: false },
          bulkDelete: { isVisible: false },
          // Custom: download PDF invoice (only on succeeded payments)
          downloadInvoice: downloadPaymentInvoiceAction,
        },
      },
    },
    // ─── Codes promo ──────────────────────────────────────────────────
    {
      resource: 'promo_codes',
      options: {
        navigation: { name: 'Marketing', icon: 'Tag' },
        listProperties: ['code', 'discount_type', 'discount_value', 'max_uses', 'used_count', 'valid_until', 'is_active'],
        showProperties: [
          'id', 'code', 'description',
          'discount_type', 'discount_value',
          'max_uses', 'used_count',
          'valid_from', 'valid_until',
          'applicable_plans', 'is_active',
          '__status', '__remaining_uses', '__total_discount_eur', '__recent_usages',
          'created_at', 'updated_at',
        ],
        editProperties: [
          'code', 'description', 'discount_type', 'discount_value',
          'max_uses', 'valid_from', 'valid_until', 'applicable_plans', 'is_active',
        ],
        filterProperties: ['is_active', 'discount_type'],
        sort: { sortBy: 'created_at', direction: 'desc' },
        properties: {
          code: {
            label: 'Code',
            description: 'Ex: BIENVENUE20 — sera automatiquement mis en majuscules côté client',
          },
          description:    { label: 'Description interne' },
          discount_type: {
            label: 'Type de remise',
            availableValues: [
              { value: 'percent', label: 'Pourcentage (%)' },
              { value: 'fixed',   label: 'Montant fixe (EUR)' },
            ],
          },
          discount_value: { label: 'Valeur (% ou EUR)' },
          max_uses:       { label: 'Utilisations max (vide = illimité)' },
          used_count:     { label: 'Utilisations effectuées' },
          valid_from:     { label: 'Valable à partir de' },
          valid_until:    { label: 'Expiration' },
          applicable_plans: {
            label: 'Plans applicables',
            description: 'Laisser vide pour s\'appliquer à tous les plans. Ex: ["monthly","yearly"]',
          },
          is_active: { label: 'Actif' },
          // Champs virtuels (show view)
          __status:             { label: 'Statut calculé',        isVisible: { list: false, show: true, edit: false, filter: false } },
          __remaining_uses:     { label: 'Utilisations restantes', isVisible: { list: false, show: true, edit: false, filter: false } },
          __total_discount_eur: { label: 'Total remises accordées', isVisible: { list: false, show: true, edit: false, filter: false } },
          __recent_usages:      { label: 'Dernières utilisations', isVisible: { list: false, show: true, edit: false, filter: false } },
        },
        actions: {
          list:       { isVisible: true },
          show:       {
            isVisible: true,
            after: enrichPromoCodeShow,
          },
          edit:       { isVisible: true, after: auditAfterHook('edit') },
          new:        { isVisible: true, after: auditAfterHook('new') },
          delete:     { isVisible: true, after: auditAfterHook('delete') },
          bulkDelete: { isVisible: false },
          toggleActive: togglePromoActiveAction,
          duplicate:    duplicatePromoCodeAction,
        },
      },
    },
    {
      resource: 'promo_code_usages',
      options: {
        navigation: { name: 'Marketing', icon: 'Tag' },
        listProperties: ['user_id', 'promo_code_id', 'discount_applied', 'used_at'],
        showProperties: ['id', 'promo_code_id', 'user_id', 'subscription_id', 'discount_applied', 'used_at'],
        filterProperties: ['promo_code_id', 'user_id'],
        sort: { sortBy: 'used_at', direction: 'desc' },
        properties: {
          promo_code_id:    { label: 'Code promo' },
          user_id:          { label: 'Utilisateur' },
          subscription_id:  { label: 'Abonnement' },
          discount_applied: { label: 'Remise appliquée (EUR)' },
          used_at:          { label: 'Utilisé le' },
        },
        actions: {
          list:       { isVisible: true },
          show:       { isVisible: true },
          edit:       { isVisible: false },
          new:        { isVisible: false },
          delete:     { isVisible: false },
          bulkDelete: { isVisible: false },
        },
      },
    },

    // ─── Éditeurs ─────────────────────────────────────────────────────
    {
      resource: 'publishers',
      options: {
        navigation: { name: 'Éditeurs', icon: 'BookOpen' },
        listProperties: ['company_name', 'contact_name', 'email', 'status', 'activated_at'],
        showProperties: [
          'id', 'company_name', 'contact_name', 'email', 'description',
          'status', 'revenue_grid', 'payout_method',
          'invitation_token', 'token_expires_at', 'activated_at',
          'created_at', 'updated_at',
        ],
        editProperties: ['company_name', 'contact_name', 'email', 'description', 'status', 'revenue_grid', 'payout_method'],
        filterProperties: ['status'],
        properties: {
          company_name:     { label: 'Maison d\'édition', isRequired: true },
          contact_name:     { label: 'Responsable', isRequired: true },
          email:            { label: 'Email', isRequired: true },
          description:      { label: 'Description' },
          status: {
            label: 'Statut',
            availableValues: [
              { value: 'pending',  label: 'En attente' },
              { value: 'active',   label: 'Actif' },
              { value: 'paused',   label: 'Pause' },
              { value: 'banned',   label: 'Banni' },
            ],
          },
          revenue_grid:     { label: 'Grille de revenus (JSON)', type: 'mixed' },
          payout_method:    { label: 'Mode de paiement (JSON)', type: 'mixed' },
          invitation_token: { label: 'Token invitation' },
          token_expires_at: { label: 'Expiration token' },
          activated_at:     { label: 'Activé le' },
          user_id:          { label: 'ID utilisateur lié' },
        },
        actions: {
          list:   { isVisible: true },
          show:   { isVisible: true },
          new:    { isVisible: false }, // invitation via service publisher
          edit:   { isVisible: true, after: [auditAfterHook('edit')] },
          delete: { isVisible: false },
          bulkDelete: { isVisible: false },
        },
        sort: { sortBy: 'created_at', direction: 'desc' },
      },
    },
    // ─── Livres soumis par les éditeurs ───────────────────────────────
    {
      resource: 'publisher_books',
      options: {
        navigation: { name: 'Éditeurs', icon: 'BookOpen' },
        listProperties: ['publisher_id', 'content_id', 'validation_status', 'submitted_at'],
        showProperties: [
          'id', 'publisher_id', 'content_id',
          'validation_status', 'rejection_reason', 'reviewed_by',
          'submitted_at', 'reviewed_at',
        ],
        editProperties: ['validation_status', 'rejection_reason'],
        filterProperties: ['validation_status', 'publisher_id'],
        properties: {
          publisher_id:      { label: 'Éditeur (ID)' },
          content_id:        { label: 'Contenu (ID)' },
          validation_status: {
            label: 'Statut validation',
            availableValues: [
              { value: 'pending',   label: 'En attente' },
              { value: 'approved',  label: 'Approuvé' },
              { value: 'rejected',  label: 'Rejeté' },
            ],
          },
          rejection_reason:  { label: 'Motif de rejet' },
          reviewed_by:       { label: 'Examiné par' },
          submitted_at:      { label: 'Soumis le' },
          reviewed_at:       { label: 'Examiné le' },
        },
        actions: {
          list:   { isVisible: true },
          show:   { isVisible: true },
          edit:   { isVisible: true, after: [auditAfterHook('edit')] },
          new:    { isVisible: false },
          delete: { isVisible: false },
          bulkDelete: { isVisible: false },
        },
        sort: { sortBy: 'submitted_at', direction: 'desc' },
      },
    },
    // ─── Revenus éditeurs ─────────────────────────────────────────────
    {
      resource: 'publisher_revenue',
      options: {
        navigation: { name: 'Éditeurs', icon: 'BookOpen' },
        listProperties: ['publisher_id', 'content_id', 'sale_type', 'sale_amount_cad', 'publisher_amount_cad', 'created_at'],
        showProperties: [
          'id', 'publisher_id', 'content_id', 'payment_id',
          'sale_type', 'sale_amount_cad', 'publisher_amount_cad',
          'payout_id', 'created_at',
        ],
        filterProperties: ['publisher_id', 'sale_type', 'payout_id'],
        properties: {
          publisher_id:         { label: 'Éditeur (ID)' },
          content_id:           { label: 'Contenu (ID)' },
          payment_id:           { label: 'Paiement (ID)' },
          sale_type:            { label: 'Type de vente' },
          sale_amount_cad:      { label: 'Montant vente (CAD)' },
          publisher_amount_cad: { label: 'Part éditeur (CAD)' },
          payout_id:            { label: 'Versement lié (ID)' },
        },
        actions: {
          list:   { isVisible: true },
          show:   { isVisible: true },
          edit:   { isVisible: false },
          new:    { isVisible: false },
          delete: { isVisible: false },
          bulkDelete: { isVisible: false },
        },
        sort: { sortBy: 'created_at', direction: 'desc' },
      },
    },
    // ─── Versements éditeurs ──────────────────────────────────────────
    {
      resource: 'publisher_payouts',
      options: {
        navigation: { name: 'Éditeurs', icon: 'BookOpen' },
        listProperties: ['publisher_id', 'amount_cad', 'status', 'period_start', 'period_end', 'paid_at'],
        showProperties: [
          'id', 'publisher_id', 'amount_cad', 'status',
          'period_start', 'period_end', 'notes',
          'paid_at', 'created_at', 'updated_at',
        ],
        editProperties: ['status', 'amount_cad', 'period_start', 'period_end', 'notes', 'paid_at'],
        filterProperties: ['publisher_id', 'status'],
        properties: {
          publisher_id: { label: 'Éditeur (ID)', isRequired: true },
          amount_cad:   { label: 'Montant (CAD)' },
          status: {
            label: 'Statut',
            availableValues: [
              { value: 'pending',    label: 'En attente' },
              { value: 'processing', label: 'En cours' },
              { value: 'paid',       label: 'Versé' },
              { value: 'failed',     label: 'Échoué' },
            ],
          },
          period_start: { label: 'Début période' },
          period_end:   { label: 'Fin période' },
          notes:        { label: 'Notes' },
          paid_at:      { label: 'Payé le' },
        },
        actions: {
          list:   { isVisible: true },
          show:   { isVisible: true },
          new:    { isVisible: true, after: [auditAfterHook('new')] },
          edit:   { isVisible: true, after: [auditAfterHook('edit')] },
          delete: { isVisible: false },
          bulkDelete: { isVisible: false },
        },
        sort: { sortBy: 'created_at', direction: 'desc' },
      },
    },

    // ─── Journal d'audit ──────────────────────────────────────────────
    {
      resource: 'audit_logs',
      options: {
        navigation: { name: 'Systeme', icon: 'Shield' },
        listProperties: ['admin_id', 'action', 'resource', 'resource_id', 'created_at'],
        showProperties: [
          'id', 'admin_id', 'action', 'resource', 'resource_id',
          'details', 'ip_address', 'user_agent', 'created_at',
        ],
        filterProperties: ['action', 'resource', 'admin_id'],
        sort: { sortBy: 'created_at', direction: 'desc' },
        actions: {
          list: { isVisible: true },
          show: { isVisible: true },
          edit: { isVisible: false },
          new: { isVisible: false },
          delete: { isVisible: false },
        },
      },
    },
  ],
};
} // end buildAdminOptions()

module.exports = { buildAdminOptions };
