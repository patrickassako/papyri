-- Migration 062: Re-tag content unlock payments that were polluted by 061.
--
-- Bug: contents.controller.unlockContent used to set
--   subscriptionId: subscription?.id || null
-- on the payment, so a user's content purchase ended up with a non-null
-- subscription_id. Migration 061 then saw subscription_id IS NOT NULL +
-- empty payment_type and tagged those rows 'subscription_initial' /
-- 'subscription_renewal', making them show as "Souscription" / "Renouvellement"
-- in the history view.
--
-- Fix: any payment whose metadata carries content_id is a content unlock,
-- regardless of subscription_id. Re-stamp metadata.payment_type to
-- 'content_unlock' and detach it from the subscription.

BEGIN;

UPDATE public.payments
SET
  subscription_id = NULL,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{payment_type}',
    '"content_unlock"'::jsonb,
    true
  )
WHERE metadata ? 'content_id'
  AND COALESCE(metadata->>'payment_type', '') <> 'content_unlock';

COMMIT;
