/**
 * Traductions des notifications push (FR + EN).
 * Sélection de la langue par utilisateur via profiles.language.
 *
 * Chaque entrée est une fonction(params) -> string pour permettre l'interpolation.
 */

const dictionaries = {
  fr: {
    reading_reminder: {
      title: () => 'Reprends ta lecture 📖',
      body: ({ daysSince, title }) => `Ça fait ${daysSince} jours que tu n'as pas ouvert "${title}".`,
    },
    reading_streak: {
      title: ({ streakDays }) => `🔥 ${streakDays} jours de suite !`,
      body: () => 'Continue ta série de lecture, tu es sur la bonne voie.',
    },
    weekly_recap: {
      title: () => 'Ton récap de la semaine 📊',
      body: ({ timeStr, booksFinished }) =>
        `${timeStr} de lecture · ${booksFinished} livre${booksFinished > 1 ? 's' : ''} terminé${booksFinished > 1 ? 's' : ''}.`,
    },
    inactivity_nudge: {
      title: () => 'On t\'a manqué 📖',
      body: () => 'Découvre les nouveautés ajoutées récemment dans Papyri.',
    },
    welcome: {
      title: () => 'Bienvenue sur Papyri 👋',
      body: () => 'Explore notre catalogue et trouve ta prochaine lecture.',
    },
    welcome_day1: {
      title: () => 'Prêt à plonger dans un livre ?',
      body: () => 'Solo dès 9,99 CAD/mois — 1er crédit inclus, catalogue illimité.',
    },
    first_read_done: {
      title: () => '🎉 Bravo, tu viens de terminer ton premier livre !',
      body: ({ suggestionTitle }) =>
        suggestionTitle ? `Et après ? On te suggère "${suggestionTitle}".` : 'Et après ? Explore la suite du catalogue.',
    },
    first_purchase: {
      title: () => '🎉 Félicitations pour ton premier achat !',
      body: ({ contentTitle }) =>
        contentTitle ? `"${contentTitle}" est débloqué, bonne lecture.` : 'Ton livre est débloqué, bonne lecture.',
    },
    signup_anniversary: {
      title: ({ years }) => `🎂 ${years} an${years > 1 ? 's' : ''} avec Papyri !`,
      body: () => 'Merci d\'être avec nous. Découvre tes stats de l\'année.',
    },
    category_new_book: {
      title: ({ categoryName }) => `Nouveauté en ${categoryName} ✨`,
      body: ({ contentTitle }) => `"${contentTitle}" vient d'être ajouté à ton genre préféré.`,
    },
    weekly_top: {
      title: () => 'Top 3 de la semaine 📚',
      body: ({ list }) => list,
    },
    audiobook_pick: {
      title: () => 'Nouvel audiobook à écouter 🎧',
      body: ({ contentTitle }) => `"${contentTitle}" est disponible en version audio.`,
    },
    post_expiry_promo: {
      title: ({ discountPercent }) => `Reviens avec ${discountPercent || 20}% de réduction 🎁`,
      body: ({ promoCode }) => `Code ${promoCode} valable sur ton prochain abonnement.`,
    },
    credit_granted: {
      title: () => 'Nouveau crédit disponible 🎟️',
      body: ({ creditCount }) =>
        creditCount > 1
          ? `Tu as ${creditCount} crédits utilisables sur le catalogue Premium.`
          : 'Tu as 1 crédit utilisable sur le catalogue Premium.',
    },
    credit_expiring: {
      title: () => '⚠️ Ton crédit expire bientôt',
      body: ({ expiresOn }) => `Utilise-le avant le ${expiresOn} pour ne pas le perdre.`,
    },
    purchase_confirmed: {
      title: () => '✅ Achat confirmé',
      body: ({ contentTitle }) =>
        contentTitle ? `"${contentTitle}" est débloqué, bonne lecture.` : 'Ton livre est débloqué, bonne lecture.',
    },
  },

  en: {
    reading_reminder: {
      title: () => 'Pick up your book 📖',
      body: ({ daysSince, title }) => `It's been ${daysSince} days since you opened "${title}".`,
    },
    reading_streak: {
      title: ({ streakDays }) => `🔥 ${streakDays}-day streak!`,
      body: () => 'Keep your reading streak going, you\'re on a roll.',
    },
    weekly_recap: {
      title: () => 'Your weekly recap 📊',
      body: ({ timeStr, booksFinished }) =>
        `${timeStr} reading · ${booksFinished} book${booksFinished > 1 ? 's' : ''} finished.`,
    },
    inactivity_nudge: {
      title: () => 'We missed you 📖',
      body: () => 'Discover the latest titles added to Papyri.',
    },
    welcome: {
      title: () => 'Welcome to Papyri 👋',
      body: () => 'Explore the catalog and find your next read.',
    },
    welcome_day1: {
      title: () => 'Ready to dive into a book?',
      body: () => 'Solo starts at 9.99 CAD/month — 1 credit included, unlimited catalog.',
    },
    first_read_done: {
      title: () => '🎉 Congrats, you finished your first book!',
      body: ({ suggestionTitle }) =>
        suggestionTitle ? `What's next? We suggest "${suggestionTitle}".` : 'What\'s next? Explore the rest of the catalog.',
    },
    first_purchase: {
      title: () => '🎉 Congrats on your first purchase!',
      body: ({ contentTitle }) =>
        contentTitle ? `"${contentTitle}" is unlocked, enjoy.` : 'Your book is unlocked, enjoy.',
    },
    signup_anniversary: {
      title: ({ years }) => `🎂 ${years} year${years > 1 ? 's' : ''} on Papyri!`,
      body: () => 'Thanks for being with us. Check out your stats for the year.',
    },
    category_new_book: {
      title: ({ categoryName }) => `New in ${categoryName} ✨`,
      body: ({ contentTitle }) => `"${contentTitle}" was just added to your favorite genre.`,
    },
    weekly_top: {
      title: () => 'Top 3 this week 📚',
      body: ({ list }) => list,
    },
    audiobook_pick: {
      title: () => 'New audiobook to listen to 🎧',
      body: ({ contentTitle }) => `"${contentTitle}" is now available as audio.`,
    },
    post_expiry_promo: {
      title: ({ discountPercent }) => `Come back with ${discountPercent || 20}% off 🎁`,
      body: ({ promoCode }) => `Use code ${promoCode} on your next subscription.`,
    },
    credit_granted: {
      title: () => 'New credit available 🎟️',
      body: ({ creditCount }) =>
        creditCount > 1
          ? `You have ${creditCount} credits to spend on the Premium catalog.`
          : 'You have 1 credit to spend on the Premium catalog.',
    },
    credit_expiring: {
      title: () => '⚠️ Your credit expires soon',
      body: ({ expiresOn }) => `Use it before ${expiresOn} or you'll lose it.`,
    },
    purchase_confirmed: {
      title: () => '✅ Purchase confirmed',
      body: ({ contentTitle }) =>
        contentTitle ? `"${contentTitle}" is unlocked, enjoy.` : 'Your book is unlocked, enjoy.',
    },
  },
};

function resolveLang(lang) {
  if (!lang) return 'fr';
  const lower = String(lang).toLowerCase();
  if (lower.startsWith('en')) return 'en';
  return 'fr';
}

/**
 * Build { title, body } for a given notification key + user language + params.
 * Falls back to French when the language has no translation.
 */
function buildNotification(key, params = {}, lang = 'fr') {
  const resolvedLang = resolveLang(lang);
  const entry = dictionaries[resolvedLang]?.[key] || dictionaries.fr[key];
  if (!entry) return { title: '', body: '' };
  return {
    title: typeof entry.title === 'function' ? entry.title(params) : entry.title,
    body: typeof entry.body === 'function' ? entry.body(params) : entry.body,
  };
}

module.exports = {
  buildNotification,
  resolveLang,
};
