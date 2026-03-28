CREATE TABLE IF NOT EXISTS training_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  start_date DATE NOT NULL,
  periodicity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS training_schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
  area_id UUID NOT NULL,
  planned_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pdf_path TEXT,
  completed_at TIMESTAMPTZ,
  reminder_3_sent_at TIMESTAMPTZ,
  reminder_day_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_schedules_client_year ON training_schedules (client_id, year);
CREATE INDEX IF NOT EXISTS idx_training_items_schedule ON training_schedule_items (schedule_id);
CREATE INDEX IF NOT EXISTS idx_training_items_area ON training_schedule_items (area_id);
