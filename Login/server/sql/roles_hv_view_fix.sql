INSERT INTO permissions (name, description)
VALUES ('hb:view', 'Ver hoja de vida')
ON CONFLICT (name) DO NOTHING;

-- quitar hb:create a almacenista y lector
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.name = 'hb:create'
  AND r.name IN ('almacenista', 'lector');

-- asegurar hb:view para almacenista, ingeniero y lector
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'hb:view'
WHERE r.name IN ('almacenista', 'ingeniero_biomedico', 'lector')
ON CONFLICT DO NOTHING;
