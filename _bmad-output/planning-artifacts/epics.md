---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/prd.md
  - _bmad-output/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Bibliotheque Numerique Privee - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Bibliotheque Numerique Privee, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Onboarding (PRD 5)**

FR1: Afficher un onboarding de 3 ecrans au premier lancement apres inscription (valeur → fonctionnement → CTA premiere lecture)
FR2: Permettre a l'utilisateur de passer (skip) l'onboarding
FR3: L'onboarding ne bloque pas l'acces au catalogue
FR4: L'onboarding ne reapparait pas apres le premier lancement

**Authentification & Comptes (PRD 6.1)**

FR5: Inscription par email + mot de passe
FR6: Connexion securisee (JWT + HTTPS)
FR7: Deconnexion
FR8: Reinitialisation du mot de passe (token temporaire par email, TTL 1h)
FR9: Consultation et modification du profil utilisateur
FR10: Historique de lecture / ecoute accessible depuis le profil
FR11: Un email = un compte (unicite)

**Abonnements & Acces (PRD 6.2)**

FR12: Souscription a un abonnement mensuel (5 EUR/mois) ou annuel (50 EUR/an)
FR13: Renouvellement automatique de l'abonnement
FR14: Annulation de l'abonnement (acces reste actif jusqu'a fin de periode)
FR15: Verification du statut d'abonnement en temps reel
FR16: Historique des paiements consultable
FR17: Changement de plan possible (mensuel <-> annuel)
FR18: Sans abonnement actif → aucun acces au contenu
FR19: Abonnement expire → acces coupe immediatement (y compris contenus hors-ligne)
FR20: Un seul abonnement actif par utilisateur
FR21: Pas d'essai gratuit

**Paiements (PRD 6.3)**

FR22: Paiement via Stripe (international)
FR23: Paiement via Flutterwave (Afrique / diaspora)
FR24: Les deux passerelles operationnelles simultanement
FR25: Paiement initial d'abonnement
FR26: Renouvellement automatique via passerelles
FR27: Webhooks de confirmation (source de verite pour statut abonnement)
FR28: Conversion de devises automatique (affichage EUR, paiement local)

**Catalogue de Contenus (PRD 6.4)**

FR29: Liste des contenus avec pagination
FR30: Page detail d'un contenu (metadonnees, couverture, actions)
FR31: Categorisation et navigation par categories
FR32: Metadonnees obligatoires : titre, auteur, langue, type, categorie, couverture
FR33: Contenu visible uniquement pour abonnes (apercu limite pour visiteurs)
FR34: Un contenu peut appartenir a plusieurs categories
FR35: Formats acceptes : EPUB, PDF, MP3, M4A
FR36: Sources de contenu : plateformes partenaires, contenus libres, upload manuel

**Recherche & Filtres (PRD 6.5)**

FR37: Recherche par titre, auteur, mots-cles
FR38: Filtres par categorie, langue, type de contenu (ebook / audio)
FR39: Filtres avances combinables
FR40: Resultats tries par pertinence
FR41: Recherche avec termes partiels et tolerance aux fautes
FR42: Resultats accessibles uniquement aux abonnes

**Page d'Accueil & Recommandations (PRD 6.6)**

FR43: Section "Continuer la lecture / l'ecoute" (reprise) en position #1
FR44: Section "Nouveautes"
FR45: Section "Populaires"
FR46: Section "Recommandations" (basees sur categories consultees)
FR47: Page d'accueil personnalisee pour chaque abonne
FR48: Visiteurs voient une version generique (decouverte)
FR49: Recommandations basees sur regles simples (categories, popularite, nouveaute) — pas d'IA avancee

**Lecteur Ebook (PRD 6.7)**

FR50: Lecture EPUB integree (epub.js web, react-native-readium ou epub.js WebView mobile)
FR51: Lecture PDF integree (pdf.js web, WebView mobile)
FR52: Marque-pages (sauvegarde position chapitre + offset en base)
FR53: Surlignage de texte (selection + couleur, sauvegarde en base)
FR54: Mode nuit (fond sombre, texte clair)
FR55: Taille de police ajustable (14px - 24px, 5 paliers)
FR56: Reprise automatique de lecture (position sauvegardee cote serveur)
FR57: Lecture uniquement dans l'application (web et mobile)
FR58: Aucun telechargement du fichier brut (desactivation clic droit, selection longue)
FR59: Acces verifie a chaque session
FR60: Marque-pages et surlignages synchronises entre devices

**Lecteur Audio (PRD 6.8)**

FR61: Lecture audio en streaming HTTP progressif via CDN
FR62: Pause / reprise
FR63: Vitesse de lecture ajustable (0.5x, 1x, 1.25x, 1.5x, 2x)
FR64: Reprise automatique (position sauvegardee cote serveur, toutes les 30s)
FR65: Playlist personnelle (liste ordonnee, sauvegardee en base)
FR66: Streaming uniquement (sauf mode hors-ligne controle)
FR67: Gestion reseau faible (pre-buffering 30s, reprise auto sur coupure, indicateur reseau)
FR68: Audio en arriere-plan (ecran eteint, app en fond) — non negociable
FR69: Controles depuis la notification systeme (play/pause/skip)

**Mode Hors-ligne Controle (PRD 6.9)**

FR70: Telechargement de contenus pour lecture/ecoute hors-ligne (mobile principalement)
FR71: Chiffrement local des fichiers telecharges (AES 256, cle derivee du token utilisateur)
FR72: Synchronisation automatique au retour en ligne (positions de lecture)
FR73: Purge automatique des contenus expires
FR74: Duree d'acces hors-ligne limitee (configurable, defaut 72 heures)
FR75: Verification obligatoire de l'abonnement au retour en ligne
FR76: Si abonnement expire au retour en ligne → purge immediate contenus locaux
FR77: Aucun acces au fichier brut (contenu chiffre, lisible uniquement via l'app)
FR78: Max contenus telechargeables simultanement (configurable, defaut 5)
FR79: Alerte si stockage local > 500 Mo
FR80: Web : mode cache limite (service worker pour assets statiques, pas de telechargement contenus)

**Notifications Push (PRD 6.10)**

FR81: Notifications de nouveaux contenus
FR82: Rappels de reprise de lecture / ecoute (inactivite > 3 jours)
FR83: Notifications d'expiration d'abonnement (J-7 et J-1)
FR84: Notifications de paiement echoue
FR85: Notifications administratives (maintenance, nouveautes)
FR86: Notifications uniquement avec consentement utilisateur
FR87: Utilisateur peut activer/desactiver les notifications depuis son profil (par type)
FR88: Notifications en francais
FR89: Token FCM enregistre a l'inscription (si consentement)

**Analytics & Suivi (PRD 6.11)**

FR90: Tracking des events : sign_up, login, subscribe, cancel_subscription, view_content, start_reading, start_listening, complete_reading, complete_listening, search, download_offline, onboarding_complete, onboarding_skip
FR91: Metriques : inscriptions, taux conversion, retention (J7/J30/J90), temps moyen lecture/ecoute, contenus populaires, churn, MRR
FR92: Tracking respecte le consentement utilisateur (RGPD, banniere de consentement)
FR93: Donnees anonymisees pour rapports agreges
FR94: Statistiques accessibles dans le back-office

**Emailing Transactionnel (PRD 6.12)**

FR95: Email de bienvenue (inscription)
FR96: Email de confirmation de paiement
FR97: Email de rappel d'expiration d'abonnement (J-7)
FR98: Email de paiement echoue
FR99: Email de reinitialisation de mot de passe (lien TTL 1h)
FR100: Emails transactionnels envoyes automatiquement dans les 2 minutes
FR101: Desabonnement emails marketing possible (pas transactionnels)
FR102: Emails en francais

**Back-office Administrateur (PRD 6.13)**

FR103: Gestion utilisateurs : liste, recherche, detail, activation/desactivation, historique activite
FR104: Gestion abonnements : liste actifs/expires, activation/prolongation/annulation manuelles
FR105: Gestion catalogue : ajout/modification/suppression contenus, upload fichiers (EPUB, PDF, MP3, M4A)
FR106: Gestion metadonnees et categories
FR107: Gestion licences et ayants droit : enregistrement editeurs/auteurs, association contenu <-> ayant droit, suivi droits de diffusion
FR108: Statistiques : lectures, ecoutes, abonnes actifs, revenus (MRR, total), retention (J7/J30/J90)
FR109: Actions admin securisees (authentification obligatoire, role admin)
FR110: Audit trail de toutes les actions admin
FR111: Envoi notifications manuelles depuis back-office

**Securite & DRM (PRD 7)**

FR112: Fichiers chiffres AES 256 au stockage (R2) et hors-ligne
FR113: URLs temporaires signees (TTL 15 min ebook, 60 min audio)
FR114: DRM leger best-effort : lecture in-app only, pas de telechargement brut, pas de watermarking
FR115: Protection donnees personnelles conformement reglementations applicables

### NonFunctional Requirements

**Performance (PRD 8.1)**

NFR1: Temps de chargement pages < 3 secondes
NFR2: Lecture audio sans coupure sur connexion moyenne
NFR3: Recherche < 1 seconde (cible < 100ms Meilisearch)
NFR4: Reprise lecture < 3s online, < 2s hors-ligne

**Securite (PRD 8.2)**

NFR5: HTTPS obligatoire sur toutes communications
NFR6: JWT securise (RS256, access 15min, refresh 7j)
NFR7: Fichiers chiffres AES 256
NFR8: URLs temporaires signees
NFR9: Mots de passe hashes bcrypt (cost factor 12)

**Scalabilite (PRD 8.3)**

NFR10: Architecture API-first (REST), stateless backend
NFR11: Stockage objet compatible S3 (Cloudflare R2, 0 frais d'egress)
NFR12: CDN obligatoire pour contenus media (Cloudflare CDN natif, edge Afrique)
NFR13: Base de donnees Supabase (PostgreSQL manage)

**Compatibilite (PRD 8.4)**

NFR14: Web : navigateurs modernes (Chrome, Firefox, Safari, Edge)
NFR15: Mobile : Android 8+ et iOS 14+

**Reseau Faible (PRD 8.5)**

NFR16: Compression des assets (gzip/brotli, minification JS/CSS)
NFR17: Lazy loading des images et contenus
NFR18: Cache agressif (ETag, Cache-Control)
NFR19: Fallback gracieux en cas de perte de connexion
NFR20: Thumbnails basse resolution pour catalogue, HD a la demande
NFR21: Audio pre-encode qualite unique 128 kbps MP3
NFR22: Detection type connexion (WiFi, 4G, 3G, offline) + indicateur

### Additional Requirements

**From Architecture:**

- AR1: Structure projet 3 repertoires : backend/ + web/ + mobile/ (pas de starter template mentionne)
- AR2: Middleware chaine obligatoire : Request → HTTPS → JWT Verify → Subscription Check → Route Handler
- AR3: Stockage JWT : HttpOnly cookie (access web), localStorage (refresh web), Secure storage Keychain/Keystore (mobile)
- AR4: Refresh token renouvellement automatique avant expiration
- AR5: Systeme d'abonnement 4 etats : INACTIVE → ACTIVE → EXPIRED, avec CANCELLED (fin de periode)
- AR6: Payment Router backend pour routage Stripe/Flutterwave selon zone
- AR7: Verification signature webhooks (Stripe Webhook Secret / Flutterwave verify)
- AR8: Idempotence webhooks : chaque event traite une seule fois (stockage event ID)
- AR9: Upload back-office : validation format/taille → chiffrement AES 256 → upload R2 → indexation Supabase → indexation Meilisearch
- AR10: Contenus servis via URLs signees R2 (compatibilite API S3, aws-sdk avec endpoint R2)
- AR11: Lecteur ebook : epub.js + pdf.js (web), react-native-readium ou epub.js WebView (mobile)
- AR12: Ebook charge chapitre par chapitre (pas le fichier complet)
- AR13: Audio : streaming HTTP progressif via CDN, pre-buffering 30s, position sauvegardee toutes les 30s
- AR14: Hors-ligne : cle AES derivee du token utilisateur, stockage metadonnees SQLite/AsyncStorage
- AR15: Meilisearch : index "contents" (titre, auteur, description, mots-cles, categorie, langue, type), boosts (popularite, nouveaute)
- AR16: Notifications FCM : token enregistre a inscription, preferences par type en base, Firebase Admin SDK
- AR17: Google Analytics : gtag.js/react-ga4 (web), @react-native-firebase/analytics (mobile)
- AR18: Emailing : templates variables, envoi via API Brevo/Mailchimp
- AR19: AdminJS integre dans Express.js, route /admin, role admin requis
- AR20: 3 buckets R2 : biblio-content-private (prive), biblio-covers-public (public CDN), biblio-backups (prive admin)
- AR21: CDN Cloudflare : cache contenus 24h, couvertures 7j, invalidation via API
- AR22: Service Worker web pour cache pages et assets statiques
- AR23: 3 environnements : development, staging, production
- AR24: Variables d'environnement critiques : Supabase, R2, Stripe, Flutterwave, Firebase, Brevo, Meilisearch, JWT, App

**From UX Design:**

- UX1: "Reprendre" en position absolue #1 sur l'accueil — avant nouveautes, recommandations, populaires
- UX2: Design system MUI v5+ (web) + React Native Paper (mobile) + tokens JSON partages
- UX3: Palette : Primary Terre d'Afrique #B5651D, Secondary Or du Sahel #D4A017, Accent Indigo Adire #2E4057, Background clair #FBF7F2, Background sombre #1A1A1A
- UX4: Typographie : Playfair Display (titres H1-H3) + Inter (corps/UI), base 16px, ratio 1.25
- UX5: Espacement base 8px (xs:4, sm:8, md:16, lg:24, xl:32, 2xl:48), zones tactiles 48px min
- UX6: Breakpoints mobile-first : xs 320px, sm 375px, md 768px, lg 1024px, xl 1440px
- UX7: 7 composants custom a construire : Mini-player audio (64px sticky), Lecteur ebook (plein ecran), Lecteur audio plein ecran, Card contenu+progression (3 variants), Indicateur hors-ligne (badge 24px), Onboarding carousel, Barre recherche+filtres
- UX8: Skeleton loading obligatoire partout (jamais de page blanche)
- UX9: Feedback emotionnel > technique ("Pret pour ton prochain trajet" au lieu de "Telechargement termine")
- UX10: Mode nuit avec palette sombre dediee (pas un simple inverse), toggle profil + toggle independant lecteur
- UX11: WCAG AA : contraste 4.5:1, zones tactiles 48px, screen reader labels (accessibilityLabel RN, ARIA web), navigation clavier web, skip links, prefers-reduced-motion
- UX12: Tab bar mobile 5 items fixes : Accueil, Catalogue, Recherche, Hors-ligne, Profil
- UX13: Mini-player audio sticky au-dessus tab bar, visible sur toutes pages, tap pour plein ecran
- UX14: Landing page narrative pour conversion sans essai gratuit (catalogue visible mais verrouille)
- UX15: Audio continue ecran eteint + controles notification systeme + pause/reprise auto sur appel telephonique
- UX16: Formes : boutons pill 24px, cards 12px, inputs 8px, couvertures ratio 2:3
- UX17: Direction visuelle A+B fusion (Chaleureuse + Epuree) : fond creme chaud + densite minimale + salutation personnalisee
- UX18: Etats vides illustres avec CTA (jamais de page vide)
- UX19: Transitions : slide horizontale (tabs), slide verticale (modales/bottom sheets), fade (overlays)
- UX20: Grille : mobile 4 col / tablet 8 col / desktop 12 col, max-width 1200px

### FR Coverage Map

FR1: Epic 1 — Onboarding ecran 1 (valeur)
FR2: Epic 1 — Onboarding skip
FR3: Epic 1 — Onboarding ne bloque pas catalogue
FR4: Epic 1 — Onboarding une seule fois
FR5: Epic 1 — Inscription email + mot de passe
FR6: Epic 1 — Connexion JWT + HTTPS
FR7: Epic 1 — Deconnexion
FR8: Epic 1 — Reinitialisation mot de passe
FR9: Epic 1 — Consultation/modification profil
FR10: Epic 1 — Historique lecture/ecoute
FR11: Epic 1 — Un email = un compte
FR12: Epic 2 — Souscription mensuel/annuel
FR13: Epic 2 — Renouvellement automatique
FR14: Epic 2 — Annulation abonnement
FR15: Epic 2 — Verification statut temps reel
FR16: Epic 2 — Historique paiements
FR17: Epic 2 — Changement de plan
FR18: Epic 2 — Sans abonnement = pas d'acces
FR19: Epic 2 — Expire = acces coupe
FR20: Epic 2 — Un seul abonnement actif
FR21: Epic 2 — Pas d'essai gratuit
FR22: Epic 2 — Paiement Stripe
FR23: Epic 2 — Paiement Flutterwave
FR24: Epic 2 — Deux passerelles simultanees
FR25: Epic 2 — Paiement initial
FR26: Epic 2 — Renouvellement auto passerelles
FR27: Epic 2 — Webhooks source de verite
FR28: Epic 2 — Conversion devises
FR29: Epic 3 — Liste contenus avec pagination
FR30: Epic 3 — Page detail contenu
FR31: Epic 3 — Categorisation et navigation
FR32: Epic 3 — Metadonnees obligatoires
FR33: Epic 3 — Apercu limite visiteurs
FR34: Epic 3 — Contenu multi-categories
FR35: Epic 3 — Formats EPUB/PDF/MP3/M4A
FR36: Epic 3 — Sources de contenu
FR37: Epic 3 — Recherche titre/auteur/mots-cles
FR38: Epic 3 — Filtres categorie/langue/type
FR39: Epic 3 — Filtres combinables
FR40: Epic 3 — Tri par pertinence
FR41: Epic 3 — Tolerance fautes et termes partiels
FR42: Epic 3 — Resultats abonnes uniquement
FR43: Epic 6 — Section "Reprendre" position #1
FR44: Epic 6 — Section "Nouveautes"
FR45: Epic 6 — Section "Populaires"
FR46: Epic 6 — Section "Recommandations"
FR47: Epic 6 — Accueil personnalise abonne
FR48: Epic 6 — Version generique visiteurs
FR49: Epic 6 — Recommandations regles simples
FR50: Epic 4 — Lecture EPUB integree
FR51: Epic 4 — Lecture PDF integree
FR52: Epic 4 — Marque-pages
FR53: Epic 4 — Surlignage texte
FR54: Epic 4 — Mode nuit
FR55: Epic 4 — Taille police ajustable
FR56: Epic 4 — Reprise automatique lecture
FR57: Epic 4 — Lecture in-app uniquement
FR58: Epic 4 — Pas de telechargement fichier brut
FR59: Epic 4 — Acces verifie chaque session
FR60: Epic 4 — Synchro marque-pages/surlignages cross-device
FR61: Epic 5 — Streaming HTTP progressif CDN
FR62: Epic 5 — Pause/reprise
FR63: Epic 5 — Vitesse ajustable (0.5x-2x)
FR64: Epic 5 — Reprise automatique (position 30s)
FR65: Epic 5 — Playlist personnelle
FR66: Epic 5 — Streaming uniquement (sauf offline)
FR67: Epic 5 — Gestion reseau faible
FR68: Epic 5 — Audio arriere-plan (non negociable)
FR69: Epic 5 — Controles notification systeme
FR70: Epic 7 — Telechargement hors-ligne mobile
FR71: Epic 7 — Chiffrement local AES 256
FR72: Epic 7 — Synchro automatique retour en ligne
FR73: Epic 7 — Purge automatique contenus expires
FR74: Epic 7 — TTL configurable (defaut 72h)
FR75: Epic 7 — Verification abonnement retour en ligne
FR76: Epic 7 — Purge immediate si abonnement expire
FR77: Epic 7 — Aucun acces fichier brut offline
FR78: Epic 7 — Max 5 contenus (configurable)
FR79: Epic 7 — Alerte stockage > 500 Mo
FR80: Epic 7 — Web cache limite (Service Worker)
FR81: Epic 8 — Notifications nouveaux contenus
FR82: Epic 8 — Rappels reprise lecture/ecoute
FR83: Epic 8 — Notifications expiration abonnement
FR84: Epic 8 — Notifications paiement echoue
FR85: Epic 8 — Notifications administratives
FR86: Epic 8 — Consentement notifications
FR87: Epic 8 — Activation/desactivation par type
FR88: Epic 8 — Notifications en francais
FR89: Epic 8 — Token FCM inscription
FR90: Epic 9 — Tracking events Google Analytics
FR91: Epic 9 — Metriques (inscriptions, conversion, retention, MRR)
FR92: Epic 9 — Consentement RGPD
FR93: Epic 9 — Donnees anonymisees
FR94: Epic 9 — Statistiques back-office
FR95: Epic 8 — Email bienvenue
FR96: Epic 8 — Email confirmation paiement
FR97: Epic 8 — Email rappel expiration
FR98: Epic 8 — Email paiement echoue
FR99: Epic 8 — Email reinitialisation mot de passe
FR100: Epic 8 — Emails < 2 minutes
FR101: Epic 8 — Desabonnement marketing
FR102: Epic 8 — Emails en francais
FR103: Epic 10 — Gestion utilisateurs
FR104: Epic 10 — Gestion abonnements
FR105: Epic 10 — Gestion catalogue + upload
FR106: Epic 10 — Gestion metadonnees/categories
FR107: Epic 10 — Gestion licences/ayants droit
FR108: Epic 10 — Statistiques dashboard
FR109: Epic 10 — Actions admin securisees
FR110: Epic 10 — Audit trail
FR111: Epic 10 — Envoi notifications manuelles
FR112: Epic 4, 5, 7, 10 — Fichiers chiffres AES 256 (cross-cutting)
FR113: Epic 3, 4, 5 — URLs signees temporaires (cross-cutting)
FR114: Epic 4, 5 — DRM leger best-effort (cross-cutting)
FR115: Epic 1 + all — Protection donnees personnelles (cross-cutting)

## Epic List

### Epic 1: Authentification, Profil & Onboarding
Les utilisateurs peuvent creer un compte, se connecter, gerer leur profil, consulter leur historique de lecture/ecoute, et decouvrir la plateforme via un onboarding 3 ecrans au premier lancement.
**FRs couverts:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR115
**Notes:** Inclut scaffolding projet (backend/ + web/ + mobile/), design system tokens (MUI + RN Paper + JSON partage), configuration environnements. Prerequis pour tous les epics suivants.

## Epic 1: Authentification, Profil & Onboarding

Les utilisateurs peuvent creer un compte, se connecter, gerer leur profil, consulter leur historique de lecture/ecoute, et decouvrir la plateforme via un onboarding 3 ecrans au premier lancement.

### Story 1.1: Initialisation Projet & Design System

As a developpeur,
I want disposer d'un projet scaffold avec backend Express.js, web React.js, mobile React Native, et design system configure,
So that le developpement puisse demarrer sur des fondations coherentes.

**Acceptance Criteria:**

**Given** un nouveau projet vierge
**When** le scaffolding est execute
**Then** la structure backend/ (Express.js, config Supabase, middleware base), web/ (React.js, MUI theme provider), et mobile/ (React Native, RN Paper theme) est creee
**And** les tokens design system partages sont configures (JSON : couleurs #B5651D/#D4A017/#2E4057, typo Playfair Display + Inter, espacements 8px, formes pill 24px/cards 12px)
**And** la connexion Supabase est fonctionnelle
**And** les variables d'environnement sont structurees (.env)
**And** le serveur Express demarre sans erreur et repond sur /health

### Story 1.2: Inscription Utilisateur

As a visiteur,
I want creer un compte avec mon email et mot de passe,
So that je puisse acceder a la plateforme.

**Acceptance Criteria:**

**Given** un visiteur sur la page d'inscription
**When** il saisit un email valide et un mot de passe (min 8 caracteres)
**Then** un compte est cree, un JWT est retourne, et l'utilisateur est redirige vers l'accueil
**And** le mot de passe est hache bcrypt (cost 12), un email = un compte (unicite)
**And** les erreurs sont explicites (email deja utilise, mot de passe trop court)
**And** les donnees personnelles sont protegees conformement aux reglementations (FR115)

### Story 1.3: Connexion Utilisateur

As a utilisateur inscrit,
I want me connecter avec mon email et mot de passe,
So that je puisse acceder a mon compte et aux contenus.

**Acceptance Criteria:**

**Given** un utilisateur inscrit sur la page de connexion
**When** il saisit ses identifiants corrects
**Then** un JWT access token (15min) + refresh token (7j) sont emis
**And** le stockage est securise : HttpOnly cookie (web), Secure storage (mobile)
**And** le refresh token est renouvele automatiquement avant expiration
**And** les erreurs sont explicites (email inconnu, mot de passe incorrect)

### Story 1.4: Deconnexion

As a utilisateur connecte,
I want me deconnecter,
So that ma session soit terminee de maniere securisee.

**Acceptance Criteria:**

**Given** un utilisateur connecte
**When** il clique sur "Deconnexion"
**Then** le JWT est invalide, les tokens sont supprimes du stockage client
**And** l'utilisateur est redirige vers la page de connexion

### Story 1.5: Reinitialisation du Mot de Passe

As a utilisateur qui a oublie son mot de passe,
I want recevoir un email pour le reinitialiser,
So that je puisse retrouver l'acces a mon compte.

**Acceptance Criteria:**

**Given** un utilisateur sur la page "Mot de passe oublie"
**When** il saisit son email
**Then** un email contenant un lien de reinitialisation est envoye (token TTL 1h)
**And** le lien ouvre un formulaire de nouveau mot de passe
**And** apres reinitialisation, l'utilisateur peut se connecter avec le nouveau mot de passe
**And** le token expire apres utilisation ou apres 1 heure

### Story 1.6: Profil Utilisateur

As a utilisateur connecte,
I want consulter et modifier mes informations de profil,
So that je puisse garder mon compte a jour.

**Acceptance Criteria:**

**Given** un utilisateur connecte sur la page Profil
**When** il consulte son profil
**Then** il voit son email, nom, date d'inscription
**And** il peut modifier son nom et son mot de passe
**And** les modifications sont sauvegardees immediatement
**And** les donnees personnelles sont protegees (FR115)

### Story 1.7: Historique de Lecture & Ecoute

As a utilisateur connecte,
I want consulter mon historique de lecture et d'ecoute,
So that je puisse retrouver les contenus que j'ai consommes.

**Acceptance Criteria:**

**Given** un utilisateur connecte sur la page Profil > Historique
**When** il consulte son historique
**Then** il voit la liste des contenus lus/ecoutes avec titre, type, progression, date
**And** la liste est triee par date de derniere consultation (plus recent en premier)
**And** il peut cliquer sur un contenu pour y acceder directement
**And** l'historique est en lecture seule (pas de suppression/modification par l'utilisateur)

### Story 1.8: Onboarding Premier Lancement

As a nouvel utilisateur,
I want voir un onboarding de 3 ecrans a mon premier lancement,
So that je comprenne la valeur de la plateforme et comment elle fonctionne.

**Acceptance Criteria:**

**Given** un utilisateur qui lance l'app pour la premiere fois apres inscription
**When** l'app s'ouvre
**Then** un carousel de 3 ecrans s'affiche (valeur → fonctionnement → CTA premiere lecture)
**And** l'utilisateur peut naviguer par swipe horizontal + dots + bouton "Suivant"
**And** l'utilisateur peut passer l'onboarding a tout moment via "Passer"
**And** l'onboarding ne reapparait jamais apres le premier lancement
**And** le CTA final redirige vers le catalogue
**And** l'onboarding ne bloque pas l'acces au catalogue
**And** l'etat "onboarding_completed" est persiste cote backend (ou storage securise) pour garantir la coherence cross-device et la non-reapparition meme apres logout/login

## Epic 2: Abonnement & Paiements

Les utilisateurs peuvent souscrire un abonnement mensuel (5 EUR/mois) ou annuel (50 EUR/an), payer via Stripe (international) ou Flutterwave (Afrique/diaspora), gerer leur abonnement (renouvellement, annulation, changement de plan), et consulter leur historique de paiements.

### Story 2.1: Modele Abonnement & Page de Choix

As a utilisateur inscrit,
I want voir les plans d'abonnement disponibles et choisir celui qui me convient,
So that je puisse m'abonner a la plateforme.

**Acceptance Criteria:**

**Given** un utilisateur connecte sans abonnement
**When** il accede a la page Abonnement
**Then** il voit les 2 plans : Mensuel (5 EUR/mois) et Annuel (50 EUR/an) avec leurs avantages
**And** il n'y a pas d'option d'essai gratuit
**And** un seul abonnement actif est possible par utilisateur
**And** la devise affichee est EUR par defaut, avec mention claire de conversion automatique selon la passerelle
**And** le choix du plan mene vers la selection de la passerelle de paiement

*Inclut: table subscriptions avec machine d'etat (INACTIVE → ACTIVE → EXPIRED → CANCELLED).*

### Story 2.2: Integration Paiement Stripe

As a utilisateur (international),
I want payer mon abonnement via Stripe,
So that je puisse acceder au catalogue avec un moyen de paiement international.

**Acceptance Criteria:**

**Given** un utilisateur ayant choisi un plan d'abonnement
**When** il selectionne Stripe comme moyen de paiement
**Then** il est redirige vers le checkout Stripe securise
**And** le montant affiche correspond au plan choisi (5 EUR ou 50 EUR)
**And** la conversion de devises est geree automatiquement par Stripe selon la region
**And** en cas de succes, l'utilisateur est redirige vers la plateforme
**And** en cas d'echec, un message rassurant est affiche avec possibilite de reessayer

### Story 2.3: Integration Paiement Flutterwave

As a utilisateur (Afrique/diaspora),
I want payer mon abonnement via Flutterwave,
So that je puisse m'abonner avec un moyen de paiement adapte a ma region.

**Acceptance Criteria:**

**Given** un utilisateur ayant choisi un plan d'abonnement
**When** il selectionne Flutterwave comme moyen de paiement
**Then** il est redirige vers le checkout Flutterwave
**And** le montant est affiche en EUR avec conversion locale automatique
**And** les deux passerelles (Stripe et Flutterwave) sont operationnelles simultanement
**And** en cas de succes/echec, le comportement est identique a Stripe

### Story 2.4: Webhooks & Activation Abonnement

As a systeme,
I want traiter les webhooks Stripe et Flutterwave de maniere fiable,
So that les abonnements soient actives/desactives en temps reel selon les paiements.

**Acceptance Criteria:**

**Given** un paiement reussi via Stripe ou Flutterwave
**When** le webhook payment_intent.succeeded (Stripe) ou charge.completed (Flutterwave) est recu
**Then** l'abonnement est active (statut ACTIVE) avec la date de fin de periode
**And** la verification de signature du webhook est obligatoire (Stripe Webhook Secret / Flutterwave verify)
**And** chaque webhook est traite une seule fois (idempotence par stockage event ID)
**And** les webhooks = source de verite pour le statut d'abonnement
**And** en cas de webhook echec paiement, l'abonnement n'est pas active

### Story 2.5: Middleware Verification Abonnement

As a systeme,
I want bloquer l'acces au contenu pour les utilisateurs sans abonnement actif,
So that seuls les abonnes accedent au catalogue et aux lecteurs.

**Acceptance Criteria:**

**Given** un utilisateur sans abonnement actif (INACTIVE ou EXPIRED)
**When** il tente d'acceder a une route protegee (catalogue, lecteur, contenu)
**Then** l'acces est refuse avec un message clair l'invitant a s'abonner
**And** la verification suit la chaine middleware : JWT Verify → Subscription Check → Route Handler
**And** les routes publiques (landing, inscription, login) sont exclues de la verification
**And** a l'expiration de l'abonnement, l'acces est coupe immediatement

### Story 2.6: Renouvellement Automatique

As a utilisateur abonne,
I want que mon abonnement se renouvelle automatiquement,
So that je ne perde pas l'acces a mes contenus.

**Acceptance Criteria:**

**Given** un abonnement actif proche de la date d'expiration
**When** le renouvellement automatique est declenche par la passerelle (Stripe/Flutterwave)
**Then** le paiement est traite, le webhook confirme, et la periode est prolongee
**And** le renouvellement est invisible pour l'utilisateur (pas de friction)
**And** en cas d'echec de renouvellement, l'utilisateur est notifie
**And** aucun acces n'est coupe avant la fin de la periode deja payee

### Story 2.7: Annulation & Changement de Plan

As a utilisateur abonne,
I want pouvoir annuler mon abonnement ou changer de plan,
So that je garde le controle sur mon engagement.

**Acceptance Criteria:**

**Given** un utilisateur abonne sur la page Profil > Abonnement
**When** il clique sur "Annuler"
**Then** une confirmation explicite est affichee ("Tu perdras l'acces le JJ/MM")
**And** apres confirmation, l'abonnement passe a CANCELLED mais l'acces reste actif jusqu'a la fin de la periode payee
**Given** un utilisateur abonne
**When** il choisit de changer de plan (mensuel → annuel ou inversement)
**Then** le changement est effectif au prochain renouvellement, sans prorata (V1)

### Story 2.8: Historique des Paiements

As a utilisateur abonne,
I want consulter mon historique de paiements,
So that je puisse verifier mes transactions et suivre mes depenses.

**Acceptance Criteria:**

**Given** un utilisateur connecte sur la page Profil > Historique paiements
**When** il consulte la liste
**Then** il voit chaque paiement avec : date, montant, plan, passerelle utilisee, statut (reussi/echoue)
**And** la liste est triee par date (plus recent en premier)
**And** l'historique est en lecture seule

## Epic 3: Catalogue & Recherche

Les utilisateurs abonnes peuvent parcourir le catalogue par categories, consulter les details des contenus, rechercher par titre/auteur/mots-cles avec filtres combinables. Les visiteurs voient un apercu limite avec landing page narrative pour conversion.

### Story 3.1: Landing Page Visiteurs

As a visiteur non inscrit,
I want decouvrir la plateforme et son catalogue via une landing page narrative,
So that je comprenne la valeur de l'offre et sois incite a m'inscrire.

**Acceptance Criteria:**

**Given** un visiteur non authentifie
**When** il arrive sur la plateforme
**Then** il voit une landing page narrative avec proposition de valeur, apercu du catalogue (couvertures visibles mais contenu verrouille), prix clairs (5 EUR/mois, 50 EUR/an), imagery culturelle africaine premium, et CTA "S'abonner"
**And** il peut parcourir le catalogue en mode apercu (titres, couvertures, categories) sans acces au contenu
**And** les boutons "Lire" / "Ecouter" redirigent vers l'inscription
**And** la landing page est accessible sans authentification, indexable SEO, avec balises meta de base (title, description)

### Story 3.2: Catalogue avec Pagination & Categories

As a utilisateur abonne,
I want parcourir le catalogue par categories avec pagination,
So that je puisse decouvrir les contenus disponibles.

**Acceptance Criteria:**

**Given** un utilisateur abonne sur la page Catalogue
**When** il parcourt la liste des contenus
**Then** les contenus s'affichent en grille (2 col mobile, 3 col tablet, 4-5 col desktop) avec couverture ratio 2:3, titre, auteur, badge type (ebook/audio)
**And** les contenus sont pagines par 20 items/page
**And** les categories sont navigables via chips filtres horizontaux
**And** un contenu peut appartenir a plusieurs categories
**And** les formats supportes sont : EPUB, PDF, MP3, M4A
**And** le chargement utilise du skeleton loading (jamais de page blanche)
**And** la carte contenu affiche la barre de progression si le contenu a deja ete commence (prefigure Epic 6 — Reprendre)

### Story 3.3: Page Detail Contenu

As a utilisateur abonne,
I want voir les details complets d'un contenu,
So that je puisse decider si je veux le lire ou l'ecouter.

**Acceptance Criteria:**

**Given** un utilisateur abonne qui clique sur un contenu dans le catalogue
**When** la page detail s'affiche
**Then** il voit : couverture grande, titre, auteur(s), langue, type, categorie(s), description complete, et image de couverture
**And** les actions disponibles sont : "Lire" (ebook), "Ecouter" (audio), "Telecharger" (hors-ligne)
**And** l'acces au fichier media passe par une URL signee temporaire (TTL 15min ebook, 60min audio)
**And** les metadonnees obligatoires sont toutes affichees (titre, auteur, langue, type, categorie, couverture)

### Story 3.4: Integration Meilisearch & Recherche

As a utilisateur abonne,
I want rechercher des contenus par titre, auteur ou mots-cles,
So that je puisse trouver rapidement ce que je cherche.

**Acceptance Criteria:**

**Given** un utilisateur abonne sur la page Recherche
**When** il saisit un terme dans la barre de recherche (apres 2 caracteres, debounce 300ms)
**Then** les resultats s'affichent en temps reel avec couverture, titre, auteur, type
**And** la recherche tolere les fautes de frappe (typo-tolerance native Meilisearch)
**And** la recherche fonctionne avec des termes partiels (prefixe)
**And** le temps de reponse est < 100ms (cible Meilisearch)
**And** les resultats ne contiennent que des contenus accessibles aux abonnes
**And** les visiteurs non abonnes peuvent rechercher, mais les resultats sont verrouilles (apercu sans acces)

### Story 3.5: Filtres Combines & Tri

As a utilisateur abonne,
I want filtrer et trier les resultats de recherche,
So that je puisse affiner ma decouverte de contenus.

**Acceptance Criteria:**

**Given** un utilisateur sur la page Recherche ou Catalogue
**When** il active des filtres (categorie, langue, type ebook/audio)
**Then** les filtres sont combinables entre eux (multi-selection)
**And** les resultats sont mis a jour en temps reel
**And** les resultats sont tries par pertinence par defaut, avec options : nouveaute, popularite
**And** si aucun resultat, un message s'affiche : "Aucun resultat pour X — essaye Y" avec suggestions alternatives
**And** les filtres s'affichent sous forme de chips horizontaux

## Epic 4: Lecteur Ebook

Les utilisateurs peuvent lire des ebooks EPUB et PDF avec marque-pages, surlignage de texte, mode nuit, taille de police ajustable (14-24px), reprise automatique de lecture, et synchronisation cross-device des annotations.

### Story 4.1: Lecteur EPUB avec Reprise Automatique

As a utilisateur abonne,
I want lire un ebook EPUB directement dans l'application avec reprise automatique,
So that je puisse lire sans interruption et retrouver ma page exacte a chaque retour.

**Acceptance Criteria:**

**Given** un utilisateur abonne qui ouvre un contenu EPUB
**When** le lecteur se charge
**Then** le contenu est rendu via epub.js (web) / react-native-readium (mobile)
**And** la navigation se fait par swipe horizontal (EPUB) avec table des matieres accessible
**And** le chargement se fait chapitre par chapitre (pas le fichier complet)
**And** la position de lecture est sauvegardee automatiquement toutes les 30 secondes cote serveur
**And** en mode hors-ligne, la position est stockee localement et synchronisee au retour en ligne
**And** a la reouverture, la lecture reprend a la position exacte sauvegardee (page, chapitre, offset)
**And** la progression est affichee (barre + % + pages restantes dans le chapitre)

### Story 4.2: Lecteur PDF avec Reprise Automatique

As a utilisateur abonne,
I want lire un PDF directement dans l'application avec reprise automatique,
So that je puisse consulter tout type de document numerique.

**Acceptance Criteria:**

**Given** un utilisateur abonne qui ouvre un contenu PDF
**When** le lecteur se charge
**Then** le contenu est rendu via pdf.js (web) / WebView (mobile)
**And** la navigation se fait par scroll vertical
**And** la position de lecture est sauvegardee automatiquement toutes les 30 secondes cote serveur
**And** en mode hors-ligne, la position est stockee localement et synchronisee au retour en ligne
**And** a la reouverture, la lecture reprend a la position exacte (page)
**And** la progression est affichee (barre + % + pages restantes)

### Story 4.3: Marque-pages

As a utilisateur abonne,
I want poser des marque-pages dans mes lectures,
So that je puisse retrouver facilement les passages importants.

**Acceptance Criteria:**

**Given** un utilisateur en cours de lecture (EPUB ou PDF)
**When** il ajoute un marque-page (tap sur icone ou depuis barre d'outils)
**Then** la position est sauvegardee en base via API (chapitre + offset pour EPUB, page pour PDF)
**And** un micro-feedback confirme l'ajout (snackbar "Marque-page ajoute")
**And** l'utilisateur peut consulter la liste de ses marque-pages et naviguer directement vers chacun
**And** l'utilisateur peut supprimer un marque-page

### Story 4.4: Surlignage de Texte

As a utilisateur abonne,
I want surligner du texte dans mes lectures,
So that je puisse mettre en evidence les passages importants.

**Acceptance Criteria:**

**Given** un utilisateur en cours de lecture EPUB
**When** il selectionne un passage de texte
**Then** une popup s'affiche avec l'option de surligner (couleur unique MVP)
**And** le surlignage est sauvegarde en base via API (range + texte + couleur)
**And** les surlignages sont visibles lors de la relecture
**And** l'utilisateur peut supprimer un surlignage existant

*Note: surlignage disponible sur EPUB. PDF en lecture seule (limitation technique).*

### Story 4.5: Mode Nuit & Reglages Lecteur

As a utilisateur abonne,
I want ajuster l'affichage du lecteur (mode nuit, taille police),
So that je puisse lire confortablement dans toutes les conditions.

**Acceptance Criteria:**

**Given** un utilisateur en cours de lecture
**When** il ouvre la barre d'outils (tap centre ecran)
**Then** il peut activer/desactiver le mode nuit (fond sombre, texte clair) avec transition immediate
**And** il peut ajuster la taille de police entre 14px et 24px (5 paliers)
**And** les reglages sont persistants entre sessions
**And** le toggle mode nuit du lecteur est independant du mode nuit global de l'application
**And** la barre d'outils est masquee par defaut et s'affiche au tap centre
**And** le contraste respecte WCAG AA (>= 4.5:1) en mode nuit

### Story 4.6: Protection Contenu (DRM Leger)

As a proprietaire de contenu,
I want que les ebooks soient proteges contre la copie non autorisee,
So that les droits des auteurs et editeurs soient respectes.

**Acceptance Criteria:**

**Given** un contenu ebook charge dans le lecteur
**When** l'utilisateur tente d'acceder au fichier source
**Then** le fichier est charge via URL signee temporaire (TTL 15min, renouvelable)
**And** la lecture est uniquement possible dans l'application (pas de lecteur externe)
**And** le clic droit et la selection longue sont desactives sur web
**And** il n'y a pas de bouton "telecharger" ni "imprimer"
**And** l'acces est verifie a chaque session de lecture (JWT + abonnement actif)
**And** le contenu rendu dans le composant ferme ne permet pas d'acceder au DOM source (PDF)

*Note: la protection DRM est best-effort et ne vise pas a empecher toute extraction par un utilisateur techniquement expert. Elle protege contre l'utilisateur moyen.*

### Story 4.7: Synchronisation Cross-device Annotations

As a utilisateur multi-device,
I want retrouver mes marque-pages et surlignages sur tous mes appareils,
So that ma lecture soit continue quel que soit le device utilise.

**Acceptance Criteria:**

**Given** un utilisateur qui a pose des marque-pages et surlignages sur un device
**When** il ouvre le meme contenu sur un autre device
**Then** tous les marque-pages et surlignages sont synchronises via API
**And** la position de lecture est celle du dernier device utilise
**And** la synchronisation est < 10 secondes en conditions normales
**And** en cas de conflit, la version la plus recente prevaut

## Epic 5: Lecteur Audio & Mini-Player

Les utilisateurs peuvent ecouter des livres audio en streaming avec controles de vitesse (0.5x-2x), playlist personnelle, lecture en arriere-plan (ecran eteint), mini-player persistant Spotify-like, et controles depuis la notification systeme.

### Story 5.1: Lecteur Audio Plein Ecran avec Streaming

As a utilisateur abonne,
I want ecouter un livre audio en streaming dans un lecteur plein ecran,
So that je puisse profiter d'une experience d'ecoute immersive.

**Acceptance Criteria:**

**Given** un utilisateur abonne qui ouvre un contenu audio
**When** le lecteur plein ecran s'affiche
**Then** il voit : couverture large (60% ecran), titre, auteur, controles (play/pause 64px, -15s, +30s)
**And** l'audio est diffuse en streaming HTTP progressif via CDN (URL signee TTL 60min, renouvelable)
**And** la position de lecture est sauvegardee automatiquement toutes les 30 secondes cote serveur
**And** en mode hors-ligne, la position est stockee localement et synchronisee au retour en ligne
**And** a la reouverture, l'ecoute reprend a la position exacte sauvegardee
**And** la barre de progression est scrubable avec temps ecoule / temps total
**And** le streaming est uniquement dans l'application (pas de telechargement fichier brut)

### Story 5.2: Vitesse de Lecture & Chapitres

As a utilisateur abonne,
I want ajuster la vitesse de lecture et naviguer par chapitres,
So that je puisse adapter l'ecoute a mon rythme et retrouver un passage.

**Acceptance Criteria:**

**Given** un utilisateur en cours d'ecoute audio
**When** il utilise les controles secondaires
**Then** il peut ajuster la vitesse parmi : 0.5x, 1x, 1.25x, 1.5x, 2x sans distorsion
**And** il peut naviguer entre les chapitres via bottom sheet (liste des chapitres)
**And** le chapitre courant est affiche dans le lecteur
**And** le changement de vitesse est persistant entre sessions

### Story 5.3: Mini-Player Persistant

As a utilisateur abonne,
I want voir un mini-player audio en bas de l'ecran quand je quitte le lecteur plein ecran,
So that je puisse naviguer dans l'app tout en continuant d'ecouter.

**Acceptance Criteria:**

**Given** un utilisateur en cours d'ecoute audio
**When** il quitte le lecteur plein ecran (retour, navigation)
**Then** un mini-player s'affiche en sticky au-dessus de la tab bar (bottom 56px, hauteur 64px)
**And** le mini-player affiche : couverture miniature 40x40px, titre, auteur, bouton play/pause, bouton suivant
**And** le mini-player est visible sur toutes les pages de l'app
**And** tap sur le mini-player ouvre le lecteur plein ecran
**And** le mini-player affiche une barre de progression animee quand l'audio joue
**And** le mini-player est toujours present mais jamais intrusif (ne vole pas l'attention au contenu principal)
**And** sur Android, le mini-player respecte le bouton "Retour" (ne bloque jamais la navigation systeme)

### Story 5.4: Audio en Arriere-plan & Controles Notification

As a utilisateur abonne,
I want que l'audio continue quand l'ecran est eteint ou l'app en fond,
So that je puisse ecouter en cuisinant, dans les transports, ou en faisant autre chose.

**Acceptance Criteria:**

**Given** un utilisateur en cours d'ecoute audio
**When** il eteint l'ecran ou passe l'app en arriere-plan
**Then** l'audio continue sans interruption, dans les limites imposees par le systeme d'exploitation (iOS / Android)
**And** les controles audio sont accessibles depuis la notification systeme (play/pause, skip -15s/+30s)
**And** tap sur la notification rouvre le lecteur plein ecran
**And** lors d'un appel telephonique, l'audio est mis en pause automatiquement
**And** a la fin de l'appel, l'audio reprend automatiquement a la position exacte

*Non negociable — c'est le moment "Mariame" du produit.*

### Story 5.5: Playlist Personnelle

As a utilisateur abonne,
I want creer et gerer une playlist de livres audio,
So that je puisse organiser mes ecoutes et enchainer les contenus.

**Acceptance Criteria:**

**Given** un utilisateur abonne
**When** il ajoute un contenu audio a sa playlist (depuis detail contenu ou long press)
**Then** le contenu est ajoute a sa playlist ordonnee, sauvegardee en base
**And** il peut consulter, reordonner et supprimer des elements de sa playlist
**And** a la fin d'un contenu, le suivant dans la playlist demarre automatiquement
**And** la playlist est accessible depuis le lecteur audio (bottom sheet) et depuis le profil
**And** les playlists ne contiennent que des contenus audio (pas d'ebooks)

### Story 5.6: Gestion Reseau Faible Audio

As a utilisateur sur reseau instable,
I want que l'audio gere les coupures reseau sans interruption brutale,
So that je puisse ecouter meme avec une connexion 3G variable.

**Acceptance Criteria:**

**Given** un utilisateur en streaming audio
**When** le reseau devient faible ou se coupe temporairement
**Then** le pre-buffering de 30 secondes d'avance maintient la lecture
**And** en cas de coupure, la reconnexion est automatique et la reprise se fait a la position du buffer
**And** un indicateur discret affiche l'etat de connexion dans le lecteur (icone reseau)
**And** si le contenu est telecharge hors-ligne, il est utilise en priorite (aucune coupure)
**And** l'audio est pre-encode en qualite unique 128 kbps MP3

## Epic 6: Accueil Personnalise & Recommandations

Les utilisateurs voient une page d'accueil personnalisee avec "Reprendre" en position absolue #1, sections Nouveautes, Populaires, et Recommandations basees sur les categories consultees. Les visiteurs voient une version generique.

*Note Epic: l'ordre des sections est strict et non personnalisable par l'utilisateur en V1 : Reprendre → Nouveautes → Populaires → Recommandations.*

### Story 6.1: Section "Reprendre" en Position #1

As a utilisateur abonne avec un contenu en cours,
I want voir "Reprendre" en premiere position sur l'accueil,
So that je puisse continuer ma lecture/ecoute en un seul tap.

**Acceptance Criteria:**

**Given** un utilisateur abonne qui ouvre l'accueil
**When** il a au moins un contenu en cours (ebook ou audio)
**Then** la section "Reprendre" s'affiche en position absolue #1 (avant toute autre section)
**And** chaque card affiche : couverture, titre, auteur, type (ebook/audio), barre de progression %, bouton "Reprendre"
**And** tap sur "Reprendre" ouvre directement le lecteur a la position exacte
**And** s'il y a plusieurs contenus en cours, ils s'affichent en carrousel horizontal (plus recent en premier)
**And** si aucun contenu en cours, la section est absente et la premiere section est "Nouveautes"

### Story 6.2: Sections Nouveautes & Populaires

As a utilisateur abonne,
I want decouvrir les nouveaux contenus et les plus populaires,
So that je trouve facilement de nouvelles lectures/ecoutes.

**Acceptance Criteria:**

**Given** un utilisateur abonne sur la page d'accueil
**When** il fait defiler la page
**Then** il voit une section "Nouveautes" (contenus les plus recents) en carrousel horizontal
**And** il voit une section "Populaires" (contenus les plus consultes) en carrousel horizontal
**And** chaque card affiche : couverture ratio 2:3, titre, auteur, badge type
**And** les sections sont alimentees avec des contenus reels et mis a jour quotidiennement
**And** "Voir tout" sur chaque section mene au catalogue filtre correspondant

### Story 6.3: Section Recommandations

As a utilisateur abonne,
I want recevoir des recommandations basees sur mes lectures,
So that je decouvre des contenus qui correspondent a mes gouts.

**Acceptance Criteria:**

**Given** un utilisateur abonne avec un historique de consultation
**When** il consulte la page d'accueil
**Then** une section "Recommandations" s'affiche avec des contenus suggeres en carrousel horizontal
**And** les recommandations sont basees sur les categories deja consultees par l'utilisateur
**And** l'algorithme est base sur des regles simples (categories, popularite, nouveaute) — pas d'IA avancee
**And** un utilisateur sans historique voit des contenus populaires en lieu de recommandations
**And** les contenus deja termines ne reapparaissent pas dans les recommandations

### Story 6.4: Personnalisation & Version Visiteur

As a utilisateur (abonne ou visiteur),
I want une page d'accueil adaptee a mon statut,
So that l'experience soit pertinente que je sois abonne ou non.

**Acceptance Criteria:**

**Given** un utilisateur abonne
**When** il ouvre l'accueil
**Then** il voit une salutation personnalisee ("Bonjour, Awa"), puis Reprendre, Nouveautes, Populaires, Recommandations
**And** la page est personnalisee selon son historique et ses categories
**And** les donnees de l'accueil sont mises en cache cote client pour garantir un affichage < 1 seconde
**Given** un visiteur non authentifie
**When** il arrive sur la plateforme
**Then** il voit une version generique : apercu catalogue, couvertures, prix, CTA "S'abonner"
**And** les sections Reprendre et Recommandations sont absentes
**And** les contenus sont verrouilles (apercu uniquement)
**Given** un utilisateur en mode hors-ligne
**When** il ouvre l'accueil
**Then** l'accueil affiche les dernieres donnees connues (cache) avec un indicateur discret "Hors-ligne"

## Epic 7: Mode Hors-ligne

Les utilisateurs mobiles peuvent telecharger des contenus chiffres (AES 256) pour lecture/ecoute sans connexion, avec synchronisation automatique au retour en ligne, purge intelligente des contenus expires, et feedback emotionnel.

### Story 7.1: Telechargement de Contenu Hors-ligne

As a utilisateur abonne (mobile),
I want telecharger un contenu pour le lire/ecouter sans connexion,
So that je puisse consommer mes contenus dans le bus, le metro, ou en zone sans reseau.

**Acceptance Criteria:**

**Given** un utilisateur abonne avec quota non atteint (< 5 contenus)
**When** il appuie sur "Telecharger" sur un contenu (page detail ou long press)
**Then** le fichier est telecharge depuis le CDN
**And** une progression circulaire s'affiche sur la couverture pendant le telechargement
**And** a la fin, un snackbar emotionnel s'affiche : "Pret pour ton prochain trajet"
**And** un badge hors-ligne (checkmark vert, 24px coin bas-droit) apparait sur la couverture
**And** les metadonnees sont stockees localement (SQLite / AsyncStorage)

### Story 7.2: Chiffrement Local AES 256

As a proprietaire de contenu,
I want que les fichiers telecharges soient chiffres localement,
So that le contenu soit protege meme sur le device de l'utilisateur.

**Acceptance Criteria:**

**Given** un fichier telecharge sur le device
**When** le telechargement est termine
**Then** le fichier est chiffre en AES 256 avec une cle derivee du token utilisateur
**And** le fichier brut n'est jamais stocke en clair sur le device
**And** le fichier est lisible uniquement via l'application (pas par un lecteur externe)
**And** aucun acces au fichier brut n'est possible, meme via l'explorateur de fichiers

### Story 7.3: Gestion Quota & Stockage

As a utilisateur abonne,
I want voir combien de contenus j'ai telecharges et gerer mon espace,
So that je puisse organiser mes telechargements.

**Acceptance Criteria:**

**Given** un utilisateur abonne sur l'ecran Telechargements (tab bar "Hors-ligne")
**When** il consulte ses contenus telecharges
**Then** il voit la liste des contenus telecharges avec : couverture, titre, type, taille, date telechargement, temps restant avant expiration
**And** le compteur de quota est visible (ex: "3 / 5 contenus")
**And** si le quota est atteint (5 max), le bouton Telecharger est desactive avec message explicite
**And** une alerte s'affiche si le stockage local depasse 500 Mo
**And** l'utilisateur peut supprimer un contenu telecharge pour liberer du quota

### Story 7.4: TTL & Purge Automatique

As a systeme,
I want gerer l'expiration des contenus telecharges et purger automatiquement,
So that le mode hors-ligne reste controle et securise.

**Acceptance Criteria:**

**Given** un contenu telecharge avec un TTL de 72 heures (configurable cote serveur)
**When** le TTL expire
**Then** le contenu est purge automatiquement du device (fichier chiffre + metadonnees locales)
**And** l'utilisateur est informe discretement (badge retire, contenu grise dans la liste)
**And** le contenu peut etre re-telecharge si l'abonnement est actif et le quota permet

### Story 7.5: Verification Abonnement au Retour en Ligne

As a systeme,
I want verifier l'abonnement a chaque retour en ligne,
So that les contenus soient purges si l'abonnement a expire.

**Acceptance Criteria:**

**Given** un utilisateur qui revient en ligne apres une periode hors-ligne
**When** la connexion est retablie
**Then** l'application verifie le statut d'abonnement via l'API
**And** si l'abonnement est actif, la synchronisation des positions de lecture se fait silencieusement
**And** si l'abonnement est expire, tous les contenus locaux sont purges immediatement (fichiers + metadonnees)
**And** l'utilisateur est informe clairement ("Ton abonnement a expire — reabonne-toi pour retrouver tes contenus")

### Story 7.6: Experience Hors-ligne dans l'App

As a utilisateur sans connexion,
I want que l'app fonctionne naturellement avec mes contenus telecharges,
So that je ne ressente pas de rupture d'experience.

**Acceptance Criteria:**

**Given** un utilisateur en mode hors-ligne (avion, pas de reseau)
**When** il ouvre l'app
**Then** les contenus telecharges s'affichent normalement et sont ouvrables instantanement (sans loader)
**And** les contenus non telecharges sont grises avec une icone cloud barree
**And** un banner discret en haut indique "Hors-ligne" (disparait au retour en ligne)
**And** la synchronisation des positions se fait silencieusement au retour en ligne
**And** les lecteurs ebook et audio fonctionnent identiquement en mode hors-ligne

### Story 7.7: Web — Cache Limite (Service Worker)

As a utilisateur web sans connexion,
I want que les pages de l'app restent accessibles,
So that je puisse au minimum naviguer dans l'interface.

**Acceptance Criteria:**

**Given** un utilisateur web qui perd la connexion
**When** il navigue dans l'app
**Then** les pages et assets statiques sont servies depuis le cache Service Worker
**And** un message clair indique "Connexion requise pour acceder aux contenus"
**And** aucun telechargement de contenus complets n'est propose sur web (mobile uniquement)

## Epic 8: Notifications & Communications

Les utilisateurs recoivent des notifications push (nouveaux contenus, rappels reprise, expiration abonnement) et des emails transactionnels (bienvenue, confirmation paiement, reinitialisation mot de passe) en francais, avec gestion du consentement.

### Story 8.1: Integration Firebase FCM & Enregistrement Token

As a systeme,
I want enregistrer les tokens FCM des utilisateurs a l'inscription,
So that je puisse leur envoyer des notifications push.

**Acceptance Criteria:**

**Given** un utilisateur qui s'inscrit ou se connecte pour la premiere fois sur mobile
**When** l'app demande le consentement notifications
**Then** si l'utilisateur accepte, le token FCM est genere et enregistre en base via API
**And** les preferences de notification sont initialisees par defaut (toutes actives)
**And** le token est mis a jour si le device change
**And** sur web, le token est enregistre si le navigateur est compatible

### Story 8.2: Notifications Push — Contenus & Rappels

As a utilisateur abonne,
I want recevoir des notifications quand de nouveaux contenus sont disponibles ou quand j'ai oublie de lire,
So that je reste engage avec la plateforme.

**Acceptance Criteria:**

**Given** un nouveau contenu publie par l'admin
**When** le contenu est valide et publie
**Then** une notification push est envoyee aux abonnes ayant active ce type de notification
**And** la notification est en francais
**Given** un utilisateur inactif depuis plus de 3 jours
**When** le rappel de reprise est declenche
**Then** une notification push est envoyee ("Tu en etais au chapitre 7 de...")
**And** tap sur la notification ouvre le contenu a la position exacte

### Story 8.3: Notifications Push — Abonnement & Paiement

As a utilisateur abonne,
I want etre notifie si mon abonnement va expirer ou si un paiement a echoue,
So that je puisse agir avant de perdre l'acces.

**Acceptance Criteria:**

**Given** un abonnement qui expire dans 7 jours
**When** le timer J-7 est atteint
**Then** une notification haute priorite est envoyee ("Ton abonnement expire dans 7 jours")
**And** une seconde notification est envoyee a J-1
**Given** un paiement echoue (webhook echec)
**When** l'echec est confirme
**Then** une notification haute priorite est envoyee avec lien vers la page de paiement
**And** toutes les notifications sont en francais

### Story 8.4: Notifications Administratives & Preferences

As a administrateur / utilisateur,
I want envoyer des notifications manuelles et gerer mes preferences,
So that la communication soit maitrisee des deux cotes.

**Acceptance Criteria:**

**Given** un administrateur dans le back-office
**When** il envoie une notification manuelle (maintenance, nouveautes)
**Then** la notification est envoyee a tous les utilisateurs ayant active les notifications administratives
**Given** un utilisateur sur la page Profil > Notifications
**When** il modifie ses preferences
**Then** il peut activer/desactiver chaque type de notification independamment (nouveaux contenus, rappels, expiration, admin)
**And** les preferences sont sauvegardees en base et prises en compte immediatement

### Story 8.5: Integration Brevo/Mailchimp & Templates Email

As a systeme,
I want envoyer des emails transactionnels automatiquement via Brevo/Mailchimp,
So that les utilisateurs soient informes des evenements importants de leur compte.

**Acceptance Criteria:**

**Given** un evenement declencheur (inscription, paiement, expiration, reset)
**When** l'evenement se produit
**Then** l'email correspondant est envoye via l'API Brevo/Mailchimp dans les 2 minutes
**And** les 5 templates sont configures avec variables dynamiques : Bienvenue {nom}, Confirmation paiement {nom}/{plan}/{montant}/{date}, Rappel expiration J-7 {nom}/{date_expiration}, Paiement echoue {nom}/{lien_mise_a_jour}, Reset mot de passe {nom}/{lien_reset} TTL 1h
**And** tous les emails sont en francais

### Story 8.6: Desabonnement & Conformite Email

As a utilisateur,
I want pouvoir me desabonner des emails marketing,
So that je controle les communications que je recois.

**Acceptance Criteria:**

**Given** un utilisateur qui recoit un email
**When** il clique sur le lien de desabonnement
**Then** il est desabonne des emails marketing
**And** les emails transactionnels continuent d'etre envoyes (non desabonnables)
**And** le statut de desabonnement est mis a jour en base

## Epic 9: Analytics & Consentement

Le systeme collecte des donnees d'usage (13 events) avec consentement RGPD pour ameliorer le produit. Les metriques cles (inscriptions, conversion, retention, MRR) sont accessibles via le back-office.

*FRs couverts : FR90, FR91, FR92, FR93, FR94*
*Notes : Google Analytics via gtag.js/react-ga4 (web) + @react-native-firebase/analytics (mobile), banniere consentement premier lancement, donnees anonymisees.*

### Story 9.1: Banniere de Consentement RGPD

As a utilisateur (nouveau ou existant),
I want donner ou refuser mon consentement au tracking avant toute collecte,
So that mes donnees soient traitees conformement a la reglementation RGPD.

**Acceptance Criteria:**

**Given** un utilisateur qui lance l'application pour la premiere fois (ou apres effacement des donnees)
**When** l'app s'initialise
**Then** une banniere de consentement s'affiche en bottom sheet avant toute autre action
**And** la banniere propose : "Accepter" (opt-in explicite) et "Refuser" (opt-out)
**And** aucun tracking n'est declenche avant le choix de l'utilisateur
**And** si l'utilisateur accepte, Google Analytics est initialise et les events sont traces
**And** si l'utilisateur refuse, aucun event n'est envoye a GA (zero tracking)
**And** le choix est persiste localement (AsyncStorage / localStorage) et en base (champ `analytics_consent`)
**And** l'utilisateur peut modifier son choix a tout moment depuis Profil > Confidentialite
**And** la modification prend effet immediatement (activation/desactivation du tracking en temps reel)

### Story 9.2: Integration Google Analytics & Tracking Events

As a product owner,
I want que les 13 events d'usage soient traces dans Google Analytics,
So that je puisse analyser le comportement utilisateur et ameliorer le produit.

**Acceptance Criteria:**

**Given** un utilisateur ayant consenti au tracking
**When** il effectue une action trackable
**Then** les 13 events sont traces : `sign_up`, `login`, `subscribe`, `cancel_subscription`, `view_content`, `start_reading`, `start_listening`, `complete_reading`, `complete_listening`, `search`, `download_offline`, `onboarding_complete`, `onboarding_skip`
**And** chaque event inclut les proprietes pertinentes (content_id, content_type, plan_type, search_query, etc.)
**And** l'integration utilise gtag.js + react-ga4 (web) et @react-native-firebase/analytics (mobile)
**And** les donnees sont anonymisees — aucune donnee personnelle (email, nom) n'est envoyee a GA
**And** les user IDs sont hasches avant envoi si utilises
**And** les events sont coherents entre web et mobile (meme nomenclature)

### Story 9.3: Metriques & Statistiques Back-office

As a administrateur,
I want consulter les metriques cles du produit dans le back-office,
So that je puisse suivre la sante du produit et prendre des decisions.

**Acceptance Criteria:**

**Given** un administrateur connecte au back-office (AdminJS)
**When** il accede au dashboard Statistiques
**Then** il voit les metriques suivantes, mises a jour quotidiennement :
- Inscriptions (total, par jour/semaine/mois)
- Taux de conversion visiteur → abonne
- Retention (J7, J30, J90)
- Temps moyen de lecture et d'ecoute
- Contenus les plus consultes (top 10 ebooks, top 10 audio)
- Taux de churn
- MRR (Monthly Recurring Revenue) et revenus totaux
**And** les donnees sont coherentes avec Google Analytics
**And** les statistiques sont calculees a partir des donnees Supabase (pas de dependance a GA pour le back-office)
**And** les metriques sont presentees avec des graphiques simples (tendance, comparaison periodes)

## Epic 10: Back-Office Administration

Les administrateurs gerent les utilisateurs, abonnements, catalogue (upload fichiers + chiffrement + indexation), licences/ayants droit, statistiques, et envoient des notifications manuelles. Toutes les actions sont securisees et tracees.

*FRs couverts : FR103, FR104, FR105, FR106, FR107, FR108, FR109, FR110, FR111, FR112*
*Notes : AdminJS integre Express.js route /admin, authentification role admin, audit trail, workflow upload (validation format/taille → chiffrement AES 256 → upload R2 → indexation Supabase + Meilisearch), 3 buckets R2.*

### Story 10.1: Setup AdminJS & Authentification Admin

As a administrateur,
I want acceder a un back-office securise via /admin,
So that je puisse gerer la plateforme avec une interface dediee.

**Acceptance Criteria:**

**Given** un utilisateur avec role `admin` en base
**When** il accede a `/admin`
**Then** AdminJS est integre dans Express.js, accessible sur la route `/admin`
**And** l'authentification verifie le role `admin` (JWT avec role verifie ou session separee)
**And** un utilisateur non-admin qui accede a `/admin` recoit un 403 Forbidden
**And** toutes les actions admin sont loguees dans une table `audit_logs` (audit trail) avec : admin_id, action, resource, resource_id, timestamp, details JSON
**And** le back-office est accessible uniquement en HTTPS

### Story 10.2: Gestion Utilisateurs

As a administrateur,
I want consulter, rechercher et gerer les comptes utilisateurs,
So that je puisse assurer le support et la moderation.

**Acceptance Criteria:**

**Given** un admin connecte au back-office
**When** il accede a la section Utilisateurs
**Then** il voit la liste paginee des utilisateurs avec : email, nom, date inscription, statut (actif/desactive), type abonnement
**And** il peut rechercher un utilisateur par email ou nom
**And** il peut consulter le detail d'un utilisateur : profil, historique d'activite (lectures, ecoutes, paiements), statut abonnement
**And** il peut activer ou desactiver un compte utilisateur
**And** la desactivation coupe l'acces immediatement (token invalide) et purge les contenus hors-ligne
**And** chaque action est tracee dans l'audit trail

### Story 10.3: Gestion Abonnements

As a administrateur,
I want gerer manuellement les abonnements des utilisateurs,
So that je puisse traiter les cas exceptionnels (support, geste commercial, bug paiement).

**Acceptance Criteria:**

**Given** un admin sur la section Abonnements
**When** il consulte les abonnements
**Then** il voit la liste avec filtres : actifs, expires, annules
**And** pour chaque abonnement : utilisateur, plan (mensuel/annuel), date debut, date fin, statut, passerelle (Stripe/Flutterwave)
**And** il peut activer manuellement un abonnement (geste commercial)
**And** il peut prolonger un abonnement (ajouter des jours)
**And** il peut annuler un abonnement (acces reste actif jusqu'a fin de periode payee)
**And** chaque action est tracee dans l'audit trail avec motif obligatoire

### Story 10.4: Gestion Catalogue & Upload Contenus

As a administrateur,
I want ajouter, modifier et supprimer des contenus avec upload de fichiers,
So that le catalogue soit toujours a jour.

**Acceptance Criteria:**

**Given** un admin sur la section Catalogue
**When** il ajoute un nouveau contenu
**Then** il remplit un formulaire : titre, auteur, description, categorie(s), type (ebook/audio), langue, image couverture, fichier contenu
**And** le workflow d'upload suit le pipeline : validation format (EPUB, PDF, MP3, M4A) et taille → chiffrement AES 256 → upload vers Cloudflare R2 (`biblio-content-private`) → couverture vers R2 (`biblio-covers-public`) → indexation metadonnees Supabase → indexation recherche Meilisearch
**And** une barre de progression s'affiche pendant l'upload
**And** en cas d'erreur (format invalide, taille excessive), un message explicite s'affiche et aucun fichier n'est stocke
**And** il peut modifier les metadonnees d'un contenu existant
**And** il peut supprimer un contenu (supprime fichier R2 + entree Supabase + index Meilisearch)
**And** la publication est immediate apres upload reussi

### Story 10.5: Gestion Metadonnees, Categories & Licences

As a administrateur,
I want gerer les categories, metadonnees et les licences/ayants droit,
So that le catalogue soit organise et les droits de diffusion soient traces.

**Acceptance Criteria:**

**Given** un admin sur la section Categories
**When** il gere les categories
**Then** il peut creer, modifier et supprimer des categories
**And** chaque contenu peut avoir une ou plusieurs categories
**Given** un admin sur la section Licences/Ayants droit
**When** il gere les ayants droit
**Then** il peut enregistrer des editeurs et auteurs partenaires (nom, contact, contrat)
**And** il peut associer un contenu a un ayant droit
**And** il peut suivre les droits de diffusion (date debut, date fin, territoire)
**And** un contenu sans ayant droit associe affiche un avertissement visuel dans la liste
**And** chaque action est tracee dans l'audit trail

### Story 10.6: Dashboard Statistiques Admin

As a administrateur,
I want consulter un dashboard complet avec les KPIs de la plateforme,
So that je puisse piloter l'activite du produit.

**Acceptance Criteria:**

**Given** un admin sur le Dashboard
**When** il consulte les statistiques
**Then** il voit : lectures (nombre, duree, contenus populaires), ecoutes (nombre, duree, contenus populaires), abonnes actifs (total + evolution), revenus (MRR, total cumule), retention (J7, J30, J90)
**And** les statistiques sont mises a jour quotidiennement
**And** les metriques sont calculees depuis Supabase (source de verite)
**And** les donnees sont coherentes avec les metriques GA de la Story 9.3
**And** le dashboard est la page d'accueil du back-office

*Note : Cette story partage les metriques avec Story 9.3 — le calcul est mutualise, seul l'affichage differe (AdminJS widgets vs. page dediee).*

### Story 10.7: Envoi Notifications Manuelles & Audit Trail

As a administrateur,
I want envoyer des notifications push manuelles et consulter l'historique des actions admin,
So that je puisse communiquer avec les utilisateurs et verifier les operations.

**Acceptance Criteria:**

**Given** un admin sur la section Notifications
**When** il compose une notification manuelle
**Then** il saisit : titre, message, type (maintenance, nouveaute, info), cible (tous les abonnes ou segment)
**And** la notification est envoyee via Firebase FCM a tous les utilisateurs ayant active les notifications administratives
**And** un apercu est affiche avant envoi avec confirmation obligatoire
**Given** un admin sur la section Audit Trail
**When** il consulte l'historique
**Then** il voit toutes les actions admin : date, admin, action, ressource, details
**And** l'historique est filtrable par admin, type d'action, periode
**And** l'audit trail est en lecture seule (aucune suppression possible)
