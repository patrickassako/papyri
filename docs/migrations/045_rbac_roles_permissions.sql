-- Migration 045: RBAC — Roles & Permissions dynamiques
-- Crée les tables roles, permissions, role_permissions
-- Seed initial : rôles système + toutes les permissions
-- Date: 2026-03-31

-- ============================================================================
-- TABLE: roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50) UNIQUE NOT NULL,       -- slug ex: 'moderateur'
  display_name VARCHAR(100) NOT NULL,              -- ex: 'Modérateur'
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT false,     -- true = non supprimable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE: permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,        -- ex: 'users.write'
  resource    VARCHAR(50) NOT NULL,                -- ex: 'users'
  action      VARCHAR(50) NOT NULL,                -- ex: 'write'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE: role_permissions (junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_roles_name             ON roles(name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role  ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource   ON permissions(resource);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_roles_updated_at();

-- ============================================================================
-- SEED: PERMISSIONS
-- ============================================================================
INSERT INTO permissions (key, resource, action, description) VALUES
  -- Users
  ('users.read',          'users',         'read',         'Consulter la liste et les profils utilisateurs'),
  ('users.write',         'users',         'write',        'Modifier les profils utilisateurs'),
  ('users.delete',        'users',         'delete',       'Supprimer des comptes utilisateurs'),
  ('users.toggle_active', 'users',         'toggle_active','Activer ou bloquer des comptes'),
  -- Content
  ('content.read',        'content',       'read',         'Consulter le catalogue'),
  ('content.write',       'content',       'write',        'Ajouter et modifier des contenus'),
  ('content.delete',      'content',       'delete',       'Supprimer des contenus'),
  ('content.publish',     'content',       'publish',      'Publier ou dépublier des contenus'),
  -- Subscriptions
  ('subscriptions.read',   'subscriptions','read',         'Consulter les abonnements'),
  ('subscriptions.write',  'subscriptions','write',        'Modifier les abonnements'),
  ('subscriptions.cancel', 'subscriptions','cancel',       'Annuler des abonnements'),
  ('subscriptions.extend', 'subscriptions','extend',       'Prolonger des abonnements'),
  -- Analytics
  ('analytics.read',      'analytics',     'read',         'Consulter les statistiques et KPIs'),
  -- Settings
  ('settings.read',       'settings',      'read',         'Consulter les paramètres'),
  ('settings.write',      'settings',      'write',        'Modifier les paramètres de la plateforme'),
  -- Notifications
  ('notifications.read',  'notifications', 'read',         'Consulter les notifications'),
  ('notifications.send',  'notifications', 'send',         'Envoyer des notifications manuelles'),
  -- Categories
  ('categories.read',     'categories',    'read',         'Consulter les catégories'),
  ('categories.write',    'categories',    'write',        'Créer et modifier des catégories'),
  ('categories.delete',   'categories',    'delete',       'Supprimer des catégories'),
  -- Publishers
  ('publishers.read',     'publishers',    'read',         'Consulter les éditeurs'),
  ('publishers.write',    'publishers',    'write',        'Gérer les éditeurs'),
  ('publishers.approve',  'publishers',    'approve',      'Approuver les demandes éditeurs'),
  -- Promo codes
  ('promo_codes.read',    'promo_codes',   'read',         'Consulter les codes promo'),
  ('promo_codes.write',   'promo_codes',   'write',        'Créer et modifier les codes promo'),
  ('promo_codes.delete',  'promo_codes',   'delete',       'Supprimer des codes promo'),
  -- Roles
  ('roles.read',          'roles',         'read',         'Consulter les rôles'),
  ('roles.write',         'roles',         'write',        'Créer et modifier des rôles'),
  ('roles.delete',        'roles',         'delete',       'Supprimer des rôles personnalisés')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: SYSTEM ROLES
-- ============================================================================
INSERT INTO roles (name, display_name, description, is_system) VALUES
  ('user',      'Utilisateur',   'Accès lecture standard, aucun accès admin',          true),
  ('admin',     'Administrateur','Accès complet à toutes les fonctionnalités',          true),
  ('publisher', 'Éditeur',       'Accès au portail éditeur uniquement',                true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED: admin role → ALL permissions
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED: publisher role → content.read + content.write only (portail éditeur)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'publisher'
  AND p.key IN ('content.read', 'content.write', 'analytics.read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage roles"
  ON roles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage permissions"
  ON permissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage role_permissions"
  ON role_permissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role bypass (backend)
CREATE POLICY "Service role full access roles"
  ON roles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access permissions"
  ON permissions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access role_permissions"
  ON role_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'roles count: %',            (SELECT COUNT(*) FROM roles);
  RAISE NOTICE 'permissions count: %',      (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE 'role_permissions count: %', (SELECT COUNT(*) FROM role_permissions);
END $$;
