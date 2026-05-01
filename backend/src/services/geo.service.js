/**
 * Geo Service
 * Détecte la zone géographique du lecteur via son IP
 * et résout les prix localisés pour les contenus
 */

const geoip = require('geoip-lite');
const { supabaseAdmin } = require('../config/database');

// Mapping pays ISO → zone
const COUNTRY_TO_ZONE = {
  // Africa
  DZ: 'africa', AO: 'africa', BJ: 'africa', BW: 'africa', BF: 'africa',
  BI: 'africa', CM: 'africa', CV: 'africa', CF: 'africa', TD: 'africa',
  KM: 'africa', CG: 'africa', CD: 'africa', CI: 'africa', DJ: 'africa',
  EG: 'africa', GQ: 'africa', ER: 'africa', ET: 'africa', GA: 'africa',
  GM: 'africa', GH: 'africa', GN: 'africa', GW: 'africa', KE: 'africa',
  LS: 'africa', LR: 'africa', LY: 'africa', MG: 'africa', MW: 'africa',
  ML: 'africa', MR: 'africa', MU: 'africa', MA: 'africa', MZ: 'africa',
  NA: 'africa', NE: 'africa', NG: 'africa', RW: 'africa', ST: 'africa',
  SN: 'africa', SC: 'africa', SL: 'africa', SO: 'africa', ZA: 'africa',
  SS: 'africa', SD: 'africa', SZ: 'africa', TZ: 'africa', TG: 'africa',
  TN: 'africa', UG: 'africa', ZM: 'africa', ZW: 'africa',

  // Europe
  AL: 'europe', AD: 'europe', AT: 'europe', BY: 'europe', BE: 'europe',
  BA: 'europe', BG: 'europe', HR: 'europe', CY: 'europe', CZ: 'europe',
  DK: 'europe', EE: 'europe', FI: 'europe', FR: 'europe', DE: 'europe',
  GR: 'europe', HU: 'europe', IS: 'europe', IE: 'europe', IT: 'europe',
  XK: 'europe', LV: 'europe', LI: 'europe', LT: 'europe', LU: 'europe',
  MT: 'europe', MD: 'europe', MC: 'europe', ME: 'europe', NL: 'europe',
  MK: 'europe', NO: 'europe', PL: 'europe', PT: 'europe', RO: 'europe',
  RU: 'europe', SM: 'europe', RS: 'europe', SK: 'europe', SI: 'europe',
  ES: 'europe', SE: 'europe', CH: 'europe', UA: 'europe', GB: 'europe',
  VA: 'europe',

  // North America
  AG: 'north_america', BS: 'north_america', BB: 'north_america', BZ: 'north_america',
  CA: 'north_america', CR: 'north_america', CU: 'north_america', DM: 'north_america',
  DO: 'north_america', SV: 'north_america', GD: 'north_america', GT: 'north_america',
  HT: 'north_america', HN: 'north_america', JM: 'north_america', MX: 'north_america',
  NI: 'north_america', PA: 'north_america', KN: 'north_america', LC: 'north_america',
  VC: 'north_america', TT: 'north_america', US: 'north_america',

  // South America
  AR: 'south_america', BO: 'south_america', BR: 'south_america', CL: 'south_america',
  CO: 'south_america', EC: 'south_america', GY: 'south_america', PY: 'south_america',
  PE: 'south_america', SR: 'south_america', UY: 'south_america', VE: 'south_america',

  // Asia
  AF: 'asia', AM: 'asia', AZ: 'asia', BD: 'asia', BT: 'asia', BN: 'asia',
  KH: 'asia', CN: 'asia', GE: 'asia', IN: 'asia', ID: 'asia', JP: 'asia',
  KZ: 'asia', KG: 'asia', LA: 'asia', MY: 'asia', MV: 'asia', MN: 'asia',
  MM: 'asia', NP: 'asia', KP: 'asia', PK: 'asia', PH: 'asia', SG: 'asia',
  KR: 'asia', LK: 'asia', TW: 'asia', TJ: 'asia', TH: 'asia', TL: 'asia',
  TM: 'asia', UZ: 'asia', VN: 'asia',

  // Middle East
  BH: 'middle_east', IR: 'middle_east', IQ: 'middle_east', IL: 'middle_east',
  JO: 'middle_east', KW: 'middle_east', LB: 'middle_east', OM: 'middle_east',
  QA: 'middle_east', SA: 'middle_east', SY: 'middle_east', TR: 'middle_east',
  AE: 'middle_east', YE: 'middle_east',

  // Oceania
  AU: 'oceania', FJ: 'oceania', KI: 'oceania', MH: 'oceania', FM: 'oceania',
  NR: 'oceania', NZ: 'oceania', PW: 'oceania', PG: 'oceania', WS: 'oceania',
  SB: 'oceania', TO: 'oceania', TV: 'oceania', VU: 'oceania',
};

/**
 * Extrait l'IP réelle du client en tenant compte des proxies
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.connection?.remoteAddress || req.ip || null;
}

/**
 * Détecte la zone géographique d'une adresse IP
 * @param {string} ip
 * @returns {string|null} zone code or null
 */
function getZoneFromIp(ip) {
  if (!ip) return null;

  // En local / loopback → pas de zone
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }

  try {
    const geo = geoip.lookup(ip);
    if (!geo || !geo.country) return null;
    return COUNTRY_TO_ZONE[geo.country] || null;
  } catch {
    return null;
  }
}

/**
 * Détecte zone + pays depuis une IP
 * @param {string} ip
 * @returns {{ zone: string|null, country: string|null }}
 */
function getGeoFromIp(ip) {
  if (!ip) return { zone: null, country: null };
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { zone: null, country: null };
  }
  try {
    const geo = geoip.lookup(ip);
    if (!geo || !geo.country) return { zone: null, country: null };
    return { zone: COUNTRY_TO_ZONE[geo.country] || null, country: geo.country };
  } catch {
    return { zone: null, country: null };
  }
}

/**
 * Détecte la zone géographique depuis la requête HTTP
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getZoneFromRequest(req) {
  const ip = getClientIp(req);
  return getZoneFromIp(ip);
}

/**
 * Détecte zone + pays depuis la requête HTTP.
 * Priorité : header X-Country-Code (mobile/client) > IP géoloc.
 * @param {import('express').Request} req
 * @returns {{ zone: string|null, country: string|null }}
 */
function getGeoFromRequest(req) {
  // Priorité au code pays déclaré par le client (mobile)
  const headerCountry = req.headers['x-country-code'];
  if (headerCountry && /^[A-Z]{2}$/.test(headerCountry.toUpperCase())) {
    const country = headerCountry.toUpperCase();
    const zone = COUNTRY_TO_ZONE[country] || null;
    return { zone, country };
  }

  const ip = getClientIp(req);
  return getGeoFromIp(ip);
}

/**
 * Pour une liste de contenus, attache le prix localisé de la zone si disponible
 * @param {Array} contents
 * @param {string|null} zone
 * @returns {Promise<Array>} contents enrichis avec localized_price
 */
async function attachLocalizedPrices(contents, geo) {
  const { zone, country } = typeof geo === 'string' ? { zone: geo, country: null } : (geo || {});
  if (!zone && !country) return contents;

  const contentIds = contents.map((c) => c.id).filter(Boolean);
  if (contentIds.length === 0) return contents;

  try {
    const candidates = [zone, country].filter(Boolean);
    const { data: geoPrices, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .select('content_id, price_cents, currency, zone')
      .in('content_id', contentIds)
      .in('zone', candidates)
      .eq('is_active', true);

    if (error || !geoPrices) return contents;

    // Pays spécifique prioritaire sur continent
    const priceMap = {};
    for (const gp of geoPrices) {
      const existing = priceMap[gp.content_id];
      const isCountryMatch = gp.zone === country;
      if (!existing || isCountryMatch) {
        priceMap[gp.content_id] = { price_cents: gp.price_cents, currency: gp.currency, zone: gp.zone };
      }
    }

    return contents.map((c) => ({
      ...c,
      localized_price: priceMap[c.id] || null,
    }));
  } catch {
    return contents;
  }
}

async function attachLocalizedPrice(content, geo) {
  if (!content?.id) return content;
  const enriched = await attachLocalizedPrices([content], geo);
  return enriched[0];
}

module.exports = {
  getZoneFromRequest,
  getGeoFromRequest,
  getZoneFromIp,
  getGeoFromIp,
  attachLocalizedPrices,
  attachLocalizedPrice,
};
