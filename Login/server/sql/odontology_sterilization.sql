CREATE TABLE IF NOT EXISTS odontology_instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  total_quantity INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_instruments_quantity_chk CHECK (total_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS odontology_instruments_client_code_uniq
ON odontology_instruments (client_id, LOWER(code))
WHERE code IS NOT NULL AND BTRIM(code) <> '';

CREATE INDEX IF NOT EXISTS idx_odontology_instruments_client
ON odontology_instruments (client_id, is_active, name);

DROP TRIGGER IF EXISTS trg_odontology_instruments_updated_at ON odontology_instruments;
CREATE TRIGGER trg_odontology_instruments_updated_at
BEFORE UPDATE ON odontology_instruments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_sterilization_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  cycle_code TEXT,
  method TEXT NOT NULL DEFAULT 'autoclave',
  cycle_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  temperature TEXT,
  pressure TEXT,
  operator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  biological_indicator TEXT,
  chemical_indicator TEXT,
  result TEXT NOT NULL DEFAULT 'successful',
  observations TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_sterilization_method_chk CHECK (method IN ('autoclave', 'chemical', 'dry_heat', 'other')),
  CONSTRAINT odontology_sterilization_result_chk CHECK (result IN ('successful', 'failed', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_odontology_sterilization_cycles_client
ON odontology_sterilization_cycles (client_id, cycle_date DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS odontology_sterilization_cycles_client_code_uniq
ON odontology_sterilization_cycles (client_id, LOWER(cycle_code))
WHERE cycle_code IS NOT NULL AND BTRIM(cycle_code) <> '';

DROP TRIGGER IF EXISTS trg_odontology_sterilization_cycles_updated_at ON odontology_sterilization_cycles;
CREATE TRIGGER trg_odontology_sterilization_cycles_updated_at
BEFORE UPDATE ON odontology_sterilization_cycles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_sterilization_cycle_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES odontology_sterilization_cycles(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES odontology_instruments(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_sterilization_cycle_items_quantity_chk CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_odontology_sterilization_cycle_items_cycle
ON odontology_sterilization_cycle_items (cycle_id);

INSERT INTO permissions (name, description)
VALUES ('odontology:sterilization:manage', 'Gestionar esterilización odontológica')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'odontology:sterilization:manage'
WHERE r.name IN ('superuser', 'admin_odontologia', 'auxiliar_odontologia', 'odontologo')
ON CONFLICT DO NOTHING;
