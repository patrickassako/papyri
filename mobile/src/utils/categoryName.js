/**
 * Returns the translated name of a category by its slug.
 * Falls back to the DB name if the slug is not in the i18n file.
 * @param {string} slug - category slug (e.g. 'litterature-africaine')
 * @param {Function} t - i18next translation function
 * @param {string} [fallback] - DB name to show when slug has no translation
 * @returns {string}
 */
export function getCategoryName(slug, t, fallback) {
  if (!slug) return fallback || '';
  const key = `categories.${slug}`;
  const translated = t(key, { defaultValue: null });
  if (translated && translated !== key) return translated;
  return fallback || slug;
}
