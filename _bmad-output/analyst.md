# Analyst.md — Bibliothèque Numérique Privée

## 1. Contexte et vision du projet

Le projet consiste à développer une plateforme de bibliothèque numérique privée accessible via :
- une application web,
- une application mobile Android et iOS.

L’accès à la plateforme est conditionné par un abonnement payant.
Les utilisateurs abonnés peuvent consulter :
- des livres numériques (EPUB, PDF),
- des livres audio (MP3, M4A),
- des contenus éditoriaux exclusifs.

La plateforme doit être sécurisée, scalable, et pensée dès le départ comme un produit SaaS à potentiel international.

---

## 2. Problème à résoudre

### 2.1 Problèmes utilisateurs
- Difficulté d’accès à des contenus numériques de qualité dans un environnement centralisé
- Absence de plateformes locales adaptées aux marchés africains et diasporas
- Mauvaise expérience utilisateur sur des solutions existantes (complexité, lenteur, manque de curation)
- Problèmes de piratage et de protection des contenus

### 2.2 Problèmes business
- Nécessité de monétiser les contenus de manière récurrente
- Gestion des droits d’accès et des licences
- Scalabilité des paiements (Afrique + international)
- Protection de la valeur du contenu (DRM léger)

---

## 3. Objectifs du produit

### 3.1 Objectifs principaux
- Offrir un accès fluide et sécurisé à une bibliothèque numérique privée
- Mettre en place un modèle d’abonnement simple et fiable
- Garantir la protection des contenus (lecture uniquement dans l’application)
- Créer une base technique évolutive

### 3.2 Objectifs secondaires
- Préparer l’intégration d’éditeurs et auteurs partenaires
- Collecter des données d’usage pour améliorer la recommandation
- Permettre une montée en charge progressive (scaling)

---

## 4. Périmètre fonctionnel (Scope)

### 4.1 Inclus (IN SCOPE)
- Authentification utilisateur
- Gestion des abonnements
- Paiements (Stripe / Flutterwave)
- Catalogue ebooks et audiobooks
- Lecteur ebook intégré (EPUB, PDF)
- Lecteur audio intégré
- Recherche et filtres
- Back-office d’administration
- Statistiques de base
- Sécurité et DRM léger

### 4.2 Exclus (OUT OF SCOPE – Phase 1)
- Marketplace auteur autonome
- Recommandation par IA avancée
- Téléchargement libre des fichiers
- Partage social des contenus
- Multilingue complet (au-delà du minimum)

---

## 5. Typologie des utilisateurs

### 5.1 Visiteur
- Accès limité (pages publiques)
- Découverte du produit
- Incitation à l’abonnement

### 5.2 Utilisateur abonné
- Accès complet aux contenus
- Lecture et écoute illimitées
- Gestion de son profil et abonnement

### 5.3 Administrateur
- Gestion des utilisateurs
- Gestion des abonnements
- Gestion du catalogue
- Suivi des statistiques

---

## 6. Parcours utilisateur (User Journey)

### 6.1 Parcours abonné
1. Découverte de la plateforme
2. Création de compte
3. Souscription à un abonnement
4. Accès au catalogue
5. Lecture / écoute
6. Reprise automatique
7. Renouvellement ou annulation

### 6.2 Parcours administrateur
1. Connexion au back-office
2. Ajout / modification de contenus
3. Gestion des abonnements
4. Consultation des statistiques

---

## 7. Hypothèses clés (à valider)

- Les utilisateurs acceptent un modèle d’abonnement mensuel
- La lecture exclusivement in-app est suffisante (DRM léger)
- Les moyens de paiement proposés couvrent la majorité des utilisateurs
- La performance de lecture/audio est critique pour la rétention

---

## 8. Contraintes

### 8.1 Techniques
- Sécurité élevée des contenus
- Performances acceptables même avec connexion moyenne
- Support multi-plateforme (web + mobile)

### 8.2 Business
- Budget maîtrisé
- Délai de livraison court
- Priorité au MVP fonctionnel

---

## 9. Indicateurs de succès (KPI)

### 9.1 KPI produit
- Nombre d’inscriptions
- Taux de conversion visiteur → abonné
- Taux de rétention
- Temps moyen de lecture / écoute

### 9.2 KPI techniques
- Temps de chargement
- Taux d’erreur API
- Stabilité des paiements

---

## 10. Risques identifiés

| Risque | Impact | Mitigation |
|------|-------|-----------|
| Piratage de contenus | Élevé | DRM léger + URLs sécurisées |
| Refus App Store / Play Store | Moyen | Respect guidelines |
| Complexité paiements | Moyen | Tests intensifs |
| Scope creep | Élevé | Scope figé Phase 1 |

---

## 11. Décisions structurantes (non négociables)

- Lecture uniquement dans l’application
- Accès conditionné à un abonnement actif
- Backend centralisé via API
- Séparation claire Frontend / Backend
- Une seule source de vérité fonctionnelle (ce document)

---

## 12. Livrables attendus (Phase 1)

- Plateforme web fonctionnelle
- Applications mobiles Android et iOS
- Back-office opérationnel
- Système de paiement actif
- Catalogue accessible
- Sécurité et contrôle d’accès validés

---

## 13. Évolution post-MVP (Phase 2 – non immédiat)

- Système de recommandation avancé
- Comptes auteurs / éditeurs
- Multilingue étendu
- Mode hors-ligne avancé
- Analytics avancés

---

## 14. Règle de gouvernance du projet

- Toute modification de scope nécessite validation formelle
- Toute décision technique majeure doit être documentée
- Ce fichier `analyst.md` fait foi pour toutes les phases suivantes
