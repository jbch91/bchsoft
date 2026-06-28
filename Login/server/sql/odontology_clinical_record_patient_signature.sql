ALTER TABLE odontology_clinical_records
  ADD COLUMN IF NOT EXISTS patient_signer_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_signer_document_type TEXT,
  ADD COLUMN IF NOT EXISTS patient_signer_document_number TEXT,
  ADD COLUMN IF NOT EXISTS patient_signer_relationship TEXT,
  ADD COLUMN IF NOT EXISTS patient_signature_path TEXT,
  ADD COLUMN IF NOT EXISTS patient_signed_at TIMESTAMPTZ;
