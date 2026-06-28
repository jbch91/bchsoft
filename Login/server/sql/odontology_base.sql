CREATE TABLE IF NOT EXISTS odontology_settings (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  allow_all_patients_for_dentists BOOLEAN NOT NULL DEFAULT TRUE,
  assistant_can_prefill_clinical BOOLEAN NOT NULL DEFAULT TRUE,
  require_diagnosis_before_sign BOOLEAN NOT NULL DEFAULT TRUE,
  require_plan_before_sign BOOLEAN NOT NULL DEFAULT TRUE,
  require_treatment_plan_signature BOOLEAN NOT NULL DEFAULT TRUE,
  require_authorization_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  auto_generate_visit_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  block_biomed_units_out_of_service BOOLEAN NOT NULL DEFAULT TRUE,
  enable_teleconsultation BOOLEAN NOT NULL DEFAULT FALSE,
  enable_patient_portal BOOLEAN NOT NULL DEFAULT FALSE,
  enable_clinical_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  enable_admin_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  enable_purchase_orders BOOLEAN NOT NULL DEFAULT FALSE,
  required_patient_fields JSONB NOT NULL DEFAULT '["documentType","documentNumber","fullName","birthDate","sex","phone","email","address","emergencyContactName","emergencyContactPhone"]'::jsonb,
  default_landing_page TEXT NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_settings_landing_chk CHECK (default_landing_page IN ('dashboard', 'agenda', 'pacientes', 'reportes'))
);

DROP TRIGGER IF EXISTS trg_odontology_settings_updated_at ON odontology_settings;
CREATE TRIGGER trg_odontology_settings_updated_at
BEFORE UPDATE ON odontology_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_sites_client_name_uniq UNIQUE (client_id, name)
);

DROP TRIGGER IF EXISTS trg_odontology_sites_updated_at ON odontology_sites;
CREATE TRIGGER trg_odontology_sites_updated_at
BEFORE UPDATE ON odontology_sites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_chairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id UUID REFERENCES odontology_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  linked_asset_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_chairs_client_site_name_uniq UNIQUE (client_id, site_id, name)
);

DROP TRIGGER IF EXISTS trg_odontology_chairs_updated_at ON odontology_chairs;
CREATE TRIGGER trg_odontology_chairs_updated_at
BEFORE UPDATE ON odontology_chairs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_procedure_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT,
  default_duration_minutes INT NOT NULL DEFAULT 30,
  default_price NUMERIC(12,2),
  color TEXT,
  requires_consent BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_procedure_duration_chk CHECK (default_duration_minutes > 0)
);

DROP TRIGGER IF EXISTS trg_odontology_procedure_types_updated_at ON odontology_procedure_types;
CREATE TRIGGER trg_odontology_procedure_types_updated_at
BEFORE UPDATE ON odontology_procedure_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS odontology_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  catalog_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_catalog_type_chk CHECK (catalog_type IN (
    'patient_status',
    'appointment_status',
    'tooth_condition',
    'photo_category',
    'allergy',
    'medical_condition',
    'medication',
    'task_type'
  ))
);

DROP TRIGGER IF EXISTS trg_odontology_catalog_items_updated_at ON odontology_catalog_items;
CREATE TRIGGER trg_odontology_catalog_items_updated_at
BEFORE UPDATE ON odontology_catalog_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO modules (key, name, description, suite_key, is_active)
VALUES
  ('odontologia', 'Odontología', 'Agenda, pacientes, historia clínica, odontograma y consentimientos', 'odontologico', TRUE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  suite_key = EXCLUDED.suite_key,
  is_active = TRUE;

DELETE FROM client_modules cm
WHERE cm.module_key = 'odontologia'
  AND NOT EXISTS (
    SELECT 1
    FROM client_software_access csa
    WHERE csa.client_id = cm.client_id
      AND csa.suite_key = 'odontologico'
      AND csa.enabled = TRUE
  );

INSERT INTO client_modules (client_id, module_key, enabled)
SELECT csa.client_id, 'odontologia', TRUE
FROM client_software_access csa
WHERE csa.suite_key = 'odontologico'
  AND csa.enabled = TRUE
ON CONFLICT (client_id, module_key) DO UPDATE SET enabled = TRUE;

INSERT INTO odontology_settings (client_id)
SELECT id FROM clients
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO odontology_procedure_types (client_id, name, code, category, default_duration_minutes, default_price, color, requires_consent, is_system)
VALUES
  (NULL, 'Valoración odontológica', 'VAL-ODO', 'Consulta', 30, NULL, '#a64045', FALSE, TRUE),
  (NULL, 'Profilaxis', 'PROF', 'Prevención', 45, NULL, '#0f766e', FALSE, TRUE),
  (NULL, 'Operatoria / Restauración', 'REST', 'Restauración', 60, NULL, '#2563eb', FALSE, TRUE),
  (NULL, 'Exodoncia simple', 'EXO-S', 'Cirugía', 60, NULL, '#dc2626', TRUE, TRUE),
  (NULL, 'Endodoncia', 'ENDO', 'Endodoncia', 90, NULL, '#7c3aed', TRUE, TRUE),
  (NULL, 'Control', 'CTRL', 'Seguimiento', 20, NULL, '#64748b', FALSE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO odontology_catalog_items (client_id, catalog_type, name, description, color, is_system)
VALUES
  (NULL, 'patient_status', 'Activo', 'Paciente activo', '#16a34a', TRUE),
  (NULL, 'patient_status', 'Inactivo', 'Paciente inactivo', '#64748b', TRUE),
  (NULL, 'patient_status', 'Archivado', 'Paciente archivado', '#6b7280', TRUE),
  (NULL, 'patient_status', 'Fallecido', 'Paciente fallecido', '#111827', TRUE),
  (NULL, 'patient_status', 'Bloqueado administrativo', 'Paciente con restricción administrativa', '#dc2626', TRUE),
  (NULL, 'appointment_status', 'Programada', 'Cita programada', '#2563eb', TRUE),
  (NULL, 'appointment_status', 'Confirmada', 'Cita confirmada', '#16a34a', TRUE),
  (NULL, 'appointment_status', 'En sala / llegada', 'Paciente en sala', '#f59e0b', TRUE),
  (NULL, 'appointment_status', 'En atención', 'Paciente en atención', '#7c3aed', TRUE),
  (NULL, 'appointment_status', 'Atendida', 'Cita atendida', '#0f766e', TRUE),
  (NULL, 'appointment_status', 'Cancelada', 'Cita cancelada', '#dc2626', TRUE),
  (NULL, 'appointment_status', 'No asistió', 'Paciente no asistió', '#991b1b', TRUE),
  (NULL, 'appointment_status', 'Reprogramada', 'Cita reprogramada', '#0891b2', TRUE),
  (NULL, 'tooth_condition', 'Sano', 'Diente sano', '#16a34a', TRUE),
  (NULL, 'tooth_condition', 'Caries', 'Lesión cariosa', '#dc2626', TRUE),
  (NULL, 'tooth_condition', 'Restauración', 'Restauración existente o realizada', '#2563eb', TRUE),
  (NULL, 'tooth_condition', 'Ausente', 'Diente ausente', '#111827', TRUE),
  (NULL, 'tooth_condition', 'Extracción indicada', 'Extracción indicada', '#f97316', TRUE),
  (NULL, 'tooth_condition', 'Endodoncia', 'Tratamiento endodóntico', '#7c3aed', TRUE),
  (NULL, 'tooth_condition', 'Corona', 'Corona', '#ca8a04', TRUE),
  (NULL, 'tooth_condition', 'Implante', 'Implante', '#0f766e', TRUE),
  (NULL, 'tooth_condition', 'Fractura', 'Fractura dental', '#be123c', TRUE),
  (NULL, 'tooth_condition', 'Sellante', 'Sellante', '#0891b2', TRUE),
  (NULL, 'tooth_condition', 'Prótesis', 'Prótesis', '#9333ea', TRUE),
  (NULL, 'tooth_condition', 'Movilidad', 'Movilidad dental', '#ea580c', TRUE),
  (NULL, 'tooth_condition', 'Dolor', 'Dolor referido', '#e11d48', TRUE),
  (NULL, 'tooth_condition', 'Observación', 'Observación clínica', '#64748b', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO roles (name, description)
VALUES
  ('recepcion_odontologia', 'Recepción y admisiones odontológicas'),
  ('admin_odontologia', 'Administrador odontológico'),
  ('auditor_odontologia', 'Auditor clínico odontológico')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO permissions (name, description)
VALUES
  ('odontology:access', 'Acceder al módulo odontológico'),
  ('odontology:settings:manage', 'Gestionar configuración odontológica'),
  ('odontology:patients:import', 'Importar pacientes odontológicos'),
  ('odontology:appointments:manage', 'Gestionar agenda odontológica'),
  ('odontology:odontogram:manage', 'Gestionar odontograma'),
  ('odontology:periodontogram:manage', 'Gestionar periodontograma odontológico'),
  ('odontology:consents:manage', 'Gestionar consentimientos odontológicos'),
  ('odontology:attachments:manage', 'Gestionar adjuntos odontológicos'),
  ('odontology:inventory:manage', 'Gestionar inventario odontológico'),
  ('odontology:sterilization:manage', 'Gestionar esterilización odontológica'),
  ('odontology:treatment_plans:manage', 'Gestionar planes de tratamiento'),
  ('odontology:payments:manage', 'Gestionar pagos odontológicos'),
  ('odontology:financial:view', 'Ver valores económicos odontológicos'),
  ('odontology:prescriptions:manage', 'Gestionar recetas odontológicas'),
  ('odontology:documents:manage', 'Gestionar certificados e incapacidades odontológicas'),
  ('odontology:reports:view', 'Ver reportes odontológicos')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:odontologico:access',
  'odontology:access',
  'odontology:patients:manage',
  'odontology:clinical_records:manage',
  'odontology:appointments:manage',
  'odontology:odontogram:manage',
  'odontology:periodontogram:manage',
  'odontology:consents:manage',
  'odontology:attachments:manage',
  'odontology:sterilization:manage',
  'odontology:treatment_plans:manage',
  'odontology:prescriptions:manage',
  'odontology:documents:manage',
  'odontology:reports:view'
)
WHERE r.name = 'odontologo'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:odontologico:access',
  'odontology:access',
  'odontology:appointments:manage',
  'odontology:attachments:manage',
  'odontology:inventory:manage',
  'odontology:sterilization:manage'
)
WHERE r.name = 'auxiliar_odontologia'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:odontologico:access',
  'odontology:access',
  'odontology:patients:manage',
  'odontology:appointments:manage',
  'odontology:payments:manage',
  'odontology:financial:view'
)
WHERE r.name = 'recepcion_odontologia'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:odontologico:access',
  'odontology:access',
  'odontology:settings:manage',
  'odontology:patients:manage',
  'odontology:patients:import',
  'odontology:appointments:manage',
  'odontology:clinical_records:manage',
  'odontology:odontogram:manage',
  'odontology:periodontogram:manage',
  'odontology:consents:manage',
  'odontology:attachments:manage',
  'odontology:inventory:manage',
  'odontology:sterilization:manage',
  'odontology:treatment_plans:manage',
  'odontology:payments:manage',
  'odontology:financial:view',
  'odontology:prescriptions:manage',
  'odontology:documents:manage',
  'odontology:reports:view'
)
WHERE r.name IN ('superuser', 'admin_odontologia')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'software:odontologico:access',
  'odontology:access',
  'odontology:reports:view'
)
WHERE r.name = 'auditor_odontologia'
ON CONFLICT DO NOTHING;
