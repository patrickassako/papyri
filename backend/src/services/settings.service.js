/**
 * Settings Service
 * Fetches and caches app_settings from DB (singleton row)
 * Used by invoice.service.js and other services needing global config
 */

const { supabaseAdmin } = require('../config/database');

// Fixed UUID of the singleton row (matches migration 031)
const SETTINGS_ROW_ID = '10000000-0000-0000-0000-000000000001';

// In-memory cache — invalidated by clearCache()
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getDefaultSettings() {
  return {
    company_name: 'Papyri — Bibliothèque Numérique',
    company_tagline: 'Votre bibliothèque numérique africaine',
    company_address: 'Yaoundé, Cameroun',
    company_email: 'contact@papyri.app',
    company_website: 'papyri.app',
    company_phone: '',
    company_vat_id: '',
    invoice_prefix: 'INV',
    invoice_footer_text: 'Cette facture a été générée automatiquement par Papyri. Pour toute question : contact@papyri.app',
    invoice_primary_color: '#B5651D',
    invoice_accent_color: '#D4A017',
    invoice_logo_url: '',
    invoice_notes: '',
  };
}

/**
 * Returns app settings, from cache if fresh, otherwise from DB.
 * Falls back to defaults if the table doesn't exist yet or is empty.
 */
async function getSettings() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .eq('id', SETTINGS_ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('[settings] DB error, using defaults:', error.message);
      return getDefaultSettings();
    }

    _cache = { ...getDefaultSettings(), ...(data || {}) };
    _cacheAt = now;
    return _cache;
  } catch (err) {
    console.warn('[settings] Fetch error, using defaults:', err.message);
    return getDefaultSettings();
  }
}

/**
 * Clears the in-memory cache — call after admin updates settings.
 */
function clearCache() {
  _cache = null;
  _cacheAt = 0;
}

module.exports = { getSettings, clearCache, getDefaultSettings, SETTINGS_ROW_ID };
