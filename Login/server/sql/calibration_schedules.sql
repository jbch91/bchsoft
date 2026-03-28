CREATE TABLE IF NOT EXISTS calibration_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calibration_schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES calibration_schedules(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  frequency TEXT NOT NULL,
  planned_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pdf_path TEXT,
  completed_at TIMESTAMPTZ,
  reminder_week_sent_at TIMESTAMPTZ,
  reminder_day_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_schedules_client_year ON calibration_schedules (client_id, year);
CREATE INDEX IF NOT EXISTS idx_calibration_items_schedule ON calibration_schedule_items (schedule_id);
CREATE INDEX IF NOT EXISTS idx_calibration_items_asset ON calibration_schedule_items (asset_id);
