-- Migration vers Supabase Auth
-- Date: 2026-02-07
-- Description: Migrer de public.users (custom) vers auth.users (Supabase Auth) + public.profiles

-- ============================================================================
-- ÉTAPE 1 : Créer la table profiles (référence auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  language VARCHAR(10) DEFAULT 'fr',
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- ============================================================================
-- ÉTAPE 2 : Trigger auto-création profil lors inscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, language, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'fr'),
    FALSE
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Si erreur, insérer avec valeurs par défaut
    INSERT INTO public.profiles (id, full_name, language, onboarding_completed)
    VALUES (NEW.id, 'Utilisateur', 'fr', FALSE)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger qui s'exécute après création user dans auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ÉTAPE 3 : RLS (Row Level Security) sur profiles
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users peuvent voir leur propre profil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Users peuvent modifier leur propre profil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- ÉTAPE 4 : Mettre à jour notification_preferences
-- ============================================================================

-- Modifier la table pour référencer auth.users au lieu de public.users
ALTER TABLE IF EXISTS public.notification_preferences
DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

ALTER TABLE IF EXISTS public.notification_preferences
ADD CONSTRAINT notification_preferences_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS sur notification_preferences
ALTER TABLE IF EXISTS public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage own notification preferences"
ON public.notification_preferences
USING (auth.uid() = user_id);

-- ============================================================================
-- ÉTAPE 5 : Fonction helper pour récupérer profil complet
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name VARCHAR(255),
  language VARCHAR(10),
  avatar_url TEXT,
  onboarding_completed BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    u.email::TEXT,
    p.full_name,
    p.language,
    p.avatar_url,
    p.onboarding_completed,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 6 : Fonction pour update profil
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_profile(
  user_id UUID,
  new_full_name VARCHAR(255) DEFAULT NULL,
  new_language VARCHAR(10) DEFAULT NULL,
  new_avatar_url TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(new_full_name, full_name),
    language = COALESCE(new_language, language),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE id = user_id
  RETURNING * INTO updated_profile;

  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- Cette migration crée la structure pour Supabase Auth
-- L'ancienne table public.users peut être supprimée après migration complète
-- Les users doivent s'inscrire via Supabase Auth
-- RLS est activé automatiquement avec auth.uid()

-- ============================================================================
-- TEST DE LA MIGRATION
-- ============================================================================

-- Pour tester, exécutez dans Supabase Dashboard > Authentication > Add User:
-- Email: test@example.com
-- Password: Test1234
-- User Metadata (dans "Additional user metadata" ou "User Metadata" selon l'UI):
-- {
--   "full_name": "Test User",
--   "language": "fr"
-- }

-- Puis vérifiez:
-- SELECT * FROM public.profiles;
-- Un profil doit avoir été créé automatiquement
