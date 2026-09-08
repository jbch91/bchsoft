UPDATE roles
SET description = 'Consulta de hojas de vida e inventario por areas y ubicaciones, con exportacion de inventario'
WHERE name = 'lector';

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.name = 'lector'
  AND p.name NOT IN ('software:biomedico:access', 'hb:view');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'lector' AND p.name IN ('software:biomedico:access', 'hb:view')
ON CONFLICT DO NOTHING;

-- Preserve explicit client restrictions; only remove permissions outside the role.
DELETE FROM client_role_permissions crp
USING roles r, permissions p
WHERE crp.role_id = r.id AND crp.permission_id = p.id AND r.name = 'lector'
  AND p.name NOT IN ('software:biomedico:access', 'hb:view');

-- Historical signatures and signed reports must remain untouched.
