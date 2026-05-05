-- Migration 055: Crédits — nettoyer doublons + index unique d'idempotence
-- Date: 2026-05-04
-- Description:
--   Race condition entre verify-payment et webhook a permis l'insertion de
--   plusieurs rows bonus_credits pour le même cycle.
--   On nettoie les doublons existants (on garde la plus ancienne) et on ajoute
--   un index unique pour rendre les inserts concurrents idempotents.

-- ============================================================================
-- 1) Cleanup : pour chaque (subscription_id, source='plan_immediate',
--    metadata->>'cycle_start'), garder uniquement la row la plus ancienne.
-- ============================================================================

DELETE FROM public.bonus_credits bc
WHERE bc.id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY subscription_id, source, (metadata->>'cycle_start')
        ORDER BY granted_at ASC, id ASC
      ) AS rn
    FROM public.bonus_credits
    WHERE source = 'plan_immediate'
      AND quantity_used = 0
      AND (metadata->>'cycle_start') IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
);

-- ============================================================================
-- 2) Index unique partiel pour bloquer les futurs doublons.
--    Limité à source='plan_immediate' et aux crédits non encore utilisés.
-- ============================================================================

DROP INDEX IF EXISTS public.uq_bonus_credits_plan_immediate_per_cycle;

CREATE UNIQUE INDEX uq_bonus_credits_plan_immediate_per_cycle
  ON public.bonus_credits (subscription_id, (metadata->>'cycle_start'))
  WHERE source = 'plan_immediate' AND (metadata->>'cycle_start') IS NOT NULL;

-- ============================================================================
-- TEST
-- ============================================================================

SELECT subscription_id,
       (metadata->>'cycle_start') AS cycle_start,
       COUNT(*) AS rows,
       SUM(quantity_total) AS total_credits
FROM public.bonus_credits
WHERE source = 'plan_immediate'
GROUP BY 1, 2
ORDER BY cycle_start DESC NULLS LAST;
