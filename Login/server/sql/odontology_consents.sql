CREATE TABLE IF NOT EXISTS odontology_consent_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  procedure_type_id UUID REFERENCES odontology_procedure_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_consent_templates_version_chk CHECK (version > 0)
);

DROP TRIGGER IF EXISTS trg_odontology_consent_templates_updated_at ON odontology_consent_templates;
CREATE TRIGGER trg_odontology_consent_templates_updated_at
BEFORE UPDATE ON odontology_consent_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_consent_templates_client ON odontology_consent_templates (client_id, is_active, title);

CREATE TABLE IF NOT EXISTS odontology_patient_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  template_id UUID REFERENCES odontology_consent_templates(id) ON DELETE SET NULL,
  procedure_type_id UUID REFERENCES odontology_procedure_types(id) ON DELETE SET NULL,
  template_title TEXT NOT NULL,
  template_version INT NOT NULL DEFAULT 1,
  rendered_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  signer_name TEXT,
  signer_document_type TEXT,
  signer_document_number TEXT,
  signer_relationship TEXT,
  signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  pdf_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_patient_consents_status_chk CHECK (status IN ('draft', 'signed')),
  CONSTRAINT odontology_patient_consents_signed_chk CHECK (
    (status = 'draft' AND signed_at IS NULL) OR
    (status = 'signed' AND signed_at IS NOT NULL AND signed_by IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS trg_odontology_patient_consents_updated_at ON odontology_patient_consents;
CREATE TRIGGER trg_odontology_patient_consents_updated_at
BEFORE UPDATE ON odontology_patient_consents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_patient_consents_client_patient ON odontology_patient_consents (client_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_patient_consents_client_status ON odontology_patient_consents (client_id, status);

INSERT INTO odontology_consent_templates (client_id, title, body, version, is_active)
SELECT c.id,
       'Consentimiento informado odontológico general',
       'Yo, {{signer_name}}, identificado(a) con documento {{signer_document}}, autorizo la atención odontológica del paciente {{patient_name}} identificado con documento {{patient_document}}. Declaro que he recibido información clara sobre el procedimiento {{procedure_name}}, sus beneficios, riesgos, alternativas y posibles complicaciones. Entiendo que puedo realizar preguntas y que debo informar antecedentes, medicamentos, alergias o condiciones relevantes. Autorizo el registro clínico y el manejo de la información conforme a la política de tratamiento de datos del prestador.',
       1,
       TRUE
FROM clients c
WHERE NOT EXISTS (
  SELECT 1
  FROM odontology_consent_templates oct
  WHERE oct.client_id = c.id
    AND oct.title = 'Consentimiento informado odontológico general'
);
