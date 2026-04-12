-- Migration 053: Ajouter les permissions manquantes au RBAC
-- Couvre : payouts, gdpr, geo_pricing, reading_stats
-- Date: 2026-04-10

-- ============================================================================
-- NOUVELLES PERMISSIONS
-- ============================================================================
INSERT INTO permissions (key, resource, action, description) VALUES
  -- Versements éditeurs
  ('payouts.read',         'payouts',         'read',    'Consulter les versements éditeurs'),
  ('payouts.write',        'payouts',         'write',   'Valider et gérer les versements éditeurs'),
  -- RGPD
  ('gdpr.read',            'gdpr',            'read',    'Consulter les demandes RGPD et exports'),
  ('gdpr.write',           'gdpr',            'write',   'Traiter les demandes RGPD (suppression, export)'),
  -- Tarification géographique
  ('geo_pricing.read',     'geo_pricing',     'read',    'Consulter les tarifs géographiques'),
  ('geo_pricing.write',    'geo_pricing',     'write',   'Modifier les tarifs par zone géographique'),
  -- Statistiques de lecture
  ('reading_stats.read',   'reading_stats',   'read',    'Consulter les statistiques de lecture'),
  -- Dashboard admin (stats générales)
  ('dashboard.read',       'dashboard',       'read',    'Accéder au tableau de bord admin'),
  -- Validation de contenu
  ('content.validate',     'content',         'validate','Valider ou rejeter du contenu soumis')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: admin role → toutes les nouvelles permissions
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.key IN (
    'payouts.read', 'payouts.write',
    'gdpr.read', 'gdpr.write',
    'geo_pricing.read', 'geo_pricing.write',
    'reading_stats.read',
    'dashboard.read',
    'content.validate'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED: publisher role — ajuster les permissions (analytics.read déjà présent)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'publisher'
  AND p.key IN ('reading_stats.read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'permissions count: %', (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE 'admin permissions count: %', (
    SELECT COUNT(*) FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id WHERE r.name = 'admin'
  );
END $$;
