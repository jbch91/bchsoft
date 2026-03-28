INSERT INTO permissions (name, description)
VALUES
  ('users:manage', 'Gestionar usuarios')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'users:manage'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
