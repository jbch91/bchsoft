CREATE TABLE IF NOT EXISTS odontology_procedure_inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  procedure_type_id UUID NOT NULL REFERENCES odontology_procedure_types(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES odontology_inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_procedure_inventory_quantity_chk CHECK (quantity > 0),
  CONSTRAINT odontology_procedure_inventory_uniq UNIQUE (client_id, procedure_type_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_odontology_procedure_inventory_client
ON odontology_procedure_inventory_items (client_id, procedure_type_id, is_active);

DROP TRIGGER IF EXISTS trg_odontology_procedure_inventory_items_updated_at ON odontology_procedure_inventory_items;
CREATE TRIGGER trg_odontology_procedure_inventory_items_updated_at
BEFORE UPDATE ON odontology_procedure_inventory_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_appointment_inventory_consumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES odontology_appointments(id) ON DELETE CASCADE,
  procedure_inventory_item_id UUID REFERENCES odontology_procedure_inventory_items(id) ON DELETE SET NULL,
  item_id UUID NOT NULL REFERENCES odontology_inventory_items(id) ON DELETE RESTRICT,
  movement_id UUID REFERENCES odontology_inventory_movements(id) ON DELETE SET NULL,
  quantity NUMERIC(12,2) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_appointment_inventory_quantity_chk CHECK (quantity > 0),
  CONSTRAINT odontology_appointment_inventory_uniq UNIQUE (appointment_id, procedure_inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_odontology_appointment_inventory_client
ON odontology_appointment_inventory_consumptions (client_id, appointment_id, created_at DESC);
