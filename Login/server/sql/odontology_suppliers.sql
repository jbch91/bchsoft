CREATE TABLE IF NOT EXISTS odontology_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nit TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_suppliers_client_name_uniq UNIQUE (client_id, name)
);

DROP TRIGGER IF EXISTS trg_odontology_suppliers_updated_at ON odontology_suppliers;
CREATE TRIGGER trg_odontology_suppliers_updated_at
BEFORE UPDATE ON odontology_suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_suppliers_client_active
  ON odontology_suppliers (client_id, is_active, name);
