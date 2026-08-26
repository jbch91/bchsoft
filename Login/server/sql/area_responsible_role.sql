INSERT INTO roles (name, description)
VALUES ('responsable_area', 'Jefe o responsable de área o ubicación')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO permissions (name, description)
VALUES
  ('software:biomedico:access', 'Acceder al software de mantenimiento biomédico'),
  ('hb:view', 'Ver hoja de vida'),
  ('maintenance:request:create', 'Crear solicitud de mantenimiento'),
  ('maintenance:report:sign', 'Firmar reporte de mantenimiento'),
  ('quick_guides:view', 'Ver guías rápidas de uso')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:biomedico:access',
  'hb:view',
  'maintenance:request:create',
  'maintenance:report:sign',
  'quick_guides:view'
)
WHERE r.name = 'responsable_area'
ON CONFLICT DO NOTHING;

ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS area_responsible_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS reader_access_user_client_idx
  ON reader_access (user_id, client_id);

CREATE INDEX IF NOT EXISTS reader_access_client_area_idx
  ON reader_access (client_id, area_id)
  WHERE area_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reader_access_client_location_idx
  ON reader_access (client_id, location_id)
  WHERE location_id IS NOT NULL;
