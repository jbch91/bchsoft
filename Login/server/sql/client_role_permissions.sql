CREATE TABLE IF NOT EXISTS client_role_permission_sets (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  configured_by UUID REFERENCES users(id) ON DELETE SET NULL,
  configured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, role_id)
);

CREATE TABLE IF NOT EXISTS client_role_permissions (
  client_id UUID NOT NULL,
  role_id INT NOT NULL,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, role_id, permission_id),
  FOREIGN KEY (client_id, role_id)
    REFERENCES client_role_permission_sets(client_id, role_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_role_permissions_client_role
ON client_role_permissions (client_id, role_id);
