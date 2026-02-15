# Tableau d'Évolution Epics & Stories
**Date:** 2026-02-14  
**Source:** Revue code + backend/frontend actifs au 2026-02-14

## Méthode de calcul
- `done` = **100%**
- `review` = **90%**
- `in-progress` = **60%**
- `ready-for-dev` = **10%**
- `backlog` = **0%**

> Le pourcentage d’un epic = moyenne des pourcentages de ses stories.

## Vue globale
- **Progression globale estimée:** **37%**
- **Stories `done`:** 19 / 61
- **Stories `in-progress`:** 4 / 61
- **Stories `ready-for-dev`:** 7 / 61
- **Stories `backlog`:** 31 / 61

## Epic 1 - Authentification, Profil & Onboarding
**Progression epic:** **100%**

| Story | Statut | % |
|---|---|---:|
| 1-1-initialisation-projet-design-system | done | 100 |
| 1-2-inscription-utilisateur | done | 100 |
| 1-3-connexion-utilisateur | done | 100 |
| 1-4-deconnexion | done | 100 |
| 1-5-reinitialisation-mot-de-passe | done | 100 |
| 1-6-profil-utilisateur | done | 100 |
| 1-7-historique-lecture-ecoute | done | 100 |
| 1-8-onboarding-premier-lancement | done | 100 |

## Epic 2 - Abonnement & Paiements
**Progression epic:** **83%**

| Story | Statut | % |
|---|---|---:|
| 2-1-modele-abonnement-page-de-choix | done | 100 |
| 2-2-integration-paiement-stripe | backlog | 0 |
| 2-3-integration-paiement-flutterwave | done | 100 |
| 2-4-webhooks-activation-abonnement | done | 100 |
| 2-5-middleware-verification-abonnement | done | 100 |
| 2-6-renouvellement-automatique | in-progress | 60 |
| 2-7-annulation-changement-de-plan | done | 100 |
| 2-8-historique-des-paiements | done | 100 |

## Epic 3 - Catalogue & Recherche
**Progression epic:** **100%**

| Story | Statut | % |
|---|---|---:|
| 3-1-landing-page-visiteurs | done | 100 |
| 3-2-catalogue-pagination-categories | done | 100 |
| 3-3-page-detail-contenu | done | 100 |
| 3-4-integration-meilisearch-recherche | done | 100 |
| 3-5-filtres-combines-tri | done | 100 |

## Epic 4 - Lecteur Ebook
**Progression epic:** **9%**

| Story | Statut | % |
|---|---|---:|
| 4-1-lecteur-epub-reprise-automatique | in-progress | 60 |
| 4-2-lecteur-pdf-reprise-automatique | backlog | 0 |
| 4-3-marque-pages | backlog | 0 |
| 4-4-surlignage-de-texte | backlog | 0 |
| 4-5-mode-nuit-reglages-lecteur | backlog | 0 |
| 4-6-protection-contenu-drm-leger | backlog | 0 |
| 4-7-synchronisation-cross-device-annotations | backlog | 0 |

## Epic 5 - Lecteur Audio & Mini-Player
**Progression epic:** **10%**

| Story | Statut | % |
|---|---|---:|
| 5-1-lecteur-audio-plein-ecran-streaming | in-progress | 60 |
| 5-2-vitesse-lecture-chapitres | backlog | 0 |
| 5-3-mini-player-persistant | backlog | 0 |
| 5-4-audio-arriere-plan-controles-notification | backlog | 0 |
| 5-5-playlist-personnelle | backlog | 0 |
| 5-6-gestion-reseau-faible-audio | backlog | 0 |

## Epic 6 - Accueil Personnalisé & Recommandations
**Progression epic:** **15%**

| Story | Statut | % |
|---|---|---:|
| 6-1-section-reprendre-position-1 | in-progress | 60 |
| 6-2-sections-nouveautes-populaires | backlog | 0 |
| 6-3-section-recommandations | backlog | 0 |
| 6-4-personnalisation-version-visiteur | backlog | 0 |

## Epic 7 - Mode Hors-ligne
**Progression epic:** **0%**

| Story | Statut | % |
|---|---|---:|
| 7-1-telechargement-contenu-hors-ligne | backlog | 0 |
| 7-2-chiffrement-local-aes-256 | backlog | 0 |
| 7-3-gestion-quota-stockage | backlog | 0 |
| 7-4-ttl-purge-automatique | backlog | 0 |
| 7-5-verification-abonnement-retour-en-ligne | backlog | 0 |
| 7-6-experience-hors-ligne-app | backlog | 0 |
| 7-7-web-cache-limite-service-worker | backlog | 0 |

## Epic 8 - Notifications & Communications
**Progression epic:** **0%**

| Story | Statut | % |
|---|---|---:|
| 8-1-integration-firebase-fcm-enregistrement-token | backlog | 0 |
| 8-2-notifications-push-contenus-rappels | backlog | 0 |
| 8-3-notifications-push-abonnement-paiement | backlog | 0 |
| 8-4-notifications-administratives-preferences | backlog | 0 |
| 8-5-integration-brevo-mailchimp-templates-email | backlog | 0 |
| 8-6-desabonnement-conformite-email | backlog | 0 |

## Epic 9 - Analytics & Consentement
**Progression epic:** **0%**

| Story | Statut | % |
|---|---|---:|
| 9-1-banniere-consentement-rgpd | backlog | 0 |
| 9-2-integration-google-analytics-tracking-events | backlog | 0 |
| 9-3-metriques-statistiques-back-office | backlog | 0 |

## Epic 10 - Back-Office Administration
**Progression epic:** **10%**

| Story | Statut | % |
|---|---|---:|
| 10-1-setup-adminjs-authentification-admin | ready-for-dev | 10 |
| 10-2-gestion-utilisateurs | ready-for-dev | 10 |
| 10-3-gestion-abonnements | ready-for-dev | 10 |
| 10-4-gestion-catalogue-upload-contenus | ready-for-dev | 10 |
| 10-5-gestion-metadonnees-categories-licences | ready-for-dev | 10 |
| 10-6-dashboard-statistiques-admin | ready-for-dev | 10 |
| 10-7-envoi-notifications-manuelles-audit-trail | ready-for-dev | 10 |
