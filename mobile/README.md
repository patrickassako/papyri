# 📱 Application Mobile - Bibliothèque Numérique

Application React Native + Expo pour iOS et Android.

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- **Pour iOS** : Xcode + iOS Simulator (Mac uniquement)
- **Pour Android** : Android Studio + Android Emulator

### 1. Installer les dépendances

```bash
cd mobile
npm install
```

### 2. Configuration

L'application se connecte au backend sur `http://localhost:3001` par défaut.

**Pour tester sur émulateur :**
- ✅ iOS Simulator : `localhost:3001` fonctionne directement
- ✅ Android Emulator : `localhost:3001` fonctionne aussi (Expo gère la redirection)

**Pour tester sur device physique :**
1. Trouver l'IP de votre machine :
   ```bash
   # Mac/Linux
   ifconfig | grep "inet "
   # Windows
   ipconfig
   ```
2. Modifier `mobile/src/config/api.js` :
   ```javascript
   const API_BASE_URL = 'http://192.168.x.x:3001'; // Votre IP
   ```

### 3. Démarrer le backend

Le backend doit être en cours d'exécution :

```bash
# Dans un terminal séparé
cd ../backend
npm start
```

Vérifier que le backend répond : http://localhost:3001/health

## 📲 Lancer l'application

### iOS Simulator (Mac uniquement)

```bash
npm run ios
```

Ou avec Expo :

```bash
npm start
# Puis appuyer sur 'i' pour ouvrir iOS Simulator
```

### Android Emulator

1. Démarrer Android Emulator depuis Android Studio
2. Puis :

```bash
npm run android
```

Ou avec Expo :

```bash
npm start
# Puis appuyer sur 'a' pour ouvrir Android
```

### Device Physique

1. Installer **Expo Go** sur votre smartphone :
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Démarrer Expo :

```bash
npm start
```

3. Scanner le QR code avec :
   - **iOS** : Camera app
   - **Android** : Expo Go app

## 📋 Fonctionnalités disponibles (Epic 1)

### ✅ Implémentées

- **Inscription** (`RegisterScreen`)
  - Email, password, nom complet
  - Validation en temps réel
  - Indicateur force du mot de passe

- **Connexion** (`LoginScreen`)
  - Email, password
  - Toggle visibilité mot de passe
  - Lien "Mot de passe oublié"

- **Réinitialisation mot de passe** (`ForgotPasswordScreen`, `ResetPasswordScreen`)
  - Demande par email
  - Reset avec token

- **Profil utilisateur** (`ProfileScreen`)
  - Affichage informations
  - Modification nom, langue
  - Changement mot de passe
  - Déconnexion

- **Historique** (`HistoryScreen`)
  - Liste avec pagination
  - Filtres par type
  - ContentCardWithProgress

- **Onboarding** (`OnboardingCarousel`)
  - 3 screens avec swipe natif
  - Skip / Complete
  - ⚠️ Non intégré dans App.js (à faire)

### 🔜 À venir

- Epic 2 : Abonnement & Paiements
- Epic 3 : Catalogue & Recherche
- Epic 4/5 : Lecteurs (ebook, audio)
- Epic 6 : Accueil personnalisé
- Epic 7 : Mode hors-ligne

## 🎨 Design System

L'app utilise **React Native Paper** (Material Design 3) avec des tokens partagés :

- **Couleurs** : `shared/tokens/colors.json`
  - Primary : #B5651D (Terre d'Afrique)
  - Secondary : #D4A017 (Or du Sahel)
  - Accent : #2E4057 (Indigo Adire)

- **Typographie** : `shared/tokens/typography.json`
- **Spacing** : `shared/tokens/spacing.json`
- **Shapes** : `shared/tokens/shapes.json`

Thème configuré dans : `mobile/src/theme/theme.js`

## 📁 Structure du projet

```
mobile/
├── App.js                    # Point d'entrée avec navigation
├── app.json                  # Configuration Expo
├── package.json              # Dépendances
├── babel.config.js           # Configuration Babel
├── assets/                   # Images, icônes
└── src/
    ├── screens/              # Écrans React Native
    │   ├── LoginScreen.js
    │   ├── RegisterScreen.js
    │   ├── ProfileScreen.js
    │   ├── HistoryScreen.js
    │   ├── ForgotPasswordScreen.js
    │   └── ResetPasswordScreen.js
    ├── components/           # Composants réutilisables
    │   ├── OnboardingCarousel.js
    │   └── ContentCardWithProgress.js
    ├── services/             # Services API
    │   └── auth.service.js
    ├── config/               # Configuration
    │   └── api.js
    └── theme/                # Design system
        └── theme.js
```

## 🧪 Tests

### Tests manuels

Voir `docs/testing/epic-1-test-plan.md` pour le plan de test complet.

**Tests prioritaires (P0) :**
1. Inscription valide → Compte créé
2. Connexion valide → Navigate Home
3. Déconnexion → Navigate Login
4. Reset password complet
5. Modification profil

### Tests automatisés (à venir)

- Tests unitaires : Jest + React Native Testing Library
- Tests E2E : Detox

## 🐛 Dépannage

### Erreur "Unable to resolve module"

```bash
# Nettoyer le cache
expo start -c
```

### Erreur "Network request failed"

- Vérifier que le backend est démarré (`http://localhost:3001/health`)
- Sur device physique : vérifier l'IP dans `src/config/api.js`
- Vérifier que mobile et backend sont sur le même réseau WiFi

### Android : "Cleartext HTTP traffic not permitted"

Expo gère automatiquement les requêtes HTTP en développement. En production, utiliser HTTPS.

### iOS Simulator ne démarre pas

```bash
# Ouvrir manuellement
open -a Simulator

# Puis relancer
npm run ios
```

## 📚 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [React Navigation](https://reactnavigation.org/)

## 🔐 Sécurité

### ⚠️ Développement actuel

- Tokens stockés en mémoire (temporaire)
- HTTP non sécurisé (localhost)

### ✅ Production (à implémenter)

- Migration vers `react-native-keychain` pour tokens
- Migration vers `@react-native-async-storage/async-storage` pour données user
- HTTPS uniquement
- Certificate pinning

## 📞 Support

Pour toute question :
- Backend : `../backend/README.md`
- Architecture : `../_bmad-output/architecture.md`
- API : `../_bmad-output/api_spec.md`

---

**Version** : 1.0.0
**Epic** : Epic 1 (Authentification, Profil & Onboarding)
**Date** : 2026-02-07
