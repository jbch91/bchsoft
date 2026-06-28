INSERT INTO roles (name, description)
VALUES ('client_admin', 'Administrador del cliente: gestiona usuarios y configuracion de su propia institucion')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO permissions (name, description)
VALUES
  ('audit:client:view', 'Ver auditoria administrativa del propio cliente'),
  ('platform:templates:manage', 'Gestionar plantillas globales de la plataforma')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'users:manage',
  'clients:view',
  'audit:client:view',
  'areas:manage'
)
WHERE r.name = 'client_admin'
ON CONFLICT DO NOTHING;

-- El superadmin conserva administracion de plataforma y plantillas, pero el acceso
-- operativo se limita en backend/frontend para proteger la informacion del cliente.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'platform:templates:manage'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
