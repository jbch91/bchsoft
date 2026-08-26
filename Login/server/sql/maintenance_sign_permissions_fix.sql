INSERT INTO permissions (name, description)
VALUES ('maintenance:report:sign', 'Firmar reporte de mantenimiento')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'maintenance:report:sign'
WHERE r.name IN ('almacenista', 'responsable_area', 'lector', 'viewer', 'visor', 'superuser')
ON CONFLICT DO NOTHING;
