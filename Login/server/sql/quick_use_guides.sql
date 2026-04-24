CREATE TABLE IF NOT EXISTS quick_use_guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_code TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  equipment_name TEXT NOT NULL,
  equipment_type TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  brand_normalized TEXT NOT NULL,
  model_normalized TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador',
  intended_use TEXT,
  responsible_use TEXT,
  placement_notes TEXT,
  prerequisites TEXT,
  startup_steps TEXT,
  shutdown_steps TEXT,
  basic_operation TEXT,
  alarms TEXT,
  cleaning_disinfection TEXT,
  emergency_actions TEXT,
  support_contact TEXT,
  visual_notes TEXT,
  visual_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quick_use_guides_status_chk CHECK (status IN ('borrador', 'aprobada', 'obsoleta')),
  CONSTRAINT quick_use_guides_client_brand_model_uniq UNIQUE (client_id, brand_normalized, model_normalized)
);

DROP TRIGGER IF EXISTS trg_quick_use_guides_updated_at ON quick_use_guides;
CREATE TRIGGER trg_quick_use_guides_updated_at
BEFORE UPDATE ON quick_use_guides
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_quick_use_guides_client_status
  ON quick_use_guides (client_id, status, updated_at DESC);

INSERT INTO permissions (name, description)
VALUES
  ('quick_guides:view', 'Ver guías rápidas de uso'),
  ('quick_guides:create', 'Crear guías rápidas de uso'),
  ('quick_guides:edit', 'Editar guías rápidas de uso'),
  ('quick_guides:approve', 'Aprobar guías rápidas de uso'),
  ('quick_guides:delete', 'Eliminar guías rápidas de uso')
ON CONFLICT (name) DO NOTHING;

INSERT INTO modules (key, name, description)
VALUES
  ('guias_rapidas', 'Guías rápidas de uso', 'Guías por marca y modelo para operación segura')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = TRUE;

INSERT INTO client_modules (client_id, module_key, enabled)
SELECT id, 'guias_rapidas', TRUE
FROM clients
ON CONFLICT (client_id, module_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'quick_guides:view',
  'quick_guides:create',
  'quick_guides:edit',
  'quick_guides:approve'
)
WHERE r.name = 'ingeniero_biomedico'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'quick_guides:view'
WHERE r.name IN ('almacenista', 'lector', 'viewer', 'calibracion')
ON CONFLICT DO NOTHING;
