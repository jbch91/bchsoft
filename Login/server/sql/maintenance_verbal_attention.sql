ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS performed_on DATE,
  ADD COLUMN IF NOT EXISTS verbal_reporter_name TEXT,
  ADD COLUMN IF NOT EXISTS verbal_reporter_role TEXT,
  ADD COLUMN IF NOT EXISTS verbal_submission_id UUID,
  ADD COLUMN IF NOT EXISTS verbal_submission_hash TEXT,
  ADD COLUMN IF NOT EXISTS verbal_asset_status_applied BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_verbal_submission_unique
  ON maintenance_reports (client_id, created_by, verbal_submission_id)
  WHERE verbal_submission_id IS NOT NULL;

COMMENT ON COLUMN maintenance_reports.performed_on IS
  'Actual service date declared for a verbal corrective; created_at remains the registration timestamp.';
