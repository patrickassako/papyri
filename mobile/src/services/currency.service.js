/**
 * currency.service.js — Mobile
 * Détection de devise par géolocalisation IP + conversion côté client.
 * Logique identique à la version web.
 */

// ── Taux de conversion depuis EUR (base) ────────────────────────────────────
const RATES_FROM_EUR = {
  EUR: 1,
  XAF: 655.957,   // Franc CFA BEAC — taux fixe (Cameroun, Gabon, Congo, RCA, Tchad, Guinée éq.)
  XOF: 655.957,   // Franc CFA BCEAO — taux fixe (Sénégal, CI, Mali, BF, Bénin, Togo, Niger, GB)
  USD: 1.08,
  GBP: 0.86,
  AUD: 1.62,
  CAD: 1.47,
  CHF: 0.96,
  MAD: 10.8,      // Maroc
  DZD: 145,       // Algérie
  TND: 3.35,      // Tunisie
  EGP: 52,        // Égypte
  NGN: 1650,      // Nigeria
  GHS: 16.5,      // Ghana
  KES: 140,       // Kenya
  ZAR: 20,        // Afrique du Sud
  RWF: 1350,      // Rwanda
  ETB: 60,        // Éthiopie
  BRL: 5.4,       // Brésil
  MXN: 18.5,      // Mexique
  COP: 4500,      // Colombie
  ARS: 1000,      // Argentine
  INR: 90,        // Inde
  JPY: 160,       // Japon
};

// ── Pays → devise ───────────────────────────────────────────────────────────
const COUNTRY_CURRENCY = {
  // Zone CFA BEAC (XAF)
  CM: 'XAF', GA: 'XAF', CG: 'XAF', CD: 'XAF', CF: 'XAF', TD: 'XAF', GQ: 'XAF',
  // Zone CFA BCEAO (XOF)
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF',
  // Zone Euro
  FR: 'EUR', DE: 'EUR', BE: 'EUR', LU: 'EUR', NL: 'EUR', ES: 'EUR', PT: 'EUR',
  IT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', IE: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR',
  // Autres
  US: 'USD', PR: 'USD', VI: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  CA: 'CAD',
  CH: 'CHF',
  MA: 'MAD',
  DZ: 'DZD',
  TN: 'TND',
  EG: 'EGP',
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  RW: 'RWF',
  ET: 'ETB',
  BR: 'BRL',
  MX: 'MXN',
  CO: 'COP',
  AR: 'ARS',
  IN: 'INR',
  JP: 'JPY',
};

// Devises sans décimales
const NO_DECIMAL_CURRENCIES = new Set(['XAF', 'XOF', 'NGN', 'GHS', 'KES', 'RWF', 'ETB', 'JPY', 'COP', 'ARS']);

// Cache en mémoire (React Native n'a pas localStorage)
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Devine la devise depuis le fuseau horaire de l'appareil (fallback sans réseau).
 */
function guessFromTimezone(tz) {
  if (!tz) return null;
  const t = tz.toLowerCase();
  if (t.startsWith('africa/douala') || t.startsWith('africa/libreville')
    || t.startsWith('africa/brazzaville') || t.startsWith('africa/bangui')
    || t.startsWith('africa/ndjamena') || t.startsWith('africa/malabo')) return 'XAF';
  if (t.startsWith('africa/dakar') || t.startsWith('africa/abidjan')
    || t.startsWith('africa/bamako') || t.startsWith('africa/ouagadougou')
    || t.startsWith('africa/cotonou') || t.startsWith('africa/lome')
    || t.startsWith('africa/niamey') || t.startsWith('africa/bissau')) return 'XOF';
  if (t.includes('europe/paris') || t.includes('europe/berlin')
    || t.includes('europe/madrid') || t.includes('europe/rome')) return 'EUR';
  if (t.includes('america/new_york') || t.includes('america/los_angeles')
    || t.includes('america/chicago')) return 'USD';
  if (t.includes('europe/london')) return 'GBP';
  if (t.includes('australia/')) return 'AUD';
  if (t.includes('america/toronto') || t.includes('america/vancouver')) return 'CAD';
  if (t.includes('africa/lagos')) return 'NGN';
  if (t.includes('africa/accra') || t.includes('africa/kumasi')) return 'GHS';
  if (t.includes('africa/nairobi')) return 'KES';
  if (t.includes('africa/johannesburg')) return 'ZAR';
  if (t.includes('africa/casablanca') || t.includes('africa/el_aaiun')) return 'MAD';
  if (t.includes('africa/algiers')) return 'DZD';
  if (t.includes('africa/tunis')) return 'TND';
  if (t.includes('africa/cairo')) return 'EGP';
  return null;
}

/**
 * Devine la devise depuis la locale de l'appareil.
 */
function guessFromLocale() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    let country = null;
    try {
      country = new Intl.Locale(locale).region;
    } catch {}
    if (!country) {
      const parts = locale.split('-');
      const last = parts[parts.length - 1].toUpperCase();
      if (last.length === 2) country = last;
    }
    if (country) return COUNTRY_CURRENCY[country] || null;
  } catch {}
  return null;
}

/**
 * Détecte { currency, country } de l'utilisateur.
 * Ordre : cache mémoire → ipapi.co → fuseau horaire → locale → EUR.
 */
export async function detectCurrency() {
  // 1. Cache mémoire
  if (_cache && Date.now() - _cacheTs < CACHE_TTL_MS) {
    return _cache;
  }

  // 2. API géolocalisation IP (ipapi.co — 1 000 req/jour gratuit)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const country = data.country_code || '';
      const currency = COUNTRY_CURRENCY[country] || data.currency || 'EUR';
      _cache = { currency, country };
      _cacheTs = Date.now();
      return _cache;
    }
  } catch {}

  // 3. Fallback fuseau horaire
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const currency = guessFromTimezone(tz);
    if (currency) {
      _cache = { currency, country: null };
      _cacheTs = Date.now();
      return _cache;
    }
  } catch {}

  // 4. Fallback locale de l'appareil
  const localeCurrency = guessFromLocale();
  if (localeCurrency) {
    _cache = { currency: localeCurrency, country: null };
    _cacheTs = Date.now();
    return _cache;
  }

  return { currency: 'EUR', country: null };
}

/**
 * Convertit des centimes de `fromCurrency` vers `toCurrency` via EUR comme pivot.
 */
export function convertCents(centsInSource, fromCurrency = 'EUR', toCurrency = 'EUR') {
  if (!centsInSource) return 0;
  if (fromCurrency === toCurrency) return Math.round(centsInSource);
  const rateFrom = RATES_FROM_EUR[fromCurrency] ?? 1;
  const rateTo = RATES_FROM_EUR[toCurrency] ?? 1;
  return Math.round((centsInSource / rateFrom) * rateTo);
}

/**
 * Formate un montant en centimes EUR dans la devise cible.
 */
export function formatInCurrency(centsEUR, toCurrency = 'EUR') {
  const converted = convertCents(centsEUR, 'EUR', toCurrency);
  return formatMinorUnits(converted, toCurrency);
}

// Symboles courants — évite style:'currency' qui bug sur Hermes/Android
const CURRENCY_SYMBOLS = {
  EUR: '€', USD: '$', GBP: '£', CAD: 'CA$', AUD: 'AU$', CHF: 'CHF',
  JPY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$', COP: 'COP', ARS: 'ARS',
  XAF: 'FCFA', XOF: 'FCFA', NGN: '₦', GHS: 'GH₵', KES: 'KSh',
  ZAR: 'R', MAD: 'MAD', DZD: 'DZD', TND: 'TND', EGP: 'E£',
  RWF: 'FRw', ETB: 'Br',
};

// Symbole placé avant le montant
const PREFIX_CURRENCIES = new Set(['USD', 'GBP', 'CAD', 'AUD', 'MXN', 'BRL', 'INR', 'JPY', 'NGN', 'GHS', 'KES']);

/**
 * Formate un montant en centimes déjà dans sa devise source.
 * N'utilise PAS style:'currency' pour éviter les bugs Hermes sur Android.
 */
export function formatMinorUnits(cents, currency = 'EUR') {
  const amount = Number(cents || 0) / 100;
  const noDecimal = NO_DECIMAL_CURRENCIES.has(currency);
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'fr-FR';

  let numStr;
  try {
    numStr = new Intl.NumberFormat(locale, {
      minimumFractionDigits: noDecimal ? 0 : (amount % 1 === 0 ? 0 : 2),
      maximumFractionDigits: noDecimal ? 0 : 2,
    }).format(amount);
  } catch {
    numStr = noDecimal ? String(Math.round(amount)) : amount.toFixed(2);
  }

  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return PREFIX_CURRENCIES.has(currency) ? `${sym}${numStr}` : `${numStr} ${sym}`;
}

export function isNonEuro(currency) {
  return currency && currency !== 'EUR';
}

export { COUNTRY_CURRENCY, RATES_FROM_EUR };
