/**
 * Flutterwave Direct Charge — Mobile Money
 *
 * Wraps POST https://api.flutterwave.com/v3/charges?type=mobile_money_<country>
 * so we can drive the whole Mobile Money flow from inside the app instead of
 * redirecting the user to the Flutterwave hosted page.
 *
 * Each Flutterwave MM endpoint accepts its own subset of fields:
 *   mobile_money_franco     → BCEAO countries (CI, SN, ML, BF, TG, BJ).
 *                             Requires `country` and ignores `network`.
 *   mobile_money_ghana      → Requires `network` (MTN | VODAFONE | TIGO).
 *   mobile_money_rwanda     → Just phone_number.
 *   mobile_money_uganda     → Requires `network` (MTN | AIRTEL).
 *   mobile_money_zambia     → Requires `network` (MTN | AIRTEL | ZAMTEL).
 *   mpesa                   → Kenya / Tanzania, just phone_number.
 *   mobile_money_cameroon   → Just phone_number (no operator selector).
 *
 * Response.data.status is `pending` while the customer confirms by USSD or
 * the wallet app; the webhook (or the verify endpoint we poll) will flip it
 * to `successful` or `failed`.
 */

const config = require('../config/env');

// ── Catalogue ─────────────────────────────────────────────────────────────
// Drives both the mobile picker UI (via the GET options endpoint) and the
// charge dispatcher below. `flwType` is the value injected into the URL
// query string. Numeric `dialingCode` is used to normalise phone numbers.
const COUNTRIES = [
  // CEMAC — Cameroun MoMo is only available via the Standard hosted checkout
  // (Flutterwave doesn't expose Direct Charge for CM publicly).
  {
    country: 'CM', label: 'Cameroun', dialingCode: '237', currency: 'XAF',
    flwType: null, fxKey: 'fx_rate_xaf',
    hostedPaymentOptions: 'mobilemoneycameroon,card',
    operators: [
      { code: 'MTN',    label: 'MTN MoMo' },
      { code: 'ORANGE', label: 'Orange Money' },
    ],
    requiresNetwork: false,
    directCharge: false,
  },

  // BCEAO — single endpoint for all francophone West Africa
  ...[
    { country: 'CI', label: 'Côte d\'Ivoire', dialingCode: '225',
      operators: [{ code: 'MTN', label: 'MTN MoMo' }, { code: 'ORANGE', label: 'Orange Money' }, { code: 'MOOV', label: 'Moov Money' }, { code: 'WAVE', label: 'Wave' }] },
    { country: 'SN', label: 'Sénégal', dialingCode: '221',
      operators: [{ code: 'ORANGE', label: 'Orange Money' }, { code: 'FREE', label: 'Free Money' }, { code: 'WAVE', label: 'Wave' }] },
    { country: 'ML', label: 'Mali', dialingCode: '223',
      operators: [{ code: 'ORANGE', label: 'Orange Money' }, { code: 'MOOV', label: 'Moov Money' }] },
    { country: 'BF', label: 'Burkina Faso', dialingCode: '226',
      operators: [{ code: 'ORANGE', label: 'Orange Money' }, { code: 'MOOV', label: 'Moov Money' }] },
    { country: 'TG', label: 'Togo', dialingCode: '228',
      operators: [{ code: 'TMONEY', label: 'T-Money' }, { code: 'MOOV', label: 'Moov Money' }] },
    { country: 'BJ', label: 'Bénin', dialingCode: '229',
      operators: [{ code: 'MTN', label: 'MTN MoMo' }, { code: 'MOOV', label: 'Moov Money' }] },
  ].map(c => ({ ...c, currency: 'XOF', flwType: 'mobile_money_franco', fxKey: 'fx_rate_xof', requiresNetwork: false, directCharge: true })),

  // Ghana
  {
    country: 'GH', label: 'Ghana', dialingCode: '233', currency: 'GHS',
    flwType: 'mobile_money_ghana', fxKey: 'fx_rate_ghs',
    operators: [
      { code: 'MTN',      label: 'MTN MoMo' },
      { code: 'VODAFONE', label: 'Vodafone Cash' },
      { code: 'TIGO',     label: 'AirtelTigo Money' },
    ],
    requiresNetwork: true,
    directCharge: true,
  },

  // M-Pesa
  {
    country: 'KE', label: 'Kenya', dialingCode: '254', currency: 'KES',
    flwType: 'mpesa', fxKey: 'fx_rate_kes',
    operators: [{ code: 'MPESA', label: 'M-Pesa' }],
    requiresNetwork: false,
    directCharge: true,
  },
  {
    country: 'TZ', label: 'Tanzanie', dialingCode: '255', currency: 'TZS',
    flwType: 'mpesa', fxKey: 'fx_rate_tzs',
    operators: [{ code: 'MPESA', label: 'M-Pesa' }],
    requiresNetwork: false,
    directCharge: true,
  },

  // Rwanda / Uganda / Zambia
  {
    country: 'RW', label: 'Rwanda', dialingCode: '250', currency: 'RWF',
    flwType: 'mobile_money_rwanda', fxKey: 'fx_rate_rwf',
    operators: [
      { code: 'MTN',    label: 'MTN MoMo' },
      { code: 'AIRTEL', label: 'Airtel Money' },
    ],
    requiresNetwork: false,
    directCharge: true,
  },
  {
    country: 'UG', label: 'Ouganda', dialingCode: '256', currency: 'UGX',
    flwType: 'mobile_money_uganda', fxKey: 'fx_rate_ugx',
    operators: [
      { code: 'MTN',    label: 'MTN MoMo' },
      { code: 'AIRTEL', label: 'Airtel Money' },
    ],
    requiresNetwork: true,
  },
  {
    country: 'ZM', label: 'Zambie', dialingCode: '260', currency: 'ZMW',
    flwType: 'mobile_money_zambia', fxKey: 'fx_rate_zmw',
    operators: [
      { code: 'MTN',    label: 'MTN MoMo' },
      { code: 'AIRTEL', label: 'Airtel Money' },
      { code: 'ZAMTEL', label: 'Zamtel Kwacha' },
    ],
    requiresNetwork: true,
  },
];

function getCountryConfig(country) {
  const c = String(country || '').toUpperCase();
  return COUNTRIES.find(x => x.country === c) || null;
}

/**
 * Normalise a phone number: strip non-digits, prepend the country dialing
 * code if missing.
 */
function normalisePhone(rawPhone, dialingCode) {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (!digits) return null;
  // If the user typed the leading 0 (national format) drop it before prefixing
  if (digits.startsWith(dialingCode)) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `${dialingCode}${digits}`;
}

/**
 * Initiate a Mobile Money charge.
 *
 * @param {object} params
 * @param {string} params.country      ISO country code (CM, SN, …)
 * @param {string} [params.operator]   Operator code from the catalogue (only
 *                                     used when requiresNetwork=true; the
 *                                     other endpoints ignore it).
 * @param {string} params.phone        Phone number, national or international format
 * @param {string} params.fullname     Customer full name
 * @param {string} params.email        Customer email
 * @param {number} params.amount       Amount in the LOCAL currency (already converted)
 * @param {string} params.currency     ISO currency code (must match the country)
 * @param {string} params.txRef        Our internal tx_ref
 * @param {string} [params.redirectUrl] Optional redirect target (used for Wave/redirect modes)
 * @param {object} [params.meta]       Extra meta to attach to the charge
 *
 * @returns {Promise<object>}
 *   {
 *     status: 'pending' | 'failed' | 'successful',
 *     reference: '<tx_ref>',
 *     flwRef: '<flw_ref>',
 *     mode: 'callback' | 'redirect' | 'otp' | 'ussd' | null,
 *     redirectUrl: string|null,    // when mode=redirect (Wave etc.)
 *     ussdCode: string|null,       // when the gateway returns one
 *     instructions: string|null,   // human-readable instructions if any
 *     raw: <full flutterwave response>
 *   }
 */
async function initiateCharge({
  country,
  operator,
  phone,
  fullname,
  email,
  amount,
  currency,
  txRef,
  redirectUrl,
  meta = {},
}) {
  const cfg = getCountryConfig(country);
  if (!cfg) throw new Error(`Unsupported country: ${country}`);
  if (cfg.currency !== currency) {
    throw new Error(`Currency mismatch for ${country}: expected ${cfg.currency}, got ${currency}`);
  }
  if (!config.flutterwave.secretKey) {
    throw new Error('Flutterwave secret key not configured');
  }

  const phoneNumber = normalisePhone(phone, cfg.dialingCode);
  if (!phoneNumber) throw new Error('Numéro de téléphone invalide');

  const body = {
    tx_ref: txRef,
    amount: String(amount),
    currency,
    email,
    phone_number: phoneNumber,
    fullname,
    redirect_url: redirectUrl || undefined,
    meta: { user_country: country, ...meta },
  };

  // Endpoint-specific extras
  if (cfg.flwType === 'mobile_money_franco') {
    body.country = country; // BCEAO endpoint needs to know which member state
  }
  if (cfg.requiresNetwork) {
    if (!operator) throw new Error('Operator (network) requis pour ce pays');
    body.network = operator.toUpperCase();
  }

  const url = `https://api.flutterwave.com/v3/charges?type=${encodeURIComponent(cfg.flwType)}`;
  console.log('[fw-mm] charge', { country, type: cfg.flwType, amount, currency, phoneNumber, txRef });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.flutterwave.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.status !== 'success') {
    const msg = json?.message || json?.data?.processor_response || `Flutterwave HTTP ${response.status}`;
    console.error('[fw-mm] charge failed', msg, json);
    throw new Error(msg);
  }

  const data = json.data || {};
  const auth = json.meta?.authorization || {};

  const result = {
    status: data.status || 'pending', // 'pending' | 'failed' | 'successful'
    reference: data.tx_ref || txRef,
    flwRef: data.flw_ref || null,
    mode: auth.mode || null,
    redirectUrl: auth.redirect || null,
    ussdCode: auth.ussd_code || null,
    instructions: auth.instruction || data.processor_response || null,
    transactionId: data.id || null,
    raw: json,
  };
  console.log('[fw-mm] charge ok', { reference: result.reference, status: result.status, mode: result.mode });
  return result;
}

/**
 * Verify a Mobile Money transaction by reference (tx_ref).
 * Used by the mobile/web client to poll until the customer finishes USSD.
 */
async function verifyByReference(txRef) {
  if (!config.flutterwave.secretKey) {
    throw new Error('Flutterwave secret key not configured');
  }
  const url = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.flutterwave.secretKey}` },
  });
  const json = await response.json().catch(() => ({}));

  if (json?.status !== 'success' || !json?.data) {
    return { status: 'unknown', reference: txRef, raw: json };
  }
  return {
    status: json.data.status || 'unknown', // 'successful' | 'failed' | 'pending'
    reference: txRef,
    flwRef: json.data.flw_ref || null,
    amount: json.data.amount,
    currency: json.data.currency,
    transactionId: json.data.id || null,
    raw: json,
  };
}

module.exports = {
  COUNTRIES,
  getCountryConfig,
  initiateCharge,
  verifyByReference,
  normalisePhone,
};
