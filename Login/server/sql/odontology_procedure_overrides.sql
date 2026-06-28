CREATE TABLE IF NOT EXISTS odontology_procedure_type_overrides (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  procedure_type_id UUID NOT NULL REFERENCES odontology_procedure_types(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_code TEXT,
  custom_category TEXT,
  custom_default_duration_minutes INT,
  custom_default_price NUMERIC(12,2),
  custom_color TEXT,
  custom_requires_consent BOOLEAN,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, procedure_type_id),
  CONSTRAINT odontology_procedure_type_overrides_duration_chk CHECK (
    custom_default_duration_minutes IS NULL OR custom_default_duration_minutes > 0
  )
);

DROP TRIGGER IF EXISTS trg_odontology_procedure_type_overrides_updated_at ON odontology_procedure_type_overrides;
CREATE TRIGGER trg_odontology_procedure_type_overrides_updated_at
BEFORE UPDATE ON odontology_procedure_type_overrides
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
