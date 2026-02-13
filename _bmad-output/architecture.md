# Architecture Technique — Bibliotheque Numerique Privee

Version: 1.0
Reference contractuelle: Cahier de charge signe (Dimitri Talla / Afrik NoCode — 31/01/2026)
Reference produit: PRD v1.1
Audience: Engineering, DevOps, QA

---

## 1. Architecture globale

### 1.1 Vision

Architecture **3 couches** orientee API-first, concue pour :
- un marche a connectivite variable (Afrique urbaine + diaspora),
- une consommation multi-device (web + mobile),
- une securisation forte des contenus (DRM leger),
- une scalabilite progressive.

### 1.2 Diagramme haut niveau

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│                                                                 │
│   ┌─────────────┐   ┌──────────────────┐   ┌──────────────┐   │
│   │  Web App    │   │  Mobile App      │   │  Back-office │   │
│   │  React.js   │   │  React Native    │   │  AdminJS     │   │
│   │             │   │  Android & iOS   │   │              │   │
│   └──────┬──────┘   └────────┬─────────┘   └──────┬───────┘   │
│          │                   │                     │           │
└──────────┼───────────────────┼─────────────────────┼───────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (HTTPS)                        │
│                      JWT Authentication                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express.js)              │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Auth     │ │ Catalog  │ │ Payment  │ │ Subscription     │  │
│  │ Service  │ │ Service  │ │ Service  │ │ Service          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Content  │ │ Search   │ │ Notif    │ │ Analytics        │  │
│  │ Delivery │ │ Service  │ │ Service  │ │ Service          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌──────────┐ ┌──────────┐                                    │
│  │ Email    │ │ Offline  │                                    │
│  │ Service  │ │ Sync Svc │                                    │
│  └──────────┘ └──────────┘                                    │
└───────┬──────────────┬──────────────┬───────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌───────────┐ ┌──────────────────────────────┐
│  Supabase    │ │Cloudflare │ │  Services externes           │
│  (PostgreSQL │ │ R2 + CDN  │ │  - Stripe                    │
│   + Auth)    │ │           │ │  - Flutterwave               │
│              │ │           │ │  - Firebase (FCM)            │
│              │ │           │ │  - Google Analytics          │
│              │ │           │ │  - Brevo / Mailchimp         │
│              │ │           │ │  - Meilisearch / Elastic     │
└──────────────┘ └───────────┘ └──────────────────────────────┘
```

### 1.3 Principes architecturaux

| Principe | Application |
|----------|------------|
| API-first | Toute logique passe par l'API REST — aucun acces direct a la DB depuis les clients |
| Stateless backend | Sessions gerees par JWT — pas de session serveur |
| Separation des responsabilites | Chaque service gere un domaine fonctionnel unique |
| Offline-first pour mobile | L'app mobile est concue pour fonctionner avec ou sans reseau |
| CDN-first pour les contenus | Tous les fichiers media sont servis via CDN, jamais directement depuis S3 |
| Securite par defaut | HTTPS partout, JWT obligatoire, fichiers chiffres AES 256 |

---

## 2. Stack technique (imposee par contrat)

| Couche | Technologie | Justification contractuelle |
|--------|------------|---------------------------|
| Frontend Web | **React.js** | Cahier de charge section 3.2 |
| Frontend Mobile | **React Native** (Android & iOS) | Cahier de charge section 3.2 |
| Backend | **Node.js + Express.js** | Cahier de charge section 3.2 |
| API | **REST securisee** | Cahier de charge section 3.2 |
| Base de donnees | **Supabase** (PostgreSQL manage) | Cahier de charge section 3.2 |
| Stockage fichiers | **Cloudflare R2** (compatible S3) | Cahier de charge section 3.2 — mis a jour client (couts exploitation) |
| Recherche | **Meilisearch** ou **Elasticsearch** | Cahier de charge section 3.2 / devis LOT 3 |
| Notifications push | **Firebase (FCM)** | Cahier de charge section 8 |
| Analytics | **Google Analytics** | Cahier de charge section 8 |
| Emailing | **Brevo** ou **Mailchimp** | Cahier de charge section 8 |
| Back-office | **AdminJS** | Devis LOT 4 |

**Aucune substitution technologique autorisee sans avenant contractuel.**

---

## 3. Authentification & securite

### 3.1 Flux d'authentification

```
Client                    Backend                   Supabase
  │                         │                         │
  │  POST /auth/register    │                         │
  │ (email + password)      │                         │
  │────────────────────────>│  Create user            │
  │                         │────────────────────────>│
  │                         │       User created      │
  │                         │<────────────────────────│
  │    JWT access token     │                         │
  │    + refresh token      │                         │
  │<────────────────────────│                         │
  │                         │                         │
  │  GET /api/* (+ JWT)     │                         │
  │────────────────────────>│  Verify JWT             │
  │                         │  Check subscription     │
  │                         │────────────────────────>│
  │       Response          │                         │
  │<────────────────────────│                         │
```

### 3.2 Strategie JWT

| Element | Specification |
|---------|--------------|
| Algorithme | RS256 |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 jours |
| Stockage client web | HttpOnly cookie (access), localStorage (refresh) |
| Stockage client mobile | Secure storage (Keychain iOS / Keystore Android) |
| Renouvellement | Automatique via refresh token avant expiration |

### 3.3 Middleware d'autorisation

Chaque requete API protegee passe par la chaine :

```
Request → HTTPS → JWT Verify → Subscription Check → Route Handler
```

- **JWT Verify** : valide le token, extrait l'identite utilisateur
- **Subscription Check** : verifie que l'abonnement est actif pour les routes protegees (catalogue, lecteurs, contenus)
- Les routes publiques (landing, inscription, login) sont exclues de la verification d'abonnement

### 3.4 Securite des mots de passe

- Hachage **bcrypt** (cost factor 12)
- Validation cote serveur : minimum 8 caracteres
- Reinitialisation par token temporaire (TTL 1 heure) envoye par email

---

## 4. Systeme d'abonnement

### 4.1 Modele

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  INACTIVE   │────>│   ACTIVE    │────>│   EXPIRED   │
│  (no sub)   │     │  (paid)     │     │  (lapsed)   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                           │  cancel            │  re-subscribe
                           ▼                    │
                    ┌─────────────┐             │
                    │  CANCELLED  │─────────────┘
                    │  (end of    │
                    │   period)   │
                    └─────────────┘
```

### 4.2 Regles

| Regle | Comportement |
|-------|-------------|
| Activation | Paiement valide (webhook) → statut ACTIVE |
| Expiration | Fin de periode sans renouvellement → statut EXPIRED → acces coupe |
| Annulation | L'acces reste actif jusqu'a la fin de la periode payee |
| Reabonnement | Un utilisateur expire peut se reabonner a tout moment |
| Unicite | Un seul abonnement actif par utilisateur |
| Impact hors-ligne | Expiration → purge des contenus locaux au retour en ligne |

---

## 5. Paiements

### 5.1 Architecture double passerelle

```
                    ┌─────────────────┐
                    │   Client App    │
                    │  (choix zone)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Payment Router │
                    │  (backend)      │
                    └───┬─────────┬───┘
                        │         │
              ┌─────────▼──┐  ┌──▼──────────┐
              │   Stripe   │  │ Flutterwave │
              │ (internat) │  │  (Afrique)  │
              └─────┬──────┘  └──────┬──────┘
                    │                │
                    ▼                ▼
              ┌──────────────────────────┐
              │   Webhooks Listener     │
              │   (source de verite)    │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │  Subscription Service   │
              │  (activation/expiration)│
              └──────────────────────────┘
```

### 5.2 Gestion des webhooks

| Evenement webhook | Action backend |
|-------------------|---------------|
| `payment_intent.succeeded` (Stripe) | Activer/renouveler abonnement |
| `payment_intent.payment_failed` (Stripe) | Marquer echec, notifier utilisateur |
| `charge.completed` (Flutterwave) | Activer/renouveler abonnement |
| `charge.failed` (Flutterwave) | Marquer echec, notifier utilisateur |
| `customer.subscription.deleted` (Stripe) | Planifier expiration fin de periode |

### 5.3 Securite des webhooks

- Verification de signature pour chaque webhook (Stripe Webhook Secret / Flutterwave verify)
- Idempotence : chaque webhook est traite une seule fois (stockage de l'event ID)
- Retry : les webhooks echoues sont re-traites automatiquement par les passerelles

---

## 6. Gestion des contenus & catalogue

### 6.1 Flux d'upload (back-office)

```
Admin (AdminJS)
  │
  │  Upload fichier (EPUB/PDF/MP3/M4A)
  │  + metadonnees obligatoires
  ▼
Backend
  │
  ├─> Validation format & taille
  ├─> Chiffrement AES 256
  ├─> Upload vers Cloudflare R2 (bucket prive, compatible S3)
  ├─> Indexation metadonnees dans Supabase
  └─> Indexation recherche dans Meilisearch
```

### 6.2 Flux de consultation (utilisateur)

```
Client App
  │
  │  GET /api/content/:id/access
  ▼
Backend
  │
  ├─> Verifier JWT
  ├─> Verifier abonnement actif
  ├─> Generer URL signee R2 (TTL: 15 min, API compatible S3)
  └─> Retourner URL temporaire au client
          │
          ▼
     Client lit/ecoute via URL signee
     (URL expire apres 15 min, renouvelable)
```

### 6.3 Formats supportes

| Type | Formats | Taille max recommandee |
|------|---------|----------------------|
| Ebook | EPUB, PDF | 50 Mo |
| Audio | MP3, M4A | 500 Mo |
| Couverture | JPG, PNG, WebP | 2 Mo |

### 6.4 Metadonnees obligatoires

- Titre
- Auteur(s)
- Langue
- Type (ebook / audio)
- Categorie(s)
- Description
- Image de couverture
- Ayant droit / editeur

---

## 7. Lecteur ebook

### 7.1 Architecture

| Plateforme | Librairie recommandee | Formats |
|------------|----------------------|---------|
| Web (React.js) | **epub.js** + **pdf.js** | EPUB, PDF |
| Mobile (React Native) | **react-native-readium** ou **epub.js via WebView** | EPUB, PDF |

### 7.2 Fonctionnalites

| Fonctionnalite | Implementation |
|----------------|---------------|
| Lecture EPUB | Rendu via epub.js (web) / Readium (mobile) |
| Lecture PDF | Rendu via pdf.js (web) / WebView (mobile) |
| Marque-pages | Sauvegarde position (chapitre + offset) en base via API |
| Surlignage | Sauvegarde selection (range + texte + couleur) en base via API |
| Mode nuit | Inversion CSS (fond sombre, texte clair) |
| Taille police | Variable CSS (12px - 28px, 5 paliers) |
| Reprise auto | Position sauvegardee cote serveur, chargee a l'ouverture |

### 7.3 Protection du contenu (ebook)

- Le fichier EPUB/PDF est charge via URL signee temporaire (15 min)
- Le contenu est rendu dans un composant ferme (pas d'acces au DOM source pour le PDF)
- Desactivation du clic droit et de la selection longue (web)
- Pas de bouton "telecharger" ni "imprimer"
- **Niveau de protection : best-effort** — un utilisateur techniquement avance pourrait contourner, mais l'utilisateur moyen ne peut pas extraire le fichier brut

---

## 8. Lecteur audio

### 8.1 Architecture

```
Client App
  │
  │  Demande lecture audio
  ▼
Backend
  │
  ├─> Verifier JWT + abonnement
  ├─> Generer URL signee R2 via Cloudflare CDN (TTL: 60 min)
  └─> Retourner URL + metadonnees audio
          │
          ▼
Client (lecteur audio integre)
  │
  ├─> Streaming HTTP progressif via CDN
  ├─> Buffering adaptatif (pre-charge 30s)
  └─> Position sauvegardee periodiquement (toutes les 30s)
```

### 8.2 Fonctionnalites

| Fonctionnalite | Implementation |
|----------------|---------------|
| Streaming | HTTP progressive download via CDN |
| Pause / reprise | Controle natif du lecteur |
| Vitesse | 0.5x, 1x, 1.25x, 1.5x, 2x (Web Audio API / React Native) |
| Reprise auto | Position sauvegardee serveur (toutes les 30s) |
| Playlist | Liste ordonnee de content IDs, sauvegardee en base |

### 8.3 Gestion reseau faible

| Strategie | Detail |
|-----------|--------|
| Pre-buffering | 30 secondes d'avance minimum |
| Reprise sur coupure | Reconnexion automatique, reprise a la position du buffer |
| Indicateur reseau | Affichage de l'etat de connexion dans le lecteur |
| Qualite adaptative | Audio pre-encode en qualite unique (128 kbps MP3 par defaut) |

---

## 9. Mode hors-ligne controle

### 9.1 Architecture

```
┌─────────────────────────────────────────────────┐
│              Mobile App (React Native)          │
│                                                 │
│  ┌─────────────────┐    ┌────────────────────┐ │
│  │ Offline Manager │    │ Encrypted Storage  │ │
│  │                 │    │ (AES 256)          │ │
│  │ - Download queue│───>│                    │ │
│  │ - TTL tracker   │    │ - Ebooks chiffres  │ │
│  │ - Sync engine   │    │ - Audio chiffres   │ │
│  │ - Purge engine  │    │ - Metadonnees      │ │
│  └────────┬────────┘    └────────────────────┘ │
│           │                                     │
└───────────┼─────────────────────────────────────┘
            │  Retour en ligne
            ▼
┌──────────────────────────┐
│  Backend                 │
│  - Verifier abonnement   │
│  - Sync position lecture │
│  - Purge si expire       │
└──────────────────────────┘
```

### 9.2 Regles techniques

| Regle | Specification |
|-------|--------------|
| Chiffrement | AES 256 — cle derivee du token utilisateur |
| TTL par defaut | 72 heures apres telechargement |
| Max contenus simultanes | 5 (configurable cote serveur) |
| Verification au retour | Obligatoire — check abonnement via API |
| Purge si expire | Automatique et immediate — suppression des fichiers chiffres locaux |
| Plateformes | Mobile (React Native) principalement. Web : cache service worker limite |
| Taille stockage | Alerte si > 500 Mo utilises localement |

### 9.3 Flux de telechargement hors-ligne

```
1. Utilisateur clique "Telecharger" sur un contenu
2. App verifie : abonnement actif + quota non atteint
3. Fichier telecharge depuis CDN
4. Fichier chiffre localement (AES 256)
5. Metadonnees stockees localement (SQLite / AsyncStorage)
6. Timer TTL demarre (72h)
7. Contenu accessible hors-ligne via lecteur integre
8. A expiration TTL OU retour en ligne sans abonnement → purge
```

### 9.4 Web (mode cache limite)

- Service Worker pour mise en cache des pages et assets statiques
- Pas de telechargement de contenus complets sur web
- Si hors-ligne sur web : message "Connexion requise pour acceder aux contenus"

---

## 10. Recherche

### 10.1 Architecture

```
Backend (Express.js)
  │
  │  A chaque CRUD contenu (creation, modification, suppression)
  ▼
Meilisearch (ou Elasticsearch)
  │
  │  Index "contents"
  │  - titre, auteur, description, mots-cles
  │  - categorie, langue, type
  │  - boosts: popularite, nouveaute
  ▼
Client (requete recherche)
  │
  │  GET /api/search?q=terme&filters=...
  ▼
Backend
  │
  ├─> Forward vers Meilisearch
  ├─> Filtrer par droits d'acces (abonne uniquement)
  └─> Retourner resultats pagines
```

### 10.2 Specifications

| Element | Detail |
|---------|--------|
| Moteur | Meilisearch (recommande pour simplicite) ou Elasticsearch |
| Tolerance fautes | Activee (typo-tolerance native Meilisearch) |
| Recherche partielle | Activee (prefixe) |
| Filtres combinables | Categorie, langue, type (ebook/audio) |
| Tri | Pertinence (defaut), nouveaute, popularite |
| Pagination | 20 resultats par page |
| Temps de reponse cible | < 100 ms |

---

## 11. Notifications push

### 11.1 Architecture

```
Backend (Express.js)
  │
  │  Evenement declencheur (nouveau contenu, expiration, etc.)
  ▼
Notification Service
  │
  ├─> Verifier consentement utilisateur
  ├─> Construire payload notification
  └─> Envoyer via Firebase Admin SDK
          │
          ▼
     Firebase Cloud Messaging (FCM)
          │
          ├─> Android (natif)
          ├─> iOS (APNs via FCM)
          └─> Web (si navigateur compatible)
```

### 11.2 Types de notifications

| Type | Declencheur | Priorite |
|------|------------|----------|
| Nouveau contenu | Upload admin valide | Normale |
| Reprise lecture | Inactivite > 3 jours | Faible |
| Expiration abonnement | J-7 et J-1 avant expiration | Haute |
| Paiement echoue | Webhook echec | Haute |
| Maintenance | Action admin manuelle | Haute |

### 11.3 Gestion du consentement

- Token FCM enregistre a l'inscription (si consentement donne)
- Preferences de notification stockees en base (par type)
- L'utilisateur peut modifier ses preferences depuis le profil

---

## 12. Analytics

### 12.1 Integration Google Analytics

| Plateforme | Methode |
|------------|---------|
| Web (React.js) | **gtag.js** ou **react-ga4** |
| Mobile (React Native) | **@react-native-firebase/analytics** |

### 12.2 Events suivis

| Event | Description |
|-------|------------|
| `sign_up` | Inscription |
| `login` | Connexion |
| `subscribe` | Souscription abonnement |
| `cancel_subscription` | Annulation |
| `view_content` | Consultation page detail contenu |
| `start_reading` | Debut lecture ebook |
| `start_listening` | Debut ecoute audio |
| `complete_reading` | Fin lecture ebook |
| `complete_listening` | Fin ecoute audio |
| `search` | Recherche effectuee |
| `download_offline` | Telechargement hors-ligne |
| `onboarding_complete` | Onboarding termine |
| `onboarding_skip` | Onboarding passe |

### 12.3 Consentement

- Banniere de consentement affichee au premier lancement
- Tracking desactive si refus
- Conforme RGPD / reglementations locales

---

## 13. Emailing transactionnel

### 13.1 Architecture

```
Backend (Express.js)
  │
  │  Evenement declencheur
  ▼
Email Service
  │
  ├─> Selectionner template
  ├─> Injecter variables (nom, contenu, lien)
  └─> Envoyer via API Brevo / Mailchimp
```

### 13.2 Templates

| Email | Declencheur | Variables |
|-------|------------|-----------|
| Bienvenue | Inscription | {nom} |
| Confirmation paiement | Webhook succes | {nom}, {plan}, {montant}, {date} |
| Expiration imminente | J-7 avant expiration | {nom}, {date_expiration} |
| Paiement echoue | Webhook echec | {nom}, {lien_mise_a_jour} |
| Reset mot de passe | Demande utilisateur | {nom}, {lien_reset} (TTL 1h) |

---

## 14. Back-office (AdminJS)

### 14.1 Architecture

```
AdminJS (interface)
  │
  │  Integre directement dans le backend Express.js
  │  Route: /admin
  ▼
Backend Express.js
  │
  ├─> CRUD utilisateurs
  ├─> CRUD abonnements
  ├─> CRUD contenus (+ upload S3)
  ├─> CRUD licences / ayants droit
  ├─> Dashboard statistiques
  └─> Envoi notifications manuelles
```

### 14.2 Securite back-office

- Acces restreint aux comptes avec role `admin`
- Authentification separee (ou JWT avec role verifie)
- Toutes les actions sont loguees (audit trail)

---

## 15. Stockage & CDN

### 15.1 Architecture Cloudflare R2

Cloudflare R2 est un stockage objet **100% compatible S3** (meme API, memes SDKs). Le choix de R2 est motive par les couts d'exploitation reduits (0 frais d'egress) et l'integration native avec le CDN Cloudflare.

| Bucket | Contenu | Acces |
|--------|---------|-------|
| `biblio-content-private` | Fichiers chiffres (EPUB, PDF, MP3, M4A) | Prive — URLs signees uniquement |
| `biblio-covers-public` | Images de couverture (JPG, PNG, WebP) | Public via Cloudflare CDN |
| `biblio-backups` | Sauvegardes base de donnees | Prive — acces admin uniquement |

### 15.2 CDN

| Element | Specification |
|---------|--------------|
| Service | **Cloudflare CDN** (natif, integre avec R2) |
| Cache contenus media | TTL 24h (invalidation via Cloudflare API si mise a jour) |
| Cache couvertures | TTL 7 jours |
| Regions | **Edge locations mondiales** (Cloudflare dispose de points de presence en Afrique) |
| Protocole | HTTPS uniquement |
| Avantage cout | 0 frais d'egress (transfert sortant gratuit) |

### 15.3 URLs signees

- Generees cote backend via API compatible S3 (aws-sdk ou @aws-sdk/client-s3 avec endpoint R2)
- TTL : 15 minutes (ebook) / 60 minutes (audio)
- Liees a l'IP du client (optionnel, configurable)
- Non reutilisables apres expiration

### 15.4 Configuration backend (compatibilite S3)

Le backend utilise le SDK AWS S3 standard avec un endpoint personnalise pointant vers R2 :
```
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_CONTENT=biblio-content-private
R2_BUCKET_COVERS=biblio-covers-public
CLOUDFLARE_CDN_DOMAIN=cdn.bibliotheque.app
```

---

## 16. Strategie reseau faible

Contrainte majeure : 2/3 des personas (Awa, Mariame) operent sur reseau 3G/4G instable.

### 16.1 Optimisations par couche

| Couche | Strategie |
|--------|-----------|
| **Frontend (assets)** | Compression gzip/brotli, minification JS/CSS, lazy loading images, format WebP pour couvertures |
| **API** | Pagination obligatoire (20 items/page), reponses compressees, cache HTTP headers (ETag, Cache-Control) |
| **Images** | Thumbnails basse resolution pour le catalogue, chargement HD a la demande |
| **Audio** | Pre-buffering 30s, reprise automatique sur coupure, qualite unique 128 kbps |
| **Ebook** | Chargement chapitre par chapitre (pas le fichier complet d'un coup) |
| **Mobile** | Mode hors-ligne controle, cache local agressif, file d'attente pour les requetes echouees (retry) |

### 16.2 Indicateurs reseau dans l'app

- Detection du type de connexion (Wi-Fi, 4G, 3G, offline)
- Affichage d'un indicateur dans le lecteur audio/ebook
- Suggestion de telechargement hors-ligne si connexion faible detectee
- Desactivation auto du chargement HD si connexion < 3G

---

## 17. Structure du projet (repertoires)

```
/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (env, db, s3, firebase, etc.)
│   │   ├── middleware/       # Auth JWT, subscription check, error handler
│   │   ├── routes/           # Routes Express par domaine
│   │   ├── services/         # Logique metier (auth, payment, catalog, etc.)
│   │   ├── models/           # Modeles Supabase / ORM
│   │   ├── utils/            # Helpers (encryption, url-signer, etc.)
│   │   ├── webhooks/         # Handlers Stripe + Flutterwave
│   │   ├── admin/            # Configuration AdminJS
│   │   └── index.js          # Point d'entree Express
│   ├── package.json
│   └── .env
│
├── web/
│   ├── src/
│   │   ├── components/       # Composants React reutilisables
│   │   ├── pages/            # Pages (accueil, catalogue, lecteur, profil, etc.)
│   │   ├── hooks/            # Hooks custom (auth, subscription, etc.)
│   │   ├── services/         # Appels API
│   │   ├── store/            # State management
│   │   ├── readers/          # Lecteur ebook (epub.js, pdf.js) + audio
│   │   └── App.js
│   ├── public/
│   └── package.json
│
├── mobile/
│   ├── src/
│   │   ├── components/       # Composants React Native
│   │   ├── screens/          # Ecrans (accueil, catalogue, lecteur, profil, etc.)
│   │   ├── hooks/            # Hooks custom
│   │   ├── services/         # Appels API + offline manager
│   │   ├── store/            # State management
│   │   ├── readers/          # Lecteur ebook + audio (natif)
│   │   ├── offline/          # Gestion hors-ligne (download, encrypt, sync, purge)
│   │   └── App.js
│   ├── android/
│   ├── ios/
│   └── package.json
│
└── docs/
    ├── architecture.md
    ├── db_schema.md
    ├── api_spec.md
    └── personas.md
```

---

## 18. Choix structurants (decisions non negociables)

| Decision | Justification |
|----------|--------------|
| API REST (pas GraphQL) | Impose par contrat, simplicite, compatibilite AdminJS |
| Supabase (pas Firebase DB) | Impose par contrat — PostgreSQL manage avec auth integree |
| Cloudflare R2 (pas Supabase Storage) | Decision client — compatible S3, 0 frais d'egress, CDN Cloudflare natif |
| JWT (pas sessions) | Stateless, scalable, compatible multi-plateforme |
| AES 256 pour fichiers | Standard securite pour chiffrement au repos et hors-ligne |
| URLs signees (pas acces direct S3) | Protection des contenus, TTL configurable |
| Meilisearch (recommande sur Elasticsearch) | Plus simple a deployer, tolerance fautes native, performant pour ce volume |
| Audio pre-encode (pas de transcoding) | Simplicite, cout reduit, performance reseau faible |
| AdminJS (pas custom admin) | Impose par contrat, rapide a mettre en place, extensible |

---

## 19. Environnements

| Environnement | Usage | Base de donnees |
|---------------|-------|----------------|
| **Development** | Dev local | Supabase local ou instance dev |
| **Staging** | Tests pre-production | Supabase instance staging |
| **Production** | Environnement live | Supabase instance production |

### Variables d'environnement critiques

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Cloudflare R2 (compatible S3)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_CONTENT=
R2_BUCKET_COVERS=
CLOUDFLARE_CDN_DOMAIN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Flutterwave
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_HASH=

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=

# Email (Brevo)
BREVO_API_KEY=

# Meilisearch
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

# App
NODE_ENV=
PORT=
CORS_ORIGIN=
```
