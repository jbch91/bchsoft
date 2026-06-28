CREATE TABLE IF NOT EXISTS odontology_odontogram_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE CASCADE,
  dentition TEXT NOT NULL DEFAULT 'permanent',
  tooth_number TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT 'whole',
  condition_item_id UUID REFERENCES odontology_catalog_items(id) ON DELETE SET NULL,
  condition_name TEXT NOT NULL,
  condition_color TEXT,
  notes TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_odontogram_dentition_chk CHECK (dentition IN ('permanent', 'temporary', 'mixed')),
  CONSTRAINT odontology_odontogram_surface_chk CHECK (surface IN ('whole', 'occlusal', 'mesial', 'distal', 'vestibular', 'lingual', 'palatal'))
);

CREATE INDEX IF NOT EXISTS idx_odontology_odontogram_patient_latest
ON odontology_odontogram_entries (client_id, patient_id, tooth_number, surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_odontology_odontogram_patient_history
ON odontology_odontogram_entries (client_id, patient_id, record_date DESC, created_at DESC);
