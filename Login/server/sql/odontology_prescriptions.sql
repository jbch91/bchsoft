CREATE TABLE IF NOT EXISTS odontology_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  concentration TEXT,
  pharmaceutical_form TEXT,
  default_dose TEXT,
  default_frequency TEXT,
  default_duration TEXT,
  default_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_odontology_medications_updated_at ON odontology_medications;
CREATE TRIGGER trg_odontology_medications_updated_at
BEFORE UPDATE ON odontology_medications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_odontology_medications_unique_name
ON odontology_medications (COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name), COALESCE(concentration, ''), COALESCE(pharmaceutical_form, ''));

CREATE INDEX IF NOT EXISTS idx_odontology_medications_client_active ON odontology_medications (client_id, is_active, name);

CREATE TABLE IF NOT EXISTS odontology_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID REFERENCES odontology_clinical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT,
  general_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  pdf_path TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_prescriptions_status_chk CHECK (status IN ('issued', 'voided'))
);

DROP TRIGGER IF EXISTS trg_odontology_prescriptions_updated_at ON odontology_prescriptions;
CREATE TRIGGER trg_odontology_prescriptions_updated_at
BEFORE UPDATE ON odontology_prescriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_prescriptions_client_patient ON odontology_prescriptions (client_id, patient_id, prescription_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_prescriptions_client_status ON odontology_prescriptions (client_id, status, prescription_date DESC);

CREATE TABLE IF NOT EXISTS odontology_prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES odontology_prescriptions(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES odontology_medications(id) ON DELETE SET NULL,
  medication_name TEXT NOT NULL,
  concentration TEXT,
  pharmaceutical_form TEXT,
  dose TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity TEXT,
  instructions TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odontology_prescription_items_prescription ON odontology_prescription_items (prescription_id, sort_order);

INSERT INTO odontology_medications (
  client_id, name, concentration, pharmaceutical_form, default_dose, default_frequency, default_duration, default_instructions, is_system
)
VALUES
  (NULL, 'Acetaminofén', '500 mg', 'Tableta', '1 tableta', 'cada 6 horas', '3 días', 'Tomar si presenta dolor. No exceder la dosis recomendada.', TRUE),
  (NULL, 'Ibuprofeno', '400 mg', 'Tableta', '1 tableta', 'cada 8 horas', '3 días', 'Tomar después de comidas. Evitar si tiene gastritis severa o contraindicación médica.', TRUE),
  (NULL, 'Amoxicilina', '500 mg', 'Cápsula', '1 cápsula', 'cada 8 horas', '7 días', 'Completar el tratamiento indicado aunque mejoren los síntomas.', TRUE),
  (NULL, 'Clorhexidina', '0.12%', 'Enjuague bucal', '15 ml', 'cada 12 horas', '7 días', 'Enjuagar durante 30 segundos y no ingerir.', TRUE),
  (NULL, 'Naproxeno', '250 mg', 'Tableta', '1 tableta', 'cada 12 horas', '3 días', 'Tomar después de comidas.', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (name, description)
VALUES ('odontology:prescriptions:manage', 'Gestionar recetas odontológicas')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('odontology:prescriptions:manage')
WHERE r.name IN ('superuser', 'odontologo', 'admin_odontologia')
ON CONFLICT DO NOTHING;
