WITH desired_modules (key, name, description) AS (
  VALUES
    ('clientes', 'Clientes', 'Gestión de clientes'),
    ('usuarios', 'Usuarios', 'Gestión de usuarios'),
    ('auditoria', 'Auditoría', 'Historial de cambios'),
    ('hojas_de_vida', 'Hojas de vida', 'Equipos biomédicos'),
    ('inventario', 'Inventario', 'Listado de equipos'),
    ('reportes_mantenimiento', 'Reportes de mantenimiento', 'Correctivos y preventivos'),
    ('cronogramas', 'Cronogramas y Capacitaciones', 'Cronogramas anuales'),
    ('calibraciones', 'Calibraciones', 'Cronograma y certificados de calibración')
)
INSERT INTO modules (key, name, description, is_active)
SELECT key, name, description, TRUE
FROM desired_modules
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = TRUE;

DELETE FROM client_modules
WHERE module_key NOT IN (
  'clientes',
  'usuarios',
  'auditoria',
  'hojas_de_vida',
  'inventario',
  'reportes_mantenimiento',
  'cronogramas',
  'calibraciones'
);

DELETE FROM modules
WHERE key NOT IN (
  'clientes',
  'usuarios',
  'auditoria',
  'hojas_de_vida',
  'inventario',
  'reportes_mantenimiento',
  'cronogramas',
  'calibraciones'
);
