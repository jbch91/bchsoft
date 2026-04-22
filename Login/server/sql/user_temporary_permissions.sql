CREATE TABLE IF NOT EXISTS user_temporary_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_temporary_permissions_active
ON user_temporary_permissions (user_id, expires_at);

INSERT INTO permissions (name, description)
VALUES
  ('asset_history:upload', 'Migrar PDFs históricos al historial de equipos')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'asset_history:upload'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
