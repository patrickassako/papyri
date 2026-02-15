# Rapport d'État du Projet - Papyri / Bibliothèque Numérique Privée
## MISE À JOUR 2026-02-14 (Addendum)

**Date:** 2026-02-14  
**Auteur MAJ:** Codex (synthèse basée sur l’état du code et les livrables intégrés)  
**Portée:** met à jour le statut réel des epics/stories réalisés depuis la version 2026-02-13.

---

### 0. Synthèse Exécutive (État Réel au 14/02/2026)

**Progression globale estimée (stories): 37%**
- Done: 19 / 61
- In progress: 4 / 61
- Ready for dev: 7 / 61
- Backlog: 31 / 61

| Epic | État | Lecture rapide |
|------|------|----------------|
| **Epic 1** | ✅ Done | Auth, profil, reset, historique déjà en place |
| **Epic 2** | 🟡 In progress (83%) | Modèle abonnements, checkout Flutterwave, callback + verify-payment, usage/bonus/members, renew/change-plan et gestion famille en place |
| **Epic 3** | ✅ Done | Landing, catalogue, détail, recherche, filtres et scénarios d’accès intégrés |
| **Epic 4** | 🟡 In progress | Page lecteur texte (UI e-reader) créée et routée |
| **Epic 5** | 🟡 In progress | Page lecteur audio (UI player) créée et routée |
| **Epic 6** | 🟡 In progress | Base `/home` existante mais personnalisation incomplète |
| **Epic 7** | 🔴 Backlog | Non démarré |
| **Epic 8** | 🔴 Backlog | Non démarré |
| **Epic 9** | 🔴 Backlog | Non démarré |
| **Epic 10** | 🟡 In progress | Artifacts créés, implémentation partielle côté repo |

---

### 0.1 Stories/Livrables effectivement réalisés récemment

- **Epic 2**
  - Pricing connecté aux vraies données backend (`/api/subscriptions/plans`)
  - Switch mensuel/annuel fonctionnel + FAQ déroulantes
  - Checkout abonnement opérationnel Flutterwave (initiation + callback frontend + vérification backend)
  - Endpoint `/api/subscriptions/verify-payment` intégré dans le flow UI
  - Évolutions backend abonnement: plans dynamiques, cycles, usage, bonus, members (routes/services en place)

- **Epic 3**
  - Page détail renforcée avec scénarios d’accès:
    - visiteur non authentifié
    - authentifié + abonnement actif
    - authentifié + abonnement inactif/expiré
  - Affichage prix public / prix réduit (30% ou valeur backend) pour contenus payants
  - CTA dynamiques selon état auth/abonnement

- **Epic 4 & 5**
  - Création des pages lecture:
    - `/read/:id` (lecteur texte, style e-reader)
    - `/listen/:id` (lecteur audio, style audiobook player)
  - Raccordement depuis la page détail (`Lire maintenant` / `Écouter maintenant`)

- **Qualité de flux**
  - Persistance auth frontend renforcée (restauration session depuis tokens stockés)
  - Correction des erreurs checkout successives (`profiles.email`, `enckey`, callback port)

---

### 0.2 Gaps restants prioritaires (court terme)

1. **Epic 2 - fermeture du cycle paiement**
   - Gestion idempotente + robustesse webhooks (double events, retry)
   - Écran "Mon abonnement" unifié (statut, plan, expiration, quotas/bonus)
   - Gestion renouvellement/changement plan (story 2.6/2.7 à finaliser)

2. **Epic 4/5 - passage de UI à lecteur fonctionnel**
   - Intégrer vraie source de contenu (EPUB/PDF/audio stream)
   - Sauvegarde/reprise progression via `reading_history`
   - Contrôles réels audio (seek, vitesse, chapitres dynamiques)

3. **Stabilisation produit**
   - Tests E2E parcours: inscription -> abonnement -> callback -> accès contenu -> lecture
   - Hardening erreurs UI/API + observabilité minimale

---

### 0.3 Prochaine séquence recommandée (2 sprints)

- **Sprint A (Monétisation fiable)**
  - Finaliser Epic 2 (webhooks/renouvellement/changement plan)
  - Ajouter page "Mon abonnement" + quotas/bonus visibles
  - Scénarios QA paiement (success/fail/pending/cancel)

- **Sprint B (Consommation contenu réelle)**
  - Finaliser Epic 4/5 fonctionnel (pas seulement UI)
  - Brancher progression continue + reprise automatique
  - Vérifier protections d’accès abonnement/payant sur lecteurs

---

## MISE À JOUR 2026-02-13

**Date:** 2026-02-13 (Mise à jour après vérification code)
**Développeur:** Patrick Essomba (Afrik NoCode)
**Client:** Dimitri Talla
**Repository:** https://github.com/patrickassako/papyri

---

## 1. État d'Avancement RÉEL des Epics

### ⚡ Statut Global: 2.8/10 Epics Complétés (28%)

| Epic | Titre | Stories | État | Progression | Notes |
|------|-------|---------|------|-------------|-------|
| **Epic 1** | Authentification, Profil & Onboarding | 8 stories | ✅ **COMPLÉTÉ** | 100% | Livré 2026-02-07 |
| **Epic 2** | Abonnement & Paiements | 8 stories | 🔴 **À FAIRE** | 0% | Services externes à configurer |
| **Epic 3** | Catalogue & Recherche | 5 stories | 🟢 **95% TERMINÉ** | 95% | Presque fini! |
| **Epic 4** | Lecteur Ebook | 7 stories | 🔴 **À FAIRE** | 0% | - |
| **Epic 5** | Lecteur Audio & Mini-Player | 6 stories | 🔴 **À FAIRE** | 0% | - |
| **Epic 6** | Accueil Personnalisé & Recommandations | 4 stories | 🟡 **EN COURS** | 40% | Route `/home` créée |
| **Epic 7** | Mode Hors-ligne | 7 stories | 🔴 **À FAIRE** | 0% | - |
| **Epic 8** | Notifications & Communications | 6 stories | 🔴 **À FAIRE** | 0% | - |
| **Epic 9** | Analytics & Consentement | 3 stories | 🔴 **À FAIRE** | 0% | - |
| **Epic 10** | Back-Office Administration | 7 stories | 🔴 **À FAIRE** | 0% | - |

**Total Stories:** 61 stories
- ✅ **Complétées:** 13 stories (21%)
- 🟢 **En cours avancé:** 4 stories (7%)
- 🔴 **Restantes:** 44 stories (72%)

---

## 2. Epic 3 - État Détaillé 🟢 (95% Terminé)

### Stories Complétées (4.75/5)

#### ✅ Story 3.1: Landing Page Visiteurs (COMPLÉTÉ)
**Livrables:**
- Page landing narrative (web)
- Aperçu catalogue avec couvertures visibles
- Prix clairs (5 EUR/mois, 50 EUR/an)
- CTA "S'abonner"
- SEO-friendly, accessible sans auth

**Fichiers créés:**
- `web/src/pages/LandingPage.jsx` (400+ lignes)
- Design inspiré "émoti numérique" avec couleurs du projet
- Intégration service: `contentsService.getContents()`

**Critères d'acceptation:** ✅ 100%

---

#### ✅ Story 3.2: Catalogue avec Pagination & Categories (COMPLÉTÉ)
**Livrables:**
- Page catalogue (web + mobile)
- Pagination (12 items/page)
- Navigation par catégories (chips horizontaux)
- Grille responsive (2 col mobile, 3 tablet, 4-5 desktop)
- Card contenu avec couverture ratio 2:3, titre, auteur, badge type
- Skeleton loading
- Support multi-catégories par contenu

**Fichiers créés:**
- `web/src/pages/CatalogPage.jsx` (250+ lignes)
- `mobile/src/screens/CatalogScreen.js` (400+ lignes)
- `web/src/components/ContentCard.jsx`
- `mobile/src/components/ContentCard.js`
- `backend/src/routes/contents.routes.js`
- `backend/src/controllers/contents.controller.js`
- `backend/src/services/contents.service.js` (323 lignes)

**Migration SQL:**
- `docs/migrations/004_create_contents_and_categories.sql` (187 lignes)
  - Table `contents` (ebooks + audiobooks)
  - Table `categories` (avec sous-catégories)
  - Table `content_categories` (N:N)
  - Table `rights_holders` (éditeurs/ayants droit)
  - RLS policies activées
  - 8 catégories initiales: Romans, Essais, Histoire, Sciences, Jeunesse, Dev Personnel, Politique, Arts

**Migration SQL (seed data):**
- `docs/migrations/005_seed_test_contents.sql` (10+ contenus de test)

**API endpoints:**
- `GET /contents` (pagination, filtres)
- `GET /contents/:id`
- `GET /categories`
- `GET /categories/:slug`
- `POST /contents` (admin)
- `PUT /contents/:id` (admin)
- `DELETE /contents/:id` (admin, soft delete)

**Critères d'acceptation:** ✅ 100%

---

#### ✅ Story 3.3: Page Detail Contenu (COMPLÉTÉ)
**Livrables:**
- Page detail contenu (web + mobile)
- Affichage: couverture grande, titre, auteur, langue, type, catégories, description
- Actions: "Lire" (ebook), "Écouter" (audio), "Télécharger" (hors-ligne)
- Métadonnées obligatoires toutes affichées

**Fichiers créés:**
- `web/src/pages/ContentDetailPage.jsx` (350+ lignes)
- `mobile/src/screens/ContentDetailScreen.js` (600+ lignes)
- Service: `contentsService.getContentById(id)`

**API endpoint:**
- `GET /contents/:id` (avec catégories + rights_holder)

**Critères d'acceptation:** ✅ 100%

---

#### ✅ Story 3.4: Integration Meilisearch & Recherche (COMPLÉTÉ)
**Livrables:**
- Service Meilisearch complet
- Barre de recherche (web + mobile)
- Recherche temps réel avec debounce 300ms
- Tolérance fautes de frappe (typo-tolerance native)
- Recherche termes partiels (préfixe)
- Résultats < 100ms (cible Meilisearch)

**Fichiers créés:**
- `backend/src/services/meilisearch.service.js` (295 lignes)
  - `initializeIndex()` - Config index avec ranking rules
  - `indexContent(content)` - Index contenu unique
  - `indexAllContents()` - Réindexation bulk
  - `search(options)` - Recherche avec filtres
  - `deleteContent(id)` - Suppression index
  - `getStats()` - Statistiques index
  - `healthCheck()` - Vérification santé

- `backend/src/controllers/search.controller.js`
- `backend/src/routes/search.routes.js`
- `backend/src/scripts/index-contents.js` (script d'indexation)

**Configuration index Meilisearch:**
- **Searchable attributes:** `title`, `author`, `description`
- **Filterable attributes:** `content_type`, `language`, `categories`, `is_published`
- **Sortable attributes:** `published_at`, `title`, `created_at`
- **Ranking rules:** words → typo → proximity → attribute → sort → exactness
- **Typo tolerance:** Activée (1 typo ≥ 3 chars, 2 typos ≥ 7 chars)

**API endpoints:**
- `GET /search?q=:query&type=&language=&category=`
- `POST /search/index` (admin, réindexation)
- `GET /search/stats` (admin)

**Variables d'environnement:**
- `MEILISEARCH_HOST` (défaut: http://localhost:7700)
- `MEILISEARCH_API_KEY`

**Critères d'acceptation:** ✅ 100%

---

#### 🟡 Story 3.5: Filtres Combines & Tri (95% - Presque Fini)
**Livrables:**
- Filtres combinables (type, langue, catégorie)
- Tri par pertinence, nouveauté, popularité
- Mise à jour temps réel des résultats
- Chips horizontaux pour filtres actifs
- Message "Aucun résultat" avec suggestions

**Implémentation:**
- ✅ Filtres intégrés dans CatalogPage (web + mobile)
- ✅ Filtres combinables fonctionnels
- ✅ Tri: newest, title, popular
- ✅ Recherche avec debounce 500ms
- ✅ Reset filtres

**Ce qui manque (5%):**
- Message "Aucun résultat" avec suggestions alternatives (UI simple à ajouter)
- Affichage compteur de résultats filtré

**Critères d'acceptation:** 🟡 95%

---

### Dépendances Externes Epic 3

#### ✅ Base de données (Supabase)
- Tables créées et RLS activées
- Migrations SQL appliquées

#### 🔴 Meilisearch (À configurer en production)
- **Local dev:** Peut tourner avec Docker
- **Production:** Instance Meilisearch Cloud ou self-hosted à provisionner
- **Config requise:**
  ```bash
  docker run -d \
    -p 7700:7700 \
    -e MEILI_MASTER_KEY=ChangeMe123456789 \
    getmeili/meilisearch:latest
  ```
- **Indexation initiale:** `node backend/src/scripts/index-contents.js`

#### 🟡 Cloudflare R2 (Partiellement implémenté)
- `generateSignedUrl()` est un placeholder dans `contents.service.js` ligne 206
- **TODO:** Implémenter vraie génération URLs signées R2
- **Requis pour:** Story 3.3 (accès fichiers contenus)

---

### Résumé Epic 3

**État global:** 🟢 **95% TERMINÉ** - Presque prêt pour production!

**Ce qui reste à faire:**
1. ✅ Migration SQL appliquée (fait)
2. 🔴 Configurer Meilisearch (production)
3. 🔴 Implémenter vraies URLs signées R2 (remplacer placeholder)
4. 🟡 Finir Story 3.5 (message "Aucun résultat", 1h de travail)
5. 🔴 Tester end-to-end le parcours catalogue → detail → (bloquer car pas d'abonnement actif)

**Bloqueurs pour finaliser Epic 3:**
- Epic 2 (Abonnements) requis pour tester la protection d'accès au contenu
- R2 requis pour servir les fichiers via URLs signées

---

## 3. Epic 6 - État Partiel 🟡 (40% Avancé)

### Stories en Cours (1.6/4)

#### 🟡 Story 6.1: Section "Reprendre" en Position #1 (60% Complété)
**Livrables partiels:**
- API endpoint `/home` créé
- Requête `continue_reading` avec jointure `reading_history` + `contents`
- Tri par `last_read_at` descendant
- Limit 5 contenus

**Fichiers créés:**
- `backend/src/routes/home.routes.js` (86 lignes)
- Endpoint protégé avec `verifyJWT`

**Ce qui manque (40%):**
- Frontend web: Section "Reprendre" sur page d'accueil
- Frontend mobile: Section "Reprendre" sur HomeScreen
- Bouton "Reprendre" avec redirection vers lecteur à position exacte
- Affichage barre de progression %

**Critères d'acceptation:** 🟡 60%

---

#### 🟡 Story 6.2: Sections Nouveautes & Populaires (60% Complété)
**Livrables partiels:**
- API endpoint `/home` retourne `new_releases` (5 derniers contenus)
- API endpoint `/home` retourne `popular` (provisoire, tri par date)
- TODO commenté: Ajouter colonne `view_count` pour vrais "Populaires"

**Ce qui manque (40%):**
- Frontend web: Affichage sections carrousel horizontal
- Frontend mobile: Affichage sections carrousel
- "Voir tout" pour chaque section
- Implémenter vraie popularité (colonne `view_count`)

**Critères d'acceptation:** 🟡 60%

---

#### 🟡 Story 6.3: Section Recommandations (20% Complété)
**Livrables partiels:**
- API endpoint `/home` retourne `recommended` (provisoire, tri par date)
- TODO commenté: "Implémenter recommandations personnalisées"

**Ce qui manque (80%):**
- Algorithme recommandations basé sur catégories consultées
- Frontend affichage

**Critères d'acceptation:** 🟡 20%

---

#### 🔴 Story 6.4: Personnalisation & Version Visiteur (0%)
**Rien d'implémenté encore.**

---

## 4. Progression Globale FRs

### Couverture Fonctionnelle RÉELLE

| Bloc PRD | FRs | État Réel |
|----------|-----|-----------|
| Onboarding (5) | FR1-FR4 | ✅ 4/4 (100%) |
| Auth & Comptes (6.1) | FR5-FR11 | ✅ 7/7 (100%) |
| Abonnements (6.2) | FR12-FR21 | 🔴 0/10 (0%) |
| Paiements (6.3) | FR22-FR28 | 🔴 0/7 (0%) |
| Catalogue (6.4) | FR29-FR36 | ✅ 8/8 (100%) |
| Recherche (6.5) | FR37-FR42 | 🟢 6/6 (100%) |
| Accueil (6.6) | FR43-FR49 | 🟡 3/7 (43%) |
| Lecteur Ebook (6.7) | FR50-FR60 | 🔴 0/11 (0%) |
| Lecteur Audio (6.8) | FR61-FR69 | 🔴 0/9 (0%) |
| Mode Hors-ligne (6.9) | FR70-FR80 | 🔴 0/11 (0%) |
| Notifications (6.10) | FR81-FR89 | 🔴 0/9 (0%) |
| Analytics (6.11) | FR90-FR94 | 🔴 0/5 (0%) |
| Emailing (6.12) | FR95-FR102 | 🔴 0/8 (0%) |
| Back-office (6.13) | FR103-FR111 | 🔴 0/9 (0%) |
| Sécurité/DRM (7) | FR112-FR115 | 🟡 2/4 (50%) |

**Couverture actuelle:** 30/115 FRs complétés (26%)
**Restant:** 85/115 FRs (74%)

---

## 5. Fichiers Backend Créés (Inventaire Complet)

### Routes
```
backend/src/routes/
├── auth.js                  ✅ Epic 1
├── users.js                 ✅ Epic 1
├── reading.js               ✅ Epic 1 (Story 1.7)
├── contents.routes.js       ✅ Epic 3
├── search.routes.js         ✅ Epic 3
└── home.routes.js           🟡 Epic 6 (partiel)
```

### Services
```
backend/src/services/
├── auth.service.js          ✅ Epic 1 (Supabase Auth)
├── email.service.js         ✅ Epic 1 (Story 1.5)
├── contents.service.js      ✅ Epic 3 (323 lignes)
└── meilisearch.service.js   ✅ Epic 3 (295 lignes)
```

### Controllers
```
backend/src/controllers/
├── contents.controller.js   ✅ Epic 3
└── search.controller.js     ✅ Epic 3
```

### Middleware
```
backend/src/middleware/
├── auth.js                  ✅ Epic 1
├── errorHandler.js          ✅ Epic 1
└── rateLimiter.js           ✅ Epic 1
```

### Migrations SQL
```
docs/migrations/
├── 000_initial_schema.sql                        ✅ Epic 1
├── 001_password_reset_tokens.sql                 ✅ Epic 1 (Story 1.5)
├── 001_fix_users_insert_policy.sql               ✅ Epic 1 (fix)
├── 002_reading_history.sql                       ✅ Epic 1 (Story 1.7)
├── 003_migrate_to_supabase_auth_simple.sql       ✅ Epic 1 (migration)
├── 004_create_contents_and_categories.sql        ✅ Epic 3
└── 005_seed_test_contents.sql                    ✅ Epic 3 (test data)
```

### Scripts
```
backend/src/scripts/
└── index-contents.js        ✅ Epic 3 (Meilisearch indexation)
```

---

## 6. Fichiers Frontend Créés (Inventaire Complet)

### Web (React + Vite + MUI)
```
web/src/pages/
├── Login.js                 ✅ Epic 1
├── Register.js              ✅ Epic 1
├── ForgotPassword.js        ✅ Epic 1
├── ResetPassword.js         ✅ Epic 1
├── Profile.js               ✅ Epic 1
├── History.js               ✅ Epic 1
├── Home.js                  🟡 Epic 6 (basique)
├── LandingPage.jsx          ✅ Epic 3
├── CatalogPage.jsx          ✅ Epic 3
└── ContentDetailPage.jsx    ✅ Epic 3

web/src/components/
├── OnboardingCarousel.js    ✅ Epic 1
├── ContentCard.jsx          ✅ Epic 3
└── ContentCardWithProgress.js  🟡 Epic 6 (partiel)

web/src/services/
├── auth.service.js          ✅ Epic 1
├── api.client.js            ✅ Epic 1
└── contents.service.js      ✅ Epic 3

web/src/config/
├── supabase.js              ✅ Epic 1
├── storage.js               ✅ Epic 1
└── tokens.js                ✅ Epic 1 (design system)

web/src/theme/
├── theme.js                 ✅ Epic 1 (MUI light)
└── darkTheme.js             ✅ Epic 1 (MUI dark)
```

### Mobile (React Native + Expo + RN Paper)
```
mobile/src/screens/
├── LoginScreen.js           ✅ Epic 1
├── RegisterScreen.js        ✅ Epic 1
├── ForgotPasswordScreen.js  ✅ Epic 1
├── ResetPasswordScreen.js   ✅ Epic 1
├── ProfileScreen.js         ✅ Epic 1
├── HistoryScreen.js         ✅ Epic 1
├── OnboardingScreen.js      ✅ Epic 1
├── HomeScreen.js            🟡 Epic 6 (basique)
├── CatalogScreen.js         ✅ Epic 3
└── ContentDetailScreen.js   ✅ Epic 3

mobile/src/components/
├── OnboardingCarousel.js    ✅ Epic 1
├── ContentCard.js           ✅ Epic 3
└── ContentCardWithProgress.js  🟡 Epic 6 (partiel)

mobile/src/services/
├── auth.service.js          ✅ Epic 1
└── (autres à créer pour Epic 3+)

mobile/src/config/
├── supabase.js              ✅ Epic 1
└── tokens.js                ✅ Epic 1 (design system)

mobile/src/theme/
└── theme.js                 ✅ Epic 1 (RN Paper)
```

---

## 7. Services Externes - État Configuration

| Service | État | Environnement | Priorité | Notes |
|---------|------|---------------|----------|-------|
| **Supabase** | ✅ Configuré | Dev | - | Auth + Database opérationnels |
| **Meilisearch** | 🟡 Partiel | Local | **P1** | Code prêt, instance à lancer (Docker) |
| **Cloudflare R2** | 🔴 À configurer | - | **P1** | URLs signées = placeholder |
| **Stripe** | 🔴 À configurer | Test | **P0** | Requis Epic 2 |
| **Flutterwave** | 🔴 À configurer | Sandbox | **P0** | Requis Epic 2 |
| **Firebase FCM** | 🔴 À configurer | Dev | P3 | Epic 8 |
| **Google Analytics** | 🔴 À configurer | Dev | P3 | Epic 9 |
| **Brevo/Mailchimp** | 🔴 À configurer | Dev | P3 | Epic 8 |

**P0 = Bloquant, P1 = Important, P3 = Peut attendre**

---

## 8. Prochaines Actions CORRIGÉES

### ⚡ Cette Semaine (2026-02-13 → 2026-02-19)

#### Priorité 0: Finaliser Epic 3 (1-2 jours)
- [ ] Configurer Meilisearch local (Docker)
  ```bash
  docker run -d -p 7700:7700 \
    -e MEILI_MASTER_KEY=ChangeMe123456789 \
    getmeili/meilisearch:latest
  ```
- [ ] Indexer contenus de test
  ```bash
  node backend/src/scripts/index-contents.js
  ```
- [ ] Implémenter vraies URLs signées R2 dans `contents.service.js:generateSignedUrl()`
- [ ] Finir Story 3.5: Message "Aucun résultat" avec suggestions
- [ ] Tester parcours complet Landing → Catalogue → Detail → (bloquer car pas abonné)

#### Priorité 1: Configuration Services Paiement (Epic 2)
- [ ] Créer compte Stripe (mode test)
- [ ] Créer compte Flutterwave (mode sandbox)
- [ ] Obtenir clés API Stripe test
- [ ] Obtenir clés API Flutterwave sandbox
- [ ] Ajouter variables .env

#### Priorité 2: Epic 2 Story 2.1
- [ ] Créer migration SQL table `subscriptions`
- [ ] Créer API `/subscriptions/plans` GET
- [ ] Créer page "Choisir un plan" (web + mobile)

### 📅 Semaine Suivante (2026-02-20 → 2026-02-26)
- [ ] Epic 2 Stories 2.2-2.5: Stripe, Flutterwave, Webhooks, Middleware
- [ ] Tests end-to-end parcours abonnement complet

### 📅 Semaines 3-4 (2026-02-27 → 2026-03-12)
- [ ] Epic 4+5: Lecteurs Ebook & Audio (moment produit clé)

---

## 9. Risques & Ajustements

### 🟢 Risques Résolus
- ✅ Authentification (Supabase Auth migré et fonctionnel)
- ✅ Design system (tokens partagés web/mobile)
- ✅ Recherche (Meilisearch intégré et configuré)

### 🔴 Risques Actifs

#### Risque 1: R2 URLs Signées (Critique)
**Impact:** Impossibilité de servir contenus de manière sécurisée
**Probabilité:** Moyenne
**Mitigation:**
- Implémenter en priorité après Epic 2
- Utiliser SDK AWS S3 compatible (déjà dans dependencies backend)
- TTL 15min ebook, 60min audio (conformément au PRD)

#### Risque 2: Meilisearch Production (Modéré)
**Impact:** Recherche lente ou indisponible
**Probabilité:** Faible
**Mitigation:**
- Provisionner instance Meilisearch Cloud ($29/mois)
- Ou self-hosted sur VPS (DigitalOcean, 4GB RAM minimum)
- Indexation initiale peut prendre du temps (prévoir script async)

---

## 10. Timeline RÉVISÉE

### ✅ Phase 1: Fondations (Epic 1) - COMPLÉTÉ
**Durée:** 2026-01-XX → 2026-02-07 (7 jours effectifs)
**Livrables:** Auth, Profil, Onboarding, Scaffolding

### 🟢 Phase 1.5: Catalogue & Découverte (Epic 3) - 95% TERMINÉ
**Durée:** 2026-02-08 → 2026-02-12 (5 jours)
**Livrables:** Landing, Catalogue, Recherche Meilisearch, Filtres
**Reste:** 1-2 jours pour finaliser

### 🎯 Phase 2: Monétisation (Epic 2) - PROCHAINE PRIORITÉ
**Durée estimée:** 2-3 semaines
**Livrables:** Abonnements, Paiements, Webhooks, Middleware
**Bloque:** Tous les autres epics

### Phase 3: Accueil Personnalisé (Epic 6) - 40% AVANCÉ
**Durée estimée:** 3-5 jours (finir les 60% restants)
**Livrables:** Reprendre, Nouveautés, Populaires, Recommandations

### Phase 4: Lecteurs (Epics 4 & 5)
**Durée estimée:** 3-4 semaines
**Livrables:** Ebook + Audio (moment produit clé)

### Phase 5-8: Reste (Epics 7-10)
**Durée estimée:** 6-8 semaines

**Total restant:** ~3 mois (conforme au budget temps)

---

## 11. Résumé Exécutif CORRIGÉ

### ✅ Ce Qui Est VRAIMENT Fait (26% du projet)

**Epic 1 (100%):**
- Authentification Supabase Auth complète
- Profil utilisateur avec historique
- Onboarding 3 écrans
- Design system tokens partagés

**Epic 3 (95%):**
- Landing page narrative
- Catalogue avec pagination + filtres
- Page detail contenu
- Recherche Meilisearch intégrée (typo-tolerance, filtres combinés)
- 8 catégories créées
- 4 tables SQL avec RLS
- Services backend complets (618 lignes)

**Epic 6 (40%):**
- API `/home` avec sections Reprendre, Nouveautés, Populaires, Recommandations
- Frontend à connecter

### 🎯 Ce Qui Vient VRAIMENT Ensuite

**Priorité Immédiate (1-2 jours):**
1. Finaliser Epic 3 (5% restant)
   - Meilisearch Docker local
   - URLs signées R2
   - Message "Aucun résultat"

**Priorité Critique (2-3 semaines):**
2. Epic 2 - Abonnements & Paiements
   - Bloque accès au contenu
   - Stripe + Flutterwave
   - Webhooks

**Priorité Haute (3-5 jours):**
3. Finir Epic 6 - Accueil personnalisé (60% restant)

**Priorité Produit (3-4 semaines):**
4. Epic 4 + 5 - Lecteurs (moment produit clé)

### 📊 Progression Globale RÉELLE
- **Epics:** 1.95/10 complétés (20%)
- **Stories:** 13/61 complétées (21%)
- **FRs:** 30/115 complétés (26%)
- **Lignes de code:** ~10,000+ (estimation backend + web + mobile)
- **Migrations SQL:** 7 migrations appliquées
- **Services backend:** 6 services + 2 controllers + 6 routes

### ⏱️ Estimation Restante RÉVISÉE
- **Finalisation Epic 3:** 1-2 jours
- **Epic 2:** 2-3 semaines (critique)
- **Epic 6 (finir):** 3-5 jours
- **Epic 4-10:** 10-12 semaines
- **Total restant:** ~3-3.5 mois (conforme au budget)

### 🚀 Prochain Jalon
**Epic 3 Complété (100%) = Catalogue Fonctionnel**
- Utilisateurs peuvent découvrir le catalogue
- Recherche opérationnelle
- Landing page pour conversion
- Prêt pour Epic 2 (abonnements)

**Epic 2 Complété = Plateforme Monétisable**
- Paiements Stripe + Flutterwave
- Middleware abonnement actif
- Webhooks opérationnels

---

**Rapport généré le:** 2026-02-13 (UPDATED après analyse code)
**Dernière mise à jour code:** 2026-02-12 (Epic 3)
**Prochain point d'étape:** Epic 3 100% (estimation 2026-02-15)
**Prochain jalon majeur:** Epic 2 complété (estimation 2026-03-06)

---

## Annexe: Comparaison Rapport Initial vs Réel

| Métrique | Rapport Initial | Réel | Écart |
|----------|----------------|------|-------|
| Epics complétés | 1/10 (10%) | 1.95/10 (20%) | +95% |
| Stories complétées | 8/61 (13%) | 13/61 (21%) | +62% |
| FRs complétés | 11/115 (9.6%) | 30/115 (26%) | +171% |
| Epic 3 état | 0% | 95% | +95% |
| Epic 6 état | 0% | 40% | +40% |

**Conclusion:** Le projet est **plus avancé que prévu**. Epic 3 est presque terminé et Epic 6 a déjà commencé. La priorité immédiate est de finaliser Epic 3 puis attaquer Epic 2 (abonnements) qui bloque tout le reste.
