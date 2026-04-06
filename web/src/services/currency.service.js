/**
 * currency.service.js
 * Détection de devise par géolocalisation IP + conversion côté frontend.
 * Cache localStorage 24h pour éviter les appels répétés.
 */

// ── Taux de conversion depuis EUR (base) ────────────────────────────────────
// XAF et XOF sont arrimés à l'EUR à taux fixe officiel.
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

// Devises où on n'affiche pas de décimales
const NO_DECIMAL_CURRENCIES = new Set(['XAF', 'XOF', 'NGN', 'GHS', 'KES', 'RWF', 'ETB', 'JPY', 'COP', 'ARS']);

const CACHE_KEY = 'papyri_geo_currency_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Retourne { currency, country } détectés depuis l'IP.
 * Utilise le cache localStorage pour éviter les appels répétés.
 */
export async function detectCurrency() {
  // 1. Lire le cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return { currency: cached.currency, country: cached.country };
      }
    }
  } catch (_) {}

  // 2. Appel API géolocalisation IP (ipapi.co — 1 000 req/jour gratuit)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const countryCode = data.country_code || '';
      const currency = COUNTRY_CURRENCY[countryCode] || data.currency || 'EUR';
      const result = { currency, country: countryCode };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, ts: Date.now() }));
      return result;
    }
  } catch (_) {}

  // 3. Fallback via fuseau horaire du navigateur
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const currency = guessFromTimezone(tz);
    if (currency) return { currency, country: null };
  } catch (_) {}

  return { currency: 'EUR', country: null };
}

/**
 * Devine la devise depuis le fuseau horaire (fallback sans réseau).
 */
function guessFromTimezone(tz) {
  if (!tz) return null;
  const tzLower = tz.toLowerCase();
  if (tzLower.startsWith('africa/douala') || tzLower.startsWith('africa/libreville')
    || tzLower.startsWith('africa/brazzaville') || tzLower.startsWith('africa/bangui')
    || tzLower.startsWith('africa/ndjamena') || tzLower.startsWith('africa/malabo')) return 'XAF';
  if (tzLower.startsWith('africa/dakar') || tzLower.startsWith('africa/abidjan')
    || tzLower.startsWith('africa/bamako') || tzLower.startsWith('africa/ouagadougou')
    || tzLower.startsWith('africa/cotonou') || tzLower.startsWith('africa/lome')
    || tzLower.startsWith('africa/niamey') || tzLower.startsWith('africa/bissau')) return 'XOF';
  if (tzLower.includes('europe/paris') || tzLower.includes('europe/berlin')
    || tzLower.includes('europe/madrid') || tzLower.includes('europe/rome')) return 'EUR';
  if (tzLower.includes('america/new_york') || tzLower.includes('america/los_angeles')
    || tzLower.includes('america/chicago')) return 'USD';
  if (tzLower.includes('europe/london')) return 'GBP';
  if (tzLower.includes('australia/')) return 'AUD';
  if (tzLower.includes('america/toronto') || tzLower.includes('america/vancouver')) return 'CAD';
  if (tzLower.includes('africa/lagos')) return 'NGN';
  if (tzLower.includes('africa/accra') || tzLower.includes('africa/kumasi')) return 'GHS';
  if (tzLower.includes('africa/nairobi')) return 'KES';
  if (tzLower.includes('africa/johannesburg')) return 'ZAR';
  if (tzLower.includes('africa/casablanca') || tzLower.includes('africa/el_aaiun')) return 'MAD';
  if (tzLower.includes('africa/algiers')) return 'DZD';
  if (tzLower.includes('africa/tunis')) return 'TND';
  if (tzLower.includes('africa/cairo')) return 'EGP';
  return null;
}

/**
 * Convertit un montant en centimes de la devise source vers la devise cible.
 * Les plans Papyri sont stockés en EUR (centimes).
 * @param {number} centsInSource — montant en centimes (ex: 500 = 5.00 EUR)
 * @param {string} fromCurrency  — devise source (ex: 'EUR')
 * @param {string} toCurrency    — devise cible (ex: 'XAF')
 * @returns {number} montant converti en centimes de la devise cible
 */
export function convertCents(centsInSource, fromCurrency = 'EUR', toCurrency = 'EUR') {
  if (!centsInSource) return 0;
  if (fromCurrency === toCurrency) return Math.round(centsInSource);

  // Toujours convertir via EUR comme pivot
  const rateFrom = RATES_FROM_EUR[fromCurrency] ?? 1;
  const rateTo = RATES_FROM_EUR[toCurrency] ?? 1;
  const eurCents = centsInSource / rateFrom;
  return Math.round(eurCents * rateTo);
}

/**
 * Formate un montant en centimes dans la devise locale.
 * @param {number} centsEUR     — montant en centimes EUR
 * @param {string} toCurrency   — devise cible
 * @returns {string}            — ex: "3 280 XAF" ou "5,00 €"
 */
export function formatInCurrency(centsEUR, toCurrency = 'EUR') {
  const converted = convertCents(centsEUR, 'EUR', toCurrency);
  const amount = converted / 100;
  const noDecimal = NO_DECIMAL_CURRENCIES.has(toCurrency);
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: toCurrency,
      minimumFractionDigits: noDecimal ? 0 : (amount % 1 === 0 ? 0 : 2),
      maximumFractionDigits: noDecimal ? 0 : 2,
    }).format(amount);
  } catch (_) {
    // Fallback si la devise n'est pas supportée par Intl
    return `${Math.round(amount).toLocaleString('fr-FR')} ${toCurrency}`;
  }
}

/**
 * Retourne vrai si la devise est différente de EUR.
 */
export function isNonEuro(currency) {
  return currency && currency !== 'EUR';
}

/**
 * Nom lisible de la devise.
 */
export function currencyLabel(code) {
  const labels = {
    XAF: 'Franc CFA', XOF: 'Franc CFA', USD: 'Dollar US', GBP: 'Livre sterling',
    AUD: 'Dollar AUS', CAD: 'Dollar CAD', CHF: 'Franc suisse', MAD: 'Dirham marocain',
    DZD: 'Dinar algérien', TND: 'Dinar tunisien', EGP: 'Livre égyptienne',
    NGN: 'Naira', GHS: 'Cedi', KES: 'Shilling kenyan', ZAR: 'Rand',
    EUR: 'Euro',
  };
  return labels[code] || code;
}
