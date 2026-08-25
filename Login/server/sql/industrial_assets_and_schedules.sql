ALTER TABLE biomedical_equipment_catalog
  ADD COLUMN IF NOT EXISTS asset_category TEXT NOT NULL DEFAULT 'biomedical';

UPDATE biomedical_equipment_catalog
SET asset_category = 'biomedical'
WHERE asset_category IS NULL OR asset_category NOT IN ('biomedical', 'industrial');

ALTER TABLE biomedical_equipment_catalog
  DROP CONSTRAINT IF EXISTS biomedical_equipment_catalog_normalized_name_key;

ALTER TABLE biomedical_equipment_catalog
  DROP CONSTRAINT IF EXISTS biomedical_equipment_catalog_asset_category_chk;
ALTER TABLE biomedical_equipment_catalog
  ADD CONSTRAINT biomedical_equipment_catalog_asset_category_chk
  CHECK (asset_category IN ('biomedical', 'industrial'));

ALTER TABLE biomedical_equipment_catalog
  DROP CONSTRAINT IF EXISTS biomedical_equipment_catalog_category_name_uniq;
ALTER TABLE biomedical_equipment_catalog
  ADD CONSTRAINT biomedical_equipment_catalog_category_name_uniq
  UNIQUE (asset_category, normalized_name);

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_category_review
  ON biomedical_equipment_catalog (asset_category, review_status, is_active, name);

INSERT INTO biomedical_equipment_catalog
  (asset_category, name, normalized_name, is_active, review_status, reviewed_at)
VALUES
  ('industrial', 'AIRE ACONDICIONADO', normalize_biomedical_catalog_text('AIRE ACONDICIONADO'), TRUE, 'approved', NOW()),
  ('industrial', 'LAVADORA INDUSTRIAL', normalize_biomedical_catalog_text('LAVADORA INDUSTRIAL'), TRUE, 'approved', NOW()),
  ('industrial', 'NEVERA INDUSTRIAL', normalize_biomedical_catalog_text('NEVERA INDUSTRIAL'), TRUE, 'approved', NOW()),
  ('industrial', 'PLANTA ELÉCTRICA', normalize_biomedical_catalog_text('PLANTA ELÉCTRICA'), TRUE, 'approved', NOW()),
  ('industrial', 'SECADORA INDUSTRIAL', normalize_biomedical_catalog_text('SECADORA INDUSTRIAL'), TRUE, 'approved', NOW())
ON CONFLICT (asset_category, normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    is_active = TRUE,
    review_status = 'approved';

DO $$
DECLARE
  client_schema RECORD;
BEGIN
  FOR client_schema IN
    SELECT schema_name
    FROM clients
    WHERE schema_name ~ '^[a-zA-Z0-9_]+$'
  LOOP
    IF to_regclass(format('%I.%I', client_schema.schema_name, 'assets')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS asset_category TEXT NOT NULL DEFAULT ''biomedical''',
      client_schema.schema_name
    );
    EXECUTE format(
      'UPDATE %I.assets SET asset_category = ''biomedical'' WHERE asset_category IS NULL OR asset_category NOT IN (''biomedical'', ''industrial'')',
      client_schema.schema_name
    );
    EXECUTE format(
      'ALTER TABLE %I.assets DROP CONSTRAINT IF EXISTS assets_asset_category_chk',
      client_schema.schema_name
    );
    EXECUTE format(
      'ALTER TABLE %I.assets ADD CONSTRAINT assets_asset_category_chk CHECK (asset_category IN (''biomedical'', ''industrial''))',
      client_schema.schema_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_assets_asset_category ON %I.assets (asset_category, created_at DESC)',
      client_schema.schema_name
    );
  END LOOP;
END
$$;

ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS asset_category TEXT NOT NULL DEFAULT 'biomedical';

UPDATE maintenance_schedules
SET asset_category = 'biomedical'
WHERE asset_category IS NULL OR asset_category NOT IN ('biomedical', 'industrial');

ALTER TABLE maintenance_schedules
  DROP CONSTRAINT IF EXISTS maintenance_schedules_asset_category_chk;
ALTER TABLE maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_asset_category_chk
  CHECK (asset_category IN ('biomedical', 'industrial'));

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_client_year_category
  ON maintenance_schedules (client_id, year, asset_category, created_at DESC);
