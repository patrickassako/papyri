/**
 * Payment Locale Resolver
 *
 * Maps an ISO country code (CM, SN, GH, KE…) to:
 *   - The Flutterwave currency required for Mobile Money in that country.
 *   - The `payment_options` string we send to Flutterwave so the hosted
 *     checkout shows the right Mobile Money / wallet on top, with card as
 *     fallback.
 *   - The settings key holding the CAD→local FX rate (admin-editable).
 *
 * Flutterwave strict rules (see https://developer.flutterwave.com/docs/payment-options):
 *   mobilemoneycameroon → XAF only
 *   mobilemoneyfranco   → XOF only
 *   mobilemoneyghana    → GHS only
 *   mobilemoneyrwanda   → RWF only
 *   mobilemoneyuganda   → UGX only
 *   mobilemoneyzambia   → ZMW only
 *   mpesa               → KES / TZS
 *   card                → multi-currency incl. CAD
 *
 * If the country isn't listed we fall back to CAD + card so North-American
 * customers keep paying by card.
 */

const { getSettings } = require('./settings.service');

// ── mapping country → payment config ────────────────────────────
const COUNTRY_TO_PAYMENT = {
  // CEMAC (XAF) — Cameroun a son Mobile Money, les autres pas (encore) chez Flutterwave
  CM: { currency: 'XAF', payment_options: 'mobilemoneycameroon,card', fx_key: 'fx_rate_xaf', label: 'Cameroun' },
  CF: { currency: 'XAF', payment_options: 'card',                     fx_key: 'fx_rate_xaf', label: 'RCA' },
  TD: { currency: 'XAF', payment_options: 'card',                     fx_key: 'fx_rate_xaf', label: 'Tchad' },
  CG: { currency: 'XAF', payment_options: 'card',                     fx_key: 'fx_rate_xaf', label: 'Congo' },
  GQ: { currency: 'XAF', payment_options: 'card',                     fx_key: 'fx_rate_xaf', label: 'Guinée Eq.' },
  GA: { currency: 'XAF', payment_options: 'card',                     fx_key: 'fx_rate_xaf', label: 'Gabon' },

  // BCEAO (XOF) — Orange Money / MTN MoMo / Wave via "mobilemoneyfranco"
  SN: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Sénégal' },
  CI: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Côte d\'Ivoire' },
  ML: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Mali' },
  BF: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Burkina Faso' },
  TG: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Togo' },
  BJ: { currency: 'XOF', payment_options: 'mobilemoneyfranco,card', fx_key: 'fx_rate_xof', label: 'Bénin' },
  NE: { currency: 'XOF', payment_options: 'card',                   fx_key: 'fx_rate_xof', label: 'Niger' },
  GW: { currency: 'XOF', payment_options: 'card',                   fx_key: 'fx_rate_xof', label: 'Guinée-Bissau' },

  // Ghana
  GH: { currency: 'GHS', payment_options: 'mobilemoneyghana,card', fx_key: 'fx_rate_ghs', label: 'Ghana' },

  // Afrique de l'Est M-Pesa
  KE: { currency: 'KES', payment_options: 'mpesa,card', fx_key: 'fx_rate_kes', label: 'Kenya' },
  TZ: { currency: 'TZS', payment_options: 'mpesa,card', fx_key: 'fx_rate_tzs', label: 'Tanzanie' },

  // Rwanda / Ouganda / Zambie
  RW: { currency: 'RWF', payment_options: 'mobilemoneyrwanda,card', fx_key: 'fx_rate_rwf', label: 'Rwanda' },
  UG: { currency: 'UGX', payment_options: 'mobilemoneyuganda,card', fx_key: 'fx_rate_ugx', label: 'Ouganda' },
  ZM: { currency: 'ZMW', payment_options: 'mobilemoneyzambia,card', fx_key: 'fx_rate_zmw', label: 'Zambie' },

  // Nigeria — Flutterwave home market: card + bank transfer + USSD
  NG: { currency: 'NGN', payment_options: 'card,banktransfer,ussd,account', fx_key: 'fx_rate_ngn', label: 'Nigeria' },
};

// Currencies that don't use sub-units (XAF, XOF, KES, etc. are typically
// integer-valued for Flutterwave; we still round to nearest whole unit).
const INTEGER_CURRENCIES = new Set(['XAF', 'XOF', 'NGN', 'KES', 'TZS', 'RWF', 'UGX']);

/**
 * Resolve the payment locale for a given ISO-3166 country code.
 * Returns null for countries we don't have a Mobile Money route for —
 * the caller should fall back to the default (CAD + card).
 */
function getLocaleForCountry(country) {
  if (!country) return null;
  return COUNTRY_TO_PAYMENT[String(country).toUpperCase()] || null;
}

/**
 * Convert a CAD amount to the local currency for a given country.
 * Reads the FX rate from app_settings so the admin can update it.
 *
 * Returns: { amount, currency, payment_options, country, fxRate, source }
 *   - When the country has no MM route: amount stays in CAD, payment_options='card'.
 *   - When a route exists: amount = round(cad * fx_rate).
 */
async function localizePayment({ cadAmount, country }) {
  const locale = getLocaleForCountry(country);
  if (!locale) {
    return {
      amount: Number(Number(cadAmount).toFixed(2)),
      currency: 'CAD',
      payment_options: 'card',
      country: country || null,
      fxRate: 1,
      source: 'default',
    };
  }

  const settings = await getSettings();
  const rate = Number(settings?.[locale.fx_key] || 0);
  if (!rate || rate <= 0) {
    // Misconfigured rate: keep CAD/card to avoid sending a 0-amount session.
    console.warn(`[payment-locale] missing fx rate for ${country} (${locale.fx_key}), falling back to CAD`);
    return {
      amount: Number(Number(cadAmount).toFixed(2)),
      currency: 'CAD',
      payment_options: 'card',
      country,
      fxRate: 1,
      source: 'fallback_missing_rate',
    };
  }

  const raw = Number(cadAmount) * rate;
  const amount = INTEGER_CURRENCIES.has(locale.currency)
    ? Math.round(raw)
    : Number(raw.toFixed(2));

  return {
    amount,
    currency: locale.currency,
    payment_options: locale.payment_options,
    country,
    fxRate: rate,
    source: 'localized',
    label: locale.label,
  };
}

module.exports = {
  COUNTRY_TO_PAYMENT,
  getLocaleForCountry,
  localizePayment,
};
