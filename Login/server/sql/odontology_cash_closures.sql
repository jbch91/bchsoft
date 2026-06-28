CREATE TABLE IF NOT EXISTS odontology_cash_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  cashier_filter TEXT,
  total_registered NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_voided NUMERIC(12,2) NOT NULL DEFAULT 0,
  registered_count INTEGER NOT NULL DEFAULT 0,
  voided_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_cash_closures_date_chk CHECK (date_to >= date_from)
);

DROP TRIGGER IF EXISTS trg_odontology_cash_closures_updated_at ON odontology_cash_closures;
CREATE TRIGGER trg_odontology_cash_closures_updated_at
BEFORE UPDATE ON odontology_cash_closures
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_cash_closures_client_dates ON odontology_cash_closures (client_id, date_from DESC, date_to DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_cash_closures_client_cashier ON odontology_cash_closures (client_id, LOWER(COALESCE(cashier_filter, '')));
