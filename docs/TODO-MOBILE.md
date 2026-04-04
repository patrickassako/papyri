# TODO — Application Mobile (Papyri)
**Date :** 2026-04-02
**Périmètre :** `/mobile/src/` — screens, services, composants

---

## 🔴 BLOQUANTS — Bugs ou crashs potentiels

### 1. SubscriptionScreen — URL API hardcodée sans base
**Fichier :** `screens/SubscriptionScreen.js` ligne ~126
- `fetch('/api/subscriptions/plans')` sans `API_BASE_URL` → appel vers une URL relative qui échoue en natif
- **Action :** Importer `API_BASE_URL` et préfixer l'URL

### 2. HistoryScreen — URL API hardcodée sans base
**Fichier :** `screens/HistoryScreen.js` ligne ~105
- `/reading-history/stats` sans `API_BASE_URL`
- **Action :** Utiliser `authFetch` ou préfixer avec `API_BASE_URL`

### 3. ProfileScreen.simple — chemin API incohérent
**Fichier :** `screens/ProfileScreen.simple.js` ligne ~295
- Utilise `/users/me/data-export` au lieu de `/api/users/me/data-export`
- **Action :** Standardiser le chemin avec `/api/`

---

## 🟠 IMPORTANTS — UX dégradée

### 4. AudioPlayerScreen — "Sleep timer" en anglais
**Fichier :** `screens/AudioPlayerScreen.js` lignes ~317, ~390
- "Sleep timer" affiché à l'utilisateur → doit être "Minuteur de sommeil"
- **Action :** Remplacer les 2 occurrences

### 5. CatalogScreen — badges "AUDIO"/"EBOOK" incohérents
**Fichier :** `screens/CatalogScreen.js` ligne ~224
- Badges en majuscules anglais sur les cartes livre
- **Action :** Remplacer par "Audio" / "E-book"

### 6. BookReaderScreen — URLs CDN EPUB.js hardcodées
**Fichier :** `screens/BookReaderScreen.js` lignes ~166, ~172
- `https://unpkg.com/epubjs/...` et `https://cdn.jsdelivr.net/npm/epubjs/...` en dur
- Si les CDNs sont down, le lecteur ne s'initialise pas
- **Action :** Extraire dans une constante `EPUBJS_CDN_URLS`

### 7. ContentCardWithProgress — URLs placeholder hardcodées
**Fichier :** `components/ContentCardWithProgress.js` lignes ~79, ~126, ~157
- `https://via.placeholder.com/...` et `https://placehold.co/...` en dur
- **Action :** Centraliser en constante dans `config/constants.js`

### 8. HomeScreen — URLs placeholder hardcodées
**Fichier :** `screens/HomeScreen.js` lignes ~50, ~208, ~217, ~226
- Même problème que #7
- **Action :** Utiliser la même constante

---

## 🟡 AMÉLIORATIONS — Qualité du code

### 9. subscription.service.js — duplication et URLs éparpillées
**Fichier :** `services/subscription.service.js`
- `getCurrentSubscription` et `getMySubscriptionStatus` quasi-identiques (lignes ~13-45)
- Multiples `fetch(${API_BASE_URL}/api/subscriptions/...)` sans centralisation
- **Action :** Fusionner les deux fonctions, extraire les paths en constantes

### 10. reading.service.js — URL construite manuellement
**Fichier :** `services/reading.service.js` ligne ~155
- URL construite par concaténation sans import propre
- **Action :** Utiliser `authFetch` du service auth

### 11. AudioContext.js — require() dynamique risqué
**Fichier :** `context/AudioContext.js` ligne ~251
- `const { apiClient } = require('../services/api')` en inline dans une fonction
- Si le module est absent, crash silencieux
- **Action :** Importer en haut du fichier

### 12. BookReaderScreen — timeout magic number
**Fichier :** `screens/BookReaderScreen.js` ligne ~177
- `setTimeout(..., 10000)` sans constante nommée
- **Action :** `const EPUB_LOAD_TIMEOUT_MS = 10000`

---

## 📋 RÉCAPITULATIF PAR PRIORITÉ

| Priorité | # | Tâche | Fichier |
|----------|---|-------|---------|
| 🔴 | 1 | API URL sans base SubscriptionScreen | `SubscriptionScreen.js` |
| 🔴 | 2 | API URL sans base HistoryScreen | `HistoryScreen.js` |
| 🔴 | 3 | Chemin API incohérent ProfileScreen | `ProfileScreen.simple.js` |
| 🟠 | 4 | "Sleep timer" → "Minuteur de sommeil" | `AudioPlayerScreen.js` |
| 🟠 | 5 | Badges "AUDIO"/"EBOOK" → français | `CatalogScreen.js` |
| 🟠 | 6 | URLs CDN EPUB.js en constantes | `BookReaderScreen.js` |
| 🟠 | 7 | Placeholder URLs centralisées (composant) | `ContentCardWithProgress.js` |
| 🟠 | 8 | Placeholder URLs centralisées (HomeScreen) | `HomeScreen.js` |
| 🟡 | 9 | Duplication subscription service | `subscription.service.js` |
| 🟡 | 10 | URL construite manuellement reading service | `reading.service.js` |
| 🟡 | 11 | require() dynamique AudioContext | `AudioContext.js` |
| 🟡 | 12 | Timeout magic number BookReader | `BookReaderScreen.js` |

---

*Généré par audit statique — Afrik NoCode / Patrick Essomba*
