-- Migration 000: Initial Schema
-- Description: Tables users et notification_preferences pour authentification
-- Dependencies: None
-- Created: 2026-02-07

-- Table users
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  full_name        VARCHAR(255),
  role             VARCHAR(20) NOT NULL DEFAULT 'user',
    -- 'user', 'admin'
  language         VARCHAR(5) DEFAULT 'fr',
    -- 'fr', 'en', 'es', 'pt'
  avatar_url       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
    -- FALSE pour nouveaux users, TRUE apres onboarding
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Table notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_enabled     BOOLEAN DEFAULT TRUE,
  email_enabled    BOOLEAN DEFAULT TRUE,
  new_content      BOOLEAN DEFAULT TRUE,
    -- Notifications pour nouveaux contenus
  reading_reminders BOOLEAN DEFAULT TRUE,
    -- Rappels de lecture
  subscription_updates BOOLEAN DEFAULT TRUE,
    -- Notifications abonnement/paiement
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index notification_preferences
CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON notification_preferences(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour users
-- Users can read their own data
CREATE POLICY "Users read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data (but not role or is_active)
CREATE POLICY "Users update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Only admins can delete users
CREATE POLICY "Admins delete users" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies pour notification_preferences
-- Users can read their own preferences
CREATE POLICY "Users read own preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users insert own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users update own preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users delete own preferences" ON notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE users IS 'Utilisateurs de la plateforme avec authentification email/password';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt du mot de passe (cost factor 12)';
COMMENT ON COLUMN users.role IS 'Role utilisateur: user (defaut) ou admin';
COMMENT ON COLUMN users.onboarding_completed IS 'TRUE si onboarding termine, FALSE pour afficher au premier lancement';
COMMENT ON COLUMN users.language IS 'Langue interface: fr, en, es, pt';

COMMENT ON TABLE notification_preferences IS 'Preferences de notifications push/email par utilisateur';
