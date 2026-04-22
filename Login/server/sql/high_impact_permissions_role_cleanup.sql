-- Estos permisos pueden cambiar muchas hojas de vida o historiales al mismo tiempo.
-- Por seguridad no deben quedar asignados a roles completos de clientes; se conceden
-- temporalmente por usuario desde el módulo Usuarios.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name <> 'superuser'
  AND p.name IN ('hb:import', 'asset_history:upload');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('hb:import', 'asset_history:upload')
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
