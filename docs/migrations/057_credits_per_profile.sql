-- Migration 057: Crédits par profil (famille)
-- Date: 2026-05-04
-- Description:
--   Pour les abos famille, chaque profil doit avoir SES propres crédits.
--   Avant : 1 row qty_total=N pour la subscription (consommée par n'importe quel profil)
--   Après : N rows qty_total=1 chacune, chacune liée à un profil spécifique.
--
--   Pour les abos solo, profile_id reste NULL (pas de scope profil).

-- ============================================================================
-- 1) Ajouter profile_id sur bonus_credits
-- ============================================================================

ALTER TABLE public.bonus_credits
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bonus_credits_profile_id ON public.bonus_credits(profile_id);
CREATE INDEX IF NOT EXISTS idx_bonus_credits_user_profile ON public.bonus_credits(user_id, profile_id);

COMMENT ON COLUMN public.bonus_credits.profile_id IS
  'Profil famille auquel le crédit est attribué. NULL pour les abos solo.';

-- ============================================================================
-- 2) Drop l'index unique de la 056 (la nouvelle clé inclut profile_id)
-- ============================================================================

DROP INDEX IF EXISTS public.uq_bonus_credits_plan_immediate_per_cycle;

CREATE UNIQUE INDEX uq_bonus_credits_plan_immediate_per_cycle
  ON public.bonus_credits (
    subscription_id,
    (metadata->>'cycle_start'),
    COALESCE(profile_id::text, '')
  )
  WHERE source = 'plan_immediate' AND (metadata->>'cycle_start') IS NOT NULL;

-- ============================================================================
-- 3) Backfill : éclater les crédits famille existants en 1 row par profil
--    Stratégie :
--      - Pour chaque crédit famille (qty_total > 1, profile_id IS NULL),
--        on crée N-1 nouvelles rows de qty=1 et on réduit l'original à qty=1
--      - Chaque row reçoit un profile_id différent
-- ============================================================================

DO $$
DECLARE
  credit_row RECORD;
  profile_ids UUID[];
  qty INTEGER;
  i INTEGER;
  used INTEGER;
BEGIN
  FOR credit_row IN
    SELECT bc.*, sp.included_users
    FROM public.bonus_credits bc
    JOIN public.subscriptions s ON s.id = bc.subscription_id
    LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE bc.profile_id IS NULL
      AND bc.source = 'plan_immediate'
      AND bc.quantity_total > 1
      AND bc.subscription_id IN (
        SELECT id FROM public.subscriptions
        WHERE COALESCE(plan_snapshot->>'includedUsers', '1')::int > 1
           OR COALESCE(included_profiles, 1) > 1
      )
  LOOP
    -- Récupérer les profils actifs de cette subscription, ordonnés (owner d'abord)
    SELECT array_agg(id ORDER BY is_owner_profile DESC, position ASC, created_at ASC)
    INTO profile_ids
    FROM public.family_profiles
    WHERE subscription_id = credit_row.subscription_id
      AND is_active = TRUE
      AND deleted_at IS NULL;

    qty := credit_row.quantity_total;
    used := credit_row.quantity_used;

    -- Si pas de profil ou pas assez, on skip (le profil principal sera créé plus tard)
    IF profile_ids IS NULL OR array_length(profile_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Mettre à jour la row existante : qty=1, attribuée au 1er profil
    UPDATE public.bonus_credits
    SET quantity_total = 1,
        quantity_used = LEAST(used, 1),
        profile_id = profile_ids[1],
        consumed_at = CASE WHEN LEAST(used, 1) >= 1 THEN NOW() ELSE NULL END
    WHERE id = credit_row.id;

    used := GREATEST(0, used - 1);

    -- Créer les rows additionnelles pour les autres profils
    FOR i IN 2..LEAST(qty, COALESCE(array_length(profile_ids, 1), 0)) LOOP
      INSERT INTO public.bonus_credits (
        user_id,
        subscription_id,
        profile_id,
        bonus_type,
        quantity_total,
        quantity_used,
        source,
        granted_at,
        expires_at,
        grants_lifetime_access,
        consumed_at,
        metadata
      ) VALUES (
        credit_row.user_id,
        credit_row.subscription_id,
        profile_ids[i],
        credit_row.bonus_type,
        1,
        LEAST(used, 1),
        credit_row.source,
        credit_row.granted_at,
        credit_row.expires_at,
        credit_row.grants_lifetime_access,
        CASE WHEN LEAST(used, 1) >= 1 THEN NOW() ELSE NULL END,
        credit_row.metadata
      );
      used := GREATEST(0, used - 1);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- TEST : afficher les crédits par profil pour les abos actifs
-- ============================================================================

SELECT
  bc.subscription_id,
  fp.name AS profile_name,
  fp.is_owner_profile,
  bc.profile_id,
  bc.quantity_total,
  bc.quantity_used,
  bc.grants_lifetime_access
FROM public.bonus_credits bc
LEFT JOIN public.family_profiles fp ON fp.id = bc.profile_id
WHERE bc.source = 'plan_immediate'
ORDER BY bc.subscription_id, fp.is_owner_profile DESC, fp.position ASC;
