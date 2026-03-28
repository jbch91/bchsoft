ALTER TABLE maintenance_reports
ADD COLUMN IF NOT EXISTS pdf_path TEXT;
