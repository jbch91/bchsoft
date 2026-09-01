ALTER TABLE maintenance_schedule_items
  ADD COLUMN IF NOT EXISTS late_execution_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_execution_authorized_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_execution_authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS late_execution_temporary_permission_id UUID
    REFERENCES user_temporary_permissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS late_execution_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_items_late_execution
  ON maintenance_schedule_items (late_execution_authorized_until)
  WHERE late_execution_authorized_until IS NOT NULL;

INSERT INTO permissions (name, description)
VALUES (
  'maintenance:preventive:late_execution',
  'Abrir temporalmente preventivos vencidos del mes anterior'
)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission
  ON permission.name = 'maintenance:preventive:late_execution'
WHERE role.name = 'superuser'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions role_permission
USING roles role, permissions permission
WHERE role_permission.role_id = role.id
  AND role_permission.permission_id = permission.id
  AND permission.name = 'maintenance:preventive:late_execution'
  AND role.name <> 'superuser';
