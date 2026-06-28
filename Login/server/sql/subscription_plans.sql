CREATE TABLE IF NOT EXISTS subscription_plans (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'ips_hospital',
  description TEXT,
  included_suites JSONB NOT NULL DEFAULT '[]'::jsonb,
  included_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_price NUMERIC(12,2),
  annual_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'COP',
  display_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS plan_key TEXT REFERENCES subscription_plans(key);

INSERT INTO subscription_plans (
  key, name, client_type, description, included_suites, included_modules,
  monthly_price, annual_price, currency, display_order, is_active
)
VALUES
  (
    'biomedico_ips',
    'Biomédico IPS / Hospital',
    'ips_hospital',
    'Mantenimiento biomédico para IPS, hospitales y clínicas: hojas de vida, inventario, mantenimiento, cronogramas, calibraciones y guías rápidas.',
    '["biomedico"]'::jsonb,
    '["usuarios","auditoria","hojas_de_vida","inventario","reportes_mantenimiento","cronogramas","calibraciones","guias_rapidas"]'::jsonb,
    0, 0, 'COP', 1, TRUE
  ),
  (
    'odontologico',
    'Odontológico',
    'odontologico',
    'Gestión odontológica: pacientes, agenda, historia clínica, odontograma, consentimientos, inventario, pagos y documentos.',
    '["odontologico"]'::jsonb,
    '["usuarios","auditoria","odontologia"]'::jsonb,
    0, 0, 'COP', 2, TRUE
  ),
  (
    'laboratorio',
    'Laboratorio clínico',
    'laboratorio',
    'Plan preparado para el software de laboratorio clínico: órdenes, muestras, resultados y trazabilidad.',
    '["laboratorio"]'::jsonb,
    '["usuarios","auditoria"]'::jsonb,
    0, 0, 'COP', 3, TRUE
  ),
  (
    'biomedico_odontologico',
    'Biomédico + Odontológico',
    'mixto',
    'Paquete integrado para clientes que requieren mantenimiento biomédico y operación odontológica.',
    '["biomedico","odontologico"]'::jsonb,
    '["usuarios","auditoria","hojas_de_vida","inventario","reportes_mantenimiento","cronogramas","calibraciones","guias_rapidas","odontologia"]'::jsonb,
    0, 0, 'COP', 4, TRUE
  ),
  (
    'biomedico_laboratorio',
    'Biomédico + Laboratorio',
    'mixto',
    'Paquete integrado para clientes con mantenimiento biomédico y operación de laboratorio clínico.',
    '["biomedico","laboratorio"]'::jsonb,
    '["usuarios","auditoria","hojas_de_vida","inventario","reportes_mantenimiento","cronogramas","calibraciones","guias_rapidas"]'::jsonb,
    0, 0, 'COP', 5, TRUE
  ),
  (
    'integral_clinica',
    'Integral clínica',
    'mixto',
    'Suite completa: biomédico, odontológico y laboratorio, preparada para operación clínica integral.',
    '["biomedico","odontologico","laboratorio"]'::jsonb,
    '["usuarios","auditoria","hojas_de_vida","inventario","reportes_mantenimiento","cronogramas","calibraciones","guias_rapidas","odontologia"]'::jsonb,
    0, 0, 'COP', 6, TRUE
  ),
  (
    'solo_consulta',
    'Solo consulta / auditoría',
    'consulta',
    'Plan restringido para consulta de información, auditorías o periodos de cierre comercial.',
    '["biomedico"]'::jsonb,
    '["auditoria","inventario","hojas_de_vida","guias_rapidas"]'::jsonb,
    0, 0, 'COP', 7, TRUE
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  client_type = EXCLUDED.client_type,
  description = EXCLUDED.description,
  included_suites = EXCLUDED.included_suites,
  included_modules = EXCLUDED.included_modules,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  currency = EXCLUDED.currency,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

UPDATE client_subscriptions cs
SET plan_key = CASE
  WHEN EXISTS (
    SELECT 1 FROM client_software_access csa
    WHERE csa.client_id = cs.client_id AND csa.suite_key = 'odontologico' AND csa.enabled = TRUE
  ) AND EXISTS (
    SELECT 1 FROM client_software_access csa
    WHERE csa.client_id = cs.client_id AND csa.suite_key = 'laboratorio' AND csa.enabled = TRUE
  ) THEN 'integral_clinica'
  WHEN EXISTS (
    SELECT 1 FROM client_software_access csa
    WHERE csa.client_id = cs.client_id AND csa.suite_key = 'odontologico' AND csa.enabled = TRUE
  ) THEN 'biomedico_odontologico'
  WHEN EXISTS (
    SELECT 1 FROM client_software_access csa
    WHERE csa.client_id = cs.client_id AND csa.suite_key = 'laboratorio' AND csa.enabled = TRUE
  ) THEN 'biomedico_laboratorio'
  ELSE 'biomedico_ips'
END
WHERE cs.plan_key IS NULL;
