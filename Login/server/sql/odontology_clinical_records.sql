CREATE TABLE IF NOT EXISTS odontology_clinical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  chief_complaint TEXT NOT NULL,
  current_illness TEXT,
  medical_history TEXT,
  dental_history TEXT,
  family_history TEXT,
  current_medications TEXT,
  allergies TEXT,
  habits TEXT,
  extraoral_exam TEXT,
  intraoral_exam TEXT,
  diagnosis_code TEXT,
  diagnosis_text TEXT,
  treatment_plan TEXT,
  clinical_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  patient_signer_name TEXT,
  patient_signer_document_type TEXT,
  patient_signer_document_number TEXT,
  patient_signer_relationship TEXT,
  patient_signature_path TEXT,
  patient_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_clinical_records_status_chk CHECK (status IN ('draft', 'signed')),
  CONSTRAINT odontology_clinical_records_signed_chk CHECK (
    (status = 'draft' AND signed_at IS NULL) OR
    (status = 'signed' AND signed_at IS NOT NULL AND signed_by IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_odontology_clinical_records_updated_at ON odontology_clinical_records;
CREATE TRIGGER trg_odontology_clinical_records_updated_at
BEFORE UPDATE ON odontology_clinical_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_clinical_records_client_patient ON odontology_clinical_records (client_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_clinical_records_client_status ON odontology_clinical_records (client_id, status);
CREATE INDEX IF NOT EXISTS idx_odontology_clinical_records_appointment ON odontology_clinical_records (appointment_id);
