ALTER TABLE training_schedules
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;
