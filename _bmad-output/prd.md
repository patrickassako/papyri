# PRD — Bibliotheque Numerique Privee

Version: 1.1
Statut: Valide pour developpement
Reference contractuelle: Cahier de charge signe (Dimitri Talla / Afrik NoCode — 31/01/2026)
Reference interne: analyst.md
Audience: Product, Engineering, QA

---

## 1. Objectif du document

Ce document definit de maniere precise :
- les fonctionnalites attendues du produit,
- les regles metiers associees,
- les criteres d'acceptation,
- les limites d'implementation.

Le PRD sert de **contrat produit** entre les parties.

**Regle d'or :** Le cahier de charge client = 100 % IN SCOPE. Ce PRD rend le scope executable, il ne le reduit pas. Toute fonctionnalite peut etre limitee, encadree ou phasee techniquement, mais jamais supprimee sans avenant client.

---

## 2. Vision produit

Creer une plateforme de bibliotheque numerique privee, securisee, accessible par abonnement, permettant :
- la lecture de livres numeriques (EPUB, PDF),
- l'ecoute de livres audio (MP3, M4A),
- l'acces a des contenus editoriaux exclusifs,

exclusivement a l'interieur des applications web et mobile (Android & iOS).

La plateforme vise en priorite les marches africains et diasporas, avec une vision internationale a moyen terme.

---

## 3. Utilisateurs cibles

### 3.1 Utilisateur abonne
- Dispose d'un compte actif
- A paye un abonnement valide
- Accede au catalogue complet
- Peut lire et ecouter les contenus
- Dispose d'un historique de lecture / ecoute
- Peut utiliser le mode hors-ligne controle

### 3.2 Administrateur
- Gere les utilisateurs
- Gere les contenus et le catalogue
- Gere les abonnements
- Gere les licences et ayants droit
- Accede aux statistiques (lectures, ecoutes, abonnes actifs, revenus, retention)

### 3.3 Visiteur (non authentifie)
- Acces limite aux pages publiques
- Decouverte du produit et du catalogue (apercu)
- Incitation a l'inscription et a l'abonnement

---

## 4. Pricing & Plans

### Modele d'abonnement

| Plan | Prix | Acces |
|------|------|-------|
| Mensuel | 5 EUR/mois | Catalogue complet |
| Annuel | 50 EUR/an | Catalogue complet |

### Regles
- Les montants sont affiches en euros, avec conversion automatique selon la region via les passerelles de paiement (Stripe / Flutterwave)
- Pas d'essai gratuit
- Acces illimite tant que l'abonnement est actif
- Un seul abonnement actif par utilisateur

---

## 5. Onboarding MVP

### Parcours premier lancement

L'onboarding est minimal mais intentionnel, concu pour convertir l'inscription en premiere lecture/ecoute.

#### Etapes
1. **Ecran valeur** — Presentation de la proposition de valeur (acces illimite, contenus exclusifs, lecture securisee)
2. **Ecran fonctionnement** — Comment ca marche (abonnement, catalogue, lecture/ecoute)
3. **CTA premiere lecture** — Redirection vers le catalogue avec suggestion de contenu

#### Regles metiers
- L'onboarding s'affiche uniquement au premier lancement apres inscription
- L'utilisateur peut le passer (skip)
- L'onboarding ne bloque pas l'acces au catalogue

#### Criteres d'acceptation
- Les 3 ecrans s'affichent correctement sur web et mobile
- Le CTA redirige vers le catalogue
- L'onboarding ne reapparait pas apres le premier lancement

---

## 6. Fonctionnalites produit (detaillees)

### 6.1 Authentification & comptes

#### Description
Permettre a un utilisateur de creer un compte, se connecter et gerer son profil.

#### Fonctionnalites
- Inscription par email + mot de passe
- Connexion securisee (JWT + HTTPS)
- Deconnexion
- Reinitialisation du mot de passe
- Consultation et modification du profil utilisateur
- Historique de lecture / ecoute

#### Regles metiers
- Un email = un compte
- Mot de passe chiffre cote serveur
- Session expiree apres inactivite
- Authentification via JWT

#### Criteres d'acceptation
- Un utilisateur peut creer un compte sans erreur
- Un utilisateur non connecte ne peut pas acceder au catalogue
- Les erreurs d'authentification sont explicites
- L'historique de lecture / ecoute est accessible depuis le profil

---

### 6.2 Abonnements & acces

#### Description
L'acces au catalogue est conditionne par un abonnement actif.

#### Fonctionnalites
- Souscription a un abonnement (mensuel ou annuel)
- Renouvellement automatique
- Annulation de l'abonnement
- Verification du statut d'abonnement en temps reel
- Historique des paiements

#### Regles metiers
- Sans abonnement actif → aucun acces au contenu
- Abonnement expire → acces coupe immediatement (y compris contenus hors-ligne)
- Un utilisateur ne peut avoir qu'un abonnement actif
- Changement de plan possible (mensuel ↔ annuel)

#### Criteres d'acceptation
- Un utilisateur abonne accede au catalogue
- Un utilisateur non abonne est bloque
- Le statut est mis a jour automatiquement apres paiement
- L'historique des paiements est consultable

---

### 6.3 Paiements

#### Description
Permettre le paiement securise des abonnements.

#### Moyens de paiement (imposes par contrat)
- **Stripe** (international)
- **Flutterwave** (Afrique / diaspora)

#### Fonctionnalites
- Paiement initial
- Renouvellement automatique
- Webhooks de confirmation
- Historique des paiements
- Conversion de devises automatique (affichage en EUR, paiement local)

#### Regles metiers
- Paiement valide → abonnement active
- Paiement echoue → acces refuse
- Webhooks = source de verite pour le statut d'abonnement
- Les deux passerelles doivent etre operationnelles simultanement

#### Criteres d'acceptation
- Un paiement valide active l'abonnement
- Un paiement echoue ne donne aucun acces
- Les statuts sont coherents apres webhook
- Stripe et Flutterwave fonctionnent independamment

---

### 6.4 Catalogue de contenus

#### Description
Afficher et organiser les contenus disponibles.

#### Types de contenus
- Livre numerique (EPUB, PDF)
- Livre audio (MP3, M4A)
- Contenus editoriaux exclusifs (textes, narrations)

#### Sources de contenu
- Plateformes partenaires (StreetLib, PublishDrive)
- Contenus libres (Gutenberg, LibriVox)
- Auteurs & editeurs partenaires (upload manuel)

#### Fonctionnalites
- Liste des contenus avec pagination
- Detail d'un contenu
- Categorisation et navigation par categories
- Metadonnees obligatoires (titre, auteur, langue, type, categorie, couverture)

#### Regles metiers
- Un contenu est visible uniquement pour les abonnes (apercu limite pour visiteurs)
- Un contenu peut appartenir a plusieurs categories
- Les metadonnees sont obligatoires pour tout contenu publie
- Les formats acceptes : EPUB, PDF, MP3, M4A

#### Criteres d'acceptation
- Le catalogue se charge en moins de 3 secondes
- Les contenus sont correctement filtres par type et categorie
- Les metadonnees sont affichees sur la page detail
- Les visiteurs voient un apercu mais ne peuvent pas acceder au contenu

---

### 6.5 Recherche & filtres

#### Description
Permettre a l'utilisateur de trouver rapidement un contenu.

#### Moteur de recherche
- Meilisearch ou Elasticsearch (impose par contrat)

#### Fonctionnalites
- Recherche par titre
- Recherche par auteur
- Recherche par mots-cles
- Filtres par categorie, langue, type de contenu (ebook / audio)
- Filtres avances combinables

#### Regles metiers
- La recherche ne retourne que des contenus accessibles a l'abonne
- Les resultats sont tries par pertinence
- La recherche fonctionne avec des termes partiels et tolere les fautes

#### Criteres d'acceptation
- Les resultats sont pertinents et affiches en moins de 1 seconde
- Les filtres combines fonctionnent correctement
- Aucun contenu hors abonnement n'apparait dans les resultats

---

### 6.6 Page d'accueil & recommandations

#### Description
Offrir une page d'accueil engageante avec des recommandations de contenu.

#### Fonctionnalites
- Section "Nouveautes"
- Section "Populaires"
- Section "Continuer la lecture / l'ecoute" (reprise)
- Section "Recommandations" (basees sur les categories consultees)

#### Regles metiers
- Les recommandations sont basees sur l'historique de consultation et les categories
- La page d'accueil est personnalisee pour chaque abonne
- Les visiteurs voient une version generique (decouverte)

#### Limites d'implementation
- Recommandations basees sur des regles simples (categories, popularite, nouveaute) — pas d'IA avancee

#### Criteres d'acceptation
- La page d'accueil charge en moins de 3 secondes
- Les sections sont alimentees avec des contenus pertinents
- La reprise de lecture/ecoute fonctionne correctement

---

### 6.7 Lecteur ebook

#### Description
Permettre la lecture securisee des ebooks directement dans l'application.

#### Fonctionnalites
- Lecture EPUB / PDF integree
- Marque-pages
- Surlignage de texte
- Mode nuit
- Taille de police ajustable
- Reprise automatique de lecture

#### Regles metiers
- Lecture uniquement dans l'application (web et mobile)
- Aucun telechargement du fichier brut
- L'acces est verifie a chaque session
- Les marque-pages et surlignages sont synchronises entre devices

#### Criteres d'acceptation
- Lecture fluide sur web et mobile
- Reprise automatique fonctionnelle au bon endroit
- Impossible d'acceder au fichier source
- Marque-pages et surlignage sauvegardent correctement
- Mode nuit et taille de police s'appliquent immediatement

---

### 6.8 Lecteur audio

#### Description
Permettre l'ecoute securisee des livres audio.

#### Fonctionnalites
- Lecture audio en streaming (HTTP)
- Pause / reprise
- Vitesse de lecture ajustable (0.5x, 1x, 1.25x, 1.5x, 2x)
- Reprise automatique
- Playlist personnelle

#### Infrastructure audio
- Audio pre-encode (pas de transcoding en temps reel)
- Streaming HTTP simple via CDN
- Gestion reseau faible (buffering adaptatif, reprise sur coupure)

#### Regles metiers
- Streaming uniquement (sauf mode hors-ligne controle — voir section 6.9)
- Acces conditionne a l'abonnement
- La position de lecture est sauvegardee cote serveur

#### Criteres d'acceptation
- Lecture stable sur connexion moyenne
- Reprise correcte apres interruption
- Vitesse ajustable sans bug ni distorsion
- Playlist sauvegardee et persistante

---

### 6.9 Mode hors-ligne controle

#### Description
Permettre une consommation temporaire de contenu sans connexion internet. Fonctionnalite contractuelle applicable principalement au mobile.

#### Fonctionnalites
- Telechargement de contenus pour lecture / ecoute hors-ligne
- Chiffrement local des fichiers telecharges (AES 256)
- Synchronisation automatique au retour en ligne
- Purge automatique des contenus expires

#### Regles metiers
- Le contenu telecharge est chiffre localement (AES 256)
- Duree d'acces hors-ligne limitee (configurable, defaut : 72 heures)
- Verification obligatoire de l'abonnement au retour en ligne
- Si l'abonnement est expire au retour en ligne → purge immediate des contenus locaux
- Aucun acces au fichier brut (le contenu reste chiffre et lisible uniquement via l'application)
- Nombre maximum de contenus telechargeable simultanement (configurable, defaut : 5)

#### Limites d'implementation
- Mode hors-ligne = best-effort, pas de DRM lourd
- Fonctionne principalement sur mobile (React Native)
- Le web peut proposer un mode cache limite (service worker)

#### Criteres d'acceptation
- Le contenu est accessible hors-ligne pendant la duree autorisee
- Le contenu est inaccessible apres expiration du delai
- Aucun acces au fichier brut meme en mode hors-ligne
- La synchronisation au retour en ligne est transparente
- Les contenus sont purges si l'abonnement a expire

---

### 6.10 Notifications push

#### Description
Informer les utilisateurs d'evenements importants via des notifications push.

#### Service (impose par contrat)
- **Firebase Cloud Messaging (FCM)**

#### Fonctionnalites
- Notifications de nouveaux contenus
- Rappels de reprise de lecture / ecoute
- Notifications d'expiration d'abonnement
- Notifications administratives (maintenance, nouveautes)

#### Regles metiers
- Les notifications ne sont envoyees qu'aux utilisateurs ayant donne leur consentement
- L'utilisateur peut desactiver les notifications depuis son profil
- Les notifications sont envoyees en francais

#### Criteres d'acceptation
- Les notifications arrivent sur mobile (Android & iOS)
- Les notifications web fonctionnent (si navigateur compatible)
- L'utilisateur peut activer/desactiver les notifications
- Les notifications d'expiration arrivent avant la date d'expiration

---

### 6.11 Analytics & suivi

#### Description
Collecter des donnees d'usage pour ameliorer le produit et suivre les KPIs.

#### Service (impose par contrat)
- **Google Analytics**

#### Metriques suivies
- Nombre d'inscriptions
- Taux de conversion visiteur → abonne
- Taux de retention (J7, J30, J90)
- Temps moyen de lecture / ecoute
- Contenus les plus consultes
- Taux de churn
- Revenus recurrents (MRR)

#### Regles metiers
- Le tracking respecte le consentement utilisateur (RGPD / reglementations locales)
- Les donnees sont anonymisees pour les rapports agreges
- Les statistiques sont accessibles dans le back-office

#### Criteres d'acceptation
- Les events sont correctement traces dans Google Analytics
- Les statistiques back-office sont coherentes avec les donnees Analytics
- Le consentement utilisateur est respecte

---

### 6.12 Emailing transactionnel

#### Description
Envoyer des emails automatises lies au cycle de vie de l'utilisateur.

#### Service (impose par contrat)
- **Brevo** ou **Mailchimp**

#### Types d'emails
- Confirmation d'inscription
- Confirmation de paiement
- Rappel d'expiration d'abonnement
- Reinitialisation de mot de passe
- Bienvenue apres premier abonnement

#### Regles metiers
- Les emails transactionnels sont envoyes automatiquement
- L'utilisateur peut se desabonner des emails marketing (pas des transactionnels)
- Les emails sont envoyes en francais

#### Criteres d'acceptation
- Chaque email transactionnel est envoye dans les 2 minutes suivant l'evenement
- Les emails sont correctement formules et sans erreur
- Le lien de reinitialisation de mot de passe fonctionne
- Le desabonnement marketing est effectif

---

### 6.13 Back-office administrateur

#### Description
Permettre la gestion complete du systeme par les administrateurs.

#### Interface
- **AdminJS** (impose par contrat)

#### Fonctionnalites

**Gestion des utilisateurs**
- Liste, recherche, detail utilisateur
- Activation / desactivation de compte
- Historique d'activite

**Gestion des abonnements**
- Liste des abonnements actifs / expires
- Gestion manuelle (activation, prolongation, annulation)

**Gestion du catalogue**
- Ajout / modification / suppression de contenus
- Upload de fichiers (EPUB, PDF, MP3, M4A)
- Gestion des metadonnees et categories

**Gestion des licences et ayants droit**
- Enregistrement des editeurs et auteurs partenaires
- Association contenu ↔ ayant droit
- Suivi des droits de diffusion

**Statistiques**
- Lectures (nombre, duree, contenus populaires)
- Ecoutes (nombre, duree, contenus populaires)
- Abonnes actifs
- Revenus (MRR, total)
- Retention (J7, J30, J90)

#### Criteres d'acceptation
- Les actions admin sont securisees (authentification obligatoire)
- Les modifications sont effectives immediatement
- Les statistiques sont coherentes et mises a jour quotidiennement
- L'upload de fichiers fonctionne pour tous les formats supportes

---

## 7. Securite & gestion des droits

### 7.1 Authentification
- JWT + HTTPS obligatoire
- Session expiree apres inactivite

### 7.2 Chiffrement
- Fichiers chiffres AES 256 (stockage et hors-ligne)
- URLs temporaires signees pour l'acces aux fichiers

### 7.3 DRM leger (best-effort)
- Lecture uniquement dans l'application
- Aucun telechargement de fichier brut
- URLs temporaires avec expiration
- Controle d'acces verifie a chaque session
- Pas de watermarking ni DRM lourd

### 7.4 Protection des donnees
- HTTPS sur toutes les communications
- Mots de passe chiffres cote serveur
- Donnees personnelles protegees conformement aux reglementations applicables

---

## 8. Exigences non fonctionnelles

### 8.1 Performance
- Temps de chargement pages < 3 secondes
- Lecture audio sans coupure sur connexion moyenne
- Recherche < 1 seconde

### 8.2 Securite
- HTTPS obligatoire
- JWT securise
- Fichiers chiffres AES 256
- URLs temporaires signees

### 8.3 Scalabilite
- Architecture API-first (REST)
- Stockage objet compatible S3 (Cloudflare R2)
- CDN obligatoire pour les contenus media (Cloudflare CDN natif)
- Base de donnees Supabase

### 8.4 Compatibilite
- Web : navigateurs modernes (Chrome, Firefox, Safari, Edge)
- Mobile : Android 8+ et iOS 14+

### 8.5 Reseau faible
- Compression des assets
- Lazy loading des images et contenus
- Cache agressif
- Fallback gracieux en cas de perte de connexion

---

## 9. Stack technique (imposee par contrat)

| Couche | Technologie |
|--------|------------|
| Frontend Web | React.js |
| Frontend Mobile | React Native (Android & iOS) |
| Backend | Node.js + Express.js |
| API | REST securisee |
| Base de donnees | Supabase |
| Stockage fichiers | Cloudflare R2 (compatible S3) |
| Recherche | Meilisearch ou Elasticsearch |
| Notifications push | Firebase (FCM) |
| Analytics | Google Analytics |
| Emailing | Brevo ou Mailchimp |
| Back-office | AdminJS |

**Aucune alternative technologique n'est autorisee sans avenant contractuel.**

---

## 10. Dependances externes

- **Stripe** — paiements internationaux
- **Flutterwave** — paiements Afrique / diaspora
- **Cloudflare R2** — stockage fichiers (compatible S3, 0 frais d'egress)
- **Firebase** — notifications push
- **Google Analytics** — tracking et analytics
- **Brevo / Mailchimp** — emailing transactionnel
- **Meilisearch / Elasticsearch** — moteur de recherche
- **Apple App Store** — distribution iOS
- **Google Play Store** — distribution Android

---

## 11. Hypotheses et signaux de validation

| Hypothese | Signal de validation | Metrique cible (fourchette MVP) |
|-----------|---------------------|-------------------------------|
| Les utilisateurs acceptent un abonnement mensuel sans essai gratuit | Taux de conversion visiteur → abonne | 3 – 8 % |
| La lecture in-app (DRM leger) est suffisante pour proteger les contenus | Taux de piratage detecte | < 5 % des contenus |
| Les moyens de paiement (Stripe + Flutterwave) couvrent la majorite des utilisateurs | Taux d'echec de paiement | < 10 % |
| La performance est critique pour la retention | Retention J30 | 20 – 35 % |
| Le mode hors-ligne augmente l'engagement sur mobile | % utilisateurs activant le hors-ligne | > 15 % |
| L'audio represente une part significative de la consommation | Ratio ecoute / lecture | > 30 % des sessions |

---

## 12. Risques produit

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Piratage de contenus | Eleve | DRM leger + URLs temporaires + chiffrement AES 256 |
| Refus App Store / Play Store | Moyen | Respect strict des guidelines, pas de paiement in-app contourne |
| Complexite paiements (double passerelle) | Moyen | Tests intensifs Stripe + Flutterwave en pre-production |
| Scope creep | Eleve | Scope fige par cahier de charge contractuel |
| Abandon utilisateur si UX lente | Eleve | Performance < 3s, CDN, optimisation reseau faible |
| Mode hors-ligne complexe a securiser | Moyen | Implementation best-effort, TTL strict, purge automatique |
| Problemes de connectivite (marche africain) | Eleve | Cache agressif, lazy loading, compression, fallback gracieux |

---

## 13. Priorisation d'execution

### Must Have (livraison obligatoire)
- Authentification & comptes
- Abonnements & paiements (Stripe + Flutterwave)
- Catalogue de contenus
- Recherche & filtres
- Lecteur ebook (avec surlignage)
- Lecteur audio (avec streaming)
- Mode hors-ligne controle
- Back-office complet (avec licences)
- Securite & DRM leger
- Notifications push (Firebase)
- Analytics (Google Analytics)
- Emailing transactionnel (Brevo/Mailchimp)
- Onboarding MVP
- Page d'accueil avec recommandations
- Historique de lecture / ecoute

### Ordre d'execution recommande (non contractuel)
1. Backend & API (authentification, abonnements, paiements, catalogue)
2. Frontend Web (interfaces, lecteurs, recherche)
3. Frontend Mobile (React Native, hors-ligne)
4. Back-office (AdminJS, statistiques, licences)
5. Integrations (notifications, analytics, emailing)
6. Tests & securite
7. Deploiement

---

## 14. Gouvernance produit

- Le cahier de charge signe (31/01/2026) est la source de verite contractuelle
- Le scope est couvert a 100 % — aucune fonctionnalite ne peut etre supprimee sans avenant client
- Toute evolution hors cahier de charge necessite validation ecrite du client
- Ce PRD est la reference produit pour l'equipe de developpement
- **Aucun engagement calendrier** n'est inclus dans ce document — le planning est gere separement
