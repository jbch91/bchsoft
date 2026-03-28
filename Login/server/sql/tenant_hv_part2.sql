DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'cliente_%'
  LOOP
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS acquisition_type TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS contract_text TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS acquisition_date DATE', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS useful_life_years INT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS warranty_years INT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS supplier_name TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS supplier_phone TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS supplier_email TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS power_type TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS voltage TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS temp_min NUMERIC', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS temp_max NUMERIC', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS humidity_min NUMERIC', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS humidity_max NUMERIC', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS maintenance_frequency TEXT', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS requires_calibration BOOLEAN NOT NULL DEFAULT FALSE', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS calibration_frequency TEXT', s.schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.asset_accessories (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE, name TEXT NOT NULL, quantity INT NOT NULL DEFAULT 1, brand TEXT, serial TEXT)', s.schema_name, s.schema_name);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.asset_cleaning (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE, procedure TEXT NOT NULL, frequency TEXT, responsible TEXT)', s.schema_name, s.schema_name);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.asset_recommendations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE, text TEXT NOT NULL)', s.schema_name, s.schema_name);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.asset_documents (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE, doc_type TEXT NOT NULL, file_path TEXT NOT NULL)', s.schema_name, s.schema_name);
  END LOOP;
END $$;
