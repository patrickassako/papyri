# Analyse Backend — Epic 4: Lecteur Ebook

**Projet:** Bibliotheque Numerique Privee
**Date:** 2026-02-13
**Status Sprint:** Epic 4 actuellement en BACKLOG
**Epic 1:** ✅ COMPLETE
**Epic 2-10:** En backlog

---

## Vue d'ensemble Epic 4

**Objectif:** Permettre aux utilisateurs de lire des ebooks EPUB et PDF avec marque-pages, surlignage, mode nuit, taille de police ajustable, reprise automatique, et synchronisation cross-device.

**7 Stories:**
1. Lecteur EPUB avec Reprise Automatique
2. Lecteur PDF avec Reprise Automatique
3. Marque-pages
4. Surlignage de Texte
5. Mode Nuit & Reglages Lecteur
6. Protection Contenu (DRM Leger)
7. Synchronisation Cross-device Annotations

**Scope Backend:** 12 endpoints, 4 tables, URLs signées, DRM leger, synchronisation temps réel

---

## 🗄️ Architecture Base de Données

### Tables Epic 4

#### 1. **reading_history** (Progression lecture)

```sql
CREATE TABLE reading_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id      UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  progress_percent DECIMAL(5,2) DEFAULT 0,     -- 0.00 à 100.00
  last_position   JSONB,
    -- Ebook: {chapter: "ch3", cfi: "/4/2/8", page: 42}
    -- Audio: {position_seconds: 1234}
  total_time_seconds INTEGER DEFAULT 0,
  is_completed    BOOLEAN DEFAULT FALSE,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rh_user_content ON reading_history(user_id, content_id);
CREATE INDEX idx_rh_user ON reading_history(user_id);
CREATE INDEX idx_rh_last_read ON reading_history(last_read_at DESC);
```

**Utilisation:**
- Stories 4.1, 4.2, 4.7
- Sauvegarde position toutes les 30s
- Permet la reprise automatique
- Synchro cross-device via `last_read_at`

---

#### 2. **bookmarks** (Marque-pages)

```sql
CREATE TABLE bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  position    JSONB NOT NULL,
    -- EPUB: {chapter: "ch3", cfi: "/4/2/8", percent: 0.42}
    -- PDF:  {page: 42, percent: 0.42}
  label       VARCHAR(255),              -- Label utilisateur optionnel
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user_content ON bookmarks(user_id, content_id);
```

**Utilisation:**
- Story 4.3, 4.7
- Un utilisateur peut avoir N marque-pages par contenu
- Synchro cross-device automatique

---

#### 3. **highlights** (Surlignages)

```sql
CREATE TABLE highlights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,             -- Texte surligné
  position    JSONB NOT NULL,
    -- {start_cfi: "...", end_cfi: "...", chapter: "ch3"}
  color       VARCHAR(20) DEFAULT 'yellow',
    -- 'yellow' | 'green' | 'blue' | 'pink'
  note        TEXT,                      -- Note utilisateur optionnelle
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_highlights_user_content ON highlights(user_id, content_id);
```

**Utilisation:**
- Story 4.4, 4.7
- Surlignage EPUB uniquement (limitation PDF)
- Synchro cross-device automatique

---

#### 4. **contents** (Catalogue - extrait pertinent)

```sql
CREATE TABLE contents (
  id              UUID PRIMARY KEY,
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(255) NOT NULL,
  content_type    VARCHAR(20) NOT NULL,  -- 'ebook' | 'audiobook'
  format          VARCHAR(10) NOT NULL,  -- 'epub' | 'pdf' | 'mp3' | 'm4a'
  file_key        VARCHAR(500) NOT NULL, -- Clé R2 fichier chiffré AES-256
  file_size_bytes BIGINT,
  cover_url       TEXT,
  -- ...
);
```

**Utilisation:**
- Stories 4.1, 4.2, 4.6
- Fichiers chiffrés AES-256 sur Cloudflare R2
- Accès via URLs signées temporaires

---

## 🚀 Endpoints Backend - Epic 4

### 📖 Groupe 1: Progression de Lecture (Stories 4.1, 4.2)

#### **1. Sauvegarder Position de Lecture**

```
PUT /reading-history/:content_id        [subscriber]
```

**Appelé:** Toutes les 30 secondes automatiquement depuis le lecteur

**Body (EPUB):**
```json
{
  "progress_percent": 42.5,
  "last_position": {
    "chapter": "ch3",
    "cfi": "/4/2/8",            // Canonical Fragment Identifier (epub.js)
    "page": 42                  // Optionnel (si pagination connue)
  }
}
```

**Body (PDF):**
```json
{
  "progress_percent": 65.3,
  "last_position": {
    "page": 42,
    "total_pages": 200
  }
}
```

**Reponse 200:**
```json
{
  "success": true,
  "data": {
    "reading_id": "uuid",
    "progress_percent": 42.5,
    "last_read_at": "2026-02-13T14:30:00Z"
  }
}
```

**Logique Backend:**
```javascript
// Pseudo-code
async function updateReadingProgress(userId, contentId, data) {
  // UPSERT (insert or update)
  const reading = await db.reading_history.upsert({
    where: { user_id: userId, content_id: contentId },
    update: {
      progress_percent: data.progress_percent,
      last_position: data.last_position,
      last_read_at: new Date(),
      is_completed: data.progress_percent >= 100,
      completed_at: data.progress_percent >= 100 ? new Date() : null
    },
    create: {
      user_id: userId,
      content_id: contentId,
      progress_percent: data.progress_percent,
      last_position: data.last_position,
      started_at: new Date()
    }
  });

  return reading;
}
```

**Validation:**
- `progress_percent`: 0-100 (decimal 2 places)
- `last_position`: JSONB valide
- Abonnement actif (middleware `checkSubscription`)

**Rate Limiting:** Authenticated level (100 req/min/user)

---

#### **2. Récupérer Position de Lecture**

```
GET /reading-history/:content_id        [subscriber]
```

**Appelé:** À l'ouverture du lecteur pour reprise automatique

**Reponse 200:**
```json
{
  "success": true,
  "data": {
    "reading_id": "uuid",
    "content_id": "uuid",
    "progress_percent": 42.5,
    "last_position": {
      "chapter": "ch3",
      "cfi": "/4/2/8",
      "page": 42
    },
    "is_completed": false,
    "started_at": "2026-02-10T10:00:00Z",
    "last_read_at": "2026-02-13T14:30:00Z"
  }
}
```

**Reponse 404:** Si jamais lu (position vide)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Aucune position de lecture sauvegardée."
  }
}
```

**Logique Backend:**
```javascript
async function getReadingProgress(userId, contentId) {
  const reading = await db.reading_history.findUnique({
    where: { user_id: userId, content_id: contentId }
  });

  if (!reading) {
    throw new NotFoundError('Reading progress not found');
  }

  return reading;
}
```

---

#### **3. Historique Complet de Lecture**

```
GET /reading-history?page=1&limit=20    [subscriber]
```

**Utilisé:** Page Profil > Historique (Story 1.7 - Epic 1)

**Reponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "reading_id": "uuid",
      "content": {
        "id": "uuid",
        "title": "Le monde s'effondre",
        "author": "Chinua Achebe",
        "content_type": "ebook",
        "cover_url": "https://cdn.../cover.webp"
      },
      "progress_percent": 75.5,
      "is_completed": false,
      "last_read_at": "2026-02-13T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

**Tri:** Par `last_read_at DESC` (plus récent en premier)

---

### 🔖 Groupe 2: Marque-pages (Story 4.3)

#### **4. Lister Marque-pages**

```
GET /contents/:id/bookmarks             [subscriber]
```

**Reponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "position": {
        "chapter": "ch5",
        "cfi": "/6/4/12",
        "percent": 0.68
      },
      "label": "Passage important",
      "created_at": "2026-02-10T15:00:00Z"
    }
  ]
}
```

**Tri:** Par `created_at DESC`

---

#### **5. Créer Marque-page**

```
POST /contents/:id/bookmarks            [subscriber]
```

**Body:**
```json
{
  "position": {
    "chapter": "ch5",
    "cfi": "/6/4/12",
    "percent": 0.68
  },
  "label": "Passage important"  // Optionnel
}
```

**Reponse 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "position": { ... },
    "label": "Passage important",
    "created_at": "2026-02-13T14:35:00Z"
  }
}
```

**Validation:**
- `position`: JSONB valide avec clés chapter/cfi/page
- `label`: Max 255 caractères

---

#### **6. Supprimer Marque-page**

```
DELETE /bookmarks/:bookmark_id          [subscriber]
```

**Reponse 204:** No Content

**Sécurité:** Vérifier que `user_id` du bookmark = `req.user.id`

---

### ✏️ Groupe 3: Surlignages (Story 4.4)

#### **7. Lister Surlignages**

```
GET /contents/:id/highlights            [subscriber]
```

**Reponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "text": "La culture d'un peuple...",
      "position": {
        "start_cfi": "/6/4/12",
        "end_cfi": "/6/4/18",
        "chapter": "ch2"
      },
      "color": "yellow",
      "note": "Très important pour ma thèse",
      "created_at": "2026-02-10T16:00:00Z"
    }
  ]
}
```

**Tri:** Par `created_at DESC`

---

#### **8. Créer Surlignage**

```
POST /contents/:id/highlights           [subscriber]
```

**Body:**
```json
{
  "text": "La culture d'un peuple est le reflet...",
  "position": {
    "start_cfi": "/6/4/12",
    "end_cfi": "/6/4/18",
    "chapter": "ch2"
  },
  "color": "yellow",    // 'yellow' | 'green' | 'blue' | 'pink'
  "note": "Important"   // Optionnel
}
```

**Reponse 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "text": "La culture d'un peuple...",
    "position": { ... },
    "color": "yellow",
    "note": "Important",
    "created_at": "2026-02-13T14:40:00Z"
  }
}
```

**Validation:**
- `text`: Requis, max 5000 caractères
- `position`: JSONB valide avec start_cfi/end_cfi
- `color`: Enum valide
- `note`: Max 1000 caractères

---

#### **9. Modifier Surlignage**

```
PATCH /highlights/:highlight_id         [subscriber]
```

**Body (partiel):**
```json
{
  "color": "green",
  "note": "Note mise à jour"
}
```

**Reponse 200:** Objet highlight mis à jour

**Sécurité:** Vérifier ownership (`user_id`)

---

#### **10. Supprimer Surlignage**

```
DELETE /highlights/:highlight_id        [subscriber]
```

**Reponse 204:** No Content

---

### 🔒 Groupe 4: Protection Contenu / DRM (Story 4.6)

#### **11. Accéder au Fichier (URL Signée)**

```
POST /contents/:id/access               [subscriber]
```

**Appelé:** Par le lecteur avant de charger le fichier

**Reponse 200:**
```json
{
  "success": true,
  "data": {
    "signed_url": "https://cdn.bibliotheque.app/content-xyz?signature=abc123&expires=1676390400",
    "expires_in_seconds": 900,    // 15 min pour ebook, 60 min pour audio
    "format": "epub",
    "file_size_bytes": 2458632,
    "content_type": "ebook"
  }
}
```

**Logique Backend:**
```javascript
// Cloudflare R2 + S3 API compatible
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: 'auto'
});

async function generateSignedUrl(content) {
  const ttl = content.content_type === 'ebook' ? 900 : 3600; // 15min / 60min

  const signedUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: 'biblio-content-private',
    Key: content.file_key,
    Expires: ttl
  });

  return {
    signed_url: signedUrl,
    expires_in_seconds: ttl,
    format: content.format,
    file_size_bytes: content.file_size_bytes,
    content_type: content.content_type
  };
}
```

**Validation:**
- Vérifier abonnement actif (middleware)
- Vérifier que content existe et `is_published = true`
- Logger l'accès (analytics: `start_reading`, `start_listening`)

**Sécurité:**
- URL signée valide uniquement TTL (15/60 min)
- Fichier chiffré AES-256 sur R2 (encryption at rest)
- CDN Cloudflare pour servir les fichiers
- Pas de téléchargement direct (désactivé côté client)

**Note DRM Leger:**
- Lecture in-app uniquement (composant fermé epub.js/pdf.js)
- Désactivation clic droit / sélection (web)
- Pas de watermarking (V1)
- Protection best-effort (pas anti-piratage absolu)

---

### 🔄 Groupe 5: Synchronisation Cross-device (Story 4.7)

#### **12. Endpoint de Synchronisation Bulk**

```
POST /sync                              [subscriber]
```

**Appelé:** Au retour en ligne (mode offline) ou refresh périodique

**Body:**
```json
{
  "device_id": "device-uuid-12345",
  "reading_positions": [
    {
      "content_id": "uuid",
      "progress_percent": 75.0,
      "last_position": { "position_seconds": 2345 },
      "last_read_at": "2026-02-13T14:00:00Z"
    }
  ],
  "bookmarks": [
    {
      "id": "local-uuid-1",  // UUID local (généré client)
      "content_id": "uuid",
      "position": { ... },
      "created_at": "2026-02-13T13:00:00Z"
    }
  ],
  "highlights": [ ... ]
}
```

**Reponse 200:**
```json
{
  "success": true,
  "data": {
    "synced_readings": 3,
    "synced_bookmarks": 5,
    "synced_highlights": 2,
    "conflicts": [],
    "server_timestamp": "2026-02-13T14:45:00Z"
  }
}
```

**Logique de Conflit:**
- **Progression lecture:** Version la plus récente gagne (`last_read_at`)
- **Bookmarks/Highlights:** Merge (pas de suppression automatique, sauf si deleted_at client)

**Note:** Ce endpoint est optionnel en V1, la synchro peut être faite via les endpoints individuels.

---

## 🎨 Groupe 6: Préférences Lecteur (Story 4.5)

### **Stockage des Préférences**

**Options:**

**Option A: Table `user_reading_preferences`**
```sql
CREATE TABLE user_reading_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  night_mode      BOOLEAN DEFAULT FALSE,
  font_size       INTEGER DEFAULT 16,     -- 14-24px
  font_family     VARCHAR(50) DEFAULT 'Inter',
  line_height     DECIMAL(3,2) DEFAULT 1.5,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Option B: JSONB dans table `users` (recommandé V1)**
```sql
ALTER TABLE users ADD COLUMN reading_preferences JSONB DEFAULT '{
  "night_mode": false,
  "font_size": 16,
  "font_family": "Inter",
  "line_height": 1.5
}';
```

### **Endpoint Préférences**

```
GET  /users/me/reading-preferences      [auth]
PATCH /users/me/reading-preferences     [auth]
```

**Body PATCH:**
```json
{
  "night_mode": true,
  "font_size": 18
}
```

**Note:** Préférences gérées côté client (localStorage web, AsyncStorage mobile), synchro via endpoint optionnelle.

---

## 🔐 Sécurité & Middleware

### Chaine Middleware Epic 4

```
Request
  → HTTPS (obligatoire)
  → Rate Limiting (par niveau: auth/subscriber)
  → verifyJWT (vérifie access token Supabase)
  → checkSubscription (vérifie abonnement actif)
  → Route Handler
```

### Middleware `checkSubscription`

```javascript
async function checkSubscription(req, res, next) {
  const userId = req.user.id;

  // Query subscription avec cache (5 min)
  const subscription = await getActiveSubscription(userId);

  if (!subscription || subscription.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Un abonnement actif est requis pour accéder à ce contenu.'
      }
    });
  }

  // Vérifier expiration
  if (new Date(subscription.current_period_end) < new Date()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Votre abonnement a expiré.'
      }
    });
  }

  req.subscription = subscription;
  next();
}
```

### Sécurité Ownership

**Bookmarks/Highlights:** Toujours vérifier que `user_id` de la ressource = `req.user.id`

```javascript
async function deleteBookmark(req, res) {
  const bookmarkId = req.params.bookmark_id;
  const userId = req.user.id;

  const bookmark = await db.bookmarks.findUnique({ where: { id: bookmarkId } });

  if (!bookmark) {
    return res.status(404).json({ error: 'Bookmark not found' });
  }

  if (bookmark.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await db.bookmarks.delete({ where: { id: bookmarkId } });
  res.status(204).send();
}
```

---

## 📊 Performance & Optimisation

### Cache Strategy

| Ressource | Cache | TTL | Invalidation |
|-----------|-------|-----|--------------|
| Progression lecture | Redis | 5 min | PUT reading-history |
| Bookmarks list | Redis | 10 min | POST/DELETE bookmark |
| Highlights list | Redis | 10 min | POST/PATCH/DELETE highlight |
| Signed URLs | Pas de cache | 15/60 min | Régénérer à expiration |
| User subscription | Redis | 5 min | Webhook payment |

### Indexes

**Critiques pour Epic 4:**
```sql
-- reading_history
CREATE UNIQUE INDEX idx_rh_user_content ON reading_history(user_id, content_id);
CREATE INDEX idx_rh_last_read ON reading_history(last_read_at DESC);

-- bookmarks
CREATE INDEX idx_bookmarks_user_content ON bookmarks(user_id, content_id);

-- highlights
CREATE INDEX idx_highlights_user_content ON highlights(user_id, content_id);
```

### Pagination

- Historique lecture: 20 items/page
- Bookmarks: Pas de pagination (< 50 marque-pages par contenu attendu)
- Highlights: Pas de pagination (< 100 surlignages par contenu attendu)

---

## 📈 Analytics Epic 4

### Events à Tracker

```javascript
// Story 4.1, 4.2
trackEvent('start_reading', {
  content_id: contentId,
  content_type: 'ebook',
  format: 'epub'
});

trackEvent('reading_progress', {
  content_id: contentId,
  progress_percent: 50.0
});

trackEvent('complete_reading', {
  content_id: contentId,
  total_time_seconds: 7200
});

// Story 4.3
trackEvent('bookmark_created', {
  content_id: contentId
});

// Story 4.4
trackEvent('highlight_created', {
  content_id: contentId,
  color: 'yellow'
});
```

**Table:** `analytics_events` (Epic 9)

---

## 🧪 Tests Backend Epic 4

### Tests Unitaires

**reading_history.test.js**
```javascript
describe('PUT /reading-history/:content_id', () => {
  it('should create new reading progress', async () => {
    const response = await request(app)
      .put('/reading-history/content-uuid')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        progress_percent: 42.5,
        last_position: { chapter: 'ch3', cfi: '/4/2/8' }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.progress_percent).toBe(42.5);
  });

  it('should update existing reading progress', async () => {
    // ...
  });

  it('should fail without active subscription', async () => {
    // ...
  });
});
```

**bookmarks.test.js**
```javascript
describe('POST /contents/:id/bookmarks', () => {
  it('should create bookmark', async () => {
    // ...
  });

  it('should prevent creating bookmark for other user content', async () => {
    // ...
  });
});
```

**signed-urls.test.js**
```javascript
describe('POST /contents/:id/access', () => {
  it('should generate signed URL with 15min TTL for ebook', async () => {
    // ...
  });

  it('should generate signed URL with 60min TTL for audio', async () => {
    // ...
  });

  it('should fail for unpublished content', async () => {
    // ...
  });
});
```

### Tests Integration

**cross-device-sync.test.js**
```javascript
describe('Cross-device synchronization', () => {
  it('should sync reading position across devices', async () => {
    // Device A updates position
    await updateReadingProgress(userA, contentId, { progress: 50 });

    // Device B fetches position
    const response = await getReadingProgress(userA, contentId);

    expect(response.progress_percent).toBe(50);
  });
});
```

---

## 📋 Récapitulatif Epic 4 Backend

### Endpoints (12 total)

| # | Method | Endpoint | Level | Story |
|---|--------|----------|-------|-------|
| 1 | PUT | `/reading-history/:content_id` | subscriber | 4.1, 4.2 |
| 2 | GET | `/reading-history/:content_id` | subscriber | 4.1, 4.2 |
| 3 | GET | `/reading-history` | subscriber | 4.1, 4.2 |
| 4 | GET | `/contents/:id/bookmarks` | subscriber | 4.3 |
| 5 | POST | `/contents/:id/bookmarks` | subscriber | 4.3 |
| 6 | DELETE | `/bookmarks/:id` | subscriber | 4.3 |
| 7 | GET | `/contents/:id/highlights` | subscriber | 4.4 |
| 8 | POST | `/contents/:id/highlights` | subscriber | 4.4 |
| 9 | PATCH | `/highlights/:id` | subscriber | 4.4 |
| 10 | DELETE | `/highlights/:id` | subscriber | 4.4 |
| 11 | POST | `/contents/:id/access` | subscriber | 4.6 |
| 12 | POST | `/sync` (optionnel) | subscriber | 4.7 |

### Tables (4 total)

1. `reading_history` (progression lecture/écoute)
2. `bookmarks` (marque-pages)
3. `highlights` (surlignages)
4. `contents` (catalogue, utilisé pour URLs signées)

### Dépendances Externes

- **Cloudflare R2** : Stockage fichiers chiffrés AES-256
- **Cloudflare CDN** : Servir les fichiers via URLs signées
- **Supabase** : PostgreSQL + Auth
- **Redis** (optionnel) : Cache subscription status, reading progress

### Fichiers Backend à Créer/Modifier

```
backend/
├── src/
│   ├── routes/
│   │   ├── reading-history.js      ✅ CREER (Stories 4.1, 4.2)
│   │   ├── bookmarks.js            ✅ CREER (Story 4.3)
│   │   ├── highlights.js           ✅ CREER (Story 4.4)
│   │   ├── contents.js             ⚠️ MODIFIER (ajouter /access endpoint)
│   │   └── sync.js                 ✅ CREER (Story 4.7, optionnel)
│   │
│   ├── services/
│   │   ├── reading-history.service.js   ✅ CREER
│   │   ├── bookmarks.service.js         ✅ CREER
│   │   ├── highlights.service.js        ✅ CREER
│   │   ├── r2-signed-url.service.js     ✅ CREER (Story 4.6)
│   │   └── sync.service.js              ✅ CREER (Story 4.7)
│   │
│   ├── middleware/
│   │   ├── auth.js                 ✅ EXISTE (Epic 1)
│   │   └── subscription.js         ✅ CREER (Epic 2, requis pour Epic 4)
│   │
│   └── tests/
│       ├── reading-history.test.js      ✅ CREER
│       ├── bookmarks.test.js            ✅ CREER
│       ├── highlights.test.js           ✅ CREER
│       └── signed-urls.test.js          ✅ CREER
```

### Migrations Database

```
docs/migrations/
├── 010_create_reading_history.sql       ✅ CREER
├── 011_create_bookmarks.sql             ✅ CREER
├── 012_create_highlights.sql            ✅ CREER
└── 013_add_reading_preferences.sql      ✅ CREER (optionnel)
```

---

## ⚠️ Dépendances Pré-requises

### Epic 2 (Abonnement) - **BLOQUANT**

❌ Epic 4 **ne peut pas être développé** sans Epic 2 car :
- Tous les endpoints Epic 4 requièrent niveau `[subscriber]`
- Middleware `checkSubscription` dépend de la table `subscriptions`
- Impossible de tester sans abonnement actif

**Ordre obligatoire :** Epic 1 ✅ → **Epic 2** → Epic 4

### Epic 3 (Catalogue) - **PARTIELLEMENT BLOQUANT**

⚠️ Requis pour :
- Table `contents` complète avec `file_key` et métadonnées
- Upload de fichiers EPUB/PDF sur R2 (Story 10.4 - Epic 10)

**Workaround dev :** Créer quelques contenus manuellement en DB pour tester

### Epic 10 (Back-Office) - **NON BLOQUANT**

✅ Epic 4 peut être développé sans Epic 10
- Upload de contenus peut être fait manuellement en DB + R2
- Back-office nécessaire pour production, pas pour dev

---

## 🎯 Résumé Exécutif

### Points Forts Architecture ✅

1. **Stateless & Scalable** : PostgreSQL + URLs signées, pas de session serveur
2. **Synchronisation automatique** : `last_read_at` résout les conflits cross-device
3. **DRM Leger réaliste** : Best-effort, pas anti-piratage absolu (scope raisonnable)
4. **Performance** : Indexes optimisés, cache Redis, CDN Cloudflare
5. **Sécurité** : Fichiers chiffrés AES-256, URLs signées TTL, ownership vérifié

### Risques & Limitations ⚠️

1. **Dépendance Epic 2** : BLOQUANT - développer Epic 2 d'abord
2. **Surlignage PDF** : Limitation technique (lecture seule PDF)
3. **Conflits synchro** : Stratégie "last write wins" peut perdre des données (edge case)
4. **DRM faible** : Utilisateur expert peut extraire contenu (accepté par specs)
5. **URLs signées** : Nécessite renouvellement toutes les 15/60 min (friction si session longue)

### Estimation Développement

**Backend uniquement (Epic 4) :**
- Routes & Services : 3-4 jours
- Tests unitaires : 1-2 jours
- Tests integration : 1 jour
- Setup R2 + URLs signées : 1 jour
- **Total : 6-8 jours backend**

**Note :** Frontend (lecteur epub.js/pdf.js) = 10-15 jours supplémentaires (hors scope ce document)

---

## 📞 Questions Ouvertes pour Patrick

1. **Epic 2 timing** : Quand prévu ? Epic 4 est bloqué sans Epic 2.
2. **Contenus test** : Avez-vous des fichiers EPUB/PDF pour tester ?
3. **R2 setup** : Buckets Cloudflare R2 déjà créés ?
4. **DRM watermarking** : Hors scope V1, prévu V2 ?
5. **Limite marque-pages** : Imposer max par contenu (ex: 50) ?
6. **Mode offline** : Epic 7 dépend d'Epic 4 - ordre confirmé ?

---

**Prochaine étape recommandée :**
1. ✅ Développer **Epic 2** (Abonnement) en priorité
2. ✅ Créer contenus test manuellement (table `contents` + upload R2)
3. ✅ Développer Epic 4 backend (6-8 jours)
4. ✅ Développer Epic 4 frontend (10-15 jours)
5. ✅ Tests end-to-end complets

---

*Document généré le 2026-02-13 par Claude Opus 4.6*
