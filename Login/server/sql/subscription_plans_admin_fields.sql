ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS grace_days INT NOT NULL DEFAULT 0;

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS expiration_access_mode TEXT NOT NULL DEFAULT 'read_only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_grace_days_chk'
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT subscription_plans_grace_days_chk
      CHECK (grace_days >= 0 AND grace_days <= 365);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_expiration_access_mode_chk'
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT subscription_plans_expiration_access_mode_chk
      CHECK (expiration_access_mode IN ('read_only', 'blocked'));
  END IF;
END $$;

UPDATE subscription_plans
SET grace_days = CASE
      WHEN key = 'solo_consulta' THEN 0
      ELSE COALESCE(NULLIF(grace_days, 0), 5)
    END,
    expiration_access_mode = CASE
      WHEN key = 'solo_consulta' THEN 'read_only'
      ELSE expiration_access_mode
    END;
