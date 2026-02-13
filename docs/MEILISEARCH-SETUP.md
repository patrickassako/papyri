# Configuration Meilisearch

## Installation avec Docker

### 1. Démarrer Docker Desktop
Assurez-vous que Docker Desktop est lancé.

### 2. Lancer Meilisearch
```bash
docker run -d \
  --name meilisearch \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY="ChangeMe123456789" \
  -v "$(pwd)/data.ms:/meili_data" \
  getmeili/meilisearch:latest
```

### 3. Vérifier que Meilisearch tourne
```bash
curl http://localhost:7700/health
# Devrait retourner: {"status":"available"}
```

### 4. Tester l'accès
```bash
curl -H "Authorization: Bearer ChangeMe123456789" \
  http://localhost:7700/indexes
```

## Configuration Backend

### Variables d'environnement
Ajouter dans `/backend/.env`:
```env
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=ChangeMe123456789
```

## Indexation des contenus

Le service d'indexation (`/backend/src/services/meilisearch.service.js`) va :
1. Créer l'index `contents`
2. Configurer les champs searchables
3. Configurer les filtres
4. Indexer tous les contenus publiés

### Lancer l'indexation initiale
```bash
cd backend
node src/scripts/index-contents.js
```

## Structure de l'index

**Champs searchables:**
- `title` (poids: 5)
- `author` (poids: 3)
- `description` (poids: 1)

**Champs filtrables:**
- `content_type` (ebook/audiobook)
- `language` (fr/en)
- `categories` (array)

**Champs triables:**
- `published_at`
- `title`

## API de recherche

```bash
# Recherche simple
POST http://localhost:7700/indexes/contents/search
Authorization: Bearer ChangeMe123456789
Content-Type: application/json

{
  "q": "afrique",
  "limit": 20
}

# Recherche avec filtres
{
  "q": "histoire",
  "filter": "content_type = 'ebook' AND language = 'fr'",
  "sort": ["published_at:desc"],
  "limit": 20
}
```

## Commandes utiles

```bash
# Arrêter Meilisearch
docker stop meilisearch

# Démarrer Meilisearch
docker start meilisearch

# Voir les logs
docker logs -f meilisearch

# Supprimer le container
docker rm -f meilisearch

# Voir les indexes
curl -H "Authorization: Bearer ChangeMe123456789" \
  http://localhost:7700/indexes

# Supprimer un index
curl -X DELETE \
  -H "Authorization: Bearer ChangeMe123456789" \
  http://localhost:7700/indexes/contents
```

## Documentation officielle
https://www.meilisearch.com/docs
