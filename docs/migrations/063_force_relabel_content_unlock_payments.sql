-- Migration 063: Force-relabel content unlock payments using content_unlocks.payment_id
--
-- Migration 062 relied on metadata.content_id which isn't present on every
-- legacy row. content_unlocks.payment_id is the authoritative reference:
-- any payment referenced by a content_unlocks row is definitely a content
-- unlock, regardless of what metadata says.
--
-- Re-stamp those payments to payment_type='content_unlock' and detach them
-- from their subscription so the history view labels them correctly.

BEGIN;

UPDATE public.payments p
SET
  subscription_id = NULL,
  metadata = jsonb_set(
    COALESCE(p.metadata, '{}'::jsonb),
    '{payment_type}',
    '"content_unlock"'::jsonb,
    true
  )
WHERE p.id IN (
  SELECT payment_id FROM public.content_unlocks WHERE payment_id IS NOT NULL
);

-- Belt and suspenders: also tag rows whose tx_ref starts with 'CNT-' (the
-- prefix used by contents.controller for Flutterwave content-unlock checkouts).
UPDATE public.payments
SET
  subscription_id = NULL,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{payment_type}',
    '"content_unlock"'::jsonb,
    true
  )
WHERE provider_payment_id LIKE 'CNT-%'
  AND COALESCE(metadata->>'payment_type', '') <> 'content_unlock';

COMMIT;
