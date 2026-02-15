# Analyse des Dépendances & Planification Parallèle

**Projet:** Bibliotheque Numerique Privee
**Date:** 2026-02-13
**Contexte:** Epic 2 en cours de réalisation (autre agent)

---

## 🎯 État Actuel

| Epic | Statut | Agent |
|------|--------|-------|
| Epic 1 (Auth & Onboarding) | ✅ **DONE** | Patrick's agent (done) |
| Epic 2 (Abonnement & Paiements) | 🔄 **EN COURS** | Autre agent |
| Epic 3-10 | 📋 **BACKLOG** | - |

---

## 📊 Analyse des Dépendances

### Epic 2 (EN COURS) - Livrables Attendus

**Middleware critique :**
```javascript
// backend/src/middleware/subscription.js
async function checkSubscription(req, res, next) {
  // Vérifie abonnement actif
  // Bloque accès si subscription.status !== 'active'
}
```

**Table critique :**
```sql
CREATE TABLE subscriptions (
  user_id UUID REFERENCES users(id),
  status VARCHAR(20),  -- 'active' | 'inactive' | 'expired' | 'cancelled'
  plan VARCHAR(20),    -- 'monthly' | 'yearly'
  current_period_end TIMESTAMPTZ,
  -- ...
);
```

**Routes Epic 2 :**
- `POST /subscriptions` [auth]
- `GET /subscriptions/current` [auth]
- `POST /subscriptions/current/cancel` [auth]
- `GET /payments` [auth]
- `POST /webhooks/stripe` [signature]
- `POST /webhooks/flutterwave` [hash]

---

## 🔄 Matrice de Dépendances

| Epic | Dépend de | Bloque | Parallélisable ? |
|------|-----------|--------|------------------|
| **Epic 1** | - | Tous | ✅ DONE |
| **Epic 2** | Epic 1 | Epic 3, 4, 5, 6, 7 | 🔄 EN COURS |
| **Epic 3** | Epic 1, (Epic 2 partiel) | Epic 6 | ⚠️ **PARTIEL** |
| **Epic 4** | Epic 1, **Epic 2**, (Epic 3) | Epic 6, 7 | ❌ **BLOQUÉ** |
| **Epic 5** | Epic 1, **Epic 2** | Epic 6, 7 | ❌ **BLOQUÉ** |
| **Epic 6** | Epic 3, 4, 5 | - | ❌ **BLOQUÉ** |
| **Epic 7** | Epic 2, 4, 5 | - | ❌ **BLOQUÉ** |
| **Epic 8** | Epic 1 | - | ✅ **OUI** |
| **Epic 9** | Epic 1 | - | ✅ **OUI** |
| **Epic 10** | Epic 1 | Epic 3, 4, 5 (tests) | ✅ **OUI** |

---

## ✅ Tâches PARALLÉLISABLES (pendant Epic 2)

### 🥇 Priorité 1 : BLOQUANT pour Epic 4

#### **Epic 10 - Story 10.4 : Gestion Catalogue + Upload Contenus**

**Pourquoi URGENT ?**
- Epic 4 nécessite des contenus EPUB/PDF pour tester
- Upload vers R2 + table `contents` + indexation Meilisearch
- Permet de débloquer les tests d'Epic 4 dès qu'Epic 2 est terminé

**Livrables :**
```
✅ Table contents complète en DB
✅ Upload fichiers EPUB/PDF vers Cloudflare R2 (bucket biblio-content-private)
✅ Chiffrement AES-256 des fichiers
✅ Indexation Meilisearch
✅ Back-office AdminJS : CRUD contenus
```

**Estimation :** 3-4 jours

**Dépendances :**
- ✅ Epic 1 (auth) : DONE
- ✅ Cloudflare R2 setup (buckets)
- ✅ Meilisearch setup

**Status niveau accès :**
- Routes AdminJS : `[admin]` (pas de dépendance Epic 2)
- Utilise middleware `requireRole('admin')` déjà créé en Epic 1

**RECOMMANDATION : 🚀 DÉMARRER MAINTENANT**

---

#### **Epic 10 - Story 10.1 : Setup AdminJS + Auth Admin**

**Pourquoi en parallèle ?**
- Infrastructure back-office nécessaire pour Story 10.4
- Pas de dépendance sur Epic 2
- Authentification admin via JWT existant (Epic 1)

**Livrables :**
```
✅ AdminJS installé et configuré
✅ Route /admin protégée par requireRole('admin')
✅ Dashboard de base avec menu
✅ Authentification admin fonctionnelle
```

**Estimation :** 1-2 jours

**RECOMMANDATION : 🚀 DÉMARRER MAINTENANT**

---

### 🥈 Priorité 2 : Préparation Epic 4

#### **Epic 4 - Préparation Infrastructure Backend**

**Ce qui peut être fait SANS Epic 2 :**

```
✅ Migrations database :
   - 010_create_reading_history.sql
   - 011_create_bookmarks.sql
   - 012_create_highlights.sql

✅ Services (logique métier) :
   - reading-history.service.js
   - bookmarks.service.js
   - highlights.service.js
   - r2-signed-url.service.js

✅ Tests unitaires services :
   - reading-history.service.test.js
   - bookmarks.service.test.js
   - highlights.service.test.js

✅ Documentation technique :
   - Spéc URLs signées R2
   - Schéma JSONB (positions EPUB/PDF)
```

**Ce qui est BLOQUÉ par Epic 2 :**
```
❌ Routes Express (nécessitent middleware checkSubscription)
❌ Tests d'intégration (nécessitent abonnement actif)
❌ Déploiement endpoints
```

**Estimation :** 2-3 jours

**RECOMMANDATION : ⚠️ Attendre que 10.1 + 10.4 soient prêts (contenus test nécessaires)**

---

### 🥈 Priorité 3 : Epic 3 - Landing Page

#### **Epic 3 - Story 3.1 : Landing Page Visiteurs**

**Pourquoi parallélisable ?**
- Route `[public]` : **AUCUNE dépendance Epic 2**
- Pas besoin de middleware subscription
- Peut utiliser contenus mockés ou réels (si Story 10.4 terminée)

**Livrables :**
```
✅ Landing page narrative (web)
✅ Aperçu catalogue (couvertures visibles, contenu verrouillé)
✅ Pricing clair (5 EUR/mois, 50 EUR/an)
✅ CTA "S'abonner" → redirect vers /subscriptions (Epic 2)
✅ SEO : balises meta, indexable
```

**Estimation :** 3-4 jours (frontend heavy)

**Dépendances :**
- ✅ Epic 1 (auth) : DONE
- ⚠️ Epic 10.4 (contenus) : Recommandé (ou mock data)

**RECOMMANDATION : ✅ PEUT DÉMARRER (avec mock data ou après 10.4)**

---

### 🥉 Priorité 4 : Epic 9 - Analytics & RGPD

#### **Epic 9 - Story 9.1 : Bannière Consentement RGPD**

**Pourquoi parallélisable ?**
- Composant frontend indépendant
- Stockage consentement en localStorage/AsyncStorage
- Pas de dépendance backend forte

**Livrables :**
```
✅ Bannière consentement (web + mobile)
✅ Stockage préférences utilisateur
✅ Gestion cookies tracking
✅ Conformité RGPD de base
```

**Estimation :** 2-3 jours

**RECOMMANDATION : ✅ PEUT DÉMARRER**

---

#### **Epic 9 - Story 9.2 : Google Analytics Integration**

**Pourquoi parallélisable ?**
- Installation GA4 indépendante
- Events tracking de base (pageviews, clicks)
- Événements auth/subscription peuvent être ajoutés après Epic 2

**Livrables :**
```
✅ Google Analytics 4 installé (web + mobile)
✅ Events de base : page_view, sign_up, login
✅ Respecte consentement RGPD (Story 9.1)
```

**Estimation :** 1-2 jours

**RECOMMANDATION : ✅ PEUT DÉMARRER (après 9.1)**

---

### 🥉 Priorité 5 : Epic 8 - Emails Transactionnels

#### **Epic 8 - Story 8.5 : Integration Brevo/Mailchimp + Templates**

**Pourquoi parallélisable ?**
- Infrastructure emailing indépendante
- Templates peuvent être créés sans Epic 2
- Webhooks Epic 2 appelleront les services email après

**Livrables :**
```
✅ Brevo/Mailchimp configuré
✅ Service email.service.js
✅ Templates email :
   - Email bienvenue (Epic 1 ✅)
   - Email confirmation paiement (Epic 2 🔄)
   - Email expiration abonnement (Epic 2 🔄)
   - Email paiement échoué (Epic 2 🔄)
✅ Tests envoi email
```

**Estimation :** 2-3 jours

**RECOMMANDATION : ⚠️ Priorité moyenne (Epic 2 utilisera après)**

---

## 🚫 Tâches BLOQUÉES par Epic 2

### Epic 4 : Lecteur Ebook (COMPLET)
- **Bloqué par :** Middleware `checkSubscription` (Epic 2)
- **Préparation possible :** Migrations, services, tests unitaires

### Epic 5 : Lecteur Audio (COMPLET)
- **Bloqué par :** Middleware `checkSubscription` (Epic 2)
- **Similaire à Epic 4**

### Epic 3 : Stories 3.2-3.5 (Catalogue Abonnés)
- **Bloqué par :** Routes `[subscriber]` nécessitent Epic 2
- **Story 3.1 OK** : Landing page publique

### Epic 6 : Accueil Personnalisé (COMPLET)
- **Bloqué par :** Epic 3, 4, 5 (contenus + progression)

### Epic 7 : Mode Hors-ligne (COMPLET)
- **Bloqué par :** Epic 2, 4, 5 (lecteurs + vérification abonnement)

---

## 🎯 Plan d'Action Recommandé

### 🔥 Phase 1 : EN PARALLÈLE (maintenant)

**Agent Patrick :** Focus back-office + contenus (BLOQUANT pour tests Epic 4)

```
1️⃣ Epic 10 - Story 10.1 : Setup AdminJS             (1-2 jours)
2️⃣ Epic 10 - Story 10.4 : Gestion Catalogue + Upload (3-4 jours)
   → Créer 5-10 contenus test (EPUB/PDF) en DB + R2
   → Chiffrement AES-256 + indexation Meilisearch
```

**Durée totale :** 4-6 jours

**Livrables critiques :**
- ✅ Back-office AdminJS fonctionnel
- ✅ Table `contents` avec contenus réels EPUB/PDF
- ✅ Fichiers chiffrés sur Cloudflare R2
- ✅ Indexation Meilisearch

**Bloque :** Tests Epic 4/5, Epic 3 (catalogue)

---

### ⚡ Phase 2 : Préparation Epic 4 (optionnel si temps)

**Agent Patrick :** Pendant qu'Epic 2 se termine

```
3️⃣ Epic 4 - Migrations Database                     (0.5 jour)
4️⃣ Epic 4 - Services (sans routes)                  (2 jours)
5️⃣ Epic 4 - Tests unitaires services                (1 jour)
6️⃣ Epic 4 - Documentation URLs signées R2           (0.5 jour)
```

**Durée :** 3-4 jours

**Livrables :**
- ✅ Tables `reading_history`, `bookmarks`, `highlights`
- ✅ Logique métier prête (services)
- ✅ Tests unitaires services

**Ce qui reste après Epic 2 :**
- Routes Express (1 jour)
- Tests d'intégration (1 jour)

---

### 🌟 Phase 3 : APRÈS Epic 2 terminé

**Suite logique :**

```
1. Epic 3 (Catalogue) - 8-10 jours
   → Stories 3.2-3.5 (maintenant débloquées par Epic 2)
   → Utilise contenus de Story 10.4 ✅

2. Epic 4 (Lecteur Ebook) - 6-8 jours backend + 10-15 jours frontend
   → Middleware subscription disponible ✅
   → Contenus test disponibles ✅
   → Services déjà prêts ✅ (si Phase 2 faite)

3. Epic 5 (Lecteur Audio) - 6-8 jours backend + 10-12 jours frontend
   → Similaire à Epic 4
   → Mini-player persistant

4. Epic 6 (Accueil Personnalisé) - 5-7 jours
   → Dépend de Epic 3, 4, 5
   → Section "Reprendre" en position #1
```

---

## 📅 Timeline Optimisée

### Semaine 1-2 : EN PARALLÈLE

```
┌─────────────────────────────────────────┐
│ Agent 1 (Epic 2)                        │  🔄 EN COURS
│ └─ Abonnement + Paiements (8 stories)  │
├─────────────────────────────────────────┤
│ Agent 2 (Patrick)                       │  🚀 DÉMARRER
│ ├─ Epic 10.1 : Setup AdminJS           │  1-2j
│ └─ Epic 10.4 : Catalogue + Upload      │  3-4j
└─────────────────────────────────────────┘
```

**Gain de temps :** 4-6 jours parallélisés = Epic 4 peut démarrer immédiatement après Epic 2

---

### Semaine 3 : APRÈS Epic 2

```
┌─────────────────────────────────────────┐
│ Epic 3 : Catalogue & Recherche          │  8-10j
│ └─ Utilise contenus Story 10.4 ✅       │
├─────────────────────────────────────────┤
│ Epic 4 : Lecteur Ebook                  │  6-8j backend
│ └─ Middleware Epic 2 ✅                 │  (+ 10-15j frontend)
│ └─ Services déjà prêts ✅ (Phase 2)     │
└─────────────────────────────────────────┘
```

---

## 🎁 Bonus : Tâches Rapides (1-2 jours chacune)

Si temps disponible pendant Epic 2 :

```
✅ Epic 9.1 : Bannière RGPD                (2j)
✅ Epic 9.2 : Google Analytics             (1j)
✅ Epic 3.1 : Landing Page                 (3j)
✅ Epic 8.5 : Templates Email              (2j)
```

**Critère :** Indépendantes, apportent de la valeur immédiate

---

## 🏆 Recommandation Finale

### 🥇 PRIORITÉ ABSOLUE (Patrick maintenant)

```
1. Epic 10.1 : Setup AdminJS               → Démarrer IMMÉDIATEMENT
2. Epic 10.4 : Gestion Catalogue + Upload  → Enchaîner après 10.1
```

**Justification :**
- ✅ **0 dépendance** sur Epic 2
- ✅ **BLOQUANT** pour tester Epic 4/5 (contenus nécessaires)
- ✅ **High value** : Back-office utilisable immédiatement
- ✅ **4-6 jours** de travail parallélisé = gain net sur projet

---

### 🥈 PRIORITÉ SECONDAIRE (si temps)

```
3. Epic 4 : Préparation Infrastructure     → Migrations + Services
```

**Justification :**
- ✅ Débloquer 3-4 jours de travail Epic 4
- ✅ Permet de démarrer Epic 4 complet immédiatement après Epic 2

---

### 🥉 BONUS (optionnel)

```
4. Epic 9.1 : Bannière RGPD                → Frontend, indépendant
5. Epic 3.1 : Landing Page                 → Frontend, route publique
```

---

## 📞 Questions pour Validation

1. **Epic 2 timing** : Combien de jours restants estimés ?
2. **Cloudflare R2** : Buckets déjà créés ? Credentials disponibles ?
3. **Meilisearch** : Instance déjà provisionnée ?
4. **Contenus test** : Avez-vous des fichiers EPUB/PDF à uploader ?
5. **Brevo/Mailchimp** : Compte déjà créé ? API key disponible ?

---

**Prochaine action recommandée :**
```bash
# Démarrer Story 10.1 (Setup AdminJS)
/bmad-bmm-dev-story
# → Sélectionner ou créer story 10-1-setup-adminjs-authentification-admin
```

---

*Document généré le 2026-02-13 par Claude Opus 4.6*
