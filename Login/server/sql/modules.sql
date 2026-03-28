CREATE TABLE IF NOT EXISTS modules (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS client_modules (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (client_id, module_key)
);

INSERT INTO modules (key, name, description)
VALUES
  ('clientes', 'Clientes', 'Gestión de clientes'),
  ('usuarios', 'Usuarios', 'Gestión de usuarios'),
  ('auditoria', 'Auditoría', 'Historial de cambios'),
  ('hojas_de_vida', 'Hojas de vida', 'Equipos biomédicos'),
  ('inventario', 'Inventario', 'Listado de equipos'),
  ('reportes_mantenimiento', 'Reportes de mantenimiento', 'Correctivos y preventivos'),
  ('cronogramas', 'Cronogramas y Capacitaciones', 'Cronogramas anuales'),
  ('calibraciones', 'Calibraciones', 'Cronograma y certificados de calibración')
ON CONFLICT (key) DO NOTHING;
