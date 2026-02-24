# Specification API REST — Bibliotheque Numerique Privee

Version: 1.0
Reference contractuelle: Cahier de charge signe (Dimitri Talla / Afrik NoCode — 31/01/2026)
Reference produit: PRD v1.1
Reference technique: architecture.md, db_schema.md
Base URL: `https://api.bibliotheque.app/v1`
Audience: Engineering, Frontend, QA

---

## 1. Conventions generales

### 1.1 Format

| Element | Convention |
|---------|-----------|
| Protocole | HTTPS uniquement |
| Format requete/reponse | JSON (`Content-Type: application/json`) |
| Authentification | Bearer JWT (`Authorization: Bearer <token>`) |
| Pagination | `?page=1&limit=20` (defaut: page=1, limit=20, max: 100) |
| Tri | `?sort=created_at&order=desc` |
| Codes HTTP | Standards REST (voir section 1.3) |
| Dates | ISO 8601 UTC (`2026-02-07T14:30:00Z`) |
| IDs | UUID v4 |

### 1.2 Structure de reponse

**Succes (objet unique) :**
```json
{
  "success": true,
  "data": { ... }
}
```

**Succes (liste paginee) :**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

**Erreur :**
```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "Un abonnement actif est requis pour acceder a ce contenu."
  }
}
```

### 1.3 Codes HTTP

| Code | Usage |
|------|-------|
| 200 | Succes |
| 201 | Creation reussie |
| 204 | Suppression reussie (pas de body) |
| 400 | Requete invalide (validation) |
| 401 | Non authentifie (JWT manquant/invalide) |
| 403 | Interdit (pas d'abonnement, pas admin) |
| 404 | Ressource non trouvee |
| 409 | Conflit (doublon email, abonnement deja actif) |
| 422 | Entite non traitable (donnees invalides) |
| 429 | Rate limit depasse |
| 500 | Erreur serveur |

### 1.4 Niveaux d'acces

| Niveau | Description | Prefixe |
|--------|------------|---------|
| `public` | Aucune authentification requise | Aucun |
| `auth` | JWT valide requis | Middleware `verifyJWT` |
| `subscriber` | JWT + abonnement actif | Middleware `verifyJWT` + `checkSubscription` |
| `admin` | JWT + role admin | Middleware `verifyJWT` + `checkAdmin` |

---

## 2. Authentification & comptes

### 2.1 Inscription

```
POST /auth/register                          [public]
```

**Body :**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "Jean Dupont"
}
```

**Reponse 201 :**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "Jean Dupont",
      "role": "user"
    },
    "access_token": "jwt...",
    "refresh_token": "jwt..."
  }
}
```

**Erreurs :** 409 (email deja utilise), 422 (validation)

---

### 2.2 Connexion

```
POST /auth/login                             [public]
```

**Body :**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Reponse 200 :** Meme structure que register.

**Erreurs :** 401 (identifiants incorrects)

---

### 2.3 Rafraichir le token

```
POST /auth/refresh                           [public]
```

**Body :**
```json
{
  "refresh_token": "jwt..."
}
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt...",
    "refresh_token": "jwt..."
  }
}
```

---

### 2.4 Deconnexion

```
POST /auth/logout                            [auth]
```

**Reponse 204**

---

### 2.5 Reinitialisation mot de passe — demande

```
POST /auth/forgot-password                   [public]
```

**Body :**
```json
{
  "email": "user@example.com"
}
```

**Reponse 200 :** Toujours succes (pas de fuite d'info si email inexistant). Email envoye via Brevo/Mailchimp.

---

### 2.6 Reinitialisation mot de passe — confirmation

```
POST /auth/reset-password                    [public]
```

**Body :**
```json
{
  "token": "reset-token-uuid",
  "new_password": "newsecurepassword"
}
```

**Reponse 200 :** Mot de passe modifie.

**Erreurs :** 400 (token expire ou invalide)

---

### 2.7 Profil utilisateur

```
GET /users/me                                [auth]
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Jean Dupont",
    "role": "user",
    "language": "fr",
    "onboarding_completed": true,
    "subscription": {
      "status": "active",
      "plan": "monthly",
      "current_period_end": "2026-03-07T00:00:00Z"
    },
    "created_at": "2026-02-01T10:00:00Z"
  }
}
```

---

### 2.8 Modifier le profil

```
PATCH /users/me                              [auth]
```

**Body (partiel) :**
```json
{
  "full_name": "Jean-Pierre Dupont",
  "language": "fr"
}
```

---

### 2.9 Marquer onboarding termine

```
POST /users/me/onboarding-complete           [auth]
```

**Reponse 200**

---

## 3. Abonnements

### 3.1 Creer un abonnement (initier le paiement)

```
POST /subscriptions                          [auth]
```

**Body :**
```json
{
  "plan": "monthly",
  "payment_gateway": "stripe"
}
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "subscription_id": "uuid",
    "payment_url": "https://checkout.stripe.com/...",
    "gateway": "stripe"
  }
}
```

Pour Flutterwave :
```json
{
  "success": true,
  "data": {
    "subscription_id": "uuid",
    "payment_url": "https://checkout.flutterwave.com/...",
    "gateway": "flutterwave"
  }
}
```

---

### 3.2 Statut de l'abonnement

```
GET /subscriptions/current                   [auth]
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "plan": "monthly",
    "status": "active",
    "price_eur": 5.00,
    "payment_gateway": "stripe",
    "current_period_start": "2026-02-07T00:00:00Z",
    "current_period_end": "2026-03-07T00:00:00Z"
  }
}
```

---

### 3.3 Annuler l'abonnement

```
POST /subscriptions/current/cancel           [auth]
```

**Reponse 200 :** Abonnement marque cancelled, acces maintenu jusqu'a fin de periode.

---

### 3.4 Historique des paiements

```
GET /payments?page=1&limit=20               [auth]
```

---

## 4. Webhooks (serveur → serveur)

### 4.1 Stripe

```
POST /webhooks/stripe                        [signature Stripe]
```

Evenements traites : `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.deleted`, `invoice.payment_succeeded`

---

### 4.2 Flutterwave

```
POST /webhooks/flutterwave                   [hash Flutterwave]
```

Evenements traites : `charge.completed`, `charge.failed`

---

## 5. Catalogue & contenus

### 5.1 Lister les contenus

```
GET /contents?page=1&limit=20               [subscriber]
```

**Parametres optionnels :**
- `type` : `ebook` | `audiobook`
- `category` : slug de la categorie
- `language` : code langue (`fr`, `en`)
- `sort` : `created_at` | `title` | `popularity`
- `order` : `asc` | `desc`

**Reponse 200 :**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Le monde s'effondre",
      "author": "Chinua Achebe",
      "content_type": "ebook",
      "format": "epub",
      "language": "fr",
      "cover_url": "https://cdn.../cover.webp",
      "categories": ["litterature", "classiques"],
      "duration_seconds": null
    }
  ],
  "pagination": { ... }
}
```

---

### 5.2 Detail d'un contenu

```
GET /contents/:id                            [subscriber]
```

**Reponse 200 :** Objet complet avec description, metadonnees, categories, ayant droit.

---

### 5.3 Acceder au fichier (URL signee)

```
POST /contents/:id/access                   [subscriber]
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "signed_url": "https://cdn.../file?signature=...&expires=...",
    "expires_in_seconds": 900,
    "format": "epub"
  }
}
```

**TTL :** 15 min (ebook), 60 min (audio)

**Note technique :** Les URLs signees sont generees cote backend via l'API compatible S3 de Cloudflare R2, servies via Cloudflare CDN.

---

### 5.4 Lister les categories

```
GET /categories                              [subscriber]
```

---

### 5.5 Contenus d'une categorie

```
GET /categories/:slug/contents?page=1&limit=20  [subscriber]
```

---

## 6. Recherche

### 6.1 Rechercher des contenus

```
GET /search?q=achebe&type=ebook&language=fr  [subscriber]
```

**Parametres :**
- `q` (requis) : terme de recherche
- `type` : `ebook` | `audiobook`
- `category` : slug
- `language` : code langue
- `page`, `limit`

**Reponse 200 :** Meme structure que listing contenus avec score de pertinence.

---

## 7. Page d'accueil

### 7.1 Donnees d'accueil

```
GET /home                                    [subscriber]
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "continue_reading": [ ... ],
    "new_releases": [ ... ],
    "popular": [ ... ],
    "recommended": [ ... ]
  }
}
```

---

## 8. Lecteur ebook

### 8.1 Sauvegarder position de lecture

```
PUT /reading-history/:content_id             [subscriber]
```

**Body :**
```json
{
  "progress_percent": 42.5,
  "last_position": {
    "chapter": "ch3",
    "cfi": "/4/2/8"
  }
}
```

---

### 8.2 Recuperer position de lecture

```
GET /reading-history/:content_id             [subscriber]
```

---

### 8.3 Historique complet de lecture

```
GET /reading-history?page=1&limit=20         [subscriber]
```

---

### 8.4 Marque-pages

```
GET    /api/reading/:content_id/bookmarks    [subscriber]
POST   /api/reading/:content_id/bookmarks    [subscriber]
DELETE /api/reading/:content_id/bookmarks/:id [subscriber]
```

**Body POST :**
```json
{
  "position": { "cfi": "epubcfi(/6/4!/4/2/8)", "percent": 42, "chapter_label": "Chapitre 3" },
  "label": "Passage important"
}
```

> **Note implementation** : Routes implementees dans `backend/src/routes/reading.js`.
> Migration DB : `docs/migrations/026_bookmarks_highlights.sql`.

---

### 8.5 Surlignages

```
GET    /api/reading/:content_id/highlights              [subscriber]
POST   /api/reading/:content_id/highlights              [subscriber]
DELETE /api/reading/:content_id/highlights/:id           [subscriber]
```

**Body POST :**
```json
{
  "text": "Le texte surligne",
  "cfi_range": "epubcfi(/6/4!/4/2/8,/1:0,/1:22)",
  "position": { "start_cfi": "...", "end_cfi": "...", "chapter": "ch3" },
  "color": "yellow",
  "note": "Note optionnelle"
}
```

> **Note implementation** : `cfi_range` (requis) est le CFI range epub.js utilise pour restaurer le surlignage visuel.
> Couleurs disponibles : `yellow`, `green`, `blue`, `pink`.

---

## 9. Lecteur audio

### 9.1 Sauvegarder position audio

```
PUT /reading-history/:content_id             [subscriber]
```

**Body :**
```json
{
  "progress_percent": 65.3,
  "last_position": {
    "position_seconds": 1234
  }
}
```

*(Meme endpoint que ebook — le champ `last_position` s'adapte au type)*

---

### 9.2 Playlists

```
GET    /playlists                             [subscriber]
POST   /playlists                             [subscriber]
GET    /playlists/:id                         [subscriber]
PATCH  /playlists/:id                         [subscriber]
DELETE /playlists/:id                         [subscriber]
```

**Body POST :**
```json
{
  "name": "Mes favoris audio"
}
```

---

### 9.3 Items de playlist

```
POST   /playlists/:id/items                  [subscriber]
DELETE /playlists/:id/items/:item_id         [subscriber]
PATCH  /playlists/:id/items/reorder          [subscriber]
```

**Body POST :**
```json
{
  "content_id": "uuid"
}
```

**Body reorder :**
```json
{
  "item_ids": ["uuid1", "uuid3", "uuid2"]
}
```

---

## 10. Mode hors-ligne

### 10.1 Demander un telechargement hors-ligne

```
POST /offline/downloads                      [subscriber]
```

**Body :**
```json
{
  "content_id": "uuid",
  "device_id": "device-uuid"
}
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "download_id": "uuid",
    "signed_url": "https://cdn.../file?...",
    "expires_at": "2026-02-10T14:30:00Z",
    "encryption_key_hint": "derived-from-user-token"
  }
}
```

**Erreurs :** 403 (quota atteint : max 5 contenus)

---

### 10.2 Lister mes telechargements

```
GET /offline/downloads                       [subscriber]
```

---

### 10.3 Synchroniser au retour en ligne

```
POST /offline/sync                           [subscriber]
```

**Body :**
```json
{
  "device_id": "device-uuid",
  "reading_positions": [
    {
      "content_id": "uuid",
      "progress_percent": 75.0,
      "last_position": { "position_seconds": 2345 }
    }
  ]
}
```

**Reponse 200 :** Positions mises a jour + statut abonnement. Si abonnement expire → reponse indiquant purge requise.

---

### 10.4 Supprimer un telechargement

```
DELETE /offline/downloads/:download_id       [subscriber]
```

---

## 11. Notifications

### 11.1 Lister mes notifications

```
GET /notifications?page=1&limit=20           [auth]
```

---

### 11.2 Marquer comme lue

```
PATCH /notifications/:id/read               [auth]
```

---

### 11.3 Marquer toutes comme lues

```
POST /notifications/read-all                 [auth]
```

---

### 11.4 Preferences de notification

```
GET  /notifications/preferences              [auth]
PUT  /notifications/preferences              [auth]
```

**Body PUT :**
```json
{
  "push_enabled": true,
  "email_enabled": true,
  "new_content": true,
  "resume_reading": false,
  "expiration_warning": true,
  "marketing": false
}
```

---

### 11.5 Enregistrer token FCM

```
POST /notifications/fcm-token               [auth]
```

**Body :**
```json
{
  "fcm_token": "firebase-token...",
  "device_type": "android"
}
```

---

## 12. Analytics (interne)

### 12.1 Enregistrer un evenement

```
POST /analytics/events                       [auth]
```

**Body :**
```json
{
  "event_name": "start_reading",
  "event_data": {
    "content_id": "uuid",
    "content_type": "ebook"
  },
  "device_type": "web"
}
```

---

## 13. Administration (back-office API)

Tous les endpoints admin requierent le niveau d'acces `admin`.

### 13.1 Utilisateurs

```
GET    /admin/users?page=1&limit=20&search=  [admin]
GET    /admin/users/:id                       [admin]
PATCH  /admin/users/:id                       [admin]
DELETE /admin/users/:id                       [admin]  (soft delete)
```

---

### 13.2 Contenus

```
GET    /admin/contents?page=1&limit=20        [admin]
POST   /admin/contents                        [admin]
GET    /admin/contents/:id                    [admin]
PATCH  /admin/contents/:id                    [admin]
DELETE /admin/contents/:id                    [admin]  (soft delete)
```

**Body POST (multipart/form-data) :**
- `file` : fichier EPUB/PDF/MP3/M4A
- `title` : string (requis)
- `author` : string (requis)
- `description` : string
- `content_type` : `ebook` | `audiobook`
- `language` : string
- `category_ids` : JSON array de UUIDs
- `rights_holder_id` : UUID
- `cover` : fichier image (optionnel)

---

### 13.3 Categories

```
GET    /admin/categories                      [admin]
POST   /admin/categories                      [admin]
PATCH  /admin/categories/:id                  [admin]
DELETE /admin/categories/:id                  [admin]
```

---

### 13.4 Ayants droit

```
GET    /admin/rights-holders                  [admin]
POST   /admin/rights-holders                  [admin]
PATCH  /admin/rights-holders/:id              [admin]
DELETE /admin/rights-holders/:id              [admin]
```

---

### 13.5 Abonnements (gestion admin)

```
GET    /admin/subscriptions?status=active     [admin]
PATCH  /admin/subscriptions/:id               [admin]
```

Permet activation/prolongation/annulation manuelle.

---

### 13.6 Statistiques

```
GET /admin/stats/overview                     [admin]
```

**Reponse 200 :**
```json
{
  "success": true,
  "data": {
    "total_users": 1542,
    "active_subscribers": 890,
    "mrr_eur": 4450.00,
    "total_contents": 234,
    "total_reads": 12340,
    "total_listens": 8920,
    "retention_j7": 0.62,
    "retention_j30": 0.28,
    "churn_rate": 0.08
  }
}
```

```
GET /admin/stats/revenue?period=monthly       [admin]
GET /admin/stats/popular-contents?limit=10    [admin]
GET /admin/stats/user-activity?days=30        [admin]
```

---

### 13.7 Notifications admin

```
POST /admin/notifications/send               [admin]
```

**Body :**
```json
{
  "type": "maintenance",
  "title": "Maintenance prevue",
  "body": "La plateforme sera en maintenance le 15/02 de 2h a 4h.",
  "target": "all"
}
```

`target` : `all` | `active_subscribers` | liste d'user IDs.

---

## 14. Rate limiting

| Niveau | Limite |
|--------|--------|
| Public (auth endpoints) | 10 requetes / minute / IP |
| Authentifie | 100 requetes / minute / utilisateur |
| Recherche | 30 requetes / minute / utilisateur |
| Admin | 200 requetes / minute / utilisateur |
| Webhooks | Pas de limite (verification signature) |

---

## 15. Recapitulatif des endpoints

| # | Methode | Endpoint | Acces | Description |
|---|---------|----------|-------|-------------|
| 1 | POST | `/auth/register` | public | Inscription |
| 2 | POST | `/auth/login` | public | Connexion |
| 3 | POST | `/auth/refresh` | public | Rafraichir token |
| 4 | POST | `/auth/logout` | auth | Deconnexion |
| 5 | POST | `/auth/forgot-password` | public | Demande reset password |
| 6 | POST | `/auth/reset-password` | public | Confirmer reset password |
| 7 | GET | `/users/me` | auth | Mon profil |
| 8 | PATCH | `/users/me` | auth | Modifier profil |
| 9 | POST | `/users/me/onboarding-complete` | auth | Marquer onboarding fait |
| 10 | POST | `/subscriptions` | auth | Creer abonnement |
| 11 | GET | `/subscriptions/current` | auth | Statut abonnement |
| 12 | POST | `/subscriptions/current/cancel` | auth | Annuler abonnement |
| 13 | GET | `/payments` | auth | Historique paiements |
| 14 | POST | `/webhooks/stripe` | signature | Webhook Stripe |
| 15 | POST | `/webhooks/flutterwave` | signature | Webhook Flutterwave |
| 16 | GET | `/contents` | subscriber | Lister contenus |
| 17 | GET | `/contents/:id` | subscriber | Detail contenu |
| 18 | POST | `/contents/:id/access` | subscriber | URL signee fichier |
| 19 | GET | `/categories` | subscriber | Lister categories |
| 20 | GET | `/categories/:slug/contents` | subscriber | Contenus par categorie |
| 21 | GET | `/search` | subscriber | Recherche |
| 22 | GET | `/home` | subscriber | Donnees accueil |
| 23 | PUT | `/reading-history/:content_id` | subscriber | Sauvegarder position |
| 24 | GET | `/reading-history/:content_id` | subscriber | Recuperer position |
| 25 | GET | `/reading-history` | subscriber | Historique complet |
| 26 | GET | `/api/reading/:content_id/bookmarks` | subscriber | Lister marque-pages |
| 27 | POST | `/api/reading/:content_id/bookmarks` | subscriber | Creer marque-page |
| 28 | DELETE | `/api/reading/:content_id/bookmarks/:id` | subscriber | Supprimer marque-page |
| 29 | GET | `/api/reading/:content_id/highlights` | subscriber | Lister surlignages |
| 30 | POST | `/api/reading/:content_id/highlights` | subscriber | Creer surlignage |
| 31 | DELETE | `/api/reading/:content_id/highlights/:id` | subscriber | Supprimer surlignage |
| 33 | GET | `/playlists` | subscriber | Lister playlists |
| 34 | POST | `/playlists` | subscriber | Creer playlist |
| 35 | GET | `/playlists/:id` | subscriber | Detail playlist |
| 36 | PATCH | `/playlists/:id` | subscriber | Modifier playlist |
| 37 | DELETE | `/playlists/:id` | subscriber | Supprimer playlist |
| 38 | POST | `/playlists/:id/items` | subscriber | Ajouter a playlist |
| 39 | DELETE | `/playlists/:id/items/:item_id` | subscriber | Retirer de playlist |
| 40 | PATCH | `/playlists/:id/items/reorder` | subscriber | Reordonner playlist |
| 41 | POST | `/offline/downloads` | subscriber | Demander telechargement |
| 42 | GET | `/offline/downloads` | subscriber | Lister telechargements |
| 43 | POST | `/offline/sync` | subscriber | Synchroniser hors-ligne |
| 44 | DELETE | `/offline/downloads/:id` | subscriber | Supprimer telechargement |
| 45 | GET | `/notifications` | auth | Lister notifications |
| 46 | PATCH | `/notifications/:id/read` | auth | Marquer lue |
| 47 | POST | `/notifications/read-all` | auth | Tout marquer lu |
| 48 | GET | `/notifications/preferences` | auth | Preferences notif |
| 49 | PUT | `/notifications/preferences` | auth | Modifier preferences |
| 50 | POST | `/notifications/fcm-token` | auth | Enregistrer token FCM |
| 51 | POST | `/analytics/events` | auth | Enregistrer event |
| 52 | GET | `/admin/users` | admin | Lister utilisateurs |
| 53 | GET | `/admin/users/:id` | admin | Detail utilisateur |
| 54 | PATCH | `/admin/users/:id` | admin | Modifier utilisateur |
| 55 | DELETE | `/admin/users/:id` | admin | Supprimer utilisateur |
| 56 | GET | `/admin/contents` | admin | Lister contenus |
| 57 | POST | `/admin/contents` | admin | Creer contenu |
| 58 | GET | `/admin/contents/:id` | admin | Detail contenu |
| 59 | PATCH | `/admin/contents/:id` | admin | Modifier contenu |
| 60 | DELETE | `/admin/contents/:id` | admin | Supprimer contenu |
| 61 | GET | `/admin/categories` | admin | Lister categories |
| 62 | POST | `/admin/categories` | admin | Creer categorie |
| 63 | PATCH | `/admin/categories/:id` | admin | Modifier categorie |
| 64 | DELETE | `/admin/categories/:id` | admin | Supprimer categorie |
| 65 | GET | `/admin/rights-holders` | admin | Lister ayants droit |
| 66 | POST | `/admin/rights-holders` | admin | Creer ayant droit |
| 67 | PATCH | `/admin/rights-holders/:id` | admin | Modifier ayant droit |
| 68 | DELETE | `/admin/rights-holders/:id` | admin | Supprimer ayant droit |
| 69 | GET | `/admin/subscriptions` | admin | Lister abonnements |
| 70 | PATCH | `/admin/subscriptions/:id` | admin | Modifier abonnement |
| 71 | GET | `/admin/stats/overview` | admin | Stats generales |
| 72 | GET | `/admin/stats/revenue` | admin | Stats revenus |
| 73 | GET | `/admin/stats/popular-contents` | admin | Stats contenus |
| 74 | GET | `/admin/stats/user-activity` | admin | Stats activite |
| 75 | POST | `/admin/notifications/send` | admin | Envoyer notification |

**75 endpoints couvrant 100% du cahier de charge.**
