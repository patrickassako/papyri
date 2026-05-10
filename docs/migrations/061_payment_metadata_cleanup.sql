-- Migration 061: Backfill payment_type metadata for legacy rows.
-- Some old payments lack metadata.payment_type or have inconsistent values,
-- which made every entry display as "Achat contenu" in the history view.
--
-- Heuristic:
--   - subscription_id IS NOT NULL  -> subscription_initial / subscription_renewal
--   - subscription_id IS NULL      -> content_unlock
-- We only set the field when it's missing, so manually-tagged rows are kept.

BEGIN;

-- Subscription-linked payments: pick initial vs renewal based on chronology.
WITH ranked AS (
  SELECT
    id,
    subscription_id,
    ROW_NUMBER() OVER (PARTITION BY subscription_id ORDER BY created_at ASC) AS rn
  FROM public.payments
  WHERE subscription_id IS NOT NULL
    AND (metadata->>'payment_type' IS NULL OR metadata->>'payment_type' = '')
)
UPDATE public.payments p
SET metadata = COALESCE(p.metadata, '{}'::jsonb)
            || jsonb_build_object('payment_type', CASE WHEN r.rn = 1 THEN 'subscription_initial' ELSE 'subscription_renewal' END)
FROM ranked r
WHERE p.id = r.id;

-- Standalone payments (no subscription) -> content unlock.
UPDATE public.payments
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('payment_type', 'content_unlock')
WHERE subscription_id IS NULL
  AND (metadata->>'payment_type' IS NULL OR metadata->>'payment_type' = '');

COMMIT;
