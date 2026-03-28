INSERT INTO permissions (name, description)
VALUES
  ('areas:manage', 'Gestionar áreas y ubicaciones')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'areas:manage'
WHERE r.name IN ('admin','superuser')
ON CONFLICT DO NOTHING;
