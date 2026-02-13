# Meilisearch Setup Guide

## 🚀 Démarrage rapide

### Option 1 : Docker (Recommandé)

```bash
# Démarrer Meilisearch avec Docker
docker run -d \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY="ChangeMe123456789" \
  -v $(pwd)/meili_data:/meili_data \
  --name meilisearch \
  getmeili/meilisearch:latest

# Vérifier que Meilisearch fonctionne
curl http://localhost:7700/health
```

### Option 2 : Installation locale

```bash
# macOS (Homebrew)
brew install meilisearch

# Démarrer Meilisearch
meilisearch --master-key="ChangeMe123456789"
```

### Option 3 : Meilisearch Cloud

1. Créer un compte sur [Meilisearch Cloud](https://cloud.meilisearch.com/)
2. Créer un nouveau projet
3. Copier l'URL et la clé API
4. Mettre à jour `.env` :
   ```
   MEILISEARCH_HOST=https://your-project.meilisearch.io
   MEILISEARCH_KEY=your_api_key
   ```

---

## 📝 Configuration

### Variables d'environnement

Ajouter dans `/backend/.env` :

```env
# Meilisearch Configuration
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=ChangeMe123456789
```

---

## 🔄 Indexation des contenus

### 1. Initialiser l'index

L'index est automatiquement créé au premier appel. Vous pouvez aussi l'initialiser manuellement :

```bash
# Dans le backend
cd backend
node -e "require('./src/services/meilisearch.service').initializeIndex()"
```

### 2. Indexer tous les contenus

**Via l'API (Admin requis) :**

```bash
# Avec JWT admin
curl -X POST http://localhost:3001/api/search/index \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

**Via script Node.js :**

Créer `backend/scripts/index-contents.js` :

```javascript
const meilisearchService = require('../src/services/meilisearch.service');

async function indexContents() {
  try {
    console.log('🔄 Initialisation de l\'index...');
    await meilisearchService.initializeIndex();

    console.log('📚 Indexation des contenus...');
    await meilisearchService.indexAllContents();

    console.log('✅ Indexation terminée !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

indexContents();
```

Puis exécuter :

```bash
node scripts/index-contents.js
```

---

## 🧪 Tester la recherche

### Via API

```bash
# Recherche simple
curl "http://localhost:3001/api/search?q=achebe"

# Recherche avec filtres
curl "http://localhost:3001/api/search?q=histoire&type=ebook&language=fr"

# Recherche avec tri
curl "http://localhost:3001/api/search?q=&sort=published_at:desc&limit=10"
```

### Via Frontend

Le frontend utilise déjà `contentsService.search()` dans CatalogPage.

**Web :** `/web/src/pages/CatalogPage.jsx` (ligne 105-137)
**Mobile :** `/mobile/src/screens/CatalogScreen.js` (lignes disponibles si besoin)

---

## 📊 Statistiques et monitoring

### Obtenir les stats de l'index (Admin)

```bash
curl http://localhost:3001/api/search/stats \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Dashboard Meilisearch

Accéder au dashboard : [http://localhost:7700](http://localhost:7700)

---

## 🔧 Maintenance

### Réindexer tous les contenus

```bash
# Via API
curl -X POST http://localhost:3001/api/search/index \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Vider l'index

```javascript
const meilisearchService = require('./src/services/meilisearch.service');
await meilisearchService.clearIndex();
```

### Supprimer un contenu de l'index

```javascript
const meilisearchService = require('./src/services/meilisearch.service');
await meilisearchService.deleteContent('content-uuid-here');
```

---

## ✅ Epic 3 - Story 3.4 Status

- [x] Service Meilisearch créé
- [x] Controller search créé
- [x] Route GET /search configurée
- [x] Recherche avec filtres (type, langue, catégorie)
- [x] Tolérance aux fautes activée
- [x] Ranking rules configurés
- [x] Frontend intégré (web + mobile)

**Prochaines étapes :**
1. Démarrer Meilisearch (Docker ou local)
2. Indexer les contenus existants
3. Tester la recherche

---

## 🐛 Troubleshooting

**Erreur "SEARCH_UNAVAILABLE" :**
- Vérifier que Meilisearch tourne : `curl http://localhost:7700/health`
- Vérifier les variables d'environnement dans `.env`

**Pas de résultats :**
- Vérifier que l'index contient des documents : GET `/api/search/stats`
- Réindexer les contenus : POST `/api/search/index`

**Erreur de connexion :**
- Vérifier que le port 7700 est libre
- Vérifier que la master key correspond dans `.env`
