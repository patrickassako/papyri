# Plan de Test - Epic 1 : Authentification, Profil & Onboarding

**Projet** : Bibliothèque Numérique Privée
**Epic** : Epic 1 - Authentification, Profil & Onboarding
**Date création** : 2026-02-07
**Version** : 1.0
**Statut** : Ready for Testing

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Objectifs](#objectifs)
3. [Scope](#scope)
4. [Environnement de test](#environnement-de-test)
5. [Données de test](#données-de-test)
6. [Tests par Story](#tests-par-story)
7. [Tests d'intégration](#tests-dintégration)
8. [Tests de sécurité](#tests-de-sécurité)
9. [Tests de performance](#tests-de-performance)
10. [Tests cross-device](#tests-cross-device)
11. [Tests d'accessibilité](#tests-daccessibilité)
12. [Critères d'acceptation](#critères-dacceptation)
13. [Checklist finale](#checklist-finale)

---

## Vue d'ensemble

Ce plan de test couvre l'intégralité des fonctionnalités implémentées dans Epic 1, comprenant l'authentification utilisateur, la gestion de profil, l'historique de lecture et l'onboarding.

### Stories couvertes
- ✅ Story 1.1 : Initialisation Projet & Design System
- ✅ Story 1.2 : Inscription Utilisateur
- ✅ Story 1.3 : Connexion Utilisateur
- ✅ Story 1.4 : Déconnexion
- ✅ Story 1.5 : Réinitialisation Mot de Passe
- ✅ Story 1.6 : Profil Utilisateur
- ✅ Story 1.7 : Historique Lecture/Écoute
- ✅ Story 1.8 : Onboarding Premier Lancement

---

## Objectifs

1. **Valider** toutes les fonctionnalités implémentées dans Epic 1
2. **Garantir** la sécurité des données utilisateur
3. **Vérifier** la cohérence cross-device (web + mobile)
4. **Confirmer** l'accessibilité WCAG AA
5. **Mesurer** les performances (temps de réponse < 2s)
6. **Documenter** tous les bugs et issues

---

## Scope

### ✅ In Scope
- Tests fonctionnels (toutes stories)
- Tests de sécurité (authentification, RLS, XSS, SQL injection)
- Tests d'intégration (flow complets)
- Tests de performance (API response time)
- Tests cross-device (web ↔ mobile)
- Tests d'accessibilité (WCAG AA)
- Tests de validation (formulaires)
- Tests d'erreurs (edge cases)

### ❌ Out of Scope
- Tests de charge (load testing) - différé à Epic 10
- Tests de paiement - Epic 2
- Tests de contenu (catalogue) - Epic 3
- Tests de lecteur (ebook/audio) - Epic 4/5
- Tests automatisés E2E - différé
- Tests de performance avancés (stress testing)

---

## Environnement de test

### Prérequis

#### Backend
- Node.js 18+ installé
- Supabase projet configuré
- Variables d'environnement (.env) :
  ```
  PORT=3001
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_ANON_KEY=eyJxxx...
  JWT_SECRET=xxx
  JWT_ACCESS_EXPIRATION=15m
  JWT_REFRESH_EXPIRATION=7d
  BREVO_API_KEY=xkeysib-xxx
  BREVO_SENDER_EMAIL=noreply@example.com
  CORS_ORIGIN=http://localhost:3000
  ```
- Backend démarré : `cd backend && npm start`

#### Frontend Web
- React 18+ installé
- Variables d'environnement (.env.local) :
  ```
  REACT_APP_API_URL=http://localhost:3001
  ```
- Web démarré : `cd web && npm start`
- Navigateurs : Chrome (latest), Firefox (latest), Safari (latest)

#### Frontend Mobile
- React Native + Expo installés
- Émulateurs : iOS Simulator + Android Emulator
- Variables d'environnement configurées
- Mobile démarré : `cd mobile && expo start`

#### Base de données
- Supabase projet créé
- Migrations SQL exécutées :
  - ✅ Table `users` créée
  - ✅ Table `notification_preferences` créée
  - ✅ Table `password_reset_tokens` créée
  - ⚠️ Table `reading_history` créée (⚠️ dépend de `contents` - Epic 3)
  - ✅ RLS policies activées
  - ✅ Indexes créés

#### Email
- Compte Brevo configuré
- Email de test vérifié
- Template "Bienvenue" créé
- Template "Reset Password" créé

### Comptes de test

| Rôle | Email | Mot de passe | État onboarding | Notes |
|------|-------|--------------|-----------------|-------|
| User nouveau | test-new@example.com | Test1234 | FALSE | Pour test inscription |
| User existant | test-user@example.com | Test1234 | TRUE | Profil complet |
| User sans onboarding | test-onboard@example.com | Test1234 | FALSE | Pour test onboarding |
| Admin | test-admin@example.com | Admin1234 | TRUE | Role = admin |

---

## Données de test

### Données valides

**Emails valides :**
- `user@example.com`
- `test.user@domain.fr`
- `user+tag@example.co.uk`

**Mots de passe valides (≥8 chars) :**
- `Password123`
- `SecureP@ss2024`
- `Test1234`

**Noms valides :**
- `Jean Dupont`
- `Marie-Claire N'Dour`
- `José García`

**Langues valides :**
- `fr`, `en`, `es`, `pt`

### Données invalides

**Emails invalides :**
- `invalid-email` (format incorrect)
- `@example.com` (missing local part)
- `user@` (missing domain)

**Mots de passe invalides :**
- `short` (< 8 chars)
- ` ` (vide)
- `1234567` (< 8 chars)

**Noms invalides :**
- `A` répété 256 fois (> 255 chars)
- ` ` (vide)

**Langues invalides :**
- `de`, `it`, `zh` (non supportées)

---

## Tests par Story

### Story 1.1 : Initialisation Projet & Design System

#### Objectif
Vérifier que l'infrastructure et le design system fonctionnent correctement.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| 1.1.1 | Backend démarre | 1. `cd backend && npm start` | ✅ Server running on port 3001 | P0 |
| 1.1.2 | Health check | 1. GET /health | ✅ 200 `{ status: 'ok', timestamp: '...' }` | P0 |
| 1.1.3 | Web démarre | 1. `cd web && npm start` | ✅ App opens on localhost:3000 | P0 |
| 1.1.4 | Mobile démarre | 1. `cd mobile && expo start` | ✅ Expo opens, QR code displayed | P0 |
| 1.1.5 | Design tokens web | 1. Inspecter web/src/theme/theme.js<br>2. Vérifier couleurs | ✅ Primary = #B5651D<br>✅ Secondary = #D4A017 | P1 |
| 1.1.6 | Design tokens mobile | 1. Inspecter mobile theme<br>2. Vérifier couleurs identiques | ✅ Tokens identiques web/mobile | P1 |
| 1.1.7 | Typographie Playfair | 1. Ouvrir page web<br>2. Inspecter titre | ✅ Font-family: Playfair Display | P2 |
| 1.1.8 | CORS configuré | 1. GET /health depuis web<br>2. Vérifier CORS headers | ✅ Access-Control-Allow-Origin présent | P1 |
| 1.1.9 | Error handler | 1. GET /non-existent-route | ✅ 404 avec format `{ success: false, error: {...} }` | P1 |

---

### Story 1.2 : Inscription Utilisateur

#### Objectif
Vérifier que les utilisateurs peuvent créer un compte avec email/password.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.2.1** | **Inscription valide (Web)** | 1. Ouvrir /register<br>2. Email: `newuser@test.com`<br>3. Password: `Test1234`<br>4. Nom: `Test User`<br>5. Cliquer "S'inscrire" | ✅ 201 Created<br>✅ Tokens retournés<br>✅ Redirect homepage<br>✅ Email bienvenue envoyé | **P0** |
| **1.2.2** | **Inscription valide (Mobile)** | 1. Ouvrir RegisterScreen<br>2. Remplir formulaire<br>3. Submit | ✅ Success<br>✅ Navigate HomeScreen | **P0** |
| 1.2.3 | Email déjà utilisé | 1. Tenter inscription avec email existant | ✅ 409 `{ error: { code: 'EMAIL_ALREADY_EXISTS' } }` | P0 |
| 1.2.4 | Email format invalide | 1. Email: `invalid-email` | ✅ 422 `INVALID_EMAIL` | P1 |
| 1.2.5 | Password < 8 chars | 1. Password: `short` | ✅ 422 `PASSWORD_TOO_SHORT` | P1 |
| 1.2.6 | Nom > 255 chars | 1. Nom: string 256 chars | ✅ 422 `NAME_TOO_LONG` | P2 |
| 1.2.7 | Champs vides | 1. Submit sans remplir | ✅ 400 `MISSING_FIELDS` | P1 |
| 1.2.8 | Rate limiting | 1. Faire 15 inscriptions en 1 min | ✅ 429 `TOO_MANY_REQUESTS` après 10 requêtes | P1 |
| 1.2.9 | Password visibility toggle | 1. Cliquer icône œil | ✅ Password visible/masqué | P2 |
| 1.2.10 | Password strength indicator | 1. Taper password<br>2. Observer barre | ✅ Barre change couleur (rouge→jaune→vert) | P2 |
| 1.2.11 | Validation temps réel | 1. Taper email invalide<br>2. Blur | ✅ Message erreur s'affiche | P2 |
| 1.2.12 | Tokens sauvegardés | 1. Inspecter localStorage (web)<br>2. Vérifier access_token, refresh_token | ✅ Tokens présents | P1 |
| 1.2.13 | onboarding_completed = FALSE | 1. Après inscription<br>2. GET /users/me | ✅ `onboarding_completed: false` | P1 |
| 1.2.14 | notification_preferences créées | 1. Vérifier DB | ✅ Row créée avec user_id, push_enabled: true | P2 |
| 1.2.15 | Email bienvenue reçu | 1. Vérifier boîte mail test | ✅ Email "Bienvenue" reçu | P1 |

---

### Story 1.3 : Connexion Utilisateur

#### Objectif
Vérifier que les utilisateurs peuvent se connecter avec leurs identifiants.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.3.1** | **Connexion valide (Web)** | 1. Ouvrir /login<br>2. Email: `test-user@example.com`<br>3. Password: `Test1234`<br>4. Cliquer "Se connecter" | ✅ 200 OK<br>✅ Tokens retournés<br>✅ Redirect homepage | **P0** |
| **1.3.2** | **Connexion valide (Mobile)** | 1. Ouvrir LoginScreen<br>2. Remplir formulaire<br>3. Submit | ✅ Success<br>✅ Navigate HomeScreen | **P0** |
| 1.3.3 | Email incorrect | 1. Email: `wrong@test.com`<br>2. Password: `Test1234` | ✅ 401 `INVALID_CREDENTIALS` | P0 |
| 1.3.4 | Password incorrect | 1. Email: `test-user@example.com`<br>2. Password: `WrongPass` | ✅ 401 `INVALID_CREDENTIALS` | P0 |
| 1.3.5 | Utilisateur inactif | 1. Connexion avec compte is_active=FALSE | ✅ 401 `INVALID_CREDENTIALS` | P1 |
| 1.3.6 | Champs vides | 1. Submit sans remplir | ✅ 400 `MISSING_FIELDS` | P1 |
| 1.3.7 | Rate limiting | 1. Faire 15 connexions en 1 min | ✅ 429 `TOO_MANY_REQUESTS` après 10 | P1 |
| 1.3.8 | Password visibility toggle | 1. Cliquer icône œil | ✅ Password visible/masqué | P2 |
| 1.3.9 | "Mot de passe oublié" link | 1. Cliquer lien | ✅ Navigate /forgot-password | P2 |
| 1.3.10 | last_login_at mis à jour | 1. Connexion<br>2. Vérifier DB | ✅ last_login_at = NOW() | P2 |
| 1.3.11 | Access token valide | 1. Connexion<br>2. Décoder JWT | ✅ userId, email, role présents<br>✅ Expiration 15 min | P1 |
| 1.3.12 | Refresh token valide | 1. Connexion<br>2. Décoder JWT | ✅ userId présent<br>✅ Expiration 7 jours | P1 |
| 1.3.13 | Refresh token flow | 1. Attendre 16 min<br>2. GET /users/me (devrait refresh auto) | ✅ Nouveau access_token obtenu | P0 |

---

### Story 1.4 : Déconnexion

#### Objectif
Vérifier que la déconnexion nettoie les tokens et redirige vers login.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.4.1** | **Déconnexion Web** | 1. Connecté<br>2. Cliquer "Se déconnecter" | ✅ POST /auth/logout 204<br>✅ Tokens supprimés localStorage<br>✅ Redirect /login | **P0** |
| **1.4.2** | **Déconnexion Mobile** | 1. Connecté<br>2. Tap "Se déconnecter" | ✅ POST /auth/logout 204<br>✅ Tokens supprimés AsyncStorage<br>✅ Navigate LoginScreen | **P0** |
| 1.4.3 | Déconnexion sans token | 1. POST /auth/logout sans Bearer token | ✅ 401 `MISSING_TOKEN` | P1 |
| 1.4.4 | Déconnexion avec token expiré | 1. POST /auth/logout avec token expiré | ✅ 401 `TOKEN_EXPIRED` | P2 |
| 1.4.5 | Tokens bien supprimés | 1. Déconnexion<br>2. Inspecter storage | ✅ access_token absent<br>✅ refresh_token absent | P1 |
| 1.4.6 | Redirect immédiat | 1. Déconnexion<br>2. Observer redirect | ✅ Redirect sans délai | P2 |
| 1.4.7 | Audit log créé | 1. Déconnexion<br>2. Vérifier console backend | ✅ Log: "User logout: userId=xxx, timestamp=xxx" | P2 |

---

### Story 1.5 : Réinitialisation Mot de Passe

#### Objectif
Vérifier le flow complet de reset password (demande + réinitialisation).

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.5.1** | **Demande reset valide (Web)** | 1. Ouvrir /forgot-password<br>2. Email: `test-user@example.com`<br>3. Submit | ✅ 200 OK<br>✅ Message "Email envoyé"<br>✅ Email reçu avec lien | **P0** |
| **1.5.2** | **Demande reset valide (Mobile)** | 1. Ouvrir ForgotPasswordScreen<br>2. Email valide<br>3. Submit | ✅ Success message<br>✅ Email envoyé | **P0** |
| 1.5.3 | Email non enregistré | 1. Email: `nonexistent@test.com` | ✅ 200 OK (privacy - ne leak pas existence) | P0 |
| 1.5.4 | Email format invalide | 1. Email: `invalid` | ✅ 422 `INVALID_EMAIL` | P1 |
| 1.5.5 | Rate limiting | 1. Faire 15 demandes en 1 min | ✅ 429 après 10 requêtes | P1 |
| 1.5.6 | Token créé en DB | 1. Demande reset<br>2. Vérifier password_reset_tokens | ✅ Row créée avec token (64 chars hex), expires_at (+1h) | P1 |
| 1.5.7 | Email contient token | 1. Ouvrir email reçu<br>2. Extraire token du lien | ✅ Lien format: `/reset-password?token=xxx` | P1 |
| **1.5.8** | **Reset password valide (Web)** | 1. Cliquer lien email<br>2. Nouveau password: `NewPass123`<br>3. Confirmation: `NewPass123`<br>4. Submit | ✅ 200 OK<br>✅ Password changé en DB<br>✅ Redirect /login après 2s | **P0** |
| **1.5.9** | **Reset password valide (Mobile)** | 1. Deep link avec token<br>2. Remplir formulaire<br>3. Submit | ✅ Success<br>✅ Navigate LoginScreen | **P0** |
| 1.5.10 | Token invalide | 1. Reset avec token inexistant | ✅ 400 `INVALID_TOKEN` | P0 |
| 1.5.11 | Token expiré | 1. Reset avec token expiré (>1h) | ✅ 400 `TOKEN_EXPIRED` | P0 |
| 1.5.12 | Token déjà utilisé | 1. Reset avec token used_at != NULL | ✅ 400 `TOKEN_ALREADY_USED` | P1 |
| 1.5.13 | Password < 8 chars | 1. Nouveau password: `short` | ✅ 422 `PASSWORD_TOO_SHORT` | P1 |
| 1.5.14 | Passwords ne matchent pas | 1. Password: `Pass123`<br>2. Confirm: `Pass456` | ✅ Erreur frontend "Les mots de passe ne correspondent pas" | P1 |
| 1.5.15 | Token marqué utilisé | 1. Reset valide<br>2. Vérifier DB | ✅ used_at = NOW() | P2 |
| 1.5.16 | Connexion avec nouveau password | 1. Reset valide<br>2. Login avec nouveau password | ✅ Connexion réussie | P0 |
| 1.5.17 | Ancien password ne marche plus | 1. Reset valide<br>2. Login avec ancien password | ✅ 401 `INVALID_CREDENTIALS` | P0 |

---

### Story 1.6 : Profil Utilisateur

#### Objectif
Vérifier la consultation et modification du profil utilisateur.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.6.1** | **Affichage profil (Web)** | 1. Connecté<br>2. Ouvrir /profile | ✅ Avatar affiché<br>✅ Nom, email, langue, rôle affichés<br>✅ Date inscription affichée | **P0** |
| **1.6.2** | **Affichage profil (Mobile)** | 1. Connecté<br>2. Ouvrir ProfileScreen | ✅ Infos affichées<br>✅ Pull-to-refresh fonctionne | **P0** |
| 1.6.3 | GET /users/me | 1. Connecté<br>2. GET /users/me | ✅ 200 OK<br>✅ user + subscription (ou null) | P0 |
| 1.6.4 | Sans token | 1. GET /users/me sans Bearer token | ✅ 401 `MISSING_TOKEN` | P1 |
| 1.6.5 | password_hash jamais exposé | 1. GET /users/me<br>2. Inspecter response | ✅ password_hash absent | P0 |
| **1.6.6** | **Modification nom (Web)** | 1. Ouvrir profil<br>2. Cliquer "Modifier"<br>3. Changer nom → "Jean-Pierre Dupont"<br>4. Enregistrer | ✅ 200 OK<br>✅ Nom mis à jour<br>✅ Message "Profil mis à jour" 3s | **P0** |
| **1.6.7** | **Modification nom (Mobile)** | 1. Tap "Modifier profil"<br>2. Changer nom<br>3. Enregistrer | ✅ Success banner<br>✅ Profil rafraîchi | **P0** |
| 1.6.8 | Modification langue | 1. Changer langue → "en"<br>2. Enregistrer | ✅ 200 OK<br>✅ language = "en" | P1 |
| 1.6.9 | Langue invalide | 1. PATCH /users/me { language: "de" } | ✅ 422 `INVALID_LANGUAGE` | P1 |
| 1.6.10 | Nom > 255 chars | 1. Nom: string 256 chars | ✅ 422 `NAME_TOO_LONG` | P2 |
| 1.6.11 | Email non modifiable | 1. PATCH /users/me { email: "new@test.com" } | ✅ Email ignoré (immutable) | P0 |
| **1.6.12** | **Changement password (Web)** | 1. Cliquer "Changer mot de passe"<br>2. Actuel: `Test1234`<br>3. Nouveau: `NewPass123`<br>4. Confirmer: `NewPass123`<br>5. Submit | ✅ 200 OK<br>✅ Message "Mot de passe modifié"<br>✅ Connexion avec nouveau fonctionne | **P0** |
| **1.6.13** | **Changement password (Mobile)** | 1. Tap "Changer mot de passe"<br>2. Remplir formulaire<br>3. Submit | ✅ Success<br>✅ Dialog fermé | **P0** |
| 1.6.14 | Ancien password incorrect | 1. Actuel: `WrongPass`<br>2. Nouveau: `NewPass123` | ✅ 401 `INVALID_PASSWORD` | P0 |
| 1.6.15 | Nouveau password < 8 chars | 1. Nouveau: `short` | ✅ 422 `PASSWORD_TOO_SHORT` | P1 |
| 1.6.16 | Passwords ne matchent pas (frontend) | 1. Nouveau: `Pass123`<br>2. Confirm: `Pass456` | ✅ Erreur "Les mots de passe ne correspondent pas" | P1 |
| 1.6.17 | Password visibility toggle | 1. Cliquer œil sur chaque champ | ✅ Password visible/masqué | P2 |
| 1.6.18 | Subscription affichée si existe | 1. User avec subscription<br>2. GET /users/me | ✅ subscription: { status, plan, price_eur, current_period_end } | P2 |
| 1.6.19 | Subscription null si absente | 1. User sans subscription<br>2. GET /users/me | ✅ subscription: null | P1 |

---

### Story 1.7 : Historique Lecture/Écoute

#### Objectif
Vérifier l'affichage et la gestion de l'historique de lecture.

⚠️ **IMPORTANT** : Cette story dépend de la table `contents` (Epic 3). Tests complets possibles uniquement après Epic 3.

#### Tests préliminaires (sans données contents)

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| 1.7.1 | GET /reading-history vide | 1. Connecté<br>2. GET /reading-history | ✅ 200 OK<br>✅ `data: []`<br>✅ `pagination: { total: 0 }` | P1 |
| 1.7.2 | Sans token | 1. GET /reading-history sans Bearer | ✅ 401 `MISSING_TOKEN` | P1 |
| 1.7.3 | Pagination params | 1. GET /reading-history?page=2&limit=50 | ✅ 200 OK<br>✅ pagination.page = 2 | P2 |
| 1.7.4 | Limit max 100 | 1. GET /reading-history?limit=200 | ✅ limit = 100 (capped) | P2 |
| 1.7.5 | PUT progress content inexistant | 1. PUT /reading-history/fake-uuid | ✅ 404 `CONTENT_NOT_FOUND` | P1 |
| 1.7.6 | Progress invalide | 1. PUT /reading-history/:id { progress_percent: 150 } | ✅ 422 `INVALID_PROGRESS` | P1 |
| 1.7.7 | History page (Web) | 1. Ouvrir /history | ✅ Page s'affiche<br>✅ Empty state si vide | P2 |
| 1.7.8 | History screen (Mobile) | 1. Ouvrir HistoryScreen | ✅ Screen s'affiche<br>✅ Empty state | P2 |

#### Tests complets (après Epic 3 - avec données contents)

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| 1.7.9 | UPSERT progress nouveau | 1. PUT /reading-history/:content_id { progress_percent: 25, last_position: {...} } | ✅ 201 Created<br>✅ Row créée en DB | P0 |
| 1.7.10 | UPSERT progress existant | 1. PUT même content_id avec progress_percent: 50 | ✅ 200 OK<br>✅ Row updated | P0 |
| 1.7.11 | Auto-completion | 1. PUT progress_percent: 100 | ✅ is_completed = TRUE<br>✅ completed_at = NOW() | P0 |
| 1.7.12 | GET history avec data | 1. GET /reading-history | ✅ Liste avec content metadata<br>✅ ORDER BY last_read_at DESC | P0 |
| 1.7.13 | Pagination | 1. Créer 25 items<br>2. GET ?page=1&limit=20<br>3. GET ?page=2 | ✅ Page 1: 20 items<br>✅ Page 2: 5 items | P1 |
| 1.7.14 | Filter web (Tous) | 1. Ouvrir /history<br>2. Tab "Tous" | ✅ Tous items affichés | P1 |
| 1.7.15 | Filter web (Ebooks) | 1. Tab "Ebooks" | ✅ Seuls ebooks affichés | P1 |
| 1.7.16 | Filter web (Audiobooks) | 1. Tab "Audiobooks" | ✅ Seuls audiobooks affichés | P1 |
| 1.7.17 | Filter web (Terminés) | 1. Tab "Terminés" | ✅ Seuls is_completed=TRUE affichés | P1 |
| 1.7.18 | ContentCardWithProgress | 1. Observer card | ✅ Couverture, titre, auteur affichés<br>✅ Progress bar correcte<br>✅ Type badge correct | P1 |
| 1.7.19 | Click card → detail | 1. Cliquer card | ✅ Navigate /contents/:id | P2 |
| 1.7.20 | Click "Reprendre" → reader | 1. Cliquer "Reprendre" | ✅ Navigate /reader/:id?position=xxx | P0 |
| 1.7.21 | GET /continue | 1. GET /reading-history/continue | ✅ Items is_completed=FALSE<br>✅ LIMIT 10 | P1 |
| 1.7.22 | Lecture seule | 1. Chercher bouton "Supprimer" | ✅ Aucun bouton delete<br>✅ Pas de swipe-to-delete | P0 |

---

### Story 1.8 : Onboarding Premier Lancement

#### Objectif
Vérifier le flow d'onboarding au premier lancement.

⚠️ **Note** : Intégration manuelle dans App.js requise avant test.

#### Tests

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **1.8.1** | **Trigger onboarding (Web)** | 1. Créer nouveau compte<br>2. Après inscription | ✅ OnboardingCarousel modal s'affiche<br>✅ Screen 1 visible | **P0** |
| **1.8.2** | **Trigger onboarding (Mobile)** | 1. Créer nouveau compte<br>2. Après inscription | ✅ OnboardingCarousel fullscreen<br>✅ Screen 1 visible | **P0** |
| 1.8.3 | Pas d'onboarding si completed | 1. Login avec user onboarding_completed=TRUE | ✅ Pas de modal<br>✅ Redirect homepage direct | P0 |
| 1.8.4 | Screen 1 contenu | 1. Observer screen 1 | ✅ Titre: "Ta Bibliothèque Sans Limites"<br>✅ Description complète<br>✅ Illustration livres<br>✅ Bouton "Suivant" | P1 |
| 1.8.5 | Screen 2 contenu | 1. Cliquer "Suivant" | ✅ Titre: "Tout Fonctionne Partout"<br>✅ Illustration multi-device<br>✅ Bouton "Suivant" | P1 |
| 1.8.6 | Screen 3 contenu | 1. Cliquer "Suivant" | ✅ Titre: "Prêt(e) ?"<br>✅ Illustration reader<br>✅ Bouton "Commencer à lire" | P1 |
| 1.8.7 | Dots indicators | 1. Observer dots à chaque screen | ✅ Dot actif = primary (#B5651D)<br>✅ Dots inactifs = gris | P2 |
| 1.8.8 | Navigation "Suivant" | 1. Cliquer "Suivant" plusieurs fois | ✅ Avance screen 1→2→3 | P1 |
| 1.8.9 | Swipe mobile | 1. Swipe horizontalement (mobile) | ✅ Navigation swipe native fonctionne | P1 |
| **1.8.10** | **Skip onboarding (Web)** | 1. Screen 1<br>2. Cliquer "Passer" (top-right) | ✅ POST /users/me/onboarding-complete<br>✅ Modal fermé<br>✅ Redirect homepage | **P0** |
| **1.8.11** | **Skip onboarding (Mobile)** | 1. Screen 1<br>2. Tap "Passer" | ✅ POST /onboarding-complete<br>✅ Navigate HomeScreen | **P0** |
| **1.8.12** | **Complete onboarding (Web)** | 1. Screen 3<br>2. Cliquer "Commencer à lire" | ✅ POST /users/me/onboarding-complete<br>✅ Modal fermé<br>✅ Redirect /catalogue | **P0** |
| **1.8.13** | **Complete onboarding (Mobile)** | 1. Screen 3<br>2. Tap "Commencer à lire" | ✅ POST /onboarding-complete<br>✅ Navigate CatalogueScreen | **P0** |
| 1.8.14 | onboarding_completed mis à jour | 1. Complete ou skip<br>2. GET /users/me | ✅ onboarding_completed = TRUE | P0 |
| 1.8.15 | Cross-device persistence | 1. Complete sur mobile<br>2. Login sur web | ✅ Pas d'onboarding sur web | P0 |
| 1.8.16 | Pas de ESC key | 1. Appuyer ESC (web) | ✅ Modal ne ferme pas | P2 |
| 1.8.17 | Responsive web | 1. Tester mobile viewport<br>2. Tester desktop | ✅ Layout adapté | P2 |

---

## Tests d'intégration

### Flow complets end-to-end

| ID | Scenario | Étapes | Résultat attendu | Priorité |
|----|----------|--------|------------------|----------|
| **INT-1** | **Inscription → Onboarding → Profil** | 1. Inscription nouveau user<br>2. Onboarding s'affiche<br>3. Compléter onboarding<br>4. Aller profil<br>5. Modifier nom | ✅ Tous les steps réussissent<br>✅ Nom modifié visible | **P0** |
| **INT-2** | **Connexion → Profil → Déconnexion** | 1. Login<br>2. Voir profil<br>3. Changer password<br>4. Déconnexion<br>5. Login avec nouveau password | ✅ Flow complet fonctionne | **P0** |
| **INT-3** | **Reset password complet** | 1. Forgot password<br>2. Recevoir email<br>3. Cliquer lien<br>4. Reset password<br>5. Login avec nouveau | ✅ Tout fonctionne<br>✅ Login réussi | **P0** |
| INT-4 | Inscription → Logout → Login | 1. Inscription<br>2. Skip onboarding<br>3. Logout<br>4. Login | ✅ Pas d'onboarding au re-login | P1 |
| INT-5 | Refresh token flow | 1. Login<br>2. Attendre 16 min<br>3. Faire API call | ✅ Auto-refresh fonctionne<br>✅ API call réussit | P0 |
| INT-6 | Cross-device sync | 1. Login mobile<br>2. Modifier profil<br>3. Login web<br>4. Voir profil | ✅ Modifications visibles web | P1 |
| INT-7 | Multi-sessions | 1. Login web<br>2. Login mobile (même user)<br>3. Logout web<br>4. Vérifier mobile | ✅ Mobile reste connecté (stateless) | P2 |

---

## Tests de sécurité

| ID | Test | Étapes | Résultat attendu | Priorité |
|----|------|--------|------------------|----------|
| **SEC-1** | **Password hashing** | 1. Inscription<br>2. Inspecter users.password_hash en DB | ✅ Bcrypt hash (commence par $2a$12$)<br>✅ Jamais plaintext | **P0** |
| **SEC-2** | **JWT signature** | 1. Login<br>2. Modifier payload JWT<br>3. Utiliser JWT modifié | ✅ 401 `INVALID_TOKEN` | **P0** |
| **SEC-3** | **JWT expiration** | 1. Login<br>2. Attendre 16 min<br>3. Utiliser access_token expiré | ✅ 401 `TOKEN_EXPIRED` | **P0** |
| SEC-4 | SQL Injection | 1. Email: `' OR '1'='1`<br>2. Tenter login | ✅ Échec sécurisé (pas de SQL injection) | P0 |
| SEC-5 | XSS | 1. Nom: `<script>alert('XSS')</script>`<br>2. Afficher profil | ✅ Script pas exécuté<br>✅ Texte échappé | P0 |
| SEC-6 | CSRF protection | 1. POST /auth/register depuis autre domaine | ✅ CORS bloque<br>✅ Seulement origin autorisé | P1 |
| SEC-7 | Rate limiting | 1. 15 requêtes /auth/login en 1 min | ✅ 429 après 10 requêtes | P1 |
| SEC-8 | RLS policies users | 1. User A tente GET autre user_id | ✅ Accès refusé | P0 |
| SEC-9 | Password reset token sécurisé | 1. Inspecter token en DB | ✅ 64 chars hexadecimal<br>✅ Aléatoire (crypto.randomBytes) | P1 |
| SEC-10 | Token single-use | 1. Reset password<br>2. Réutiliser même token | ✅ 400 `TOKEN_ALREADY_USED` | P1 |
| SEC-11 | HTTPS headers | 1. Inspecter response headers | ✅ Helmet headers présents<br>✅ X-Content-Type-Options: nosniff | P2 |
| SEC-12 | Email enumeration protection | 1. Forgot password avec email inexistant | ✅ 200 OK (même response que email existant) | P1 |

---

## Tests de performance

| ID | Test | Métrique | Seuil acceptable | Priorité |
|----|------|----------|------------------|----------|
| PERF-1 | GET /health | Response time | < 100ms | P2 |
| PERF-2 | POST /auth/register | Response time | < 2s | P1 |
| PERF-3 | POST /auth/login | Response time | < 1s | P0 |
| PERF-4 | GET /users/me | Response time | < 500ms | P1 |
| PERF-5 | PATCH /users/me | Response time | < 1s | P1 |
| PERF-6 | GET /reading-history (20 items) | Response time | < 1s | P1 |
| PERF-7 | PUT /reading-history/:id | Response time | < 500ms | P2 |
| PERF-8 | Web page load (/register) | First Contentful Paint | < 2s | P2 |
| PERF-9 | Mobile app launch | Time to interactive | < 3s | P2 |
| PERF-10 | Bcrypt hashing | Hashing time | < 500ms | P2 |

**Outils de mesure** :
- Backend : `console.time()` / `console.timeEnd()`
- Web : Chrome DevTools Performance tab
- Mobile : React Native Performance Monitor
- API : Postman / Insomnia

---

## Tests cross-device

| ID | Test | Devices | Résultat attendu | Priorité |
|----|------|---------|------------------|----------|
| CROSS-1 | Inscription mobile → Login web | iOS + Chrome web | ✅ Login réussi<br>✅ Données cohérentes | P0 |
| CROSS-2 | Modification profil web → Voir mobile | Chrome + Android | ✅ Modifications visibles<br>✅ Sync immédiat | P1 |
| CROSS-3 | Onboarding mobile → Login web | Android + Safari | ✅ Pas d'onboarding sur web | P0 |
| CROSS-4 | Change password web → Login mobile | Firefox + iOS | ✅ Login avec nouveau password | P0 |
| CROSS-5 | Tokens séparés | iOS + Android (même user) | ✅ 2 sessions indépendantes<br>✅ Logout l'un n'affecte pas l'autre | P1 |

**Devices de test** :
- Web : Chrome (latest), Firefox (latest), Safari (latest)
- Mobile : iOS Simulator (iPhone 14), Android Emulator (Pixel 6)

---

## Tests d'accessibilité

| ID | Test | Critère WCAG | Résultat attendu | Priorité |
|----|------|--------------|------------------|----------|
| A11Y-1 | Contraste couleurs | 1.4.3 AA | ✅ Ratio ≥ 4.5:1 texte/fond | P1 |
| A11Y-2 | Titres hiérarchie | 1.3.1 | ✅ h1 → h2 → h3 correct | P2 |
| A11Y-3 | Labels formulaires | 3.3.2 | ✅ Tous inputs ont label | P1 |
| A11Y-4 | Erreurs explicites | 3.3.1 | ✅ Messages d'erreur clairs | P1 |
| A11Y-5 | Navigation clavier | 2.1.1 | ✅ Tab/Enter fonctionnent | P0 |
| A11Y-6 | Focus visible | 2.4.7 | ✅ Focus outline visible | P1 |
| A11Y-7 | Touch targets | 2.5.5 | ✅ Buttons ≥ 48x48px | P1 |
| A11Y-8 | Alt text images | 1.1.1 | ✅ Illustrations ont alt | P2 |
| A11Y-9 | aria-labels | 4.1.2 | ✅ Icons ont aria-label | P2 |
| A11Y-10 | Screen reader | 4.1.3 | ✅ Flow logique | P2 |

**Outils de test** :
- Chrome Lighthouse
- WAVE browser extension
- axe DevTools
- Screen reader (NVDA/JAWS/VoiceOver)

---

## Critères d'acceptation

### Critères bloquants (P0)

✅ **Tous les tests P0 doivent passer** avant validation Epic 1.

**Liste P0** :
- Inscription fonctionnelle (web + mobile)
- Connexion fonctionnelle (web + mobile)
- Déconnexion fonctionnelle (web + mobile)
- Reset password complet
- Profil consultation + modification
- Password hashing sécurisé
- JWT validation
- Tokens expiration
- RLS policies
- Onboarding trigger + completion
- Cross-device persistence onboarding
- Navigation clavier

### Critères non-bloquants (P1/P2)

- Tests P1 : À corriger avant production
- Tests P2 : Nice-to-have, peuvent être différés

---

## Checklist finale

### Avant de commencer les tests

- [ ] Backend démarré et accessible
- [ ] Web démarré et accessible
- [ ] Mobile démarré et accessible
- [ ] Supabase configuré avec migrations exécutées
- [ ] Brevo API configurée
- [ ] Comptes de test créés
- [ ] Variables d'environnement configurées

### Tests fonctionnels

- [ ] Story 1.1 : Design system testé
- [ ] Story 1.2 : Inscription testée (15 tests)
- [ ] Story 1.3 : Connexion testée (13 tests)
- [ ] Story 1.4 : Déconnexion testée (7 tests)
- [ ] Story 1.5 : Reset password testé (17 tests)
- [ ] Story 1.6 : Profil testé (19 tests)
- [ ] Story 1.7 : Historique testé (8 tests préliminaires + 14 complets après Epic 3)
- [ ] Story 1.8 : Onboarding testé (17 tests)

### Tests d'intégration

- [ ] 7 flows end-to-end testés

### Tests de sécurité

- [ ] 12 tests sécurité passés

### Tests de performance

- [ ] 10 métriques mesurées
- [ ] Tous endpoints < 2s

### Tests cross-device

- [ ] 5 scenarios cross-device testés

### Tests d'accessibilité

- [ ] 10 critères WCAG AA validés
- [ ] Lighthouse score ≥ 90

### Documentation

- [ ] Bugs documentés avec reproduction steps
- [ ] Screenshots des bugs critiques
- [ ] Test report final créé

---

## Test Report Template

```markdown
# Test Report - Epic 1

**Date** : YYYY-MM-DD
**Testeur** : [Nom]
**Environnement** : [Dev/Staging]

## Résumé

- Tests exécutés : X
- Tests passés : Y
- Tests échoués : Z
- Taux de réussite : Y/X %

## Tests échoués

### [ID Test]
**Description** : [...]
**Résultat attendu** : [...]
**Résultat obtenu** : [...]
**Sévérité** : P0/P1/P2
**Screenshot** : [lien]
**Reproduction steps** :
1. [...]
2. [...]

## Bugs trouvés

### BUG-1
**Titre** : [...]
**Description** : [...]
**Sévérité** : Critical/High/Medium/Low
**Steps to reproduce** : [...]
**Environment** : [...]

## Recommandations

[...]
```

---

## Conclusion

Ce plan de test couvre de manière exhaustive toutes les fonctionnalités d'Epic 1.

**Total tests** : ~150 tests fonctionnels + intégration + sécurité + performance

**Durée estimée** : 3-5 jours (testeur expérimenté)

**Prochaines étapes** :
1. Exécuter tous les tests P0
2. Documenter les bugs critiques
3. Fix bugs P0
4. Re-test bugs fixés
5. Exécuter tests P1/P2
6. Validation finale

**⚠️ Note importante** : Story 1.7 (Historique) ne peut être testée complètement qu'après implémentation de Epic 3 (table `contents`).

---

**Document créé par** : Claude Opus 4.6
**Date** : 2026-02-07
**Version** : 1.0
