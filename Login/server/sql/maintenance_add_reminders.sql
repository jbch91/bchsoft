ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS reminder_3_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_day_sent_at TIMESTAMPTZ;
