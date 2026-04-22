INSERT INTO permissions (name, description)
VALUES
  ('inventory:move', 'Mover equipos y generar reportes de movimiento')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'inventory:move'
WHERE r.name IN ('almacenista', 'ingeniero_biomedico', 'superuser')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT schema_name FROM clients LOOP
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS hv_engineer_user_id UUID', s.schema_name);
    EXECUTE format('ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS hv_engineer_signed_at TIMESTAMPTZ', s.schema_name);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.asset_movements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES %I.assets(id) ON DELETE CASCADE,
        from_code TEXT,
        to_code TEXT,
        from_site_id UUID,
        from_site_name TEXT,
        to_site_id UUID,
        to_site_name TEXT,
        from_area_id UUID,
        from_area_name TEXT,
        to_area_id UUID,
        to_area_name TEXT,
        from_location_id UUID,
        from_location_name TEXT,
        to_location_id UUID,
        to_location_name TEXT,
        moved_by UUID,
        moved_by_name TEXT,
        moved_by_role TEXT,
        notes TEXT,
        pdf_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, s.schema_name, s.schema_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.asset_movements (asset_id, created_at DESC)', 'idx_asset_movements_asset_created', s.schema_name);
  END LOOP;
END $$;
