-- Migration Epic 2: Abonnements & Paiements
-- Date: 2026-02-13
-- Description: Tables pour gérer les abonnements et paiements (Flutterwave + Stripe)

-- ============================================================================
-- ÉTAPE 1 : Table subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  plan_type               VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  amount                  DECIMAL(10, 2) NOT NULL,
  currency                VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Status machine (INACTIVE → ACTIVE → EXPIRED / CANCELLED)
  status                  VARCHAR(20) NOT NULL CHECK (status IN ('INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED')) DEFAULT 'INACTIVE',

  -- Billing period
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,

  -- Provider info (Flutterwave or Stripe)
  provider                VARCHAR(20) NOT NULL CHECK (provider IN ('flutterwave', 'stripe')),
  provider_subscription_id VARCHAR(255),
  provider_customer_id    VARCHAR(255),

  -- Metadata
  metadata                JSONB DEFAULT '{}',

  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON public.subscriptions(provider, provider_subscription_id);

-- Constraint: Un seul abonnement ACTIVE par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
ON public.subscriptions(user_id)
WHERE status = 'ACTIVE';

-- Comments
COMMENT ON TABLE public.subscriptions IS 'Abonnements utilisateurs (mensuel 5 EUR, annuel 50 EUR)';
COMMENT ON COLUMN public.subscriptions.status IS 'Machine d''état: INACTIVE → ACTIVE → EXPIRED/CANCELLED';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Si true, l''abonnement s''arrête à la fin de la période';

-- ============================================================================
-- ÉTAPE 2 : Table payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  -- Payment details
  amount                DECIMAL(10, 2) NOT NULL,
  currency              VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status                VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')) DEFAULT 'pending',

  -- Provider info
  provider              VARCHAR(20) NOT NULL CHECK (provider IN ('flutterwave', 'stripe')),
  provider_payment_id   VARCHAR(255),
  provider_customer_id  VARCHAR(255),

  -- Payment method
  payment_method        VARCHAR(50), -- card, mobile_money, bank_transfer, etc.

  -- Metadata
  metadata              JSONB DEFAULT '{}',
  error_message         TEXT,

  -- Timestamps
  paid_at               TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);

-- Comments
COMMENT ON TABLE public.payments IS 'Historique des paiements (initial + renouvellements)';
COMMENT ON COLUMN public.payments.status IS 'pending = en attente, succeeded = réussi, failed = échoué';

-- ============================================================================
-- ÉTAPE 3 : Table webhook_events (Idempotence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(20) NOT NULL CHECK (provider IN ('flutterwave', 'stripe')),
  event_id          VARCHAR(255) NOT NULL,
  event_type        VARCHAR(100) NOT NULL,
  payload           JSONB NOT NULL,
  processed         BOOLEAN DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint pour éviter de traiter 2 fois le même event
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
ON public.webhook_events(provider, event_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(provider, event_type);

-- Comments
COMMENT ON TABLE public.webhook_events IS 'Log de tous les webhooks reçus (idempotence)';
COMMENT ON COLUMN public.webhook_events.event_id IS 'ID unique fourni par le provider (Flutterwave/Stripe)';

-- ============================================================================
-- ÉTAPE 4 : Trigger pour updated_at automatique
-- ============================================================================

-- Fonction trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger sur payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ÉTAPE 5 : Fonction helper - Get active subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  plan_type VARCHAR(20),
  status VARCHAR(20),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.plan_type,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'ACTIVE'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 6 : RLS Policies
-- ============================================================================

-- Subscriptions: Lecture par l'utilisateur, écriture backend uniquement
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Payments: Lecture par l'utilisateur, écriture backend uniquement
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
CREATE POLICY "Service role can manage payments"
ON public.payments FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Webhook events: Backend uniquement
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage webhooks" ON public.webhook_events;
CREATE POLICY "Service role can manage webhooks"
ON public.webhook_events FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- ÉTAPE 7 : Données de référence - Plans
-- ============================================================================

-- Les plans sont retournés par l'API, pas stockés en DB
-- Mensuel: 5 EUR/mois
-- Annuel: 50 EUR/an

-- ============================================================================
-- TEST
-- ============================================================================

-- Pour tester:
-- 1. Exécuter cette migration
-- 2. Vérifier les tables:
SELECT * FROM public.subscriptions LIMIT 5;
SELECT * FROM public.payments LIMIT 5;
SELECT * FROM public.webhook_events LIMIT 5;

-- 3. Tester la fonction helper:
-- SELECT * FROM public.get_active_subscription('user-uuid-here');
