ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS asset_status_observations TEXT;
