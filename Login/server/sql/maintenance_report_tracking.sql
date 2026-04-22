ALTER TABLE maintenance_reports
ADD COLUMN IF NOT EXISTS asset_status_after TEXT NOT NULL DEFAULT 'operativo',
ADD COLUMN IF NOT EXISTS requires_spare_parts BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS spare_parts_needed TEXT,
ADD COLUMN IF NOT EXISTS spare_parts_status TEXT NOT NULL DEFAULT 'no_aplica';

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_spare_parts
ON maintenance_reports (client_id, requires_spare_parts, spare_parts_status, created_at DESC);
