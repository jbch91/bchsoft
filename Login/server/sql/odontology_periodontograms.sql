CREATE TABLE IF NOT EXISTS odontology_periodontograms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID REFERENCES odontology_clinical_records(id) ON DELETE SET NULL,
  chart_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dentition TEXT NOT NULL DEFAULT 'permanent',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_periodontograms_dentition_chk CHECK (dentition IN ('permanent', 'temporary', 'mixed')),
  CONSTRAINT odontology_periodontograms_status_chk CHECK (status IN ('draft', 'signed'))
);

DROP TRIGGER IF EXISTS trg_odontology_periodontograms_updated_at ON odontology_periodontograms;
CREATE TRIGGER trg_odontology_periodontograms_updated_at
BEFORE UPDATE ON odontology_periodontograms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_periodontograms_client_patient ON odontology_periodontograms (client_id, patient_id, chart_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_periodontograms_client_date ON odontology_periodontograms (client_id, chart_date DESC);

CREATE TABLE IF NOT EXISTS odontology_periodontal_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chart_id UUID NOT NULL REFERENCES odontology_periodontograms(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  probing_mb INT,
  probing_b INT,
  probing_db INT,
  probing_ml INT,
  probing_l INT,
  probing_dl INT,
  recession_mb INT,
  recession_b INT,
  recession_db INT,
  recession_ml INT,
  recession_l INT,
  recession_dl INT,
  bleeding_mb BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_b BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_db BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_ml BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_l BOOLEAN NOT NULL DEFAULT FALSE,
  bleeding_dl BOOLEAN NOT NULL DEFAULT FALSE,
  plaque BOOLEAN NOT NULL DEFAULT FALSE,
  calculus BOOLEAN NOT NULL DEFAULT FALSE,
  mobility TEXT,
  furcation TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_periodontal_measurements_tooth_unique UNIQUE (chart_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_odontology_periodontal_measurements_chart ON odontology_periodontal_measurements (chart_id, sort_order);

INSERT INTO permissions (name, description)
VALUES ('odontology:periodontogram:manage', 'Gestionar periodontograma odontológico')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('odontology:periodontogram:manage')
WHERE r.name IN ('superuser', 'odontologo', 'admin_odontologia')
ON CONFLICT DO NOTHING;
