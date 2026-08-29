ALTER TABLE report_signatures
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_invima_registration TEXT,
  ADD COLUMN IF NOT EXISTS signature_sha256 VARCHAR(64);

UPDATE report_signatures signature
SET signer_name = COALESCE(
      NULLIF(BTRIM(signature.signer_name), ''),
      NULLIF(BTRIM(account.display_name), ''),
      NULLIF(BTRIM(account.username), ''),
      'FIRMANTE REGISTRADO'
    ),
    signer_invima_registration = COALESCE(
      NULLIF(BTRIM(signature.signer_invima_registration), ''),
      NULLIF(BTRIM(account.invima_registration), '')
    )
FROM users account
WHERE account.id = signature.user_id;

UPDATE report_signatures
SET signer_name = 'FIRMANTE REGISTRADO'
WHERE signer_name IS NULL OR BTRIM(signer_name) = '';

ALTER TABLE report_signatures
  ALTER COLUMN signer_name SET NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE report_signatures
  DROP CONSTRAINT IF EXISTS report_signatures_user_id_fkey;

ALTER TABLE report_signatures
  ADD CONSTRAINT report_signatures_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE maintenance_reports
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE maintenance_reports
  DROP CONSTRAINT IF EXISTS maintenance_reports_created_by_fkey;

ALTER TABLE maintenance_reports
  ADD CONSTRAINT maintenance_reports_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE maintenance_requests
  ALTER COLUMN requested_by DROP NOT NULL;

ALTER TABLE maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_requested_by_fkey;

ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN report_signatures.signature_path IS
  'Ruta de la copia inmutable de la firma utilizada al firmar el reporte.';

COMMENT ON COLUMN report_signatures.signer_name IS
  'Nombre del firmante conservado tal como estaba al momento de la firma.';

COMMENT ON COLUMN report_signatures.signature_sha256 IS
  'Huella SHA-256 de la imagen de firma conservada para verificar su integridad.';
