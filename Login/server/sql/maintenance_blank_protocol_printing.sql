INSERT INTO permissions (name, description)
VALUES (
  'maintenance:protocol:print_blank',
  'Generar temporalmente protocolos físicos de mantenimiento en blanco'
)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Es un permiso de alto impacto: no se asigna permanentemente a roles de cliente.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name <> 'superuser'
  AND p.name = 'maintenance:protocol:print_blank';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'maintenance:protocol:print_blank'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS maintenance_protocol_print_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_code TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  temporary_permission_id UUID REFERENCES user_temporary_permissions(id) ON DELETE SET NULL,
  permission_expires_at TIMESTAMPTZ NOT NULL,
  selection_scope TEXT NOT NULL,
  asset_ids UUID[] NOT NULL,
  asset_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_protocol_print_batches_scope_chk
    CHECK (selection_scope IN ('selected', 'all_active')),
  CONSTRAINT maintenance_protocol_print_batches_count_chk
    CHECK (asset_count > 0 AND asset_count = cardinality(asset_ids)),
  CONSTRAINT maintenance_protocol_print_batches_reason_chk
    CHECK (char_length(btrim(reason)) BETWEEN 10 AND 300)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_protocol_print_batches_client_created
  ON maintenance_protocol_print_batches (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_protocol_print_batches_user_created
  ON maintenance_protocol_print_batches (generated_by, created_at DESC);
