CREATE TABLE IF NOT EXISTS odontology_patient_counters (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  next_number INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_patient_counters_next_chk CHECK (next_number > 0)
);

DROP TRIGGER IF EXISTS trg_odontology_patient_counters_updated_at ON odontology_patient_counters;
CREATE TRIGGER trg_odontology_patient_counters_updated_at
BEFORE UPDATE ON odontology_patient_counters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  internal_code TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  patient_type TEXT NOT NULL DEFAULT 'particular',
  payer_name TEXT,
  authorization_required BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Activo',
  guardian_name TEXT,
  guardian_document_type TEXT,
  guardian_document_number TEXT,
  guardian_phone TEXT,
  guardian_relationship TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  pregnancy BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_risk BOOLEAN NOT NULL DEFAULT FALSE,
  diabetes BOOLEAN NOT NULL DEFAULT FALSE,
  hypertension BOOLEAN NOT NULL DEFAULT FALSE,
  pacemaker BOOLEAN NOT NULL DEFAULT FALSE,
  important_observation TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_patients_client_code_uniq UNIQUE (client_id, internal_code),
  CONSTRAINT odontology_patients_document_uniq UNIQUE (client_id, document_type, document_number),
  CONSTRAINT odontology_patients_document_type_chk CHECK (document_type IN ('cedula_ciudadania', 'cedula_extranjeria', 'tarjeta_identidad', 'registro_civil', 'pasaporte', 'permiso_especial', 'otro')),
  CONSTRAINT odontology_patients_guardian_document_type_chk CHECK (guardian_document_type IS NULL OR guardian_document_type IN ('cedula_ciudadania', 'cedula_extranjeria', 'tarjeta_identidad', 'registro_civil', 'pasaporte', 'permiso_especial', 'otro')),
  CONSTRAINT odontology_patients_sex_chk CHECK (sex IN ('femenino', 'masculino', 'otro', 'no_especifica')),
  CONSTRAINT odontology_patients_type_chk CHECK (patient_type IN ('particular', 'eps', 'aseguradora', 'convenio', 'otro'))
);

DROP TRIGGER IF EXISTS trg_odontology_patients_updated_at ON odontology_patients;
CREATE TRIGGER trg_odontology_patients_updated_at
BEFORE UPDATE ON odontology_patients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_patients_client_name ON odontology_patients (client_id, full_name);
CREATE INDEX IF NOT EXISTS idx_odontology_patients_client_status ON odontology_patients (client_id, status);
CREATE INDEX IF NOT EXISTS idx_odontology_patients_client_document ON odontology_patients (client_id, document_number);
