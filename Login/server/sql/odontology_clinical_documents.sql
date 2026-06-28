CREATE TABLE IF NOT EXISTS odontology_clinical_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES odontology_patients(id) ON DELETE RESTRICT,
  clinical_record_id UUID REFERENCES odontology_clinical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES odontology_appointments(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'certificado',
  title TEXT NOT NULL,
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date DATE,
  end_date DATE,
  days INT,
  body TEXT NOT NULL,
  recommendations TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  pdf_path TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT odontology_clinical_documents_type_chk CHECK (document_type IN ('certificado', 'incapacidad', 'constancia', 'remision', 'otro')),
  CONSTRAINT odontology_clinical_documents_status_chk CHECK (status IN ('issued', 'voided')),
  CONSTRAINT odontology_clinical_documents_days_chk CHECK (days IS NULL OR days >= 0)
);

DROP TRIGGER IF EXISTS trg_odontology_clinical_documents_updated_at ON odontology_clinical_documents;
CREATE TRIGGER trg_odontology_clinical_documents_updated_at
BEFORE UPDATE ON odontology_clinical_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_odontology_clinical_documents_client_patient ON odontology_clinical_documents (client_id, patient_id, document_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_clinical_documents_client_type ON odontology_clinical_documents (client_id, document_type, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_odontology_clinical_documents_client_status ON odontology_clinical_documents (client_id, status, document_date DESC);

INSERT INTO permissions (name, description)
VALUES ('odontology:documents:manage', 'Gestionar certificados e incapacidades odontológicas')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('odontology:documents:manage')
WHERE r.name IN ('superuser', 'odontologo', 'admin_odontologia')
ON CONFLICT DO NOTHING;
