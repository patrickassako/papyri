-- Migration 066: payment locale FX rates
--
-- Adds CAD → local-currency conversion rates on app_settings so the admin
-- can adjust them from the back-office. Each rate represents how many
-- units of the local currency equal 1 CAD.
--
-- These default values are approximations and SHOULD be updated by the
-- admin from /admin/app_settings.

BEGIN;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS fx_rate_xaf numeric(12,4) NOT NULL DEFAULT 446.00,   -- 1 CAD = X XAF (CEMAC: CM, CF, TD, CG, GQ, GA)
  ADD COLUMN IF NOT EXISTS fx_rate_xof numeric(12,4) NOT NULL DEFAULT 446.00,   -- 1 CAD = X XOF (BCEAO: SN, CI, ML, BF, TG, BJ, NE, GW)
  ADD COLUMN IF NOT EXISTS fx_rate_ghs numeric(12,4) NOT NULL DEFAULT 10.80,    -- 1 CAD = X GHS (Ghana)
  ADD COLUMN IF NOT EXISTS fx_rate_kes numeric(12,4) NOT NULL DEFAULT 95.00,    -- 1 CAD = X KES (Kenya)
  ADD COLUMN IF NOT EXISTS fx_rate_tzs numeric(12,4) NOT NULL DEFAULT 1900.00,  -- 1 CAD = X TZS (Tanzanie)
  ADD COLUMN IF NOT EXISTS fx_rate_rwf numeric(12,4) NOT NULL DEFAULT 950.00,   -- 1 CAD = X RWF (Rwanda)
  ADD COLUMN IF NOT EXISTS fx_rate_ugx numeric(12,4) NOT NULL DEFAULT 2750.00,  -- 1 CAD = X UGX (Ouganda)
  ADD COLUMN IF NOT EXISTS fx_rate_zmw numeric(12,4) NOT NULL DEFAULT 19.00,    -- 1 CAD = X ZMW (Zambie)
  ADD COLUMN IF NOT EXISTS fx_rate_ngn numeric(12,4) NOT NULL DEFAULT 1090.00;  -- 1 CAD = X NGN (Nigeria)

COMMENT ON COLUMN public.app_settings.fx_rate_xaf IS '1 CAD = X XAF (utilisé pour Mobile Money CEMAC: Cameroun, Tchad, Gabon…)';
COMMENT ON COLUMN public.app_settings.fx_rate_xof IS '1 CAD = X XOF (utilisé pour Mobile Money BCEAO: Sénégal, Côte d''Ivoire, Mali, Togo…)';
COMMENT ON COLUMN public.app_settings.fx_rate_ghs IS '1 CAD = X GHS (Ghana — MTN MoMo, Vodafone Cash…)';
COMMENT ON COLUMN public.app_settings.fx_rate_kes IS '1 CAD = X KES (Kenya — M-Pesa)';
COMMENT ON COLUMN public.app_settings.fx_rate_tzs IS '1 CAD = X TZS (Tanzanie — M-Pesa)';
COMMENT ON COLUMN public.app_settings.fx_rate_rwf IS '1 CAD = X RWF (Rwanda — MTN MoMo, Airtel Money)';
COMMENT ON COLUMN public.app_settings.fx_rate_ugx IS '1 CAD = X UGX (Ouganda — MTN, Airtel Money)';
COMMENT ON COLUMN public.app_settings.fx_rate_zmw IS '1 CAD = X ZMW (Zambie — MTN, Airtel Money, Zamtel)';
COMMENT ON COLUMN public.app_settings.fx_rate_ngn IS '1 CAD = X NGN (Nigeria — carte, bank transfer, USSD)';

COMMIT;
