INSERT INTO roles (name, description)
VALUES
  ('almacenista', 'Gestión de inventario y mantenimiento'),
  ('ingeniero_biomedico', 'Mantenimiento biomédico'),
  ('calibracion', 'Calibraciones y reportes'),
  ('lector', 'Solo lectura')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description)
VALUES
  ('hb:create', 'Crear hoja de vida'),
  ('hb:view', 'Ver hoja de vida'),
  ('schedules:manage', 'Gestionar cronogramas'),
  ('calibration:schedule:manage', 'Gestionar cronograma de calibraciones'),
  ('maintenance:request:create', 'Crear solicitud de mantenimiento'),
  ('maintenance:report:create', 'Crear reporte de mantenimiento'),
  ('maintenance:report:sign', 'Firmar reporte de mantenimiento'),
  ('inventory:move', 'Movimientos de inventario'),
  ('inventory:request', 'Solicitud de inventario'),
  ('maintenance:order:create', 'Crear orden de mantenimiento'),
  ('maintenance:order:close', 'Cerrar orden de mantenimiento'),
  ('service:order:create', 'Crear orden de servicio'),
  ('spareparts:order:create', 'Orden de repuestos al almacenista'),
  ('calibration:report:upload', 'Subir reporte de calibración'),
  ('read:all', 'Lectura general')
ON CONFLICT (name) DO NOTHING;

-- almacenista
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'hb:view','inventory:move','maintenance:order:create','maintenance:order:close','maintenance:request:create','maintenance:report:sign','calibration:schedule:manage'
)
WHERE r.name = 'almacenista'
ON CONFLICT DO NOTHING;

-- ingeniero biomédico
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'hb:create','hb:view','inventory:request','service:order:create','maintenance:report:create','spareparts:order:create','schedules:manage','calibration:schedule:manage'
)
WHERE r.name = 'ingeniero_biomedico'
ON CONFLICT DO NOTHING;

-- calibración
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('calibration:report:upload')
WHERE r.name = 'calibracion'
ON CONFLICT DO NOTHING;

-- lector
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('hb:view','read:all','maintenance:request:create','maintenance:report:sign')
WHERE r.name = 'lector'
ON CONFLICT DO NOTHING;
