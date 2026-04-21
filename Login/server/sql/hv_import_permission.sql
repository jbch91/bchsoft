INSERT INTO permissions (name, description)
VALUES
  ('hb:import', 'Importar hojas de vida masivamente')
ON CONFLICT (name) DO NOTHING;

-- Por seguridad queda activo solo para superuser. Desde Roles y permisos se
-- puede habilitar manualmente a otros roles cuando el cliente lo requiera.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'hb:import'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
