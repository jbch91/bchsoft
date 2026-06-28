ALTER TABLE odontology_treatment_plans
  ADD COLUMN IF NOT EXISTS accepted_signer_name TEXT,
  ADD COLUMN IF NOT EXISTS accepted_signer_document_type TEXT,
  ADD COLUMN IF NOT EXISTS accepted_signer_document_number TEXT,
  ADD COLUMN IF NOT EXISTS accepted_signer_relationship TEXT,
  ADD COLUMN IF NOT EXISTS accepted_signature_path TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL;
