CREATE TABLE IF NOT EXISTS client_subscriptions (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  access_mode TEXT NOT NULL DEFAULT 'full',
  current_period_starts_at DATE,
  current_period_ends_at DATE,
  grace_ends_at DATE,
  amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'COP',
  notes TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_subscriptions_billing_cycle_chk CHECK (billing_cycle IN ('monthly', 'annual')),
  CONSTRAINT client_subscriptions_status_chk CHECK (status IN ('active', 'grace', 'read_only', 'suspended', 'cancelled')),
  CONSTRAINT client_subscriptions_access_mode_chk CHECK (access_mode IN ('full', 'read_only', 'blocked'))
);

DROP TRIGGER IF EXISTS trg_client_subscriptions_updated_at ON client_subscriptions;
CREATE TRIGGER trg_client_subscriptions_updated_at
BEFORE UPDATE ON client_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'COP',
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_client_paid_at
ON subscription_payments (client_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_client_created_at
ON subscription_events (client_id, created_at DESC);

INSERT INTO client_subscriptions (client_id, billing_cycle, status, access_mode, currency)
SELECT id, 'monthly', 'active', 'full', 'COP'
FROM clients
ON CONFLICT (client_id) DO NOTHING;
