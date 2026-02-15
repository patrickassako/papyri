# Epic 2 - Abonnements & Paiements (Documentation Complète)
Date: 2026-02-14
Statut: In progress avance (base fonctionnelle en production locale)

## 1. Objectif Epic 2
Mettre en place un systeme d'abonnement configurable avec paiement en ligne, activation d'acces, gestion famille/sieges, quotas par membre, bonus credits, historique des paiements, et logique de reduction sur contenus payants.

## 2. Perimetre implemente
- Plans dynamiques en base (`subscription_plans`) avec prix/quotas/bonus parametres.
- Checkout abonnement via Flutterwave.
- Callback frontend + verification backend (`verify-payment`).
- Activation et renouvellement d'abonnement.
- Resume/cancel/change-plan (change-plan planifie cycle suivant).
- Gestion sieges famille (`users_limit`) + membres (`subscription_members`).
- Quotas individuels par membre et par cycle (`member_cycle_usage`).
- Bonus credits avec expiration (12 mois configurable par plan).
- Historique paiements (`payments`) pour abonnement et unlock contenu.
- UI backoffice utilisateur: page abonnement complete.
- Documentation OpenAPI exposee via `/docs` et `/openapi.yaml`.

## 3. Modele metier (regles)
### 3.1 Abonnements
- Un utilisateur ne peut pas demarrer un nouveau checkout s'il a deja un abonnement actif.
- Activation abonnement effectuee apres verification paiement reussi (webhook/callback).
- Un abonnement a:
  - `status`: `INACTIVE | ACTIVE | EXPIRED | CANCELLED`
  - `current_period_start`, `current_period_end`
  - `cancel_at_period_end`
  - `users_limit`
  - `plan_snapshot` (capture immutable des parametres plan au moment d'application)

### 3.2 Famille / membres
- Le proprietaire (owner) peut:
  - ajouter membre
  - retirer membre (sauf owner)
  - modifier `users_limit`
- `users_limit` ne peut pas etre:
  - < minimum du plan
  - < nombre de membres actifs

### 3.3 Quotas & bonus
- Quotas individuels par membre (meme pour plan famille).
- Chaque cycle cree/maintient `member_cycle_usage`.
- Deblocage contenu suit ordre: quota -> bonus -> paiement.
- Bonus credits expirent selon `bonus_validity_days` du plan (ex: 365 jours).

### 3.4 Contenu payant et reduction abonnement
- Si abonnement actif: reduction appliquee selon `subscription_discount_percent` contenu (ou regle plan, selon usage frontend/backend).
- Si abonnement inactif: prix plein.
- L'achat payant cree un unlock permanent pour l'utilisateur (`content_unlocks`).

## 4. Schema de donnees (migrations cle)
Migrations Epic 2 et extensions appliquees/prevues:
- `docs/migrations/006_subscriptions_and_payments.sql`
- `docs/migrations/021_subscription_plans_customizable.sql`
- `docs/migrations/022_add_paid_content_unlocks.sql`
- `docs/migrations/023_add_bonus_credits.sql`
- `docs/migrations/024_add_subscription_cycles_usage.sql`
- `docs/migrations/025_add_annual_subscription_plans.sql`

Tables principales:
- `subscription_plans`
- `subscriptions`
- `payments`
- `subscription_members`
- `subscription_cycles`
- `member_cycle_usage`
- `bonus_credits`
- `content_unlocks`

## 5. Endpoints Epic 2
Reference complete: `docs/openapi.yaml`

### 5.1 Plans
- `GET /api/subscriptions/plans` (public)

### 5.2 Statut abonnement
- `GET /api/subscriptions/me`
- `GET /api/subscriptions/all`

### 5.3 Paiement abonnement
- `POST /api/subscriptions/checkout`
- `POST /api/subscriptions/verify-payment`
- `POST /api/subscriptions/renew`

### 5.4 Cycle de vie abonnement
- `POST /api/subscriptions/cancel`
- `POST /api/subscriptions/resume`
- `POST /api/subscriptions/change-plan`

### 5.5 Suivi/usage
- `GET /api/subscriptions/payment-history`
- `GET /api/subscriptions/cycle/current`
- `GET /api/subscriptions/usage/me`
- `GET /api/subscriptions/bonuses/me`

### 5.6 Famille/sieges
- `GET /api/subscriptions/members`
- `POST /api/subscriptions/members`
- `DELETE /api/subscriptions/members/:userId`
- `PATCH /api/subscriptions/users-limit`

### 5.7 Webhook
- `POST /webhooks/flutterwave`

## 6. Flux fonctionnels
### 6.1 Souscription initiale
1. Front appelle `POST /api/subscriptions/checkout`.
2. Backend cree subscription `INACTIVE` + payment `pending`.
3. Flutterwave renvoie `paymentLink`.
4. Front redirige utilisateur.
5. Retour callback -> front appelle `POST /api/subscriptions/verify-payment`.
6. Backend verifie transaction, marque payment `succeeded`, active abonnement.

### 6.2 Renouvellement
1. Front appelle `POST /api/subscriptions/renew`.
2. Backend prepare paiement renouvellement.
3. Verification paiement active extension periode.

### 6.3 Changement de plan
1. Front appelle `POST /api/subscriptions/change-plan`.
2. Backend stocke `pending_plan_change` dans metadata subscription.
3. Au paiement de renouvellement suivant, le nouveau plan snapshot est applique.

### 6.4 Unlock contenu payant
1. Front appelle `POST /api/contents/:id/unlock`.
2. Backend tente quota, puis bonus.
3. Si echec quota/bonus et contenu payable -> `402 PAYMENT_REQUIRED` + lien.
4. Callback paiement -> `POST /api/contents/:id/unlock/verify-payment`.
5. Backend cree `content_unlocks` source `paid`.

## 7. Frontend connecte a Epic 2
Pages principales:
- `web/src/pages/PricingPage.jsx`
- `web/src/pages/SubscriptionCallbackPage.jsx`
- `web/src/pages/SubscriptionPage.jsx` (backoffice utilisateur)
- `web/src/pages/ContentDetailPage.jsx` (scenarios d'acces + unlock paiement)

Services:
- `web/src/services/subscriptions.service.js`
- `web/src/services/contents.service.js`

## 8. Variables d'environnement critiques
Backend:
- `FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_HASH`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Frontend:
- `VITE_API_URL` (ex: `http://localhost:3001`)

## 9. Observabilite et logs
Logs metier ajoutes:
- `[subscriptions.checkout] start/success`
- `[subscriptions.verify] start/success`
- `[subscriptions.renew] start/success`
- `[subscriptions.changePlan] start/success`

Recommandation: centraliser vers fournisseur logs (Datadog/ELK/CloudWatch) + correlation id par requete.

## 10. Qualite & tests
Tests backend ajoutes:
- `src/services/__tests__/content-access.service.test.js`
- `src/middleware/__tests__/contentAccess.middleware.test.js`
- `src/controllers/__tests__/subscriptions.members.test.js`

Commande:
```bash
cd backend
npm test
```

## 11. Erreurs frequentes et diagnostic rapide
- `Flutterwave not configured`
  - verifier cles `.env` backend + restart serveur
- `"enckey" is required`
  - secret Flutterwave invalide/manquant
- `column profiles.email does not exist`
  - utiliser email depuis user auth (deja corrige)
- callback qui ne passe pas
  - verifier `redirectBaseUrl` et port frontend (`3000/5173`)

## 12. Etat de completion Epic 2
Etat actuel estime: 83%

Done:
- 2.1 Modele abonnement + page pricing connectee
- 2.3 Flutterwave integration
- 2.4 Webhooks activation (base en place)
- 2.5 Verification abonnement/middleware d'acces
- 2.7 Annulation/changement plan (planifie)
- 2.8 Historique paiements

In progress:
- 2.6 Renouvellement automatique complet (scheduler/job + reminders)

Backlog:
- 2.2 Stripe (si requis business)

## 13. Definition of Done pour cloture Epic 2
- Webhook idempotent strict (event dedupe).
- Renouvellement auto planifie (job quotidien + notifications echec paiement).
- Scenarios QA valides (success/fail/pending/cancel) pour abonnement et unlock contenu.
- Swagger et runbooks operationnels finalises.
