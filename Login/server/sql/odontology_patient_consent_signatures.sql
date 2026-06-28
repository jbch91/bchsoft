ALTER TABLE odontology_patient_consents
  ADD COLUMN IF NOT EXISTS signer_signature_path TEXT;
