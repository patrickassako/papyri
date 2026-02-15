# Story 10.4: Gestion Catalogue & Upload Contenus

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want ajouter, modifier et supprimer des contenus avec upload de fichiers,
So that le catalogue soit toujours a jour.

## Acceptance Criteria

1. **AC1 — Formulaire ajout contenu** : Given un admin sur la section Catalogue, When il clique "Ajouter contenu", Then un formulaire s'affiche avec : titre, auteur, description, categorie(s), type (ebook/audio), langue, image couverture, fichier contenu
2. **AC2 — Workflow upload complet** : Given un admin qui upload un fichier, When le fichier est valide, Then le workflow execute : validation format (EPUB, PDF, MP3, M4A) et taille → chiffrement AES 256 → upload Cloudflare R2 (`biblio-content-private` pour contenu, `biblio-covers-public` pour couverture) → indexation Supabase → indexation Meilisearch
3. **AC3 — Barre de progression** : Given un upload en cours, When le fichier est transmis, Then une barre de progression s'affiche avec pourcentage
4. **AC4 — Validation erreurs** : Given un fichier invalide (format non supporte, taille excessive), When la validation echoue, Then un message explicite s'affiche et aucun fichier n'est stocke
5. **AC5 — Modification metadonnees** : Given un contenu existant, When l'admin modifie les metadonnees, Then les changements sont sauvegardes et l'index Meilisearch est mis a jour
6. **AC6 — Suppression contenu** : Given un admin qui supprime un contenu, When la suppression est confirmee, Then le fichier R2 est supprime + entree Supabase supprimee (soft delete) + index Meilisearch mis a jour
7. **AC7 — Publication immediate** : Given un upload reussi, When le contenu est sauvegarde, Then il est publie immediatement (is_published=true)

## Tasks / Subtasks

- [ ] **Task 1 : Configuration Cloudflare R2** (AC: #2)
  - [ ] 1.1 Creer/verifier 3 buckets R2 : `biblio-content-private` (fichiers chiffres), `biblio-covers-public` (couvertures publiques CDN), `biblio-backups` (backups admin)
  - [ ] 1.2 Ajouter variables d'environnement : R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_CONTENT, R2_BUCKET_COVERS
  - [ ] 1.3 Configurer client S3-compatible (aws-sdk) pour R2
  - [ ] 1.4 Tester connexion R2 et upload/download de base

- [ ] **Task 2 : Service chiffrement AES-256** (AC: #2)
  - [ ] 2.1 Creer service `backend/src/services/encryption.service.js`
  - [ ] 2.2 Implementer `encryptFile(buffer, key)` avec crypto AES-256-GCM
  - [ ] 2.3 Implementer `decryptFile(encryptedBuffer, key)` pour lecture
  - [ ] 2.4 Generer cle de chiffrement depuis variable d'environnement ENCRYPTION_KEY (32 bytes)
  - [ ] 2.5 Tests unitaires encryption/decryption

- [ ] **Task 3 : Service upload R2 + chiffrement** (AC: #2)
  - [ ] 3.1 Creer service `backend/src/services/r2-upload.service.js`
  - [ ] 3.2 Fonction `uploadContent(file, metadata)` : valider → chiffrer → upload R2 → retourner file_key
  - [ ] 3.3 Fonction `uploadCover(file)` : redimensionner (max 800x1200) → upload R2 public → retourner URL CDN
  - [ ] 3.4 Fonction `deleteContent(fileKey)` : supprimer fichier R2
  - [ ] 3.5 Validation formats : EPUB, PDF (ebooks), MP3, M4A (audio)
  - [ ] 3.6 Validation tailles : max 50 MB ebook, max 500 MB audio, max 2 MB image
  - [ ] 3.7 Gestion erreurs upload (retry, timeout, cleanup en cas d'echec)

- [ ] **Task 4 : Service indexation Meilisearch** (AC: #2, #5)
  - [ ] 4.1 Installer Meilisearch client : `npm install meilisearch`
  - [ ] 4.2 Ajouter variables d'environnement : MEILISEARCH_HOST, MEILISEARCH_API_KEY
  - [ ] 4.3 Creer service `backend/src/services/meilisearch.service.js`
  - [ ] 4.4 Fonction `indexContent(content)` : indexer dans index "contents"
  - [ ] 4.5 Fonction `updateContent(contentId, updates)` : mettre a jour index
  - [ ] 4.6 Fonction `deleteContent(contentId)` : retirer de l'index
  - [ ] 4.7 Configurer index "contents" : searchable attributes (title, author, description), filterable (content_type, language, categories)

- [ ] **Task 5 : Route API upload contenu** (AC: #1, #2, #3, #4)
  - [ ] 5.1 Creer route POST `/admin/contents/upload` [admin]
  - [ ] 5.2 Utiliser multer pour gestion fichiers multipart/form-data
  - [ ] 5.3 Valider metadata (titre, auteur requis, type enum, etc.)
  - [ ] 5.4 Valider fichier contenu (format, taille)
  - [ ] 5.5 Executer workflow : encryptFile → uploadContent → uploadCover → save Supabase → indexContent
  - [ ] 5.6 Retourner progression via Server-Sent Events (SSE) ou WebSocket (optionnel V1 : reponse 201 simple)
  - [ ] 5.7 Gestion erreurs avec messages explicites (format invalide, taille excessive, erreur R2, erreur Meilisearch)
  - [ ] 5.8 Logger dans audit_logs : action=create, resource=contents

- [ ] **Task 6 : Integration AdminJS ressource Contents** (AC: #1, #5, #6, #7)
  - [ ] 6.1 Ajouter ressource `contents` dans config AdminJS
  - [ ] 6.2 Formulaire creation : titre, auteur, description, type (ebook/audio), format (enum), langue (dropdown), categories (multi-select), couverture (upload), fichier (upload)
  - [ ] 6.3 Formulaire edition : modifier metadonnees (pas re-upload fichier)
  - [ ] 6.4 Action suppression : soft delete (deleted_at) + suppression R2 + mise a jour Meilisearch
  - [ ] 6.5 Liste contenus : filtres (type, langue, publie/non publie), recherche (titre, auteur)
  - [ ] 6.6 Afficher taille fichier, date upload, statut publication
  - [ ] 6.7 Bouton "Depublier/Publier" pour toggle is_published

- [ ] **Task 7 : Migration database** (AC: #7)
  - [ ] 7.1 Verifier table `contents` existe (creee en Epic 1 ou avant)
  - [ ] 7.2 Si manquant, creer migration `030_create_contents_table.sql`
  - [ ] 7.3 Ajouter colonnes si necessaires : file_key, file_size_bytes, is_published, published_at
  - [ ] 7.4 Creer table `categories` si inexistante
  - [ ] 7.5 Creer table `content_categories` (N:N) si inexistante

- [ ] **Task 8 : Tests et validation** (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] 8.1 Test : upload EPUB valide → chiffrement → R2 → Supabase → Meilisearch OK
  - [ ] 8.2 Test : upload PDF valide → workflow complet OK
  - [ ] 8.3 Test : upload MP3 valide → workflow complet OK
  - [ ] 8.4 Test : upload fichier trop gros → erreur explicite
  - [ ] 8.5 Test : upload format invalide (.txt) → erreur explicite
  - [ ] 8.6 Test : modification metadonnees → Meilisearch mis a jour
  - [ ] 8.7 Test : suppression contenu → R2 + Supabase + Meilisearch OK
  - [ ] 8.8 Test : recherche Meilisearch apres indexation fonctionne

## Dev Notes

### Architecture Workflow Upload

```
Client (AdminJS Form)
  → POST /admin/contents/upload (multipart/form-data)
  → Validation metadata + fichier
  → Encryption Service (AES-256-GCM)
  → R2 Upload Service
    → Upload contenu chiffre → biblio-content-private
    → Upload couverture → biblio-covers-public
  → Save metadata Supabase (file_key, file_size, cover_url)
  → Indexation Meilisearch (title, author, description, categories)
  → Return 201 + content object
  → Audit Trail logging
```

### Configuration Cloudflare R2

**Buckets :**
1. `biblio-content-private` : Fichiers ebooks/audio chiffres (pas de CDN direct)
2. `biblio-covers-public` : Couvertures publiques (CDN enabled)
3. `biblio-backups` : Backups base de donnees (admin only)

**Variables .env :**
```env
# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_CONTENT=biblio-content-private
R2_BUCKET_COVERS=biblio-covers-public
R2_BUCKET_BACKUPS=biblio-backups

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-key  # openssl rand -hex 32

# Meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your-master-key
```

**Client S3 (aws-sdk) :**
```javascript
// backend/src/config/r2.js
const AWS = require('aws-sdk');

const s3Client = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto', // R2 utilise 'auto'
});

module.exports = { s3Client };
```

### Service Chiffrement AES-256

**backend/src/services/encryption.service.js :**
```javascript
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

function encryptFile(buffer) {
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Return: iv (16 bytes) + authTag (16 bytes) + encrypted data
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptFile(encryptedBuffer) {
  const iv = encryptedBuffer.slice(0, 16);
  const authTag = encryptedBuffer.slice(16, 32);
  const encrypted = encryptedBuffer.slice(32);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}

module.exports = {
  encryptFile,
  decryptFile,
};
```

### Service Upload R2

**backend/src/services/r2-upload.service.js :**
```javascript
const { s3Client } = require('../config/r2');
const { encryptFile } = require('./encryption.service');
const crypto = require('crypto');

// Formats autorises
const ALLOWED_FORMATS = {
  ebook: ['epub', 'pdf'],
  audiobook: ['mp3', 'm4a'],
};

// Tailles max (bytes)
const MAX_SIZE = {
  ebook: 50 * 1024 * 1024,      // 50 MB
  audiobook: 500 * 1024 * 1024, // 500 MB
  cover: 2 * 1024 * 1024,       // 2 MB
};

async function uploadContent(fileBuffer, metadata) {
  const { content_type, format, title } = metadata;

  // Validation format
  if (!ALLOWED_FORMATS[content_type]?.includes(format)) {
    throw new Error(`Format ${format} non autorise pour ${content_type}`);
  }

  // Validation taille
  const maxSize = MAX_SIZE[content_type];
  if (fileBuffer.length > maxSize) {
    throw new Error(`Fichier trop volumineux (max ${maxSize / 1024 / 1024} MB)`);
  }

  // Chiffrement AES-256
  const encryptedBuffer = encryptFile(fileBuffer);

  // Generer cle unique
  const fileKey = `contents/${crypto.randomUUID()}.${format}.encrypted`;

  // Upload vers R2
  await s3Client.putObject({
    Bucket: process.env.R2_BUCKET_CONTENT,
    Key: fileKey,
    Body: encryptedBuffer,
    ContentType: 'application/octet-stream',
    Metadata: {
      'original-format': format,
      'content-type': content_type,
      'title': title,
    },
  }).promise();

  return {
    file_key: fileKey,
    file_size_bytes: fileBuffer.length,
    encrypted_size_bytes: encryptedBuffer.length,
  };
}

async function uploadCover(fileBuffer) {
  // TODO: Redimensionner image avec sharp (max 800x1200)
  // const resized = await sharp(fileBuffer).resize(800, 1200, { fit: 'inside' }).toBuffer();

  const coverKey = `covers/${crypto.randomUUID()}.webp`;

  await s3Client.putObject({
    Bucket: process.env.R2_BUCKET_COVERS,
    Key: coverKey,
    Body: fileBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=604800', // 7 jours
  }).promise();

  // URL publique CDN
  const coverUrl = `https://cdn.bibliotheque.app/${coverKey}`;

  return coverUrl;
}

async function deleteContent(fileKey) {
  await s3Client.deleteObject({
    Bucket: process.env.R2_BUCKET_CONTENT,
    Key: fileKey,
  }).promise();
}

module.exports = {
  uploadContent,
  uploadCover,
  deleteContent,
};
```

### Service Meilisearch

**backend/src/services/meilisearch.service.js :**
```javascript
const { MeiliSearch } = require('meilisearch');

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_API_KEY,
});

const INDEX_NAME = 'contents';

async function ensureIndex() {
  try {
    await client.getIndex(INDEX_NAME);
  } catch (error) {
    // Index n'existe pas, le creer
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });

    // Configurer index
    const index = client.index(INDEX_NAME);
    await index.updateSettings({
      searchableAttributes: ['title', 'author', 'description'],
      filterableAttributes: ['content_type', 'language', 'categories', 'is_published'],
      sortableAttributes: ['published_at', 'title'],
    });
  }
}

async function indexContent(content) {
  await ensureIndex();

  const index = client.index(INDEX_NAME);

  // Formatter document pour Meilisearch
  const document = {
    id: content.id,
    title: content.title,
    author: content.author,
    description: content.description,
    content_type: content.content_type,
    format: content.format,
    language: content.language,
    categories: content.categories || [],
    cover_url: content.cover_url,
    is_published: content.is_published,
    published_at: content.published_at,
  };

  await index.addDocuments([document]);
}

async function updateContent(contentId, updates) {
  const index = client.index(INDEX_NAME);
  await index.updateDocuments([{ id: contentId, ...updates }]);
}

async function deleteContent(contentId) {
  const index = client.index(INDEX_NAME);
  await index.deleteDocument(contentId);
}

module.exports = {
  indexContent,
  updateContent,
  deleteContent,
};
```

### Route Upload API

**backend/src/routes/admin.js (ajouter) :**
```javascript
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const r2Service = require('../services/r2-upload.service');
const meilisearch = require('../services/meilisearch.service');
const { logAuditEvent } = require('../services/audit.service');

router.post('/admin/contents/upload',
  verifyJWT,
  requireRole('admin'),
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const { title, author, description, content_type, format, language, categories } = req.body;

      // Validation
      if (!title || !author || !content_type || !format) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Titre, auteur, type et format requis' }
        });
      }

      if (!req.files.file || !req.files.file[0]) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FILE', message: 'Fichier contenu requis' }
        });
      }

      const fileBuffer = req.files.file[0].buffer;
      const coverBuffer = req.files.cover?.[0]?.buffer;

      // Upload contenu (chiffre + R2)
      const { file_key, file_size_bytes } = await r2Service.uploadContent(fileBuffer, {
        content_type,
        format,
        title,
      });

      // Upload couverture
      let cover_url = null;
      if (coverBuffer) {
        cover_url = await r2Service.uploadCover(coverBuffer);
      }

      // Save Supabase
      const { data: content, error } = await supabaseAdmin
        .from('contents')
        .insert({
          title,
          author,
          description,
          content_type,
          format,
          language,
          file_key,
          file_size_bytes,
          cover_url,
          is_published: true,
          published_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      // Indexer Meilisearch
      await meilisearch.indexContent(content);

      // Audit trail
      await logAuditEvent(req.user.id, 'create', 'contents', content.id, { title, content_type });

      res.status(201).json({
        success: true,
        data: content,
      });
    } catch (error) {
      next(error);
    }
  }
);
```

### Integration AdminJS

**backend/src/config/adminjs.js (ajouter ressource) :**
```javascript
const adminOptions = {
  resources: [
    // ... autres ressources ...
    {
      resource: Contents,
      options: {
        properties: {
          file_key: { isVisible: { list: false, edit: false, show: true } },
          file_size_bytes: { isVisible: { list: true, edit: false } },
          cover_url: {
            isVisible: { list: true, edit: true, show: true },
            components: {
              show: AdminJS.bundle('./components/ImagePreview'),
            },
          },
        },
        actions: {
          new: {
            // Custom component pour upload
            component: AdminJS.bundle('./components/ContentUploadForm'),
          },
          delete: {
            before: async (request, context) => {
              const content = await context.record.populate();
              // Supprimer de R2
              await r2Service.deleteContent(content.params.file_key);
              // Supprimer de Meilisearch
              await meilisearch.deleteContent(content.id);
              return request;
            },
          },
        },
      },
    },
  ],
};
```

### Tests

**backend/tests/r2-upload.test.js :**
```javascript
describe('R2 Upload Service', () => {
  it('should encrypt and upload EPUB file', async () => {
    const fileBuffer = fs.readFileSync('test-files/sample.epub');
    const result = await r2Service.uploadContent(fileBuffer, {
      content_type: 'ebook',
      format: 'epub',
      title: 'Test Book',
    });

    expect(result.file_key).toContain('.epub.encrypted');
    expect(result.file_size_bytes).toBe(fileBuffer.length);
  });

  it('should reject invalid format', async () => {
    const fileBuffer = Buffer.from('invalid');
    await expect(r2Service.uploadContent(fileBuffer, {
      content_type: 'ebook',
      format: 'txt', // Invalide
      title: 'Test',
    })).rejects.toThrow('Format txt non autorise');
  });

  it('should reject file too large', async () => {
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51 MB
    await expect(r2Service.uploadContent(largeBuffer, {
      content_type: 'ebook',
      format: 'epub',
      title: 'Test',
    })).rejects.toThrow('Fichier trop volumineux');
  });
});
```

### Dependencies

**NPM Packages :**
```bash
npm install aws-sdk meilisearch multer sharp
```

**External Services :**
- Cloudflare R2 : Account + Buckets + API Keys
- Meilisearch : Instance deployed (localhost ou cloud)

### References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Meilisearch Documentation](https://docs.meilisearch.com/)
- [Node.js Crypto AES-256-GCM](https://nodejs.org/api/crypto.html)
- [Source: _bmad-output/architecture.md#Section 5 — Cloudflare R2 + CDN]
- [Source: _bmad-output/architecture.md#Section 11 — Chiffrement AES-256]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4]

## Dev Agent Record

### Agent Model Used

<!-- Agent will fill this -->

### Debug Log References

<!-- Agent will fill this -->

### Completion Notes List

<!-- Agent will fill this -->

### File List

<!-- Agent will list all files created/modified -->

### Change Log

<!-- Agent will summarize changes made -->
