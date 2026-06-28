CREATE TABLE IF NOT EXISTS odontology_treatment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID REFERENCES odontology_clinical_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  diagnosis_text TEXT,
  objective TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  accepted_signer_name TEXT,
  accepted_signer_document_type TEXT,
  accepted_signer_document_number TEXT,
  accepted_signer_relationship TEXT,
  accepted_signature_path TEXT,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_treatment_plans_status_chk CHECK (status IN ('draft', 'proposed', 'accepted', 'in_progress', 'completed', 'cancelled'))
);

DROP TRIGGER IF EXISTS trg_odontology_treatment_plans_updated_at ON odontology_treatment_plans;
CREATE TRIGGER trg_odontology_treatment_plans_updated_at
BEFORE UPDATE ON odontology_treatment_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_treatment_plans_client_patient ON odontology_treatment_plans (client_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_treatment_plans_client_status ON odontology_treatment_plans (client_id, status);

CREATE TABLE IF NOT EXISTS odontology_treatment_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_plan_id UUID NOT NULL REFERENCES odontology_treatment_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  procedure_type_id UUID REFERENCES odontology_procedure_types(id) ON DELETE SET NULL,
  procedure_name TEXT NOT NULL,
  tooth_number TEXT,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_sessions INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_treatment_plan_items_qty_chk CHECK (quantity > 0),
  CONSTRAINT odontology_treatment_plan_items_sessions_chk CHECK (estimated_sessions > 0),
  CONSTRAINT odontology_treatment_plan_items_status_chk CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

DROP TRIGGER IF EXISTS trg_odontology_treatment_plan_items_updated_at ON odontology_treatment_plan_items;
CREATE TRIGGER trg_odontology_treatment_plan_items_updated_at
BEFORE UPDATE ON odontology_treatment_plan_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_treatment_plan_items_plan ON odontology_treatment_plan_items (treatment_plan_id, sort_order);
