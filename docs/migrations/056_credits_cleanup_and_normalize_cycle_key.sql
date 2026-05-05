-- Migration 056: Cleanup crédits dupliqués + normalisation cycle_start sur period_end
-- Date: 2026-05-04
-- Description:
--   La migration 055 a tenté de dédupliquer mais le cycle_start (basé sur
--   current_period_start) différait de quelques ms entre les 2 appels concurrents
--   (verify-payment + webhook), donc le DELETE n'a rien fait et l'index unique
--   ne s'appliquait pas.
--
--   On bascule cycle_start sur current_period_end (stable) et on dédoublonne
--   en gardant la row la plus ancienne par subscription.
--
--   ORDRE OBLIGATOIRE :
--     1. DROP l'index unique (sinon UPDATE bloqué par 23505)
--     2. UPDATE cycle_start vers current_period_end pour toutes les rows
--     3. DELETE les doublons (cycle_start identique → garder la plus ancienne)
--     4. RECREATE l'index unique

-- ============================================================================
-- 1) Drop temporairement l'index pour permettre l'UPDATE
-- ============================================================================

DROP INDEX IF EXISTS public.uq_bonus_credits_plan_immediate_per_cycle;

-- ============================================================================
-- 2) Normaliser metadata.cycle_start = subscription.current_period_end
-- ============================================================================

UPDATE public.bonus_credits bc
SET metadata = jsonb_set(
  COALESCE(bc.metadata, '{}'::jsonb),
  '{cycle_start}',
  to_jsonb(s.current_period_end::text)
)
FROM public.subscriptions s
WHERE bc.subscription_id = s.id
  AND bc.source = 'plan_immediate';

-- ============================================================================
-- 3) Cleanup des doublons (basé sur le nouveau cycle_start uniforme).
--    Garder la row la plus ancienne par (subscription, cycle_start).
-- ============================================================================

DELETE FROM public.bonus_credits bc
WHERE bc.id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY subscription_id, (metadata->>'cycle_start')
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
-- 4) Recréer l'index unique partiel
-- ============================================================================

CREATE UNIQUE INDEX uq_bonus_credits_plan_immediate_per_cycle
  ON public.bonus_credits (subscription_id, (metadata->>'cycle_start'))
  WHERE source = 'plan_immediate' AND (metadata->>'cycle_start') IS NOT NULL;

-- ============================================================================
-- TEST : devrait afficher exactement 1 row par subscription active
-- ============================================================================

SELECT subscription_id,
       (metadata->>'cycle_start') AS cycle_start,
       COUNT(*) AS rows,
       SUM(quantity_total) AS total_credits
FROM public.bonus_credits
WHERE source = 'plan_immediate'
GROUP BY 1, 2
ORDER BY cycle_start DESC NULLS LAST;
