DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'cliente_%'
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.areas (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())', s.schema_name);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.locations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), area_id UUID REFERENCES %I.areas(id) ON DELETE SET NULL, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())', s.schema_name, s.schema_name);

    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS photo_path TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS invima_reg TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES %I.areas(id) ON DELETE SET NULL', s.schema_name, s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES %I.locations(id) ON DELETE SET NULL', s.schema_name, s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS risk_class TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN NOT NULL DEFAULT FALSE', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS manufacturer TEXT', s.schema_name);
  END LOOP;
END $$;
