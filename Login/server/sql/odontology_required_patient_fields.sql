ALTER TABLE odontology_settings
ADD COLUMN IF NOT EXISTS required_patient_fields JSONB NOT NULL DEFAULT
  '["documentType","documentNumber","fullName","birthDate","sex","phone","email","address","emergencyContactName","emergencyContactPhone"]'::jsonb;

UPDATE odontology_settings
SET required_patient_fields =
  '["documentType","documentNumber","fullName","birthDate","sex","phone","email","address","emergencyContactName","emergencyContactPhone"]'::jsonb
WHERE required_patient_fields IS NULL
   OR jsonb_typeof(required_patient_fields) <> 'array';
