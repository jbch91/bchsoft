CREATE TABLE IF NOT EXISTS odontology_clinical_record_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  clinical_record_id UUID NOT NULL REFERENCES odontology_clinical_records(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  reason TEXT,
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odontology_clinical_record_notes_record
  ON odontology_clinical_record_notes (client_id, clinical_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_odontology_clinical_record_notes_patient
  ON odontology_clinical_record_notes (client_id, patient_id, created_at DESC);
