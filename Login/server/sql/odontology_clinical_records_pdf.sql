ALTER TABLE odontology_clinical_records
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;
