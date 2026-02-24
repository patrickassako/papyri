# Etat d'avancement global - Epics & Stories
Date: 2026-02-16

## Resume global
- Avancement produit estime: 68%
- Backend: avance et stable sur auth, abonnements, unlock, lecture (API)
- Frontend: avance sur catalogue/detail/pricing/subscription/lecteurs, avec stabilisation UX en cours

## Epic 1 - Authentification, Profil, Onboarding
- Avancement: 90%
- Stories realisees:
  - 1.1 Initialisation & design system (done)
  - 1.2 Inscription (done)
  - 1.3 Connexion (done)
  - 1.4 Deconnexion (done)
  - 1.5 Reset mot de passe (done)
  - 1.6 Profil utilisateur (done)
  - 1.7 Historique lecture/ecoute (partiel: API ok, contraintes schema selon env)
  - 1.8 Onboarding (done)
- Reste:
  - Hardening tests E2E et fiabilisation totale des cas schema legacy

## Epic 2 - Abonnements & Paiements
- Avancement: 92%
- Stories realisees:
  - Plans dynamiques en base + personnalisation (done)
  - Pricing frontend connecte (mensuel/annuel + FAQ) (done)
  - Checkout/verify Flutterwave (done)
  - Cycle abonnement (cancel/resume/change-plan) (done)
  - Gestion membres/sieges famille (done)
  - Usage cycle + bonus credits (done)
  - Unlock contenu (quota -> bonus -> paid) (done)
  - Reduction sur contenus payants (done)
  - Corrections production:
    - decrement quota/bonus strict avant creation unlock
    - get plans 500 corrige
    - lecture/progress fallback pour environnements incomplets
- Reste:
  - renouvellement automatique (scheduler/cron + notifications)
  - hardening webhook idempotence/retry

## Epic 3 - Catalogue & Detail contenu
- Avancement: 82%
- Stories realisees:
  - liste contenus/categorie/recherche (done)
  - detail contenu connecte aux vraies donnees (done)
  - scenarios d'acces guest/abonne/inactif (done)
  - unlock depuis detail (done)
- Reste:
  - optimisation UX/performances catalogue et refinement access copy

## Epic 4 - Lecture ebook/audio (frontend + backend)
- Avancement: 74%
- Stories realisees:
  - routes backend reading session/progress/chapters/file proxy (done)
  - lecteur audio connecte (done)
  - lecteur ebook epub/pdf connecte (done)
  - TOC + navigation prev/next + mode nuit + fullscreen (done)
  - highlights/bookmarks CRUD (done)
- En cours:
  - persistance visuelle highlights legacy (partielle selon CFI)
  - stabilisation logs EPUB tiers (about:srcdoc)
- Reste:
  - UX polish final et recalibrage automatique highlights anciens

## Epic 5 - Backoffice abonnement utilisateur
- Avancement: 78%
- Stories realisees:
  - page subscription overview (done)
  - affichage usage, membres, actions principales (done)
  - integration avec endpoints cycle/usage/bonuses/members (done)
- Reste:
  - enrichissement facturation/invoices UX

## Epic 10 - Back-Office Administration (AdminJS)
- Avancement: 45%
- Stories realisees:
  - 10.1 Activation AdminJS + adapter Supabase REST custom (done)
  - 10.2 Gestion utilisateurs CRUD complet (done)
    - Creation utilisateur (Supabase Auth + profil)
    - Edition (nom, role, blocage/deblocage)
    - Suppression (Auth + profil)
    - Recherche dynamique (email + nom, auto-filtre sans clic)
    - Vue enrichie (abonnement, historique, unlocks)
    - Audit trail sur toutes les actions
  - 10.4 Gestion catalogue contenus (done)
    - CRUD complet avec hooks (validation, Meilisearch, audit)
    - Recherche dynamique (titre + auteur)
    - Correction access_type (contraintes DB)
  - Schema subscription_plans corrige (colonnes reelles)
- Infrastructure:
  - Adapter Supabase REST custom (adminjs-supabase.js)
  - ComponentLoader + bundler pour composants React custom
  - Recherche dynamique via composant AutoSearchFilter
  - Auth admin avec client Supabase dedie (pas de pollution auth state)
- En cours:
  - Affichage grille + images contenus
- Reste:
  - 10.3 Gestion abonnements (edit/actions)
  - 10.5 Gestion metadonnees, categories & licences
  - 10.6 Dashboard statistiques admin
  - 10.7 Envoi notifications & audit trail UI

## Epic 6+ (Roadmap)
- Avancement: 0-20% selon epic
- Non entame ou partiel:
  - analytics avancee
  - notifications avancees
  - reporting admin complet
  - performance/sre/lancement prod

## Risques ouverts
- Variabilite structure EPUB tiers (CFI invalides) impacte restauration highlights anciens
- Environnements locaux heterogenes (migrations partielles) peuvent provoquer comportements "skipped"
- Webhooks paiement: besoin de validation finale en mode quasi-production

## Prochaines priorites recommandees
1. Cloturer Epic 2: scheduler renouvellement + QA E2E paiement
2. Cloturer Epic 4: recalibration highlights legacy + polish UX lecture
3. Durcir observabilite: logs metier + tableaux de bord erreurs 4xx/5xx critiques
