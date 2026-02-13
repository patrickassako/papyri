# Migration vers Supabase Auth

**Date** : 2026-02-07
**Epic** : Epic 1
**Objectif** : Migrer de l'authentification custom (public.users + bcrypt) vers Supabase Auth (auth.users)

---

## 🎯 Pourquoi cette migration ?

**Avant (Custom)** :
- Users dans `public.users`
- Passwords hashés avec bcrypt manuellement
- JWT générés manuellement
- Gestion manuelle de la sécurité

**Après (Supabase Auth)** :
- Users dans `auth.users` (système Supabase)
- Passwords gérés par Supabase (sécurité professionnelle)
- Tokens gérés automatiquement
- OAuth, MFA, Magic Links disponibles
- RLS automatique avec `auth.uid()`

---

## 📋 Étapes de migration

### **Étape 1 : Exécuter la migration SQL**

1. **Ouvrir Supabase Dashboard** : https://app.supabase.com
2. **Sélectionner votre projet**
3. **Aller dans SQL Editor**
4. **Copier-coller** le contenu de `docs/migrations/003_migrate_to_supabase_auth.sql`
5. **Exécuter** (Run)

**Vérifications** :
```sql
-- Vérifier que la table profiles existe
SELECT * FROM public.profiles LIMIT 1;

-- Vérifier que le trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

---

### **Étape 2 : Tester l'inscription via Supabase Dashboard**

1. **Aller dans Authentication > Users**
2. **Add User** (bouton)
3. **Créer un user test** :
   - Email : `test-auth@example.com`
   - Password : `Test1234`
   - User Metadata (JSON) :
     ```json
     {
       "full_name": "Test Supabase Auth",
       "language": "fr"
     }
     ```
4. **Vérifier** :
   ```sql
   -- User doit apparaître dans profiles automatiquement (trigger)
   SELECT * FROM public.profiles;
   ```

---

### **Étape 3 : Mettre à jour le Backend**

Le backend a été mis à jour pour utiliser Supabase Auth.

**Nouveaux endpoints** :
- `POST /auth/register` → Utilise `supabase.auth.signUp()`
- `POST /auth/login` → Utilise `supabase.auth.signInWithPassword()`
- `POST /auth/logout` → Utilise `supabase.auth.signOut()`
- `GET /users/me` → Utilise `supabase.auth.getUser()` + profiles

**Variables d'environnement requises** :
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx... (pour opérations admin)
```

---

### **Étape 4 : Mettre à jour les Frontends**

**Web** :
- Installer : `npm install @supabase/supabase-js`
- Utiliser le client Supabase au lieu d'appels fetch

**Mobile** :
- Installer : `npm install @supabase/supabase-js`
- Utiliser le client Supabase

---

### **Étape 5 : Tester end-to-end**

**Flow complet à tester** :

1. **Inscription** :
   - Web/Mobile : Créer nouveau compte
   - ✅ User créé dans `auth.users`
   - ✅ Profil créé automatiquement dans `public.profiles`
   - ✅ Email de confirmation envoyé (si activé)

2. **Connexion** :
   - Web/Mobile : Se connecter
   - ✅ Token Supabase retourné
   - ✅ Session active

3. **Profil** :
   - Voir profil : GET /users/me
   - ✅ Données de `profiles` + `auth.users`
   - Modifier profil
   - ✅ Mise à jour dans `profiles`

4. **Déconnexion** :
   - Se déconnecter
   - ✅ Session supprimée

---

## 🔒 Sécurité RLS

**Avant** :
```sql
-- RLS manuel avec user_id comparaison
WHERE user_id = current_user_id
```

**Après** :
```sql
-- RLS automatique avec auth.uid()
WHERE id = auth.uid()
```

**Avantages** :
- `auth.uid()` retourne NULL si pas authentifié → accès refusé automatiquement
- Pas besoin de passer user_id manuellement
- Impossible de falsifier (géré par Supabase)

---

## 📊 Tableau de correspondance

| Ancien (Custom) | Nouveau (Supabase Auth) |
|-----------------|-------------------------|
| `public.users.id` | `auth.users.id` |
| `public.users.email` | `auth.users.email` |
| `public.users.password_hash` | ❌ Géré par Supabase |
| `public.users.full_name` | `public.profiles.full_name` |
| `public.users.role` | `auth.users.raw_user_meta_data->>'role'` |
| `public.users.is_active` | `auth.users.banned_until` (NULL = actif) |
| `public.users.last_login_at` | `auth.users.last_sign_in_at` |
| JWT manuel | `auth.users.session` (auto) |

---

## ⚠️ Points d'attention

1. **Email confirmation** :
   - Par défaut, Supabase envoie un email de confirmation
   - Configurer dans : Authentication > Settings > Email Templates
   - Pour dev : désactiver "Enable email confirmations"

2. **Rate limiting** :
   - Supabase a son propre rate limiting sur auth endpoints
   - Configurer dans : Authentication > Settings > Rate Limits

3. **Password policy** :
   - Minimum 6 caractères par défaut
   - Configurer dans : Authentication > Settings > Password Policy

4. **Ancienne table users** :
   - Peut être supprimée après migration complète
   - Ou renommée en `users_backup` pour historique

---

## 🚀 Fonctionnalités futures possibles

Avec Supabase Auth, vous pouvez facilement ajouter :

- **OAuth** : Google, Facebook, GitHub, etc.
  ```javascript
  supabase.auth.signInWithOAuth({ provider: 'google' })
  ```

- **Magic Links** : Connexion sans password
  ```javascript
  supabase.auth.signInWithOtp({ email })
  ```

- **MFA (2FA)** : Authentification à 2 facteurs
  ```javascript
  supabase.auth.mfa.enroll()
  ```

- **Email verification** : Automatique
- **Password recovery** : Automatique

---

## 📞 Support

Si problèmes :
1. Vérifier les logs Supabase : Dashboard > Logs
2. Vérifier RLS policies : Table Editor > Policies
3. Tester auth dans Dashboard : Authentication > Users

---

**✅ Migration terminée !**

Vous avez maintenant une authentification de niveau production avec Supabase Auth.
