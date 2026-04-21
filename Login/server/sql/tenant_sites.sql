DO $$
DECLARE
  s RECORD;
  default_site_id UUID;
BEGIN
  FOR s IN SELECT schema_name FROM clients WHERE schema_name LIKE 'cliente_%'
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.sites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )', s.schema_name);

    EXECUTE format('INSERT INTO %I.sites (name)
      SELECT $1
      WHERE NOT EXISTS (SELECT 1 FROM %I.sites)', s.schema_name, s.schema_name)
      USING 'Sede principal';

    EXECUTE format('SELECT id FROM %I.sites ORDER BY created_at LIMIT 1', s.schema_name)
      INTO default_site_id;

    EXECUTE format('ALTER TABLE %I.areas ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES %I.sites(id) ON DELETE SET NULL', s.schema_name, s.schema_name);
    EXECUTE format('UPDATE %I.areas SET site_id = $1 WHERE site_id IS NULL', s.schema_name)
      USING default_site_id;

    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES %I.sites(id) ON DELETE SET NULL', s.schema_name, s.schema_name);
    EXECUTE format('UPDATE %I.assets a
      SET site_id = COALESCE(ar.site_id, $1)
      FROM %I.areas ar
      WHERE a.area_id = ar.id AND a.site_id IS NULL', s.schema_name, s.schema_name)
      USING default_site_id;
    EXECUTE format('UPDATE %I.assets SET site_id = $1 WHERE site_id IS NULL', s.schema_name)
      USING default_site_id;
  END LOOP;
END $$;
