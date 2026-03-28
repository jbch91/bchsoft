CREATE INDEX IF NOT EXISTS idx_maintenance_reports_client_asset_created
  ON maintenance_reports (client_id, asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_asset_created
  ON maintenance_reports (asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calibration_items_asset_dates
  ON calibration_schedule_items (asset_id, completed_at DESC, planned_date DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_client_asset_created
  ON maintenance_requests (client_id, asset_id, created_at DESC);
