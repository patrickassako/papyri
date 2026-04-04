# Plan de Test Complet — Papyri (Bibliothèque Numérique)
**Version :** 2.0
**Date :** 2026-04-03
**Périmètre :** Web · Backend API · Mobile (Expo)
**Rédacteur :** Afrik NoCode / Patrick Essomba

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ✅ | Passé |
| ❌ | Échoué |
| ⏭ | Non testé |
| 🔴 | Bloquant — stoppe les tests |
| 🟠 | Important — à corriger avant livraison |
| 🟡 | Mineur — peut attendre |

---

## Environnements

| Environnement | URL | Prérequis |
|---------------|-----|-----------|
| Web (dev) | `http://localhost:5173` | `npm run dev` dans `/web` |
| Backend (dev) | `http://localhost:3001` | `node src/index.js` dans `/backend` |
| Admin | `http://localhost:3001/admin` | Backend démarré |
| Mobile | Expo Go + QR code | `npx expo start` dans `/mobile` |

## Comptes de Test

| Rôle | Email | Notes |
|------|-------|-------|
| Admin | afriknocode@gmail.com | Accès complet back-office |
| Abonné actif | À créer | Plan Personnel Slow (400 textes / 1 audio) |
| Non abonné | À créer | Pour tester les restrictions |
| Éditeur | À inviter depuis admin | Espace publisher |

---

## MODULE 1 — Authentification & Comptes

### 1.1 Inscription
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 1.1.1 | Inscription valide | email unique, mdp ≥ 8 cars, nom complet | Compte créé, redirection `/onboarding` | 🔴 | ⏭ |
| 1.1.2 | Email déjà utilisé | email existant | Message « Email déjà utilisé » | 🟠 | ⏭ |
| 1.1.3 | Mot de passe trop court | `< 8 cars` | Erreur inline sous le champ | 🟠 | ⏭ |
| 1.1.4 | Champs vides | Formulaire vide | Bouton désactivé ou erreurs inline | 🟡 | ⏭ |
| 1.1.5 | Format email invalide | `user@` | Message erreur format | 🟡 | ⏭ |
| 1.1.6 | Lien « Se connecter » | Clic | Navigation `/login` sans rechargement | 🟡 | ⏭ |

### 1.2 Connexion
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 1.2.1 | Connexion utilisateur standard | email+mdp valides | Redirection `/dashboard` | 🔴 | ⏭ |
| 1.2.2 | Connexion admin | email admin+mdp | Accès `/admin/dashboard` | 🔴 | ⏭ |
| 1.2.3 | Connexion éditeur | email éditeur+mdp | Accès `/publisher/dashboard` | 🟠 | ⏭ |
| 1.2.4 | Mauvais mot de passe | mdp incorrect | Message d'erreur visible | 🟠 | ⏭ |
| 1.2.5 | Compte inexistant | email inconnu | Message d'erreur générique | 🟠 | ⏭ |
| 1.2.6 | Lien « S'inscrire » | Clic | Navigation `/register` sans rechargement | 🟡 | ⏭ |
| 1.2.7 | Afficher/masquer mot de passe | Clic icône œil | Champ bascule text↔password | 🟡 | ⏭ |

### 1.3 Onboarding (après inscription)
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 1.3.1 | Carousel affiché | 1ère connexion | Écrans onboarding visibles | 🟠 | ⏭ |
| 1.3.2 | Navigation carousel | Boutons Suivant/Précédent | Transitions fluides | 🟡 | ⏭ |
| 1.3.3 | Terminer onboarding | Clic « Commencer » | Redirection `/dashboard` | 🟠 | ⏭ |

### 1.4 Sécurité de session
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 1.4.1 | Déconnexion | Clic « Se déconnecter » | Token effacé, redirection `/login` | 🔴 | ⏭ |
| 1.4.2 | Accès route protégée sans token | URL directe `/dashboard` | Redirection `/login` | 🔴 | ⏭ |
| 1.4.3 | Refresh token expiré | Attendre expiration | Auto-refresh ou redirection `/login` | 🟠 | ⏭ |
| 1.4.4 | Route admin avec compte standard | URL `/admin/dashboard` | Redirection `/dashboard` (403) | 🔴 | ⏭ |
| 1.4.5 | Route publisher avec compte standard | URL `/publisher/dashboard` | Redirection `/dashboard` | 🔴 | ⏭ |

### 1.5 Mot de passe oublié
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 1.5.1 | Email valide enregistré | email existant | Message « Email envoyé » | 🟠 | ⏭ |
| 1.5.2 | Email inconnu | email absent | Message générique (no enumeration) | 🟠 | ⏭ |
| 1.5.3 | Lien reset valide | Lien depuis email | Formulaire reset mdp affiché | 🟠 | ⏭ |
| 1.5.4 | Lien reset expiré | Lien périmé | Message d'erreur explicite | 🟡 | ⏭ |

---

## MODULE 2 — Catalogue & Recherche

### 2.1 Page Catalogue (`/catalogue`)
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 2.1.1 | Chargement initial | — | Grille de contenus avec couvertures | 🔴 | ⏭ |
| 2.1.2 | Filtre type Ebook | `type=ebook` | Seuls les ebooks | 🟠 | ⏭ |
| 2.1.3 | Filtre type Audiobook | `type=audiobook` | Seuls les audiobooks | 🟠 | ⏭ |
| 2.1.4 | Filtre par catégorie | Sélection catégorie | Contenus filtrés | 🟠 | ⏭ |
| 2.1.5 | Filtre par langue | Français / Anglais | Contenus filtrés | 🟠 | ⏭ |
| 2.1.6 | Tri par date | `sort=newest` | Du plus récent au plus ancien | 🟡 | ⏭ |
| 2.1.7 | Tri par popularité | `sort=popular` | Ordre décroissant | 🟡 | ⏭ |
| 2.1.8 | Cumul filtres | type + catégorie | Les deux filtres actifs | 🟠 | ⏭ |
| 2.1.9 | Persistance filtres URL | Retour depuis fiche | Filtres dans l'URL conservés | 🟡 | ⏭ |
| 2.1.10 | Pagination | Clic page suivante | Contenus suivants chargés | 🟠 | ⏭ |
| 2.1.11 | Résultat vide | Filtres sans résultat | Message « Aucun contenu trouvé » | 🟡 | ⏭ |
| 2.1.12 | Clic sur un livre | — | Navigation vers `/catalogue/:id` | 🔴 | ⏭ |

### 2.2 Recherche
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 2.2.1 | Recherche par titre | « roman » | Résultats pertinents (Meilisearch ou fallback DB) | 🟠 | ⏭ |
| 2.2.2 | Recherche par auteur | « Victor Hugo » | Résultats pertinents | 🟠 | ⏭ |
| 2.2.3 | Autocomplete | Saisie 3 lettres | Dropdown avec suggestions | 🟠 | ⏭ |
| 2.2.4 | Clic suggestion | Sélection item | Navigation vers fiche contenu | 🟠 | ⏭ |
| 2.2.5 | Terme sans résultat | « xyzqwerty » | Message « Aucun résultat » | 🟡 | ⏭ |
| 2.2.6 | Effacer la recherche | Vider le champ | Retour catalogue complet | 🟡 | ⏭ |

### 2.3 Fiche Contenu (`/catalogue/:id`)

> **Règle d'accès :** Un abonné doit DÉBLOQUER un livre (quota) avant de pouvoir LIRE. Le bouton « Lire » n'apparaît que si le contenu est déjà débloqué.

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 2.3.1 | Fiche ebook chargée | id ebook | Titre, auteur, description, couverture, format | 🔴 | ⏭ |
| 2.3.2 | Fiche audiobook chargée | id audiobook | Titre, durée, couverture | 🔴 | ⏭ |
| 2.3.3 | Recommandations affichées | — | Section recommandations visible | 🟡 | ⏭ |
| 2.3.4 | Avis lecteurs | — | Notes et commentaires visibles | 🟡 | ⏭ |
| **Visiteur non connecté** | | | | | |
| 2.3.5 | Livre abonnement (non connecté) | `access_type=subscription` | Bouton « Se connecter pour accéder » | 🔴 | ⏭ |
| 2.3.6 | Livre payant (non connecté) | `access_type=paid` | Bouton « Se connecter pour acheter » + prix | 🔴 | ⏭ |
| **Abonné actif (contenu non débloqué)** | | | | | |
| 2.3.7 | Livre abonnement non débloqué | abonné actif | Bouton **« Débloquer avec mon abonnement »** + quota affiché | 🔴 | ⏭ |
| 2.3.8 | Livre payant non débloqué | abonné actif | Bouton **« Acheter au prix réduit »** + prix abonné | 🔴 | ⏭ |
| 2.3.9 | Livre `subscription_or_paid` non débloqué | abonné actif | Choix débloquer (quota) ou acheter | 🟠 | ⏭ |
| **Abonné actif (contenu débloqué)** | | | | | |
| 2.3.10 | Ebook débloqué | abonné + unlock | Bouton **« Lire maintenant »** | 🔴 | ⏭ |
| 2.3.11 | Audiobook débloqué | abonné + unlock | Bouton **« Écouter maintenant »** | 🔴 | ⏭ |
| **Non abonné** | | | | | |
| 2.3.12 | Livre abonnement (non abonné) | compte sans abonnement | Bouton « Prendre un abonnement » | 🔴 | ⏭ |
| 2.3.13 | Livre payant (non abonné) | compte sans abonnement | Bouton « Acheter sans réduction » + prix plein | 🟠 | ⏭ |

### 2.4 Déblocage de contenu
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 2.4.1 | Débloquer livre abonnement (quota dispo) | Clic « Débloquer » | Quota `-1`, redirection lecteur | 🔴 | ⏭ |
| 2.4.2 | Quota affiché sur la fiche | Abonné | « Quota texte : X / 400 (Y restants) » | 🔴 | ⏭ |
| 2.4.3 | Quota épuisé (texte) | `text_unlocked_count = text_quota` | Message quota épuisé, proposition bonus | 🟠 | ⏭ |
| 2.4.4 | Quota épuisé mais bonus disponible | Bonus credits actifs | Déblocage via bonus | 🟠 | ⏭ |
| 2.4.5 | Débloquer livre payant — Flutterwave | Clic « Acheter » | Redirection Flutterwave Checkout | 🟠 | ⏭ |
| 2.4.6 | Callback paiement réussi | `?status=successful&tx_ref=...` | Contenu débloqué, bouton « Lire » | 🟠 | ⏭ |
| 2.4.7 | Callback paiement échoué | `?status=cancelled` | Message erreur, invitation à réessayer | 🟠 | ⏭ |
| 2.4.8 | Déblocage idempotent | Re-débloquer livre déjà débloqué | Succès sans consommer de quota | 🟠 | ⏭ |

---

## MODULE 3 — Lecteur Ebook Web

### 3.1 EPUB
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 3.1.1 | Ouverture lecteur | `/read/:id` (ebook débloqué EPUB) | **Livre affiché** dans la zone de lecture | 🔴 | ⏭ |
| 3.1.2 | Chargement — barre de progression | Fichier > 1 MB | Barre progression pendant téléchargement | 🟡 | ⏭ |
| 3.1.3 | Navigation page suivante | Clic flèche droite ou bouton | Page suivante affichée | 🔴 | ⏭ |
| 3.1.4 | Navigation page précédente | Clic flèche gauche | Page précédente affichée | 🔴 | ⏭ |
| 3.1.5 | Table des matières | Clic icône Menu | Chapitres listés | 🟠 | ⏭ |
| 3.1.6 | Clic chapitre dans TOC | Sélection chapitre | Navigation directe au chapitre | 🟠 | ⏭ |
| 3.1.7 | Taille de police | Slider font 80%→140% | Texte redimensionné | 🟡 | ⏭ |
| 3.1.8 | Mode nuit | Toggle | Fond sombre, texte clair | 🟡 | ⏭ |
| 3.1.9 | Surlignage texte | Sélection + couleur | Surligné en couleur, sauvegardé | 🟡 | ⏭ |
| 3.1.10 | Ajout note sur surlignage | Texte note | Note associée au surlignage | 🟡 | ⏭ |
| 3.1.11 | Marque-page | Clic icône signet | Marque-page créé à la position courante | 🟡 | ⏭ |
| 3.1.12 | Recherche dans le livre | Saisie mot-clé | Résultats dans le sidebar | 🟡 | ⏭ |
| 3.1.13 | Slider progression | Déplacer curseur | Saut à la position correspondante | 🟠 | ⏭ |
| 3.1.14 | Plein écran | Clic icône Maximize | Mode plein écran activé | 🟡 | ⏭ |
| 3.1.15 | Sauvegarde progression | Lire N pages, fermer, rouvrir | Reprise à la dernière page | 🔴 | ⏭ |
| 3.1.16 | Erreur accès refusé | Token expiré ou contenu non débloqué | Message d'erreur + bouton retour catalogue | 🟠 | ⏭ |
| 3.1.17 | Bouton retour | Clic flèche retour header | Navigation `/catalogue/:id` | 🟠 | ⏭ |

### 3.2 PDF
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 3.2.1 | Ouverture PDF | `/read/:id` (ebook PDF) | PDF rendu sur canvas | 🟠 | ⏭ |
| 3.2.2 | Navigation pages | Flèches | Pages précédente/suivante | 🟠 | ⏭ |
| 3.2.3 | Indicateur page | — | « Page X / Total » affiché | 🟡 | ⏭ |
| 3.2.4 | Sauvegarde page courante | Fermer, rouvrir | Reprise à la bonne page | 🟠 | ⏭ |

---

## MODULE 4 — Lecteur Audio Web

### 4.1 Lecture
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 4.1.1 | Ouverture lecteur audio | `/listen/:id` (audiobook débloqué) | Interface audio chargée | 🔴 | ⏭ |
| 4.1.2 | Lecture démarre | Auto-play ou clic Play | Audio joué | 🔴 | ⏭ |
| 4.1.3 | Pause / Reprise | Bouton Play/Pause | Audio s'arrête et reprend | 🔴 | ⏭ |
| 4.1.4 | Avance rapide +30s | Bouton +30 | Saut en avant 30 secondes | 🟠 | ⏭ |
| 4.1.5 | Retour -10s | Bouton -10 | Saut en arrière 10 secondes | 🟠 | ⏭ |
| 4.1.6 | Vitesse de lecture | Sélecteur 0.5x → 2x | Vitesse appliquée | 🟠 | ⏭ |
| 4.1.7 | Navigation chapitres | Clic chapitre liste | Lecture depuis ce chapitre | 🟠 | ⏭ |
| 4.1.8 | Barre de progression | Clic sur timeline | Saut à la position | 🟠 | ⏭ |
| 4.1.9 | Sauvegarde position | Fermer, rouvrir | Reprise à la position | 🔴 | ⏭ |
| 4.1.10 | Mini-player persistant | Naviguer vers autre page | Mini-player visible en bas d'écran | 🟠 | ⏭ |
| 4.1.11 | Mini-player — cliquer | Clic sur mini-player | Retour à la page lecteur audio | 🟡 | ⏭ |

---

## MODULE 5 — Abonnements & Paiements

### 5.1 Page Tarification (`/pricing`)
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 5.1.1 | Plans affichés | — | Plans avec prix et fonctionnalités | 🔴 | ⏭ |
| 5.1.2 | Clic plan mensuel (non abonné) | Utilisateur sans abonnement | Dialog choix méthode paiement | 🔴 | ⏭ |
| 5.1.3 | Choix Stripe | Clic « Carte bancaire » | Redirection Stripe Checkout | 🔴 | ⏭ |
| 5.1.4 | Choix Flutterwave | Clic « Mobile Money » | Redirection Flutterwave | 🔴 | ⏭ |
| 5.1.5 | Callback Stripe réussi | `?provider=stripe&session_id=...` | Abonnement activé, message succès | 🔴 | ⏭ |
| 5.1.6 | Callback Flutterwave réussi | `?tx_ref=...&transaction_id=...&status=successful` | Abonnement activé | 🔴 | ⏭ |
| 5.1.7 | Code promo valide | Code actif pendant checkout | Réduction appliquée | 🟠 | ⏭ |
| 5.1.8 | Code promo invalide / expiré | Code incorrect | Message d'erreur | 🟠 | ⏭ |

### 5.2 Gestion Abonnement (`/subscription`)
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 5.2.1 | Abonnement actif affiché | Utilisateur abonné | Plan, date renouvellement, statut | 🔴 | ⏭ |
| 5.2.2 | Date renouvellement correcte | Plan mensuel | **+30 jours** (pas 60) après souscription | 🔴 | ⏭ |
| 5.2.3 | Quota affiché | — | Textes et audios utilisés / quota | 🟠 | ⏭ |
| 5.2.4 | Historique paiements | — | Liste des transactions avec montant et date | 🟠 | ⏭ |
| 5.2.5 | Téléchargement facture PDF | Clic icône download | PDF téléchargé (nom `INV-YYYYMMDD-XXXX.pdf`) | 🟠 | ⏭ |
| 5.2.6 | Facture non accessible pour autre user | ID paiement étranger | Erreur 403 / 404 | 🔴 | ⏭ |
| 5.2.7 | Annulation abonnement | Clic « Annuler » | Dialog confirmation, puis `cancel_at_period_end = true` | 🟠 | ⏭ |
| 5.2.8 | Réactivation après annulation | Clic « Réactiver » | `cancel_at_period_end = false` | 🟠 | ⏭ |
| 5.2.9 | Abonnement inactif / expiré | Compte sans abonnement actif | Bouton « Prendre un abonnement » visible | 🟠 | ⏭ |

---

## MODULE 6 — Historique de Lecture (`/history`)

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 6.1 | Historique chargé | — | Liste avec couvertures et progression | 🟠 | ⏭ |
| 6.2 | Groupement par période | — | Aujourd'hui / Hier / Cette semaine | 🟡 | ⏭ |
| 6.3 | Bouton « Reprendre » | Clic | Redirection directe vers lecteur | 🟠 | ⏭ |
| 6.4 | Pagination / Charger plus | > 20 items | Bouton « Charger plus » fonctionne | 🟡 | ⏭ |
| 6.5 | Filtrage En cours / Terminé | Toggle | Filtrage correct | 🟡 | ⏭ |
| 6.6 | Recherche dans l'historique | Saisie titre | Filtrage temps réel | 🟡 | ⏭ |
| 6.7 | Historique vide | Aucune lecture | Message « Aucune lecture » | 🟡 | ⏭ |

---

## MODULE 7 — Dashboard Utilisateur (`/dashboard`)

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 7.1 | Stats lisibles | — | Livres lus, temps total, quota affiché | 🟠 | ⏭ |
| 7.2 | Section « Reprendre » — livre en cours | Livre partiellement lu | Carte avec progression %, clic → lecteur direct | 🔴 | ⏭ |
| 7.3 | Section « Reprendre » — vide | Aucune lecture | Message ou section masquée | 🟡 | ⏭ |
| 7.4 | Section « Nouveautés » | — | Derniers contenus ajoutés | 🟠 | ⏭ |
| 7.5 | Clic livre dans « Nouveautés » | — | Redirige vers **`/catalogue/:id`** (PAS lecteur) | 🔴 | ⏭ |
| 7.6 | Section « Populaires » | — | Contenus populaires | 🟠 | ⏭ |
| 7.7 | Clic livre dans « Populaires » | — | Redirige vers `/catalogue/:id` | 🔴 | ⏭ |
| 7.8 | Section « Recommandés » | Abonné avec historique | Recommandations personnalisées | 🟡 | ⏭ |
| 7.9 | Navigation sidebar | Clic liens | Navigation sans rechargement | 🟠 | ⏭ |

---

## MODULE 8 — Profil Utilisateur (`/profile`)

### 8.1 Informations personnelles
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 8.1.1 | Chargement profil | — | Nom, email, avatar affiché | 🟠 | ⏭ |
| 8.1.2 | Modification nom | Nouveau nom | Sauvegardé, toast confirmation | 🟠 | ⏭ |
| 8.1.3 | Upload avatar | Image PNG/JPG < 5MB | Préview, upload, avatar mis à jour | 🟠 | ⏭ |
| 8.1.4 | Avatar trop lourd | Image > 5MB | Message d'erreur taille | 🟡 | ⏭ |
| 8.1.5 | Changement mot de passe | Ancien + nouveau mdp valide | Succès confirmé | 🟠 | ⏭ |
| 8.1.6 | Mauvais ancien mdp | Mdp incorrect | Message d'erreur clair | 🟠 | ⏭ |
| 8.1.7 | Stats de lecture | — | Livres lus, temps total, progression | 🟡 | ⏭ |

### 8.2 Notifications
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 8.2.1 | Toggle notifications email | Switch on/off | Préférence sauvegardée en DB | 🟡 | ⏭ |
| 8.2.2 | Toggle notifications push | Switch on/off | Préférence sauvegardée | 🟡 | ⏭ |

### 8.3 Gestion appareils (`/devices`)
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 8.3.1 | Liste appareils connectés | — | Appareils listés (max 3) | 🟠 | ⏭ |
| 8.3.2 | Supprimer appareil | Clic supprimer | Appareil retiré | 🟠 | ⏭ |
| 8.3.3 | Dépasser limite 3 appareils | 4e appareil | Message limite atteinte | 🟠 | ⏭ |

### 8.4 RGPD
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 8.4.1 | Demande export données | Clic « Exporter mes données » | Demande créée, email confirmation | 🟡 | ⏭ |
| 8.4.2 | Demande suppression compte | Clic « Supprimer mon compte » | Confirmation dialog, demande créée | 🟡 | ⏭ |

---

## MODULE 9 — Notifications Web

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 9.1 | Badge compteur non-lues | Utilisateur avec notifs | Nombre affiché sur icône cloche | 🟠 | ⏭ |
| 9.2 | Ouverture panel | Clic cloche | Liste des notifications | 🟠 | ⏭ |
| 9.3 | Marquer une notif lue | Clic notification | Badge décrémenté | 🟠 | ⏭ |
| 9.4 | Marquer toutes lues | Clic « Tout marquer lu » | Badge = 0 | 🟠 | ⏭ |
| 9.5 | Fermer panel | Clic extérieur | Panel fermé | 🟡 | ⏭ |
| 9.6 | Notification en temps réel | Action backend | Badge mis à jour sans rechargement | 🟡 | ⏭ |

---

## MODULE 10 — Espace Éditeur (`/publisher`)

### 10.1 Activation compte éditeur
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 10.1.1 | Lien activation valide | Token admin | Formulaire activation visible | 🟠 | ⏭ |
| 10.1.2 | Token invalide/expiré | Token incorrect | Message d'erreur | 🟠 | ⏭ |
| 10.1.3 | Formulaire complété | Données valides | Compte activé, accès dashboard | 🟠 | ⏭ |

### 10.2 Dashboard Éditeur
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 10.2.1 | Stats résumées | — | Nb livres, lectures, revenus | 🟠 | ⏭ |
| 10.2.2 | Graphique revenus | — | Courbe mensuelle visible | 🟡 | ⏭ |

### 10.3 Gestion livres éditeur
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 10.3.1 | Liste des livres | — | Livres avec statut validation | 🟠 | ⏭ |
| 10.3.2 | Créer un livre | Métadonnées + fichier EPUB | Livre soumis pour validation | 🟠 | ⏭ |
| 10.3.3 | Upload couverture | Image JPEG < 5MB | Aperçu affiché | 🟠 | ⏭ |
| 10.3.4 | Upload fichier EPUB/MP3 | Fichier valide | Barre progression, upload réussi | 🟠 | ⏭ |
| 10.3.5 | Statut validation | — | En attente / Approuvé / Rejeté | 🟠 | ⏭ |
| 10.3.6 | Modifier un livre | Changements métadonnées | Modifications sauvegardées | 🟠 | ⏭ |

### 10.4 Revenus & Codes promo éditeur
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 10.4.1 | Tableau revenus par livre | — | Revenu par titre affiché | 🟠 | ⏭ |
| 10.4.2 | Créer code promo | Code + % + date exp | Code créé dans la liste | 🟠 | ⏭ |
| 10.4.3 | Quota codes promo respecté | Limite atteinte | Bouton « Créer » désactivé | 🟠 | ⏭ |
| 10.4.4 | Activer/désactiver code | Toggle | Statut mis à jour | 🟠 | ⏭ |

---

## MODULE 11 — Administration (`/admin`)

### 11.1 Dashboard Admin
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.1.1 | KPIs globaux | — | Utilisateurs actifs, revenus, abonnements | 🟠 | ⏭ |
| 11.1.2 | Activité récente | — | Logs d'audit affichés | 🟡 | ⏭ |

### 11.2 Gestion utilisateurs
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.2.1 | Liste utilisateurs | — | Tableau paginé avec rôles et statuts | 🟠 | ⏭ |
| 11.2.2 | Recherche par email | email | Filtrage résultats | 🟠 | ⏭ |
| 11.2.3 | Suspendre compte | Clic « Suspendre » | `is_active = false`, user bloqué | 🟠 | ⏭ |
| 11.2.4 | Réactiver compte | Clic « Réactiver » | `is_active = true` | 🟠 | ⏭ |

### 11.3 Validation contenu
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.3.1 | Livres « en attente » listés | — | Contenus `pending` visibles | 🔴 | ⏭ |
| 11.3.2 | Approuver un livre | Clic « Approuver » | Statut → `approved`, éditeur notifié | 🔴 | ⏭ |
| 11.3.3 | Rejeter un livre | Clic « Rejeter » + raison | Statut → `rejected`, raison visible | 🔴 | ⏭ |
| 11.3.4 | Archiver un contenu | Clic « Archiver » | Contenu masqué du catalogue | 🟠 | ⏭ |

### 11.4 Catégories
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.4.1 | Créer catégorie | Nom + slug unique | Catégorie créée | 🟠 | ⏭ |
| 11.4.2 | Modifier catégorie | Nouveau nom | Modification sauvegardée | 🟡 | ⏭ |
| 11.4.3 | Supprimer catégorie | — | Confirmation, puis suppression | 🟡 | ⏭ |

### 11.5 Codes promo admin
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.5.1 | Créer code global | Code + % réduction + validité | Code créé | 🟠 | ⏭ |
| 11.5.2 | Activer/désactiver | Toggle | Statut mis à jour | 🟠 | ⏭ |
| 11.5.3 | Statistiques d'utilisation | Clic détail | Nombre d'utilisations affiché | 🟡 | ⏭ |

### 11.6 Versements éditeurs
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.6.1 | Vue d'ensemble versements | — | Montants dus par éditeur | 🟠 | ⏭ |
| 11.6.2 | Planifier un versement | Clic « Planifier » | Versement programmé | 🟠 | ⏭ |
| 11.6.3 | Historique versements | — | Liste des versements passés | 🟡 | ⏭ |

### 11.7 Paramètres application
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.7.1 | Modifier nom société | Nouveau nom | Apparaît dans les factures | 🟡 | ⏭ |
| 11.7.2 | Modifier footer facture | Nouveau texte | Visible sur prochaine facture PDF | 🟡 | ⏭ |
| 11.7.3 | Upload logo | Image PNG | Logo mis à jour | 🟡 | ⏭ |

### 11.8 Analytique admin
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.8.1 | Revenus mensuels | — | Graphique courbe visible | 🟠 | ⏭ |
| 11.8.2 | Export PDF revenus | Clic export | PDF téléchargé | 🟡 | ⏭ |
| 11.8.3 | Stats de lecture | — | Livres les plus lus, temps moyen | 🟡 | ⏭ |

### 11.9 RGPD admin
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 11.9.1 | Demandes RGPD listées | — | Tableau des demandes | 🟡 | ⏭ |
| 11.9.2 | Traiter demande export | Clic « Traiter » | Statut → traité | 🟡 | ⏭ |
| 11.9.3 | Traiter suppression compte | Clic « Traiter » | Données anonymisées | 🟡 | ⏭ |

---

## MODULE 12 — Application Mobile (Expo)

### 12.1 Authentification
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 12.1.1 | Onboarding au 1er lancement | — | Carousel visible | 🟠 | ⏭ |
| 12.1.2 | Inscription mobile | email+mdp | Compte créé, accès HomeScreen | 🔴 | ⏭ |
| 12.1.3 | Connexion mobile | email+mdp valides | Accès HomeScreen | 🔴 | ⏭ |
| 12.1.4 | Persistance session | Fermer/rouvrir app | Session maintenue | 🔴 | ⏭ |
| 12.1.5 | Déconnexion | — | Retour LoginScreen | 🟠 | ⏭ |

### 12.2 Catalogue mobile
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 12.2.1 | Catalogue chargé | — | FlatList avec contenus et couvertures | 🔴 | ⏭ |
| 12.2.2 | Filtres | type / catégorie | Résultats filtrés | 🟠 | ⏭ |
| 12.2.3 | Recherche | terme | Résultats affichés | 🟠 | ⏭ |
| 12.2.4 | Clic fiche | — | Navigation ContentDetailScreen | 🔴 | ⏭ |

### 12.3 Contrôle accès mobile
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 12.3.1 | Livre abonnement non débloqué | Abonné actif | Bouton « Débloquer » visible | 🔴 | ⏭ |
| 12.3.2 | Débloquer avec quota | Clic « Débloquer » | Quota consommé, lecteur ouvert | 🔴 | ⏭ |
| 12.3.3 | Livre déjà débloqué | Abonné + unlock | Bouton « Lire » / « Écouter » | 🔴 | ⏭ |

### 12.4 Lecture mobile
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 12.4.1 | Lecteur ebook | EPUB débloqué | Contenu EPUB rendu correctement | 🔴 | ⏭ |
| 12.4.2 | Lecteur audio | MP3 débloqué | Audio joué, contrôles visibles | 🔴 | ⏭ |
| 12.4.3 | Navigation EPUB | Swipe gauche/droite | Page suivante/précédente | 🟠 | ⏭ |
| 12.4.4 | Sauvegarde progression | Fermer, rouvrir | Position reprise | 🔴 | ⏭ |
| 12.4.5 | Mode hors-ligne | Désactiver réseau (contenu téléchargé) | Contenu accessible offline | 🟠 | ⏭ |

### 12.5 Profil & notifications mobile
| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 12.5.1 | Profil affiché | — | Nom, email, avatar | 🟠 | ⏭ |
| 12.5.2 | Modifier profil | Nouveau nom | Sauvegardé | 🟠 | ⏭ |
| 12.5.3 | Notifications push | Déclencher une notif | Reçue sur l'appareil (FCM) | 🟡 | ⏭ |

---

## MODULE 13 — Sécurité & Autorisation

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 13.1 | Fichier EPUB sans token | GET `/api/reading/:id/file` sans auth | 401 | 🔴 | ⏭ |
| 13.2 | Fichier EPUB — contenu non débloqué | Token valide mais pas d'unlock | 402 | 🔴 | ⏭ |
| 13.3 | Facture autre utilisateur | GET `/payments/:id/invoice` autre user | 403 | 🔴 | ⏭ |
| 13.4 | Webhook Stripe sans signature | POST `/webhooks/stripe` sans header | 400 | 🔴 | ⏭ |
| 13.5 | API admin avec token user | GET `/api/admin/stats` user standard | 403 | 🔴 | ⏭ |
| 13.6 | Verrou multi-appareils | 2 appareils simultanés sur même contenu | 2e appareil reçoit bannière déplacement | 🟠 | ⏭ |
| 13.7 | Rate limiting | Appels répétés /auth | 429 après N tentatives | 🟠 | ⏭ |
| 13.8 | CORS domaine non autorisé | Requête depuis domaine inconnu | Bloquée (CORS error) | 🟠 | ⏭ |
| 13.9 | Injection SQL via paramètre | `id = 1; DROP TABLE` | 400/404, pas d'exécution | 🔴 | ⏭ |
| 13.10 | XSS via champ texte | `<script>alert(1)</script>` dans bio | Texte affiché échappé | 🟠 | ⏭ |

---

## MODULE 14 — Pages Publiques & Transversales

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 14.1 | Landing page `/` (non authentifié) | — | Page marketing visible | 🟠 | ⏭ |
| 14.2 | Cookie consent — 1ère visite | — | Banner cookies visible | 🟡 | ⏭ |
| 14.3 | Accepter cookies | Clic « Accepter » | Banner fermé, mémorisé | 🟡 | ⏭ |
| 14.4 | Page `/privacy` | — | Politique de confidentialité | 🟡 | ⏭ |
| 14.5 | Page 404 | URL inexistante | Page 404 affichée proprement | 🟡 | ⏭ |
| 14.6 | Responsive mobile (web) | Viewport 375px | UI adaptée, pas de débordement | 🟠 | ⏭ |

---

## MODULE 15 — Tests API Backend

> Tester avec curl, Postman ou Swagger UI sur `http://localhost:3001/docs`

| # | Endpoint | Méthode | Cas | Attendu | Priorité | Statut |
|---|----------|---------|-----|---------|----------|--------|
| 15.1 | `/api/contents` | GET | Sans auth | 200, liste publique | 🔴 | ⏭ |
| 15.2 | `/api/contents/:id` | GET | id valide | 200, détail contenu | 🔴 | ⏭ |
| 15.3 | `/api/contents/:id/access` | GET | Abonné + unlock | 200, `can_read: true` | 🔴 | ⏭ |
| 15.4 | `/api/contents/:id/access` | GET | Abonné sans unlock | 200, `can_read: false`, `denial.code: SUBSCRIPTION_UNLOCK_REQUIRED` | 🔴 | ⏭ |
| 15.5 | `/api/contents/:id/unlock` | POST | Abonné avec quota dispo | 200, `source: quota`, quota `-1` | 🔴 | ⏭ |
| 15.6 | `/api/contents/:id/unlock` | POST | Abonné quota épuisé, pas de bonus | 402, `CONTENT_LOCKED_PAYMENT_REQUIRED` | 🔴 | ⏭ |
| 15.7 | `/api/contents/:id/unlock` | POST | Contenu déjà débloqué | 200, `already_unlocked: true` | 🟠 | ⏭ |
| 15.8 | `/api/reading/:id/session` | GET | Token valide + unlock | 200, URL signée + stream | 🔴 | ⏭ |
| 15.9 | `/api/reading/:id/session` | GET | Sans unlock | 402 | 🔴 | ⏭ |
| 15.10 | `/api/reading/:id/file` | GET | Sans auth | 401 | 🔴 | ⏭ |
| 15.11 | `/api/subscriptions/plans` | GET | — | 200, liste des plans avec quotas | 🔴 | ⏭ |
| 15.12 | `/api/subscriptions/checkout` | POST | `provider=stripe` | 200, `sessionUrl` | 🔴 | ⏭ |
| 15.13 | `/api/subscriptions/checkout` | POST | `provider=flutterwave` | 200, `paymentLink` | 🔴 | ⏭ |
| 15.14 | `/api/subscriptions/usage` | GET | Abonné | 200, `text_quota=400, audio_quota=1` | 🔴 | ⏭ |
| 15.15 | `/api/subscriptions/payments/:id/invoice` | GET | Proprio du paiement | 200, PDF binaire | 🟠 | ⏭ |
| 15.16 | `/api/subscriptions/payments/:id/invoice` | GET | Autre utilisateur | 403 | 🔴 | ⏭ |
| 15.17 | `/webhooks/stripe` | POST | Sans `Stripe-Signature` | 400 | 🔴 | ⏭ |
| 15.18 | `/api/admin/stats` | GET | Token admin | 200 | 🟠 | ⏭ |
| 15.19 | `/api/admin/stats` | GET | Token user standard | 403 | 🔴 | ⏭ |
| 15.20 | `/api/search` | GET | `q=roman` | 200, hits pertinents | 🟠 | ⏭ |

---

## MODULE 16 — Performance & Résilience

| # | Cas de test | Données | Résultat attendu | Priorité | Statut |
|---|-------------|---------|-----------------|----------|--------|
| 16.1 | Chargement catalogue 14+ livres | — | < 2s, pas de freeze | 🟠 | ⏭ |
| 16.2 | Backend inaccessible | Couper le backend | Messages d'erreur affichés, pas de crash | 🟠 | ⏭ |
| 16.3 | EPUB volumineux (> 5MB) | Fichier lourd | Barre progression, pas de timeout | 🟠 | ⏭ |
| 16.4 | Retry lecteur EPUB | Clic « Réessayer » | Nouvelle tentative de chargement | 🟠 | ⏭ |
| 16.5 | Meilisearch indisponible | Arrêter Meilisearch | Fallback automatique sur DB | 🟠 | ⏭ |
| 16.6 | Connexion lente | Throttle réseau 3G | UI reste utilisable, spinners affichés | 🟡 | ⏭ |

---

## Ordre d'Exécution Recommandé

```
1. MODULE 15 (API Backend)   → Valider que le backend répond correctement
2. MODULE 1  (Auth)          → Prérequis pour tout le reste
3. MODULE 2  (Catalogue)     → Navigation de base et accès contenu ← CRITIQUE
4. MODULE 5  (Abonnements)   → Nécessaire pour débloquer la lecture
5. MODULE 3  (Lecteur EPUB)  → Fonctionnalité cœur
6. MODULE 4  (Lecteur Audio) → Fonctionnalité cœur
7. MODULE 7  (Dashboard)     → Vue globale utilisateur
8. MODULE 6  (Historique)    → Lecture en cours
9. MODULE 8  (Profil)        → Gestion compte
10. MODULE 9 (Notifications)
11. MODULE 10 (Publisher)    → Espace éditeur
12. MODULE 11 (Admin)        → Back-office complet
13. MODULE 12 (Mobile)       → Application mobile
14. MODULE 13 (Sécurité)     → Tests de pénétration basiques
15. MODULES 14, 16           → Pages publiques, performance
```

---

## Bugs Connus au Moment de la Rédaction

| Réf | Bug | Module | Priorité | Correction |
|-----|-----|--------|----------|-----------|
| B-01 | Lecteur EPUB — livre ne s'affiche pas (epub not initialized) | 3 | 🔴 | En cours |
| B-02 | Abonnement affiché 2 mois au lieu d'1 | 5 | 🟠 | Corriger `duration_days` dans Supabase Table Editor |
| B-03 | API Devices (`/api/devices`) renvoie 404 | 12/8.3 | 🟠 | Route devices non montée dans `index.js` |

---

*Version 2.0 — Afrik NoCode / Patrick Essomba — 2026-04-03*
*16 modules · 200+ cas de test*
