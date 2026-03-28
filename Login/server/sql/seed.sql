INSERT INTO roles (name, description)
VALUES
  ('superuser', 'Acceso total'),
  ('admin', 'Administra clientes existentes'),
  ('viewer', 'Solo lectura')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description)
VALUES
  ('clients:create', 'Crear clientes'),
  ('clients:manage', 'Administrar clientes'),
  ('clients:view', 'Ver clientes'),
  ('reports:view', 'Ver reportes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('clients:create','clients:manage','clients:view','reports:view')
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('clients:manage','clients:view','reports:view')
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('clients:view','reports:view')
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;
