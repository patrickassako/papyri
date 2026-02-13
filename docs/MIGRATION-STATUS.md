# 🔄 Migration Supabase Auth - État

**Date** : 2026-02-07
**Status** : ⏸️ EN ATTENTE D'EXÉCUTION

---

## ✅ Ce qui a été fait

### 1. **Migration SQL créée** ✅
- **Fichier** : `docs/migrations/003_migrate_to_supabase_auth.sql`
- **Contenu** :
  - Création table `public.profiles`
  - Trigger auto-création profil
  - RLS policies avec `auth.uid()`
  - Fonctions helper SQL
  - Migration `notification_preferences`

### 2. **Backend Supabase Auth créé** ✅
- **Fichier** : `backend/src/services/auth.service.supabase.js`
- **Fonctions** :
  - `register()` → `supabase.auth.signUp()`
  - `login()` → `supabase.auth.signInWithPassword()`
  - `logout()` → `supabase.auth.signOut()`
  - `refreshToken()` → `supabase.auth.refreshSession()`
  - `forgotPassword()` → `supabase.auth.resetPasswordForEmail()`
  - `resetPassword()` → `supabase.auth.updateUser()`
  - `verifyToken()` → `supabase.auth.getUser()`

### 3. **Documentation complète** ✅
- **Guide migration** : `docs/MIGRATION-SUPABASE-AUTH.md`
- **Status migration** : `docs/MIGRATION-STATUS.md` (ce fichier)

---

## ⏳ Ce qu'il reste à faire

### **Étape 1 : Exécuter la migration SQL** ⏸️

**Action** :
1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. SQL Editor
4. Copier-coller `docs/migrations/003_migrate_to_supabase_auth.sql`
5. Exécuter (Run)

**Vérification** :
```sql
SELECT * FROM public.profiles LIMIT 1;
```

---

### **Étape 2 : Remplacer le service auth backend** ⏸️

**Action** :
```bash
cd backend/src/services
mv auth.service.js auth.service.old.js
mv auth.service.supabase.js auth.service.js
```

Ou simplement **modifier** `backend/src/routes/auth.js` pour importer le nouveau service :
```javascript
// Avant
const authService = require('../services/auth.service');

// Après
const authService = require('../services/auth.service.supabase');
```

---

### **Étape 3 : Mettre à jour les routes backend** ⏸️

**Fichiers à modifier** :
- `backend/src/routes/auth.js`
- `backend/src/routes/users.js`
- `backend/src/middleware/auth.js`

**Changements clés** :
```javascript
// auth.js - Register
const { user, session } = await authService.register(email, password, full_name);
res.status(201).json({
  success: true,
  data: {
    user,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  },
});

// middleware/auth.js - Verify token
const { user } = await authService.verifyToken(token);
req.user = user;
next();
```

---

### **Étape 4 : Installer Supabase client (frontends)** ⏸️

**Web** :
```bash
cd web
npm install @supabase/supabase-js
```

**Mobile** :
```bash
cd mobile
npm install @supabase/supabase-js
```

---

### **Étape 5 : Créer client Supabase (frontends)** ⏸️

**Fichier** : `web/src/config/supabase.js` (et idem mobile)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Variables d'environnement** :
```env
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJxxx...
```

---

### **Étape 6 : Adapter auth service frontend** ⏸️

**web/src/services/auth.service.js** :
```javascript
import { supabase } from '../config/supabase';

export async function register(email, password, full_name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
    },
  });

  if (error) throw error;

  // Store session
  if (data.session) {
    localStorage.setItem('access_token', data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
  }

  return data;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Store session
  if (data.session) {
    localStorage.setItem('access_token', data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
  }

  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
```

---

### **Étape 7 : Tester** ⏸️

**Tests à faire** :
1. ✅ Inscription web
2. ✅ Connexion web
3. ✅ Inscription mobile
4. ✅ Connexion mobile
5. ✅ Profil
6. ✅ Déconnexion
7. ✅ Mot de passe oublié

---

## 🎯 Ordre d'exécution recommandé

1. **Exécuter migration SQL** (Étape 1) ← **COMMENCER ICI**
2. **Tester inscription manuelle** dans Supabase Dashboard
3. **Mettre à jour backend** (Étapes 2-3)
4. **Redémarrer backend** et tester avec curl
5. **Mettre à jour frontends** (Étapes 4-6)
6. **Tester end-to-end** (Étape 7)

---

## 📞 En cas de problème

**Rollback** :
```sql
-- Désactiver le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer les tables
DROP TABLE IF EXISTS public.profiles;

-- Revenir à l'ancien backend
mv backend/src/services/auth.service.old.js backend/src/services/auth.service.js
```

---

## 🚀 Après migration réussie

**Avantages disponibles** :
- ✅ Auth de niveau production
- ✅ Dashboard Supabase pour gérer users
- ✅ RLS automatique avec `auth.uid()`
- ✅ Email verification (configurable)
- ✅ OAuth ready (Google, Facebook, etc.)
- ✅ MFA ready
- ✅ Magic Links ready

**Nettoyage** :
```bash
# Supprimer les anciens fichiers
rm backend/src/services/auth.service.old.js

# Supprimer l'ancienne table (après confirmation)
# DROP TABLE public.users_backup;
```

---

**Status** : 🟡 Prêt pour exécution - En attente de Patrick
