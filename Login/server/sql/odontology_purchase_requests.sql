CREATE TABLE IF NOT EXISTS odontology_purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES odontology_inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,2) NOT NULL,
  needed_by_date DATE,
  preferred_supplier TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_purchase_requests_quantity_chk CHECK (quantity > 0),
  CONSTRAINT odontology_purchase_requests_status_chk CHECK (status IN ('requested', 'quoted', 'ordered', 'received', 'cancelled'))
);

DROP TRIGGER IF EXISTS trg_odontology_purchase_requests_updated_at ON odontology_purchase_requests;
CREATE TRIGGER trg_odontology_purchase_requests_updated_at
BEFORE UPDATE ON odontology_purchase_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_purchase_requests_client_status
  ON odontology_purchase_requests (client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_purchase_requests_client_item
  ON odontology_purchase_requests (client_id, item_id, created_at DESC);
