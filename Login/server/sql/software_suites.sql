CREATE TABLE IF NOT EXISTS software_suites (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_software_suites_updated_at ON software_suites;
CREATE TRIGGER trg_software_suites_updated_at
BEFORE UPDATE ON software_suites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO software_suites (key, name, description, display_order, is_active)
VALUES
  ('biomedico', 'Mantenimiento biomédico', 'Gestión integral de equipos biomédicos, hojas de vida, inventario, mantenimiento, calibraciones y cronogramas.', 1, TRUE),
  ('odontologico', 'Odontológico', 'Gestión odontológica profesional para pacientes, historias clínicas, agenda, tratamientos y documentos clínicos.', 2, TRUE),
  ('laboratorio', 'Laboratorio clínico', 'Gestión de órdenes, muestras, resultados, reportes, trazabilidad y documentos de laboratorio.', 3, TRUE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = TRUE;

ALTER TABLE modules ADD COLUMN IF NOT EXISTS suite_key TEXT;

UPDATE modules
SET suite_key = 'biomedico'
WHERE suite_key IS NULL;

UPDATE modules
SET suite_key = 'biomedico'
WHERE key IN (
  'clientes',
  'usuarios',
  'auditoria',
  'hojas_de_vida',
  'inventario',
  'reportes_mantenimiento',
  'cronogramas',
  'calibraciones',
  'guias_rapidas'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'modules_suite_key_fk'
  ) THEN
    ALTER TABLE modules
      ADD CONSTRAINT modules_suite_key_fk
      FOREIGN KEY (suite_key) REFERENCES software_suites(key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS client_software_access (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  suite_key TEXT NOT NULL REFERENCES software_suites(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  license_status TEXT NOT NULL DEFAULT 'active',
  plan_name TEXT,
  starts_at DATE,
  expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, suite_key),
  CONSTRAINT client_software_access_status_chk CHECK (license_status IN ('trial', 'active', 'suspended', 'expired'))
);

DROP TRIGGER IF EXISTS trg_client_software_access_updated_at ON client_software_access;
CREATE TRIGGER trg_client_software_access_updated_at
BEFORE UPDATE ON client_software_access
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO client_software_access (client_id, suite_key, enabled, license_status)
SELECT id, 'biomedico', TRUE, 'active'
FROM clients
ON CONFLICT (client_id, suite_key) DO NOTHING;

INSERT INTO client_software_access (client_id, suite_key, enabled, license_status)
SELECT c.id, s.key, FALSE, 'trial'
FROM clients c
JOIN software_suites s ON s.key IN ('odontologico', 'laboratorio')
ON CONFLICT (client_id, suite_key) DO NOTHING;

-- If quick guides was the only explicit module row, restore the expected default
-- so older clients do not get locked into a single module.
WITH clients_only_quick_guides AS (
  SELECT c.id AS client_id
  FROM clients c
  JOIN client_modules cm ON cm.client_id = c.id
  GROUP BY c.id
  HAVING COUNT(*) = 1
     AND BOOL_AND(cm.module_key = 'guias_rapidas')
)
INSERT INTO client_modules (client_id, module_key, enabled)
SELECT cqg.client_id, m.key, TRUE
FROM clients_only_quick_guides cqg
JOIN modules m ON m.is_active = TRUE
ON CONFLICT (client_id, module_key) DO NOTHING;

INSERT INTO roles (name, description)
VALUES
  ('odontologo', 'Profesional odontológico'),
  ('auxiliar_odontologia', 'Auxiliar de odontología'),
  ('bacteriologo', 'Profesional de laboratorio clínico'),
  ('auxiliar_laboratorio', 'Auxiliar de laboratorio clínico')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO permissions (name, description)
VALUES
  ('software:biomedico:access', 'Acceder al software de mantenimiento biomédico'),
  ('software:odontologico:access', 'Acceder al software odontológico'),
  ('software:laboratorio:access', 'Acceder al software de laboratorio clínico'),
  ('odontology:patients:manage', 'Gestionar pacientes odontológicos'),
  ('odontology:clinical_records:manage', 'Gestionar historias clínicas odontológicas'),
  ('laboratory:orders:manage', 'Gestionar órdenes de laboratorio'),
  ('laboratory:results:manage', 'Gestionar resultados de laboratorio')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'software:biomedico:access'
WHERE r.name IN ('superuser', 'almacenista', 'ingeniero_biomedico', 'lector', 'viewer', 'calibracion')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('software:odontologico:access', 'odontology:patients:manage', 'odontology:clinical_records:manage')
WHERE r.name IN ('superuser', 'odontologo')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('software:odontologico:access')
WHERE r.name IN ('auxiliar_odontologia')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('software:laboratorio:access', 'laboratory:orders:manage', 'laboratory:results:manage')
WHERE r.name IN ('superuser', 'bacteriologo')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('software:laboratorio:access')
WHERE r.name IN ('auxiliar_laboratorio')
ON CONFLICT DO NOTHING;
