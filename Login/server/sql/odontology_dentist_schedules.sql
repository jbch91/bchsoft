ALTER TABLE odontology_settings
  ADD COLUMN IF NOT EXISTS enforce_dentist_schedule BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS odontology_dentist_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dentist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_dentist_schedules_day_chk CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT odontology_dentist_schedules_time_chk CHECK (end_time > start_time),
  CONSTRAINT odontology_dentist_schedules_uniq UNIQUE (client_id, dentist_user_id, day_of_week, start_time, end_time)
);

DROP TRIGGER IF EXISTS trg_odontology_dentist_schedules_updated_at ON odontology_dentist_schedules;
CREATE TRIGGER trg_odontology_dentist_schedules_updated_at
BEFORE UPDATE ON odontology_dentist_schedules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_dentist_schedules_client
  ON odontology_dentist_schedules (client_id, dentist_user_id, day_of_week, is_active);
