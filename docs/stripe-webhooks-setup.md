# Configuration Webhooks Stripe

## Développement (localhost)

### 1. Installer la Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Vérifier
stripe --version
```

### 2. Se connecter

```bash
stripe login
```

### 3. Lancer le forwarding

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

La CLI affiche un **webhook signing secret** (commence par `whsec_`).
Le copier dans `backend/.env` :

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Redémarrer le backend après.

### 4. Tester les events manuellement

```bash
# Paiement initial réussi
stripe trigger checkout.session.completed

# Renouvellement automatique (Stripe subscription)
stripe trigger invoice.payment_succeeded

# Echec de renouvellement
stripe trigger invoice.payment_failed

# Annulation côté Stripe
stripe trigger customer.subscription.deleted
```

---

## Production (déploiement)

1. Aller sur https://dashboard.stripe.com/webhooks
2. Cliquer **"Add endpoint"**
3. URL : `https://ton-domaine.com/webhooks/stripe`
4. Sélectionner les events suivants :
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copier le **Signing secret** → variable `STRIPE_WEBHOOK_SECRET` sur le serveur

---

## Variables d'environnement requises (backend/.env)

```
STRIPE_SECRET_KEY=sk_test_xxxxx       # Clé secrète Stripe (test ou live)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx     # Secret de signature webhook
```

---

## Endpoint backend

`POST /webhooks/stripe` — monté dans `backend/src/index.js` avec `express.raw({ type: 'application/json' })` **avant** `express.json()` (obligatoire pour la vérification de signature Stripe).

### Events gérés

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Active l'abonnement après paiement initial |
| `invoice.payment_succeeded` | Renouvelle l'abonnement (cycle suivant) |
| `invoice.payment_failed` | Notifie l'utilisateur par email |
| `customer.subscription.deleted` | Marque l'abonnement CANCELLED en DB |
| `customer.subscription.updated` | Synchronise `cancel_at_period_end` en DB |
