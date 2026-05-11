-- Migration 064: force CAD across catalog + payments + subscriptions
--
-- Some Flutterwave verifications returned USD as the transaction currency
-- (Flutterwave merchant default) so legacy payments were stored as USD even
-- though the catalog ships in CAD. Invoices generated from those rows then
-- displayed US$ amounts. We normalize everything to CAD.
--
-- This is safe because (a) we never charge in any currency other than CAD
-- in practice and (b) the amounts in DB are the actual CAD values — no
-- conversion is needed, only a label change.

BEGIN;

-- Catalog
UPDATE public.contents
SET price_currency = 'CAD'
WHERE price_currency IS DISTINCT FROM 'CAD';

-- Payments
UPDATE public.payments
SET currency = 'CAD'
WHERE currency IS DISTINCT FROM 'CAD';

-- Subscriptions (already CAD in plan_snapshot but normalize the column)
UPDATE public.subscriptions
SET currency = 'CAD'
WHERE currency IS DISTINCT FROM 'CAD';

-- Content unlocks (paid history)
UPDATE public.content_unlocks
SET currency = 'CAD'
WHERE currency IS DISTINCT FROM 'CAD';

COMMIT;
