# TODO — Application Web (Papyri)
**Dernière mise à jour :** 2026-04-03
**Périmètre :** `/web/src/` — pages, composants, services, backend

---

## ✅ RÉSOLU — Éléments vérifiés et corrigés

| # | Tâche | État |
|---|-------|------|
| 1 | Signed URLs lecture (ebooks + audiobooks) | ✅ Déjà implémenté |
| 2 | PricingPage — useEffect + checkout | ✅ Déjà implémenté |
| 3 | AudiobookPlayerPage — `chapterItems` vs `chapters` | ✅ `chapterItems` défini localement via `useMemo` |
| 4 | SubscriptionPage — textes anglais | ✅ Corrigé (`Recent Invoices` → `Historique de facturation`, `View All` → `Tout voir`, `No Plan` → `Aucun plan`) |
| 5 | ContentDetailPage — reviews + typo | ✅ Reviews chargées et affichées, typo corrigée |
| 6 | Route `/privacy` manquante | ✅ Déjà routée dans App.js |
| 7 | PublisherRevenuePage — API hardcodée | ✅ Utilise déjà `getDashboardData()` du service |
| 8 | DashboardPage — empty state "Reprendre" | ✅ Guard + message "Aucune lecture en cours" déjà présent |
| 9 | ProfilePage — Upload avatar non branché | ✅ Dialog + FormData + POST `/users/me/avatar` déjà implémentés |
| 10 | TopNavBar — Badge notifications non synchronisé | ✅ `NotificationBell` appelle `load()` dans un `useEffect` au montage |
| 11 | PublisherLayout — Doublon de layout | ✅ Faux positif — deux layouts distincts pour deux rôles (éditeur vs admin) |
| 12 | EReaderPage — Gestion d'erreur EPUB | ✅ Catch → `setError()` + `<Alert>` + bouton "Réessayer" déjà présents |
| 13 | HistoryPage — Pagination manquante | ✅ `limit=20&page=N` + bouton "Charger plus d'historique" déjà implémentés |
| 14 | CatalogPage — Filtres non persistants | ✅ `useSearchParams` synchronise les filtres dans les query params URL |
| 15 | Couleurs hardcodées → tokens design | ✅ 30+ fichiers mis à jour, zéro `#B5651D`/`#2E4057`/`#D4A017` actifs |
| 16 | Catch vides silencieux | ✅ `console.error` ajouté sur les loaders de données critiques |
| 17 | Accessibilité — `aria-label` icônes + `alt` images | ✅ 11 corrections (CatalogPage, DashboardPage, ProfilePage, SubscriptionPage, UserSpaceSidebar) |
| 18 | Dead code mobile — fichiers `.simple` et `.old` | ✅ 7 fichiers supprimés |
| 19 | FlatList `keyExtractor` mobile | ✅ Import mort supprimé (HomeScreen) + `Math.random()` → index stable (CatalogScreen) |
| 20 | Centraliser `API_BASE_URL` web | ✅ `config/api.js` créé, 7 services migrés |
| 21 | CORS backend depuis variable d'environnement | ✅ `process.env.CORS_ORIGINS` (CSV) avec fallback localhost |
| 22 | Normalisation réponses API backend | ✅ Helper `utils/response.js` (`sendSuccess`/`sendError`) créé — endpoints existants maintenus (frontend déjà adapté, migration progressive) |
| 23 | `alert()` dans mobile | ✅ Aucun `alert()` browser — `Alert.alert()` react-native partout |
| 24 | `useEffect` sans dépendances | ✅ Dépendances correctes dans DashboardPage et AudioContext |
| 25 | Logger centralisé backend | ✅ `utils/logger.js` créé, `index.js` + `errorHandler.js` migrés |
| 26 | `href="/login"` et `href="/register"` dans Login.js + Register.js | ✅ Remplacés par `component="button"` + `onClick` navigate (no page reload) |

---

## 🔴 BLOQUANTS — À corriger avant déploiement

### 1. Secrets exposés dans git
- **Statut :** ⚠️ À vérifier — `.env*` non tracké (`git ls-files | grep .env` → uniquement les fichiers `.example`)
- Si des secrets sont dans l'historique git, purger avec BFG Repo Cleaner
- **Action :** Vérifier l'historique `git log --all --full-history -- "*.env"` et révoquer/régénérer les clés si nécessaire

---

## 🟡 AMÉLIORATIONS — En cours / Différé

### 2. API_BASE_URL — Pages non migrées
**Fichiers :** `HistoryPage`, `ProfilePage`, `EReaderPage`, `AudiobookPlayerPage`, pages admin/publisher
- Les services sont centralisés mais certaines pages font encore `const API_URL = import.meta.env.VITE_API_URL || '...'` localement
- **Action :** Migrer vers `import { API_BASE_URL } from '../config/api'` au fur et à mesure des modifications

### 3. Logger backend — Migration complète
- `utils/logger.js` créé mais seulement `index.js` et `errorHandler.js` migrés
- 45+ fichiers backend utilisent encore `console.log` directement
- **Action :** Migrer progressivement au fur et à mesure des modifications de fichiers

### 4. Normalisation réponses API — Migration complète
- Helper `utils/response.js` créé (`sendSuccess`/`sendError`)
- Endpoints existants maintenus tel quel (frontend adapté à chaque format)
- **Action :** Utiliser `sendSuccess`/`sendError` dans les nouveaux endpoints et lors des refactorisations futures

---

## 📋 MIGRATIONS SQL EN ATTENTE (Epic 18 — Rémunération éditeurs)

| # | Fichier | Statut |
|---|---------|--------|
| 048 | `048_reading_sessions.sql` | ⏳ Non créé |
| 049 | `049_royalty_periods.sql` | ⏳ Non créé |
| 050 | `050_publisher_royalties.sql` | ⏳ Non créé |
| 051 | `051_royalty_fraud_flags.sql` | ⏳ Non créé |

---

## 📊 SCORE QUALITÉ ESTIMÉ

| Critère | Avant | Après |
|---------|-------|-------|
| Design tokens cohérents | 4/10 | 10/10 |
| Gestion d'erreurs | 5/10 | 8/10 |
| Accessibilité (a11y) | 4/10 | 7/10 |
| Dead code | 6/10 | 9/10 |
| Configuration / env vars | 3/10 | 9/10 |
| Sécurité (CORS, secrets) | 2/10 | 7/10 |
| **Global** | **4/10** | **~8.5/10** |

---

*Généré par analyse statique — Afrik NoCode / Patrick Essomba*
