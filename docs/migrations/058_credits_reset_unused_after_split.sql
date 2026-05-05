-- Migration 058: Réconciliation crédits après éclatement par profil (057)
-- Date: 2026-05-05
-- Description:
--   La migration 057 a éclaté les rows bonus_credits en 1 row/profil et a copié
--   quantity_used = LEAST(used_global, 1) sur chaque row dans l'ordre.
--   Conséquence : si avant 057 un user avait consommé 2 crédits (depuis 1 row qty=3),
--   après 057 on voit 2 rows à qty_used=1 (sur 2 profils choisis par défaut) et 1 row à 0.
--
--   Mais la consommation pré-057 n'était pas liée à un profil — c'était un pool global.
--   Les content_unlocks existants pointent (via bonus_credit_id) sur l'ANCIENNE row
--   qui a été conservée pour le profil 1. Les rows NEUVES créées pour les profils 2..N
--   n'ont jamais été utilisées pour un unlock réel.
--
--   On reset quantity_used = 0 sur tous les crédits qui n'ont AUCUN content_unlock
--   pointant sur eux via bonus_credit_id.

-- ============================================================================
-- Reset crédits non utilisés (pas de unlock attaché)
-- ============================================================================

UPDATE public.bonus_credits bc
SET
  quantity_used = 0,
  consumed_at = NULL,
  updated_at = NOW()
WHERE bc.source = 'plan_immediate'
  AND bc.quantity_used > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.content_unlocks cu
    WHERE cu.bonus_credit_id = bc.id
  );

-- ============================================================================
-- TEST
-- ============================================================================

SELECT
  bc.subscription_id,
  fp.name AS profile_name,
  fp.is_owner_profile,
  bc.profile_id,
  bc.quantity_total,
  bc.quantity_used,
  (bc.quantity_total - bc.quantity_used) AS remaining,
  (SELECT COUNT(*) FROM public.content_unlocks WHERE bonus_credit_id = bc.id) AS unlocks
FROM public.bonus_credits bc
LEFT JOIN public.family_profiles fp ON fp.id = bc.profile_id
WHERE bc.source = 'plan_immediate'
ORDER BY bc.subscription_id, fp.is_owner_profile DESC, fp.position ASC;
