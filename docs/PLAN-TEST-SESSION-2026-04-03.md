# Plan de Test — Session 2026-04-03
**Environnement :** Web `http://localhost:5173` · Backend `http://localhost:3001`
**Compte test :** abonnement actif (plan Personnel Slow — 400 textes / 1 audio)

---

## Légende
| Symbole | Signification |
|---------|--------------|
| ✅ | Passé |
| ❌ | Échoué |
| ⏭ | Non testé |
| 🔴 | Bloquant |

---

## MODULE 1 — Contrôle d'accès au contenu (fixes critiques)

### 1.1 Page de détail — Livre abonnement (`access_type = subscription`)
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 1.1.1 | Aller sur `/catalogue/8f748594-...` (Jungle Tales — audiobook subscription) **sans être connecté** | Bouton « Se connecter pour accéder » | ⏭ |
| 1.1.2 | Se connecter avec compte abonné actif, retourner sur la page | Bouton **« Débloquer avec mon abonnement »** (PAS « Lire ») | ⏭ |
| 1.1.3 | Cliquer « Débloquer avec mon abonnement » | Quota consommé, redirection vers le lecteur | ⏭ |
| 1.1.4 | Revenir sur la page après déblocage | Bouton **« Écouter maintenant »** (débloqué) | ⏭ |

### 1.2 Page de détail — Livre payant (`access_type = paid`)
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 1.2.1 | Aller sur `/catalogue/6da82edd-...` (Frankenstein 7.80 EUR — paid) avec abonné | Bouton **« Acheter au prix réduit »** (PAS « Lire ») | ⏭ |
| 1.2.2 | Vérifier l'affichage du prix | Prix public + prix abonné (-30%) affiché | ⏭ |
| 1.2.3 | Cliquer « Acheter » | Redirection Flutterwave/Stripe (paiement initié) | ⏭ |

### 1.3 Page de détail — Livre abonnement déjà débloqué
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 1.3.1 | Revenir sur un livre déjà débloqué (test 1.1.3) | Bouton **« Lire maintenant »** ou **« Écouter maintenant »** | ⏭ |
| 1.3.2 | Cliquer le bouton | Redirection directe vers le lecteur (PAS le déblocage) | ⏭ |

### 1.4 Dashboard — Navigation livres
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 1.4.1 | Cliquer un livre dans « Nouveautés » | Redirige vers `/catalogue/:id` (PAS vers le lecteur) | ⏭ |
| 1.4.2 | Cliquer un livre dans « Populaires » | Redirige vers `/catalogue/:id` | ⏭ |
| 1.4.3 | Cliquer un livre dans « Reprendre » | Redirige directement vers le **lecteur** (`/read/:id` ou `/listen/:id`) | ⏭ |

---

## MODULE 2 — Quota & Déblocage

### 2.1 Quota d'abonnement
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 2.1.1 | Page de détail → affichage du quota | « Quota texte : X / 400 (Y restants) » visible | ⏭ |
| 2.1.2 | Débloquer un livre → quota diminue | Quota X+1 après déblocage | ⏭ |
| 2.1.3 | API `/api/subscriptions/usage` | Retourne `text_unlocked_count`, `text_quota = 400` | ⏭ |

### 2.2 Idempotence déblocage
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 2.2.1 | Débloquer un livre déjà débloqué | Retourne succès sans consommer de quota (`already_unlocked: true`) | ⏭ |

---

## MODULE 3 — Lecteur EPUB

### 3.1 Chargement du lecteur
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 3.1.1 | Naviguer vers `/read/:id` (livre débloqué EPUB) | Page lecteur s'affiche, **livre visible dans la zone de lecture** | ⏭ |
| 3.1.2 | Vérifier console — aucune erreur `epub not initialized` persistante | `[EReader] relocated` log apparaît (epub initialisé) | ⏭ |
| 3.1.3 | Boutons Suivant / Précédent | Navigation entre pages fonctionne sans crash | ⏭ |
| 3.1.4 | Table des matières (icône Menu) | Sommaire des chapitres affiché | ⏭ |
| 3.1.5 | Mode nuit (icône Lune) | Fond sombre, texte clair | ⏭ |
| 3.1.6 | Fermer lecteur → retourner page catalogue | Navigation `/catalogue/:id` fonctionne | ⏭ |

### 3.2 Progression
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 3.2.1 | Lire 5 pages, fermer, rouvrir | Reprendre à la dernière position (CFI restauré) | ⏭ |
| 3.2.2 | Slider de progression | Déplacer le slider navigue dans le livre | ⏭ |

---

## MODULE 4 — Lecteur Audio

### 4.1 Chargement
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 4.1.1 | Naviguer vers `/listen/:id` (audiobook débloqué) | Page lecteur audio s'affiche, lecture démarre | ⏭ |
| 4.1.2 | Contrôles Play/Pause/Avancer/Reculer | Fonctionnent correctement | ⏭ |

---

## MODULE 5 — Abonnements

### 5.1 Page abonnement
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 5.1.1 | Aller sur `/subscription` | Infos abonnement actif affichées (plan, date renouvellement) | ⏭ |
| 5.1.2 | Date de renouvellement | **1 mois** après la date de début (PAS 2 mois) | ⏭ |
| 5.1.3 | Historique paiements | Liste des paiements avec bouton télécharger facture | ⏭ |

### 5.2 Prise d'abonnement (sans abonnement actif)
| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 5.2.1 | Aller sur `/pricing`, choisir un plan | Dialog de choix de paiement (Stripe / Flutterwave) | ⏭ |
| 5.2.2 | Flutterwave → paiement test | Redirection callback → abonnement activé | ⏭ |

---

## MODULE 6 — Catalogue & Recherche

| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 6.1 | Aller sur `/catalogue` | Liste des livres affichée avec couvertures | ⏭ |
| 6.2 | Filtrer par type (Ebook / Audiobook) | Résultats filtrés | ⏭ |
| 6.3 | Rechercher « Frankenstein » | Résultats pertinents (fallback DB si Meilisearch absent) | ⏭ |
| 6.4 | Cliquer un livre dans le catalogue | Redirige vers `/catalogue/:id` | ⏭ |

---

## MODULE 7 — Authentification

| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 7.1 | Connexion valide | Redirection vers Dashboard | ⏭ |
| 7.2 | Connexion invalide | Message d'erreur visible | ⏭ |
| 7.3 | Inscription → bouton « Se connecter » | Redirige vers `/login` (pas rafraîchissement) | ⏭ |
| 7.4 | Déconnexion | Session effacée, redirection `/` | ⏭ |
| 7.5 | Accès page protégée sans token | Redirection vers `/login` | ⏭ |

---

## MODULE 8 — Dashboard utilisateur

| # | Action | Résultat attendu | Statut |
|---|--------|-----------------|--------|
| 8.1 | Aller sur `/dashboard` | Stats (livres lus, temps, quota) affichées | ⏭ |
| 8.2 | Section « Reprendre » | Livres en cours de lecture avec progression | ⏭ |
| 8.3 | Section « Nouveautés » | Liste livres récents (clique → `/catalogue/:id`) | ⏭ |

---

## BUGS CONNUS NON RÉSOLUS

| Bug | Impact | Action requise |
|-----|--------|---------------|
| Lecteur EPUB — livre vide (epub not initialized) | 🔴 Bloquant | Debug en cours — vérifier console après hot reload |
| Abonnement affiché 2 mois | 🟠 Cosmétique | Corriger `duration_days` dans Supabase Table Editor (`subscription_plans`) |
| Devices API manquante (`/api/devices 404`) | 🟡 Mineur | Le hook `useReadingLock` échoue silencieusement en dev |

---

## CHECKLIST RAPIDE AVANT DEPLOY

- [ ] `canReadBySubscription = false` (quota obligatoire)
- [ ] Quota correctement initialisé (fallback live plan si snapshot = 0)
- [ ] Dashboard → clic livre → `/catalogue/:id` (pas directement reader)
- [ ] ContentDetailPage → pas de crash au chargement
- [ ] Lecteur EPUB → livre s'affiche et navigation fonctionne
- [ ] Variables d'environnement production configurées
- [ ] Webhooks Stripe configurés (voir `docs/stripe-webhooks-setup.md`)
