INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'clients:manage'
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
