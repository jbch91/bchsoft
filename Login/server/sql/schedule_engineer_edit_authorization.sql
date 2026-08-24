ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS engineer_edit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS engineer_edit_enabled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engineer_edit_enabled_at TIMESTAMPTZ;

INSERT INTO permissions (name, description)
VALUES (
  'schedules:unlock_approved',
  'Habilitar una edición controlada de cronogramas de mantenimiento aprobados'
)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

DELETE FROM role_permissions role_permission
USING roles role, permissions permission
WHERE role_permission.role_id = role.id
  AND role_permission.permission_id = permission.id
  AND permission.name = 'schedules:unlock_approved'
  AND role.name <> 'client_admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'schedules:unlock_approved'
WHERE role.name = 'client_admin'
ON CONFLICT DO NOTHING;
