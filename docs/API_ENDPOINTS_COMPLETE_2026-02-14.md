# API Endpoints Complets (Backend)
**Date:** 2026-02-14  
**Base URL locale:** `http://localhost:3001`  
**Auth:** JWT Supabase via header `Authorization: Bearer <access_token>`

## 1) Santé

### `GET /health`
- Auth: `Public`
- Description: Vérifie que l’API répond.
- Réponse `200`:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## 2) Auth (`/auth`)

### `POST /auth/register`
- Auth: `Public`
- Body:
```json
{
  "email": "user@example.com",
  "password": "********",
  "full_name": "Nom Complet",
  "language": "fr"
}
```
- Réponses:
  - `201` compte créé + session
  - `409` email déjà utilisé
  - `422` validation

### `POST /auth/login`
- Auth: `Public`
- Body:
```json
{ "email": "user@example.com", "password": "********" }
```
- Réponses:
  - `200` user + session
  - `401` identifiants invalides

### `POST /auth/refresh`
- Auth: `Public`
- Body:
```json
{ "refresh_token": "..." }
```
- Réponses:
  - `200` nouvelle session
  - `401` token invalide/expiré

### `POST /auth/logout`
- Auth: `JWT requis`
- Réponses:
  - `204` succès

### `POST /auth/forgot-password`
- Auth: `Public`
- Body:
```json
{ "email": "user@example.com" }
```
- Réponses:
  - `200` (toujours, pour confidentialité)

### `POST /auth/reset-password`
- Auth: `Public`
- Body:
```json
{ "token": "...", "new_password": "********" }
```
- Réponses:
  - `200` succès
  - `400` token invalide/expiré
  - `422` mot de passe trop court

---

## 3) Utilisateur (`/users`)

### `GET /users/me`
- Auth: `JWT requis`
- Description: Profil courant + dernier état abonnement.

### `PATCH /users/me`
- Auth: `JWT requis`
- Body (partiel possible):
```json
{
  "full_name": "Nouveau nom",
  "language": "fr",
  "avatar_url": "https://..."
}
```

### `PUT /users/me/password`
- Auth: `JWT requis`
- Body:
```json
{
  "current_password": "********",
  "new_password": "********"
}
```

### `POST /users/me/onboarding-complete`
- Auth: `JWT requis`
- Description: Marque onboarding terminé.

---

## 4) Catalogue & Catégories (`/api`)

### `GET /api/contents`
- Auth: `Public`
- Query:
  - `page`, `limit`
  - `type` (`ebook|audiobook`)
  - `language`
  - `category`
  - `sort`

### `GET /api/contents/:id`
- Auth: `Public`
- Description: Détail contenu.

### `GET /api/categories`
- Auth: `Public`

### `GET /api/categories/:slug`
- Auth: `Public`

### `GET /api/contents/:id/file-url`
- Auth: `JWT + abonnement actif requis`
- Description: URL signée du fichier.

### `GET /api/contents/:id/access`
- Auth: `JWT requis`
- Description: État d’accès utilisateur (unlock, pricing, discount, etc.).

### `POST /api/contents/:id/unlock`
- Auth: `JWT requis`
- Description: Flux `quota -> bonus -> paiement`.
- Réponses:
  - `200` déblocage effectué
  - `402` paiement requis (avec `payment_link`)

### `POST /api/contents/:id/unlock/verify-payment`
- Auth: `JWT requis`
- Body:
```json
{ "transactionId": "1001", "reference": "CNT-..." }
```
- Description: Confirme paiement d’un unlock.

### Admin (catalogue)
- `POST /api/contents` (admin)
- `PUT /api/contents/:id` (admin)
- `DELETE /api/contents/:id` (admin)

---

## 5) Recherche (`/api/search`)

### `GET /api/search`
- Auth: `Public`
- Query:
  - `q`, `limit`, `offset`
  - `type`, `language`, `category`, `sort`

### `POST /api/search/index`
- Auth: `JWT admin`
- Description: Réindexation Meilisearch.

### `GET /api/search/stats`
- Auth: `JWT admin`
- Description: Statistiques index recherche.

---

## 6) Abonnements & Paiements (`/api/subscriptions`)

### `GET /api/subscriptions/plans`
- Auth: `Public`
- Description: Plans actifs configurés en base.

### `GET /api/subscriptions/me`
- Auth: `JWT requis`
- Description: Statut abonnement courant (`hasSubscription`, `isActive`, etc.).

### `GET /api/subscriptions/all`
- Auth: `JWT requis`
- Description: Historique abonnements utilisateur.

### `POST /api/subscriptions/checkout`
- Auth: `JWT requis`
- Body:
```json
{
  "planId": "uuid-optionnel",
  "planCode": "slug-optionnel",
  "usersLimit": 3
}
```
- Description: Initie paiement abonnement (Flutterwave).

### `POST /api/subscriptions/verify-payment`
- Auth: `JWT requis`
- Body:
```json
{ "transactionId": "10015390", "reference": "SUB-..." }
```
- Description: Vérifie paiement retour callback et active/renouvelle abonnement.

### `POST /api/subscriptions/cancel`
- Auth: `JWT requis`
- Body:
```json
{ "immediately": false }
```
- Description: Annulation immédiate ou fin de période.

### `POST /api/subscriptions/resume`
- Auth: `JWT requis`
- Description: Reprend un abonnement avec `cancel_at_period_end=true`.

### `POST /api/subscriptions/renew`
- Auth: `JWT requis`
- Description: Initie paiement de renouvellement manuel.

### `POST /api/subscriptions/change-plan`
- Auth: `JWT requis`
- Body:
```json
{
  "planId": "uuid-optionnel",
  "planCode": "slug-optionnel",
  "usersLimit": 5
}
```
- Description: Planifie changement de plan au prochain cycle.

### `GET /api/subscriptions/payment-history`
- Auth: `JWT requis`
- Description: Historique des paiements utilisateur.

### `GET /api/subscriptions/cycle/current`
- Auth: `JWT requis`
- Description: Cycle actif + usage du membre.

### `GET /api/subscriptions/usage/me`
- Auth: `JWT requis`
- Description: Résumé des consommations quota.

### `GET /api/subscriptions/bonuses/me`
- Auth: `JWT requis`
- Description: Bonus credits utilisateur.

### `GET /api/subscriptions/members`
- Auth: `JWT requis`
- Description: Membres de l’abonnement actif.

### `POST /api/subscriptions/members`
- Auth: `JWT requis`
- Body:
```json
{ "userId": "uuid-utilisateur" }
```
- Description: Ajout membre (owner uniquement).

### `DELETE /api/subscriptions/members/:userId`
- Auth: `JWT requis`
- Description: Retrait membre (owner uniquement).

### `PATCH /api/subscriptions/users-limit`
- Auth: `JWT requis`
- Body:
```json
{ "usersLimit": 5 }
```
- Description: Met à jour nombre de sièges.

---

## 7) Webhooks (`/webhooks`)

### `POST /webhooks/flutterwave`
- Auth: `Public` (validation signature `verif-hash`)
- Description: Réception événements paiement Flutterwave.
- Événements gérés:
  - `charge.completed`
  - `charge.failed`
  - `charge.pending`

### `GET /webhooks/test`
- Auth: `Public`
- Description: Endpoint de test webhook.

---

## 8) Home personnalisé (`/home`)

### `GET /home`
- Auth: `JWT requis`
- Description: Home agrégée:
  - `continue_reading`
  - `new_releases`
  - `popular`
  - `recommended`

---

## 9) Historique lecture (`/reading-history`)

### `GET /reading-history`
- Auth: `JWT requis`
- Query: `page`, `limit`
- Description: Historique complet paginé.

### `PUT /reading-history/:content_id`
- Auth: `JWT requis`
- Body:
```json
{
  "progress_percent": 42,
  "last_position": "chapitre-3|offset-1200"
}
```
- Description: Upsert progression.

### `GET /reading-history/continue`
- Auth: `JWT requis`
- Query: `limit`
- Description: Liste “reprendre” (incomplets).

### `GET /api/reading/:content_id/session`
- Auth: `JWT requis`
- Description: Initialise une session de lecture/écoute:
  - vérifie accès réel contenu
  - retourne URL signée
  - retourne progression existante
- Réponses:
  - `200` session OK
  - `402` paiement requis
  - `403` abonnement actif requis

### `POST /api/reading/:content_id/progress`
- Auth: `JWT requis`
- Body:
```json
{
  "progress_percent": 42,
  "last_position": { "type": "ebook", "chapter": "p-120" },
  "total_time_seconds": 360
}
```
- Description: Sauvegarde progression unifiée texte/audio (upsert).
- Réponses:
  - `200` update
  - `201` create

### `GET /api/reading/:content_id/chapters`
- Auth: `JWT requis`
- Description: Retourne sommaire/chapitres pour le lecteur.

---

## 10) Route AdminJS (non montée actuellement)

Le fichier `backend/src/routes/admin.routes.js` existe, mais dans `backend/src/index.js` l’intégration AdminJS est commentée (désactivée).  
Donc aucune URL AdminJS n’est active tant que ce bloc n’est pas réactivé.
