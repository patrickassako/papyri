# Bibliothèque Numérique Privée

Plateforme de bibliothèque numérique privée avec ebooks et audiobooks.

## Structure du Projet

```
/
├── backend/          # API Node.js + Express.js
├── web/              # Frontend React.js + MUI
├── mobile/           # App React Native (iOS + Android)
├── shared/           # Tokens design system partagés
└── docs/             # Documentation technique
```

## Stack Technique

**Backend:**
- Node.js + Express.js
- Supabase (PostgreSQL)
- Cloudflare R2 (S3-compatible storage)
- JWT RS256 (auth)
- Bcrypt (passwords)

**Frontend Web:**
- React.js
- Material UI (MUI) v5+
- Design system personnalisé

**Frontend Mobile:**
- React Native
- React Native Paper
- Design system partagé

## Installation

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configurer les variables d'environnement dans .env
npm start
```

Le serveur démarre sur `http://localhost:3001`

Health check : `http://localhost:3001/health`

### Web

```bash
cd web
npm install
npm start
```

### Mobile

```bash
cd mobile
npm install
# iOS
cd ios && pod install && cd ..
npm run ios
# Android
npm run android
```

## Design System

Les tokens de design (couleurs, typographie, espacements, formes) sont centralisés dans `/shared/tokens/` et partagés entre web et mobile.

**Couleurs principales:**
- Primary: `#B5651D` (Terre d'Afrique)
- Secondary: `#D4A017` (Or du Sahel)
- Accent: `#2E4057` (Indigo Adire)

**Typographie:**
- Titres: Playfair Display
- Corps: Inter

## Variables d'Environnement

Copier `.env.example` vers `.env` dans chaque projet et configurer :

- Supabase credentials
- Cloudflare R2 credentials
- Stripe & Flutterwave keys
- Firebase credentials
- JWT secrets

## Développement

```bash
# Backend (avec hot reload)
cd backend
npm run dev

# Web
cd web
npm start

# Mobile
cd mobile
npm start
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Specification](docs/api_spec.md)
- [Database Schema](docs/db_schema.md)
- [UX Design Specification](docs/ux-design-specification.md)

## License

Propriétaire - Dimitri Talla © 2026
