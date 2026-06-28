INSERT INTO permissions (name, description)
VALUES ('audit:odontology:view', 'Ver auditoría odontológica del cliente')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'audit:odontology:view'
WHERE r.name = 'auditor_odontologia'
ON CONFLICT DO NOTHING;
