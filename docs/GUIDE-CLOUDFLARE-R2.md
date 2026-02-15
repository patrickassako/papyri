# 📦 Guide Complet: Configuration Cloudflare R2

Guide pas-à-pas pour configurer le stockage Cloudflare R2 pour Papyri.

---

## 📋 Table des Matières

1. [Qu'est-ce que Cloudflare R2?](#quest-ce-que-cloudflare-r2)
2. [Prérequis](#prérequis)
3. [Étape 1: Créer un compte Cloudflare](#étape-1-créer-un-compte-cloudflare)
4. [Étape 2: Activer R2](#étape-2-activer-r2)
5. [Étape 3: Créer les buckets](#étape-3-créer-les-buckets)
6. [Étape 4: Créer les API Tokens](#étape-4-créer-les-api-tokens)
7. [Étape 5: Configurer le backend](#étape-5-configurer-le-backend)
8. [Étape 6: Tester la configuration](#étape-6-tester-la-configuration)
9. [Étape 7: Uploader des fichiers](#étape-7-uploader-des-fichiers)
10. [Troubleshooting](#troubleshooting)

---

## Qu'est-ce que Cloudflare R2?

**Cloudflare R2** est un service de stockage d'objets compatible S3:

✅ **Avantages:**
- 💰 **Gratuit jusqu'à 10 GB** / mois
- 🚀 **Pas de frais d'egress** (téléchargement gratuit)
- 🌍 **CDN mondial intégré**
- 🔒 **Sécurisé par défaut**
- 🔧 **Compatible API S3** (facile à intégrer)

📊 **Comparaison avec AWS S3:**
- S3: $0.023/GB + $0.09/GB egress = **$0.113/GB total**
- R2: $0.015/GB + $0/GB egress = **$0.015/GB total**
- **7x moins cher que S3!**

---

## Prérequis

- ✅ Une adresse email valide
- ✅ Aucune carte bancaire requise (plan gratuit 10 GB)
- ✅ 15 minutes de temps

---

## Étape 1: Créer un compte Cloudflare

### 1.1 Inscription

1. Allez sur: **https://cloudflare.com**
2. Cliquez sur **"Sign Up"** (en haut à droite)
3. Remplissez le formulaire:
   - Email: votre adresse email
   - Mot de passe: au moins 8 caractères
4. Cliquez sur **"Create Account"**
5. **Vérifiez votre email** (cliquez sur le lien reçu)

### 1.2 Connexion

Une fois vérifié:
- Connectez-vous sur https://dash.cloudflare.com
- Vous arriverez sur le **Dashboard Cloudflare**

---

## Étape 2: Activer R2

### 2.1 Accéder à R2

Dans le dashboard Cloudflare:
1. Menu de gauche → Cliquez sur **"R2"**
2. Ou allez directement sur: **https://dash.cloudflare.com/r2**

### 2.2 Activer le service

Si c'est votre première fois:
1. Vous verrez **"Purchase R2"** ou **"Get Started"**
2. Cliquez sur **"Purchase R2"** ou **"Begin Setup"**
3. **Plan gratuit:** 10 GB stockage + 10M requêtes/mois
4. Pas besoin de carte bancaire
5. Cliquez sur **"Enable R2"**

✅ **R2 est maintenant activé!**

---

## Étape 3: Créer les buckets

Vous avez besoin de **2 buckets**:
1. **biblio-content-private** → Contenus protégés (ebooks, audiobooks)
2. **biblio-covers-public** → Couvertures publiques (images)

### 3.1 Bucket 1: Contenus Privés

1. Dans R2, cliquez sur **"Create bucket"**
2. Remplissez le formulaire:
   ```
   Bucket name: biblio-content-private
   Location: Automatic (Recommended)
   Storage class: Standard
   ```
3. **Public access:** Laissez **désactivé** (accès privé par défaut)
4. Cliquez sur **"Create bucket"**

✅ Bucket privé créé!

### 3.2 Bucket 2: Couvertures Publiques

1. Cliquez à nouveau sur **"Create bucket"**
2. Remplissez le formulaire:
   ```
   Bucket name: biblio-covers-public
   Location: Automatic
   Storage class: Standard
   ```
3. **Public access:**
   - Cliquez sur **"Allow Access"**
   - Activez **"Public bucket"**
   - ⚠️ Attention: Ce bucket sera accessible publiquement
   - Confirmer
4. Cliquez sur **"Create bucket"**

✅ Bucket public créé!

### 3.3 Vérification

Vous devriez voir vos 2 buckets dans la liste:
```
📦 biblio-content-private (Private)
📦 biblio-covers-public (Public)
```

---

## Étape 4: Créer les API Tokens

Les tokens permettent au backend d'accéder à R2.

### 4.1 Créer le token

1. En haut à droite de la page R2, cliquez sur **"Manage R2 API Tokens"**
2. Cliquez sur **"Create API Token"**

### 4.2 Configuration du token

Remplissez le formulaire:

```
Token name: papyri-backend-token

Permissions:
  ☑️ Object Read & Write

Apply to specific buckets only:
  ☑️ biblio-content-private
  ☑️ biblio-covers-public

TTL (Time to Live):
  ⭕ Forever (pas d'expiration)
```

3. Cliquez sur **"Create API Token"**

### 4.3 ⚠️ IMPORTANT: Copier les credentials

**ATTENTION:** Ces informations ne seront affichées qu'**UNE SEULE FOIS**!

Vous verrez 3 valeurs:

```
Access Key ID: ████████████████████
Secret Access Key: ████████████████████████████████████
Jurisdiction-specific Endpoint for S3 clients: https://████.r2.cloudflarestorage.com
```

**📋 Copiez ces 3 valeurs dans un fichier texte temporaire!**

---

## Étape 5: Configurer le backend

### 5.1 Obtenir l'Account ID

1. En haut de la page R2, vous verrez:
   ```
   Account ID: abcdef1234567890
   ```
2. **Copiez cet Account ID**

### 5.2 Modifier le fichier .env

Ouvrez le fichier `backend/.env` et ajoutez ces lignes:

```bash
# ============================================================================
# CLOUDFLARE R2 STORAGE
# ============================================================================

# Account ID (trouvé en haut de la page R2)
R2_ACCOUNT_ID=votre-account-id-ici

# Endpoint URL (Jurisdiction-specific Endpoint)
R2_ENDPOINT=https://votre-account-id.r2.cloudflarestorage.com

# API Token credentials
R2_ACCESS_KEY_ID=votre-access-key-id-ici
R2_SECRET_ACCESS_KEY=votre-secret-access-key-ici

# Noms des buckets
R2_BUCKET_CONTENT=biblio-content-private
R2_BUCKET_COVERS=biblio-covers-public

# URL publique pour les covers (optionnel - voir section suivante)
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### 5.3 URL Publique pour les Covers

Vous avez 3 options:

#### Option A: R2.dev Subdomain (Recommandé pour débuter)

1. Allez dans le bucket `biblio-covers-public`
2. Onglet **"Settings"**
3. Section **"Public R2.dev Bucket URL"**
4. Cliquez sur **"Allow Access"**
5. Copiez l'URL affichée: `https://pub-xxxxx.r2.dev`
6. Dans `.env`: `R2_PUBLIC_URL=https://pub-xxxxx.r2.dev`

#### Option B: Custom Domain (Production)

Si vous avez un domaine (ex: papyri.com):

1. Dans `biblio-covers-public` → **"Settings"** → **"Custom Domains"**
2. Cliquez sur **"Connect Domain"**
3. Entrez: `cdn.papyri.com` (ou autre sous-domaine)
4. Cloudflare ajoutera automatiquement les DNS records
5. Attendez 5-10 minutes pour la propagation DNS
6. Dans `.env`: `R2_PUBLIC_URL=https://cdn.papyri.com`

#### Option C: Direct R2 URL (Dev uniquement)

```bash
R2_PUBLIC_URL=https://votre-account-id.r2.cloudflarestorage.com/biblio-covers-public
```

### 5.4 Exemple complet du .env

```bash
R2_ACCOUNT_ID=abc123def456
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5
R2_SECRET_ACCESS_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
R2_BUCKET_CONTENT=biblio-content-private
R2_BUCKET_COVERS=biblio-covers-public
R2_PUBLIC_URL=https://pub-xyz789.r2.dev
```

---

## Étape 6: Tester la configuration

### 6.1 Lancer le script de test

```bash
cd backend
node src/scripts/test-r2.js
```

### 6.2 Résultat attendu

```
🚀 Test complet Cloudflare R2...

1️⃣  Vérification configuration...
   ✅ Configuration OK
   Account: abc123de...
   Endpoint: https://abc123def456.r2.cloudflarestorage.com

2️⃣  Test connexion S3...
   ✅ Client S3 OK

3️⃣  Test upload fichier...
   ✅ Upload OK: test/papyri-test-1234567890.txt

4️⃣  Test signed URL...
   ✅ Signed URL: https://abc123def456.r2.cloudflarestorage.com/...

5️⃣  Test download...
   ✅ Download OK - Contenu vérifié

6️⃣  Nettoyage...
   ✅ Fichier test supprimé

7️⃣  Test URL publique...
   ✅ URL: https://pub-xyz789.r2.dev/test.jpg

============================================================
🎉 TOUS LES TESTS RÉUSSIS!
============================================================

✅ Cloudflare R2 opérationnel
```

### 6.3 Si le test échoue

Voir la section [Troubleshooting](#troubleshooting)

---

## Étape 7: Uploader des fichiers

### Option 1: Via le Dashboard Cloudflare (Simple)

1. Allez dans **R2** → Cliquez sur `biblio-content-private`
2. Cliquez sur **"Upload"**
3. Sélectionnez vos fichiers (ebooks, audiobooks)
4. Structure recommandée:
   ```
   biblio-content-private/
   ├── ebooks/
   │   ├── enfant-noir.epub
   │   ├── si-longue-lettre.epub
   │   └── ...
   ├── audiobooks/
   │   ├── histoire-afrique-vol1.mp3
   │   ├── contes-legendes.mp3
   │   └── ...
   ```

5. Pour les covers dans `biblio-covers-public`:
   ```
   biblio-covers-public/
   ├── ebooks/
   │   ├── enfant-noir.jpg
   │   ├── si-longue-lettre.jpg
   │   └── ...
   ├── audiobooks/
   │   ├── histoire-afrique-vol1.jpg
   │   └── ...
   ```

### Option 2: Via Wrangler CLI (Avancé)

```bash
# Installer Wrangler
npm install -g wrangler

# Login Cloudflare
wrangler login

# Upload fichier
wrangler r2 object put biblio-content-private/ebooks/test.epub --file ./test.epub

# Upload folder
wrangler r2 object put biblio-content-private/ebooks/ --file ./ebooks/ --recursive
```

### Option 3: Via Code Backend (Programmation)

Le backend peut générer des URLs d'upload:

```javascript
const r2Service = require('./services/r2.service');

// Générer URL d'upload
const uploadUrl = await r2Service.generateUploadUrl(
  'ebooks/nouveau-livre.epub',
  3600, // 1 heure
  'application/epub+zip'
);

// Le frontend peut ensuite faire PUT sur cette URL
```

---

## Troubleshooting

### ❌ Erreur: "R2 non configuré"

**Cause:** Variables manquantes dans `.env`

**Solution:**
1. Vérifiez que toutes les variables sont présentes:
   ```bash
   grep R2_ backend/.env
   ```
2. Vérifiez qu'il n'y a pas d'espaces ou de guillemets:
   ```bash
   # ❌ Incorrect
   R2_ACCOUNT_ID = "abc123"

   # ✅ Correct
   R2_ACCOUNT_ID=abc123
   ```

### ❌ Erreur: "Access Denied" ou "Invalid Credentials"

**Cause:** Access Key incorrectes

**Solution:**
1. Vérifiez les credentials dans `.env`
2. Re-créez un nouveau token API:
   - R2 → Manage R2 API Tokens
   - Create API Token
   - Remplacez les valeurs dans `.env`

### ❌ Erreur: "Bucket not found"

**Cause:** Nom de bucket incorrect

**Solution:**
1. Vérifiez les noms dans `.env`:
   ```bash
   R2_BUCKET_CONTENT=biblio-content-private
   R2_BUCKET_COVERS=biblio-covers-public
   ```
2. Vérifiez que les buckets existent dans R2 dashboard
3. Respectez la casse (minuscules/majuscules)

### ❌ Erreur: "Network timeout" ou "ENOTFOUND"

**Cause:** Problème de connexion internet ou endpoint incorrect

**Solution:**
1. Testez votre connexion:
   ```bash
   ping cloudflare.com
   ```
2. Vérifiez l'endpoint dans `.env`:
   ```bash
   # Format correct
   R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
   ```
3. Pas de slash `/` à la fin

### ❌ Les covers publiques ne s'affichent pas

**Cause:** Bucket non public ou URL incorrecte

**Solution:**
1. Vérifiez que `biblio-covers-public` est bien public:
   - R2 → biblio-covers-public → Settings
   - Public Access: **Enabled**
2. Vérifiez `R2_PUBLIC_URL` dans `.env`
3. Testez l'URL dans un navigateur:
   ```
   https://pub-xxxxx.r2.dev/test.jpg
   ```

### 🆘 Besoin d'aide?

- **Documentation R2:** https://developers.cloudflare.com/r2/
- **Support Cloudflare:** https://community.cloudflare.com/
- **Discord Cloudflare:** https://discord.gg/cloudflaredev

---

## 📊 Récapitulatif

✅ **Ce que vous avez fait:**
1. ✅ Créé un compte Cloudflare
2. ✅ Activé R2 (10 GB gratuit)
3. ✅ Créé 2 buckets (privé + public)
4. ✅ Créé un API Token
5. ✅ Configuré le backend (.env)
6. ✅ Testé la connexion
7. ✅ Prêt à uploader des fichiers

✅ **Prochaines étapes:**
- Uploader vos ebooks/audiobooks
- Mettre à jour la base de données avec les `file_key` corrects
- Tester l'endpoint: `GET /api/contents/:id/file-url`
- Intégrer le frontend (lecture/écoute)

---

## 🎉 Félicitations!

Votre stockage Cloudflare R2 est maintenant **100% opérationnel**!

**Coûts estimés pour Papyri:**
- 100 ebooks (50 MB chacun): 5 GB = **GRATUIT**
- 50 audiobooks (100 MB chacun): 5 GB = **GRATUIT**
- Total: 10 GB = **0 €/mois** 🎉

---

**Date de création:** 2026-02-13
**Version:** 1.0
**Projet:** Papyri - Bibliothèque Numérique Privée
