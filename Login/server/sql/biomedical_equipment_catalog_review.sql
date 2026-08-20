ALTER TABLE biomedical_equipment_catalog
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE biomedical_equipment_brands
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE biomedical_equipment_models
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE biomedical_equipment_catalog
  DROP CONSTRAINT IF EXISTS biomedical_equipment_catalog_review_status_chk;
ALTER TABLE biomedical_equipment_catalog
  ADD CONSTRAINT biomedical_equipment_catalog_review_status_chk
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE biomedical_equipment_brands
  DROP CONSTRAINT IF EXISTS biomedical_equipment_brands_review_status_chk;
ALTER TABLE biomedical_equipment_brands
  ADD CONSTRAINT biomedical_equipment_brands_review_status_chk
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE biomedical_equipment_models
  DROP CONSTRAINT IF EXISTS biomedical_equipment_models_review_status_chk;
ALTER TABLE biomedical_equipment_models
  ADD CONSTRAINT biomedical_equipment_models_review_status_chk
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_biomedical_equipment_catalog_review
  ON biomedical_equipment_catalog (review_status, is_active, last_submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_biomedical_equipment_brands_review
  ON biomedical_equipment_brands (review_status, is_active, last_submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_biomedical_equipment_models_review
  ON biomedical_equipment_models (review_status, is_active, last_submitted_at DESC);

INSERT INTO permissions (name, description)
VALUES (
  'platform:biomedical_catalog:manage',
  'Administrar y aprobar el catálogo biomédico global de equipos, marcas y modelos'
)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'platform:biomedical_catalog:manage'
WHERE r.name IN ('superuser', 'saas_admin', 'admin')
ON CONFLICT DO NOTHING;
