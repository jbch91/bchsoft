ALTER TABLE odontology_settings
  ADD COLUMN IF NOT EXISTS enable_whatsapp_reminders BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_business_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_day_before_template TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_same_day_template TEXT;
