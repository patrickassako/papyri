# Backend Papyri - API Node.js/Express

Backend API pour la bibliothèque numérique Papyri.

## Stack Technique

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5
- **Database:** Supabase (PostgreSQL)
- **Search:** Meilisearch
- **Storage:** Cloudflare R2 (S3-compatible)
- **Auth:** Supabase Auth

## Installation

```bash
# Installer les dépendances
npm install

# Copier le template .env
cp .env.example .env

# Éditer .env avec vos credentials Supabase
nano .env
```

## Développement

### 1. Lancer les services externes (Meilisearch)

```bash
# Démarrer Meilisearch avec Docker Compose
docker-compose up -d

# Vérifier que Meilisearch est running
curl http://localhost:7700/health
# Réponse: {"status":"available"}

# Voir les logs Meilisearch
docker-compose logs -f meilisearch
```

### 2. Lancer le serveur backend

```bash
# Mode développement (avec nodemon)
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:3001`

### 3. Initialiser Meilisearch

```bash
# Indexer les contenus existants
node src/scripts/index-contents.js

# Vérifier l'index
curl http://localhost:7700/indexes/contents/stats
```

## Scripts Disponibles

```bash
npm start           # Démarrer le serveur (production)
npm run dev         # Démarrer avec nodemon (dev)
npm test            # Lancer les tests backend (Jest)

# Scripts utilitaires
node src/scripts/index-contents.js        # Indexer contenus dans Meilisearch
node src/scripts/test-flutterwave.js      # Tester configuration Flutterwave
node src/scripts/test-subscriptions.js    # Tester système d'abonnements
```

## Endpoints API

### Health Check
```
GET /health         Public
```

### Authentification (Epic 1)
```
POST /auth/register             Public (rate limited)
POST /auth/login                Public (rate limited)
POST /auth/refresh              Public
POST /auth/logout               Protected (JWT)
POST /auth/forgot-password      Public (rate limited)
POST /auth/reset-password       Public (rate limited)
```

### Profil Utilisateur (Epic 1)
```
GET    /users/me                      Protected (JWT)
PATCH  /users/me                      Protected (JWT)
PUT    /users/me/password             Protected (JWT)
POST   /users/me/onboarding-complete Protected (JWT)
```

### Historique Lecture (Epic 1)
```
GET  /reading-history                  Protected (JWT)
PUT  /reading-history/:content_id      Protected (JWT)
GET  /reading-history/continue         Protected (JWT)
GET  /api/reading/:content_id/session  Protected (JWT) - Session lecteur (accès + URL signée + progression)
POST /api/reading/:content_id/progress Protected (JWT) - Sauvegarde progression unifiée
GET  /api/reading/:content_id/chapters Protected (JWT) - Sommaire/chapitres lecteur
```

### Catalogue (Epic 3)
```
GET    /api/contents                   Public (liste avec filtres)
GET    /api/contents/:id               Public (détail)
GET    /api/categories                 Public (liste catégories)
GET    /api/categories/:slug           Public (catégorie par slug)
GET    /api/contents/:id/access        Protected (JWT) - Etat d'accès/pricing
POST   /api/contents/:id/unlock        Protected (JWT) - Déblocage quota/bonus/paiement
POST   /api/contents/:id/unlock/verify-payment Protected (JWT) - Verify paiement unlock
GET    /api/contents/:id/file-url      Protected (JWT) - Signed URL si accès autorisé
POST   /api/contents                   Admin only
PUT    /api/contents/:id               Admin only
DELETE /api/contents/:id               Admin only (soft delete)
```

### Recherche (Epic 3)
```
GET  /api/search                       Public (recherche)
POST /api/search/index                 Admin only (réindexation)
GET  /api/search/stats                 Admin only (stats)
```

### Abonnements & Paiements (Epic 2)
```
GET    /api/subscriptions/plans                 Public (liste plans)
GET    /api/subscriptions/me                    Protected (JWT) - Abonnement actif
GET    /api/subscriptions/all                   Protected (JWT) - Historique complet
POST   /api/subscriptions/checkout              Protected (JWT) - Initier paiement
POST   /api/subscriptions/renew                 Protected (JWT) - Initier renouvellement
POST   /api/subscriptions/resume                Protected (JWT) - Reprendre annulation fin période
POST   /api/subscriptions/change-plan           Protected (JWT) - Programmer changement plan
POST   /api/subscriptions/cancel                Protected (JWT) - Annuler abonnement
GET    /api/subscriptions/payment-history       Protected (JWT) - Historique paiements
GET    /api/subscriptions/cycle/current         Protected (JWT) - Cycle + usage courant
GET    /api/subscriptions/usage/me              Protected (JWT) - Quotas consommés
GET    /api/subscriptions/bonuses/me            Protected (JWT) - Bonus crédits
GET    /api/subscriptions/members               Protected (JWT) - Membres abonnement
POST   /api/subscriptions/members               Protected (JWT) - Ajouter membre (owner)
DELETE /api/subscriptions/members/:userId       Protected (JWT) - Retirer membre (owner)
PATCH  /api/subscriptions/users-limit           Protected (JWT) - MAJ sièges
POST   /api/subscriptions/verify-payment        Protected (JWT) - Vérifier paiement
POST   /webhooks/flutterwave                    Public (webhook signature)
GET    /webhooks/test                           Public (test webhook)
```

### Accueil Personnalisé (Epic 6)
```
GET  /home                             Protected (JWT)
```

## Variables d'Environnement

Voir `.env.example` pour la liste complète.

### Essentielles

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=ChangeMe123456789
```

### À configurer pour Epic 2+

```bash
# Cloudflare R2 (Epic 3) - Stockage fichiers
R2_ACCOUNT_ID=
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_CONTENT=biblio-content-private
R2_BUCKET_COVERS=biblio-covers-public
R2_PUBLIC_URL=https://cdn.papyri.com

# Flutterwave (Epic 2) - Paiements Afrique
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx
FLUTTERWAVE_WEBHOOK_HASH=xxx

# Stripe (Epic 2) - Paiements International (optionnel)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Brevo (Epic 5) - Emails transactionnels
BREVO_API_KEY=
BREVO_SENDER_EMAIL=noreply@papyri.com

# Firebase (Epic 8) - Push notifications
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
```

## Structure du Projet

```
backend/
├── src/
│   ├── config/              Configuration (Supabase, env)
│   ├── middleware/          Middleware (auth, error, rate limit)
│   ├── services/            Services métier
│   ├── controllers/         Controllers API
│   ├── routes/              Routes Express
│   ├── scripts/             Scripts utilitaires
│   └── index.js             Entry point
├── docker-compose.yml       Services externes (Meilisearch)
├── package.json             Dependencies
└── .env                     Variables d'environnement
```

## Base de Données

Les migrations SQL sont dans `/docs/migrations/`.

Pour appliquer les migrations, connectez-vous à Supabase et exécutez-les dans l'ordre:

1. `000_initial_schema.sql`
2. `001_password_reset_tokens.sql`
3. `002_reading_history.sql`
4. `003_migrate_to_supabase_auth_simple.sql`
5. `004_create_contents_and_categories.sql`
6. `005_seed_test_contents.sql`
7. `006_subscriptions_and_payments.sql` (Epic 2)

## Tests

```bash
# Health check
curl http://localhost:3001/health

# Liste contenus
curl http://localhost:3001/api/contents?page=1&limit=10

# Recherche (Meilisearch doit être running)
curl "http://localhost:3001/api/search?q=roman&type=ebook"

# Catégories
curl http://localhost:3001/api/categories

# Plans d'abonnement
curl http://localhost:3001/api/subscriptions/plans

# Mon abonnement (nécessite JWT)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/subscriptions/me

# Initier paiement (nécessite JWT)
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planType":"monthly"}' \
  http://localhost:3001/api/subscriptions/checkout

# Test webhook
curl http://localhost:3001/webhooks/test
```

## Docker Compose - Commandes Utiles

```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Voir les logs
docker-compose logs -f

# Redémarrer Meilisearch
docker-compose restart meilisearch

# Supprimer volumes (ATTENTION: perte de données)
docker-compose down -v
```

## Troubleshooting

### Meilisearch ne démarre pas

```bash
# Vérifier les logs
docker-compose logs meilisearch

# Vérifier que le port 7700 est libre
lsof -i :7700

# Redémarrer le container
docker-compose restart meilisearch
```

### Erreur "ECONNREFUSED localhost:7700"

Meilisearch n'est pas démarré. Lancez:
```bash
docker-compose up -d meilisearch
```

### Erreur Supabase Auth

Vérifiez que les variables `.env` sont correctes:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Rate limiting sur /auth/*

C'est normal, les endpoints auth sont limités à 15 requêtes / 15 minutes par IP.

## Documentation Complète

- **Rapport état backend:** `../_bmad-output/backend-state-report-2026-02-13.md`
- **Rapport état projet:** `../_bmad-output/planning-artifacts/rapport-etat-projet-UPDATED-2026-02-13.md`
- **Architecture:** `../_bmad-output/architecture.md`
- **API Spec:** `../_bmad-output/api_spec.md`
- **DB Schema:** `../_bmad-output/db_schema.md`

## Support

Pour toute question, voir la documentation BMAD ou contacter Patrick Essomba.

---

**Version:** 0.2.0 (Epic 1 + Epic 2 + Epic 3)
**Dernière mise à jour:** 2026-02-13
