CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  engineer_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  pdf_path TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  frequency TEXT NOT NULL,
  planned_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  report_id UUID REFERENCES maintenance_reports(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ
);
