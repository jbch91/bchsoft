ALTER TABLE odontology_appointment_reminders
  ADD COLUMN IF NOT EXISTS reminder_kind TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_odontology_appointment_reminders_unique_sent_auto
  ON odontology_appointment_reminders (appointment_id, channel, reminder_kind)
  WHERE status = 'sent' AND reminder_kind <> 'manual';

CREATE INDEX IF NOT EXISTS idx_odontology_appointment_reminders_kind
  ON odontology_appointment_reminders (client_id, reminder_kind, channel, sent_at DESC);
