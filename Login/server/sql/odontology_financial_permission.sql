INSERT INTO permissions (name, description)
VALUES ('odontology:financial:view', 'Ver valores económicos odontológicos')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'odontology:financial:view'
WHERE r.name IN ('superuser', 'admin_odontologia', 'recepcion_odontologia')
ON CONFLICT DO NOTHING;
