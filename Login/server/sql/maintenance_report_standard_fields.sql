ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS failure_cause TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS maintenance_activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS maintenance_tests JSONB NOT NULL DEFAULT '[]'::jsonb;
