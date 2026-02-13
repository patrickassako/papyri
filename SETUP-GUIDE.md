# Guide de Configuration - Bibliothèque Numérique

Ce document explique comment configurer les services externes nécessaires pour tester l'application.

## État Actuel du Développement

✅ **Story 1.1 : Initialisation Projet & Design System** - COMPLÈTE
✅ **Story 1.2 : Inscription Utilisateur** - COMPLÈTE (code implémenté)

### Ce qui fonctionne

- Structure monorepo complète (backend, web, mobile, shared)
- Backend Express.js avec middleware de sécurité (helmet, cors, compression)
- Design system partagé (tokens couleurs, typographie, espacements)
- Thème MUI configuré pour le web
- Endpoint d'inscription avec validation complète
- Service d'authentification JWT (access 15min, refresh 7j)
- Rate limiting (10 req/min par IP sur auth)
- Pages web d'inscription et home avec React Router
- Écrans mobile d'inscription avec React Native Paper

### Ce qui nécessite une configuration

Pour tester l'application end-to-end, vous devez configurer :

## 1. Supabase (Base de données)

### Créer un projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Noter l'URL du projet et les clés API

### Créer les tables

Exécuter les requêtes SQL suivantes dans le SQL Editor de Supabase :

```sql
-- Table users
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  full_name             VARCHAR(255) NOT NULL,
  role                  VARCHAR(20) NOT NULL DEFAULT 'user',
  avatar_url            TEXT,
  language              VARCHAR(10) DEFAULT 'fr',
  onboarding_completed  BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Table notification_preferences
CREATE TABLE notification_preferences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_enabled       BOOLEAN DEFAULT TRUE,
  email_enabled      BOOLEAN DEFAULT TRUE,
  fcm_token          TEXT,
  new_content        BOOLEAN DEFAULT TRUE,
  resume_reading     BOOLEAN DEFAULT TRUE,
  expiration_warning BOOLEAN DEFAULT TRUE,
  marketing          BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Configurer les variables d'environnement

Dans `backend/.env`, remplacer :

```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_KEY=votre-cle-service
```

## 2. Brevo (Emails)

### Créer un compte Brevo

1. Aller sur https://www.brevo.com (anciennement Sendinblue)
2. Créer un compte gratuit
3. Aller dans Settings > SMTP & API > API Keys
4. Créer une nouvelle clé API

### Configurer les variables d'environnement

Dans `backend/.env`, ajouter :

```env
BREVO_API_KEY=votre-cle-api-brevo
BREVO_SENDER_EMAIL=noreply@votre-domaine.com
BREVO_SENDER_NAME=Bibliothèque Numérique
```

**Note** : En développement, vous pouvez utiliser l'email de votre compte Brevo comme sender.

## 3. JWT Secrets (Production)

Pour la production, générer des secrets JWT sécurisés :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Exécuter cette commande deux fois et remplacer dans `backend/.env` :

```env
JWT_SECRET=votre-secret-genere-1
JWT_REFRESH_SECRET=votre-secret-genere-2
```

## 4. Démarrer l'application

### Backend

```bash
cd backend
npm start
```

Le serveur démarre sur http://localhost:3001

### Web

```bash
cd web
# Installer les dépendances si nécessaire
npm install

# Démarrer le serveur de développement (React)
# Note: Vous devrez configurer un script de démarrage React
# (webpack-dev-server, create-react-app, vite, etc.)
```

### Mobile

```bash
cd mobile
# L'initialisation complète React Native sera faite dans une story ultérieure
# Pour l'instant, les écrans sont créés mais le projet n'est pas encore initialisé
```

## 5. Tester l'inscription

### Via curl (Backend uniquement)

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "motdepasse123",
    "full_name": "Test User"
  }'
```

**Réponse attendue (201 Created)** :

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "full_name": "Test User",
      "role": "user"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Via l'interface web

1. Aller sur http://localhost:3000/register
2. Remplir le formulaire avec :
   - Nom complet (min 2 caractères)
   - Email valide
   - Mot de passe (min 8 caractères)
3. Cliquer sur "Créer mon compte"
4. Vous serez redirigé vers la page d'accueil

## Erreurs possibles

### 1. "Supabase client error"

**Cause** : Les clés Supabase ne sont pas configurées ou invalides.

**Solution** : Vérifier `backend/.env` et s'assurer que SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY sont corrects.

### 2. "Failed to send welcome email"

**Cause** : Brevo n'est pas configuré ou la clé API est invalide.

**Impact** : L'inscription fonctionne quand même, seul l'email n'est pas envoyé.

**Solution** : Vérifier `BREVO_API_KEY` dans `backend/.env`.

### 3. "Email already exists" (409)

**Cause** : Un compte existe déjà avec cet email.

**Solution** : Utiliser un autre email ou supprimer l'utilisateur existant dans Supabase.

### 4. CORS error

**Cause** : Le frontend n'est pas autorisé à accéder au backend.

**Solution** : Vérifier `CORS_ORIGIN` dans `backend/.env` correspond à l'URL du frontend (par défaut http://localhost:3000).

## Prochaines étapes

Les prochaines stories à implémenter sont :

- **Story 1.3** : Connexion Utilisateur (login avec email/password)
- **Story 1.4** : Déconnexion
- **Story 1.5** : Réinitialisation Mot de Passe
- **Story 1.6** : Profil Utilisateur
- **Story 1.7** : Historique Lecture/Écoute
- **Story 1.8** : Onboarding Premier Lancement

## Support

Pour toute question sur la configuration, vérifier :

- Documentation Supabase : https://supabase.com/docs
- Documentation Brevo : https://developers.brevo.com
- Architecture du projet : `_bmad-output/architecture.md`
- Schéma de base de données : `_bmad-output/db_schema.md`
- Spécifications API : `_bmad-output/api_spec.md`
