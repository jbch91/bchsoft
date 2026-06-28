CREATE TABLE IF NOT EXISTS odontology_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES odontology_sites(id) ON DELETE SET NULL,
  chair_id UUID REFERENCES odontology_chairs(id) ON DELETE SET NULL,
  dentist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  procedure_type_id UUID REFERENCES odontology_procedure_types(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Programada',
  notes TEXT,
  cancellation_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_appointments_duration_chk CHECK (duration_minutes > 0),
  CONSTRAINT odontology_appointments_time_chk CHECK (end_time > start_time)
);

DROP TRIGGER IF EXISTS trg_odontology_appointments_updated_at ON odontology_appointments;
CREATE TRIGGER trg_odontology_appointments_updated_at
BEFORE UPDATE ON odontology_appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_appointments_client_date ON odontology_appointments (client_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_odontology_appointments_dentist_date ON odontology_appointments (client_id, dentist_user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_odontology_appointments_chair_date ON odontology_appointments (client_id, chair_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_odontology_appointments_patient ON odontology_appointments (client_id, patient_id);
