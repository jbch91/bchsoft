import { query } from './db.js';

const TABLES_SQL = (schema) => `
CREATE SCHEMA IF NOT EXISTS "${schema}";

CREATE TABLE IF NOT EXISTS "${schema}".sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES "${schema}".sites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID REFERENCES "${schema}".areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  equipment_catalog_model_id UUID REFERENCES public.biomedical_equipment_models(id) ON DELETE SET NULL,
  serial TEXT,
  location TEXT,
  photo_path TEXT,
  invima_reg TEXT,
  site_id UUID REFERENCES "${schema}".sites(id) ON DELETE SET NULL,
  area_id UUID REFERENCES "${schema}".areas(id) ON DELETE SET NULL,
  location_id UUID REFERENCES "${schema}".locations(id) ON DELETE SET NULL,
  risk_class TEXT,
  requires_sanitary_classification BOOLEAN NOT NULL DEFAULT FALSE,
  requires_electrical_classification BOOLEAN NOT NULL DEFAULT FALSE,
  electrical_protection_class TEXT,
  applied_part_type TEXT,
  is_mobile BOOLEAN NOT NULL DEFAULT FALSE,
  manufacturer TEXT,
  acquisition_type TEXT,
  contract_text TEXT,
  acquisition_date DATE,
  useful_life_years INT,
  warranty_years INT,
  supplier_name TEXT,
  supplier_phone TEXT,
  supplier_email TEXT,
  power_type TEXT,
  voltage TEXT,
  temp_min NUMERIC,
  temp_max NUMERIC,
  humidity_min NUMERIC,
  humidity_max NUMERIC,
  maintenance_frequency TEXT,
  requires_calibration BOOLEAN NOT NULL DEFAULT FALSE,
  calibration_frequency TEXT,
  hv_engineer_user_id UUID,
  hv_engineer_signed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_assets_catalog_uppercase ON "${schema}".assets;
CREATE TRIGGER trg_assets_catalog_uppercase
BEFORE INSERT OR UPDATE OF name, brand, model ON "${schema}".assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_biomedical_asset_catalog_uppercase();

CREATE TABLE IF NOT EXISTS "${schema}".asset_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
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
);

CREATE TABLE IF NOT EXISTS "${schema}".inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".maintenance_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierta',
  created_by TEXT,
  closed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "${schema}".service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".maintenance_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_order_id UUID REFERENCES "${schema}".maintenance_orders(id) ON DELETE SET NULL,
  report_text TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".calibration_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE SET NULL,
  pdf_path TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".spareparts_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".inventory_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".asset_accessories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  brand TEXT,
  serial TEXT
);

CREATE TABLE IF NOT EXISTS "${schema}".asset_cleaning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
  procedure TEXT NOT NULL,
  frequency TEXT,
  responsible TEXT
);

CREATE TABLE IF NOT EXISTS "${schema}".asset_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "${schema}".asset_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "${schema}".asset_history_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES "${schema}".assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Mantenimiento histórico migrado',
  description TEXT,
  document_date DATE NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  document_type TEXT NOT NULL DEFAULT 'other',
  maintenance_schedule_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_asset_history_files_asset_date"
  ON "${schema}".asset_history_files (asset_id, document_date ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_asset_history_files_schedule_item"
  ON "${schema}".asset_history_files (maintenance_schedule_item_id)
  WHERE maintenance_schedule_item_id IS NOT NULL;

INSERT INTO "${schema}".sites (name)
SELECT 'Sede principal'
WHERE NOT EXISTS (SELECT 1 FROM "${schema}".sites);

`;

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_');
}

export async function createSchemaTables(schema) {
  if (!/^[a-z0-9_]+$/.test(schema)) {
    throw new Error('Schema inválido');
  }

  await query(TABLES_SQL(schema));
}
