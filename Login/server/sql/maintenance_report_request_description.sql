ALTER TABLE maintenance_reports
ADD COLUMN IF NOT EXISTS request_description TEXT;
