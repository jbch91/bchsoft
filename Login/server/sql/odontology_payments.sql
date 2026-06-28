CREATE TABLE IF NOT EXISTS odontology_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  treatment_plan_id UUID REFERENCES odontology_treatment_plans(id) ON DELETE SET NULL,
  concept TEXT NOT NULL DEFAULT 'Abono odontológico',
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  void_reason TEXT,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_payments_amount_chk CHECK (amount > 0),
  CONSTRAINT odontology_payments_method_chk CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta_credito', 'tarjeta_debito', 'nequi', 'daviplata', 'cheque', 'otro')),
  CONSTRAINT odontology_payments_status_chk CHECK (status IN ('registered', 'voided')),
  CONSTRAINT odontology_payments_void_chk CHECK (
    (status = 'registered' AND voided_at IS NULL) OR
    (status = 'voided' AND voided_at IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_odontology_payments_updated_at ON odontology_payments;
CREATE TRIGGER trg_odontology_payments_updated_at
BEFORE UPDATE ON odontology_payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_payments_client_patient ON odontology_payments (client_id, patient_id, payment_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_payments_client_plan ON odontology_payments (client_id, treatment_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_odontology_payments_client_status ON odontology_payments (client_id, status);
