-- Migration vers Supabase Auth (Version Simplifiée)
-- Date: 2026-02-07
-- Description: Structure minimale pour Supabase Auth

-- ============================================================================
-- ÉTAPE 1 : Créer la table profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL DEFAULT 'Utilisateur',
  language VARCHAR(10) DEFAULT 'fr',
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- ============================================================================
-- ÉTAPE 2 : Trigger simple (crée profil avec valeurs par défaut)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer profil avec valeurs par défaut
  -- Le backend mettra à jour avec les vraies valeurs après inscription
  INSERT INTO public.profiles (id, full_name, language, onboarding_completed)
  VALUES (NEW.id, 'Utilisateur', 'fr', FALSE)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ÉTAPE 3 : RLS sur profiles
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- ÉTAPE 4 : Fonction pour update profil
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
  user_id UUID,
  new_full_name VARCHAR(255),
  new_language VARCHAR(10) DEFAULT NULL,
  new_avatar_url TEXT DEFAULT NULL,
  new_onboarding_completed BOOLEAN DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(new_full_name, full_name),
    language = COALESCE(new_language, language),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    onboarding_completed = COALESCE(new_onboarding_completed, onboarding_completed),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TEST
-- ============================================================================

-- Pour tester:
-- 1. Allez dans Authentication > Users
-- 2. Add User: test@example.com / Test1234
-- 3. Puis vérifiez:

SELECT * FROM public.profiles;

-- Un profil doit avoir été créé automatiquement avec:
-- - id = user id de auth.users
-- - full_name = 'Utilisateur'
-- - language = 'fr'
-- - onboarding_completed = false
