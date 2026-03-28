ALTER TABLE maintenance_schedules
ADD COLUMN IF NOT EXISTS pdf_path TEXT;
