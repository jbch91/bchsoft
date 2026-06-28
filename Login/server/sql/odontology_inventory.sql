CREATE TABLE IF NOT EXISTS odontology_inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  presentation TEXT,
  unit TEXT NOT NULL DEFAULT 'unidad',
  brand TEXT,
  supplier TEXT,
  min_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_inventory_min_stock_chk CHECK (min_stock >= 0),
  CONSTRAINT odontology_inventory_current_stock_chk CHECK (current_stock >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS odontology_inventory_items_client_code_uniq
ON odontology_inventory_items (client_id, LOWER(code))
WHERE code IS NOT NULL AND BTRIM(code) <> '';

CREATE INDEX IF NOT EXISTS idx_odontology_inventory_items_client
ON odontology_inventory_items (client_id, is_active, name);

DROP TRIGGER IF EXISTS trg_odontology_inventory_items_updated_at ON odontology_inventory_items;
CREATE TRIGGER trg_odontology_inventory_items_updated_at
BEFORE UPDATE ON odontology_inventory_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES odontology_inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  reference TEXT,
  unit_cost NUMERIC(12,2),
  stock_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_inventory_movement_type_chk CHECK (movement_type IN ('entry', 'exit', 'adjustment')),
  CONSTRAINT odontology_inventory_quantity_chk CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_odontology_inventory_movements_client
ON odontology_inventory_movements (client_id, movement_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_odontology_inventory_movements_item
ON odontology_inventory_movements (item_id, movement_date DESC, created_at DESC);

INSERT INTO permissions (name, description)
VALUES ('odontology:inventory:manage', 'Gestionar inventario odontológico')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'odontology:inventory:manage'
WHERE r.name IN ('superuser', 'admin_odontologia', 'auxiliar_odontologia')
ON CONFLICT DO NOTHING;
