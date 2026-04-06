import { useCallback, useEffect, useState } from 'react';
import {
  convertCents,
  currencyLabel,
  detectCurrency,
  formatInCurrency,
  isNonEuro,
} from '../services/currency.service';

/**
 * Hook React pour la gestion de la devise locale.
 *
 * Usage:
 *   const { currency, country, ready, formatPrice, convertFromEUR } = useCurrency();
 *
 * - currency      : code devise détecté (ex: 'XAF')
 * - country       : code pays ISO (ex: 'CM') ou null
 * - ready         : true une fois la détection terminée
 * - isLocalized   : true si la devise n'est pas EUR
 * - label         : nom lisible de la devise (ex: 'Franc CFA')
 * - formatPrice(eurCents) : formate en devise locale (conversion incluse)
 * - formatBoth(eurCents)  : retourne { local, eur } pour afficher les deux
 */
export function useCurrency() {
  const [currency, setCurrency] = useState('EUR');
  const [country, setCountry] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectCurrency().then(({ currency: c, country: co }) => {
      if (!cancelled) {
        setCurrency(c || 'EUR');
        setCountry(co || null);
        setReady(true);
      }
    }).catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const formatPrice = useCallback(
    (eurCents) => formatInCurrency(eurCents, currency),
    [currency],
  );

  const convertFromEUR = useCallback(
    (eurCents) => convertCents(eurCents, 'EUR', currency),
    [currency],
  );

  const formatBoth = useCallback(
    (eurCents) => {
      if (!isNonEuro(currency)) return { local: formatInCurrency(eurCents, 'EUR'), eur: null };
      return {
        local: formatInCurrency(eurCents, currency),
        eur: formatInCurrency(eurCents, 'EUR'),
      };
    },
    [currency],
  );

  return {
    currency,
    country,
    ready,
    isLocalized: isNonEuro(currency),
    label: currencyLabel(currency),
    formatPrice,
    convertFromEUR,
    formatBoth,
  };
}
