CREATE TABLE IF NOT EXISTS odontology_appointment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES odontology_appointments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_appointment_reminders_channel_chk CHECK (channel IN ('email', 'whatsapp')),
  CONSTRAINT odontology_appointment_reminders_status_chk CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_odontology_appointment_reminders_appointment
  ON odontology_appointment_reminders (client_id, appointment_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_odontology_appointment_reminders_status
  ON odontology_appointment_reminders (client_id, channel, status, sent_at DESC);
