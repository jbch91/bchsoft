ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS void_details JSONB;

CREATE INDEX IF NOT EXISTS maintenance_reports_active_request
  ON maintenance_reports(request_id) WHERE voided_at IS NULL;
