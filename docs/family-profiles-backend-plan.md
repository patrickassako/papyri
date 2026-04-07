# Family Profiles Backend Plan

## Objectif

Faire evoluer l'abonnement famille d'un modele `owner + members + invitations` vers un modele `compte principal + profils`, en conservant la logique economique actuelle:

- 1 compte principal
- 3 profils inclus
- jusqu'a 10 profils maximum
- les profils supplementaires sont payants

Le socle abonnement/paiement actuel est conserve:

- `subscriptions`
- `subscription_plans`
- `payments`
- `subscription_cycles`

La logique legacy a deprecie progressivement:

- `subscription_members`
- `member_cycle_usage`
- invitations famille par email

## Etat actuel

Le backend famille repose aujourd'hui sur:

- `subscriptions.users_limit`
- `subscription_members`
- `member_cycle_usage`

References:

- [006_subscriptions_and_payments.sql](/Users/apple/Documents/biblioteque%20digi/BibliotheuqeNum/docs/migrations/006_subscriptions_and_payments.sql)
- [021_subscription_plans_customizable.sql](/Users/apple/Documents/biblioteque%20digi/BibliotheuqeNum/docs/migrations/021_subscription_plans_customizable.sql)
- [024_add_subscription_cycles_usage.sql](/Users/apple/Documents/biblioteque%20digi/BibliotheuqeNum/docs/migrations/024_add_subscription_cycles_usage.sql)
- [subscriptions.service.js](/Users/apple/Documents/biblioteque%20digi/BibliotheuqeNum/backend/src/services/subscriptions.service.js)
- [subscriptions.controller.js](/Users/apple/Documents/biblioteque%20digi/BibliotheuqeNum/backend/src/controllers/subscriptions.controller.js)

## Modele cible

### 1. Subscription

La table `subscriptions` reste la source de verite commerciale et de facturation.

Nouvelles colonnes:

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS included_profiles INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS profiles_limit INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_profiles INTEGER NOT NULL DEFAULT 10;
```

Regles:

- `included_profiles` = nombre de profils inclus dans le plan
- `profiles_limit` = quota actuellement achete pour l'abonnement
- `max_profiles` = limite absolue produit
- sur le plan famille:
  - `included_profiles = 3`
  - `max_profiles = 10`
- `users_limit` reste temporairement pour compatibilite, mais doit etre considere comme legacy

Contraintes recommandees:

```sql
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_profiles_limit_check
  CHECK (
    included_profiles >= 1
    AND profiles_limit >= 1
    AND max_profiles >= included_profiles
    AND profiles_limit <= max_profiles
  );
```

### 2. Family profiles

Nouvelle table:

```sql
CREATE TABLE IF NOT EXISTS public.family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_key VARCHAR(50),
  is_owner_profile BOOLEAN NOT NULL DEFAULT FALSE,
  is_kid BOOLEAN NOT NULL DEFAULT FALSE,
  pin_hash TEXT,
  pin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

Regles:

- un profil appartient a un abonnement famille
- `owner_user_id` pointe vers le compte principal
- `is_owner_profile = true` pour le profil principal
- `pin_enabled = true` implique un `pin_hash` renseigne
- le PIN doit etre numerique et long de 4 a 6 chiffres

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_family_profiles_subscription
  ON public.family_profiles(subscription_id, is_active);

CREATE INDEX IF NOT EXISTS idx_family_profiles_owner
  ON public.family_profiles(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_family_profiles_position
  ON public.family_profiles(subscription_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_profiles_owner_profile
  ON public.family_profiles(subscription_id)
  WHERE is_owner_profile = TRUE AND deleted_at IS NULL;
```

### 3. Usage par profil

Nouvelle table:

```sql
CREATE TABLE IF NOT EXISTS public.profile_cycle_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.family_profiles(id) ON DELETE CASCADE,
  text_quota INTEGER NOT NULL DEFAULT 0 CHECK (text_quota >= 0),
  audio_quota INTEGER NOT NULL DEFAULT 0 CHECK (audio_quota >= 0),
  bonus_quota INTEGER NOT NULL DEFAULT 0 CHECK (bonus_quota >= 0),
  text_unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (text_unlocked_count >= 0),
  audio_unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (audio_unlocked_count >= 0),
  bonus_used_count INTEGER NOT NULL DEFAULT 0 CHECK (bonus_used_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_cycle_usage_unique_cycle_profile UNIQUE (cycle_id, profile_id)
);
```

Cette table remplace progressivement `member_cycle_usage`.

## Donnees metier a migrer par profil

Les donnees suivantes doivent a terme porter `profile_id`:

- historique de lecture
- progression ebook
- progression audio
- favoris / reading list
- recommandations
- verrous de lecture exclusifs

Strategie recommandee:

1. ajouter `profile_id` nullable
2. backfill sur le profil principal
3. migrer le code backend
4. rendre `profile_id` obligatoire plus tard

## Selection de profil

Le modele d'authentification reste:

- login par compte principal
- selection du profil apres login

Implementation backend recommandee:

- conserver le JWT utilisateur actuel
- le frontend transmet `x-profile-id`
- le backend valide:
  - que le profil existe
  - qu'il appartient a l'abonnement actif du user
  - qu'il n'est pas supprime/inactif

Cette approche evite d'introduire un second token de session.

## Regles produit

### Plan famille

- 3 profils inclus
- max 10 profils
- impossible de creer un profil au-dela de `profiles_limit`
- impossible d'acheter au-dela de `max_profiles`

### Suppression d'un profil

- la suppression ne diminue pas `profiles_limit`
- elle libere seulement une place disponible

### Profil principal

- cree automatiquement
- non supprimable tant qu'il est l'unique profil principal

### PIN

- 4 a 6 chiffres
- hash en base, jamais en clair
- verification a l'entree du profil si le profil est protege

## Endpoints backend cibles

### CRUD profils

- `GET /api/family/profiles`
- `POST /api/family/profiles`
- `PATCH /api/family/profiles/:id`
- `DELETE /api/family/profiles/:id`

### PIN

- `POST /api/family/profiles/:id/set-pin`
- `POST /api/family/profiles/:id/verify-pin`
- `POST /api/family/profiles/:id/remove-pin`

### Selection

- `POST /api/family/select-profile`

Option simple:

- pas de persistance serveur obligatoire au debut
- validation du profil a chaque requete via `x-profile-id`

### Quota profils supplementaires

- `POST /api/subscriptions/family/add-profile-slot`

Effet:

- incremente `profiles_limit` de 1
- refuse si `profiles_limit >= 10`

## Plan de migration

### Migration 048: `048_family_profiles.sql`

Objectif:

- introduire la table `family_profiles`
- introduire les colonnes `included_profiles`, `profiles_limit`, `max_profiles`
- backfill minimal

Contenu:

1. alter `subscriptions`
2. create `family_profiles`
3. triggers `updated_at`
4. indexes
5. RLS
6. backfill:
   - pour chaque abonnement famille:
     - `included_profiles = 3`
     - `max_profiles = 10`
     - `profiles_limit = least(10, greatest(3, users_limit))`
     - creer un `Profil principal` si absent

### Migration 049: `049_profile_cycle_usage.sql`

Objectif:

- introduire `profile_cycle_usage`
- preparer la sortie de `member_cycle_usage`

Contenu:

1. create `profile_cycle_usage`
2. indexes
3. triggers
4. RLS
5. backfill initial sur profil principal

### Migration 050: `050_profile_columns_on_usage_tables.sql`

Objectif:

- ajouter `profile_id` sur les tables metier critiques

Tables minimales ciblees:

- `reading_history`
- `reading_list`
- tables de progression/playlist si necessaire

### Migration 051: `051_profile_selection_helpers.sql`

Objectif:

- fonctions SQL ou vues utilitaires
- verification d'appartenance profil -> abonnement

### Migration 052: `052_deprecate_subscription_members.sql`

Objectif:

- geler les usages legacy
- retirer progressivement `subscription_members` du produit famille

Cette migration ne doit arriver qu'apres bascule applicative.

## Strategie de compatibilite

### Court terme

- conserver `subscription_members`
- conserver `member_cycle_usage`
- conserver `users_limit`
- ajouter la nouvelle couche profils sans casser les parcours existants

### Moyen terme

- nouveaux parcours famille bases sur `family_profiles`
- usages lecture/favoris/historique migrent vers `profile_id`

### Long terme

- `subscription_members` devient legacy
- `users_limit` devient obsolete
- source de verite famille = `profiles_limit` + `family_profiles`

## Backfill recommande

Pour chaque abonnement famille existant:

1. detecter le plan famille via:
   - `subscriptions.plan_type = 'family'`
   - ou `plan_snapshot.slug = 'family'`
   - ou `subscription_plans.slug = 'family'`
2. positionner:
   - `included_profiles = 3`
   - `max_profiles = 10`
   - `profiles_limit = least(10, greatest(3, users_limit))`
3. creer un profil principal:
   - `name = 'Profil principal'`
   - `is_owner_profile = true`
   - `owner_user_id = subscriptions.user_id`
   - `position = 0`

## Impacts backend

Fichiers a faire evoluer ensuite:

- `backend/src/services/subscriptions.service.js`
- `backend/src/controllers/subscriptions.controller.js`
- `backend/src/controllers/contents.controller.js`
- `backend/src/routes/reading.js`

Nouveau service probable:

- `backend/src/services/family-profiles.service.js`

## Risques

1. Toute la logique actuelle de consommation est par `user_id`
- il faudra la basculer proprement par `profile_id`

2. Les verrous de lecture exclusifs sont aujourd'hui relies au compte
- il faudra decider si le verrou est par compte ou par profil

3. Les recommandations/historique front devront suivre le profil actif

## Recommandation d'implementation

Ordre conseille:

1. migration `048_family_profiles.sql`
2. service backend CRUD profils
3. selection de profil
4. migration des usages lecture/favoris/historique
5. retrait du modele membres/invitations

