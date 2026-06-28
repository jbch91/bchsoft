CREATE TABLE IF NOT EXISTS odontology_catalog_overrides (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES odontology_catalog_items(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_description TEXT,
  custom_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, catalog_item_id)
);

DROP TRIGGER IF EXISTS trg_odontology_catalog_overrides_updated_at ON odontology_catalog_overrides;
CREATE TRIGGER trg_odontology_catalog_overrides_updated_at
BEFORE UPDATE ON odontology_catalog_overrides
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
