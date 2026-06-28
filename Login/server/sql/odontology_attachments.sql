CREATE TABLE IF NOT EXISTS odontology_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID REFERENCES odontology_clinical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  treatment_plan_id UUID REFERENCES odontology_treatment_plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'otro',
  title TEXT NOT NULL,
  description TEXT,
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size_bytes INT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_attachments_category_chk CHECK (category IN ('radiografia', 'autorizacion', 'remision', 'laboratorio', 'formula', 'foto_clinica', 'documento_externo', 'otro'))
);

DROP TRIGGER IF EXISTS trg_odontology_attachments_updated_at ON odontology_attachments;
CREATE TRIGGER trg_odontology_attachments_updated_at
BEFORE UPDATE ON odontology_attachments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_attachments_client_patient ON odontology_attachments (client_id, patient_id, document_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_attachments_client_category ON odontology_attachments (client_id, category);
