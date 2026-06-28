INSERT INTO roles (name, description)
VALUES
  ('saas_admin', 'Administrador interno SaaS: gestiona cartera, planes, suscripciones y soporte sin acceso operativo de clientes'),
  ('saas_billing', 'Facturacion SaaS: gestiona cobros, renovaciones y estados comerciales'),
  ('saas_clients', 'Gestion de clientes SaaS: consulta y actualiza datos administrativos de clientes'),
  ('saas_support', 'Soporte SaaS: consulta clientes y restablece claves de administradores de cliente'),
  ('saas_auditor', 'Auditor SaaS: consulta cartera y auditoria administrativa sin editar')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO permissions (name, description)
VALUES
  ('saas:access', 'Acceder al panel de administracion SaaS'),
  ('saas:clients:view', 'Ver cartera y datos administrativos de clientes SaaS'),
  ('saas:clients:update', 'Editar datos administrativos, logos, software y modulos contratados de clientes'),
  ('saas:subscriptions:manage', 'Gestionar suscripciones, vencimientos, renovaciones y pagos'),
  ('saas:plans:manage', 'Crear y editar planes SaaS generales'),
  ('saas:client_admins:reset_password', 'Restablecer clave de administradores de cliente'),
  ('saas:audit:view', 'Ver auditoria administrativa de la plataforma SaaS')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'saas:access',
  'saas:clients:view',
  'saas:clients:update',
  'saas:subscriptions:manage',
  'saas:plans:manage',
  'saas:client_admins:reset_password',
  'saas:audit:view',
  'audit:client:view',
  'clients:view',
  'reports:view'
)
WHERE r.name = 'saas_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'saas:access',
  'saas:clients:view',
  'saas:subscriptions:manage',
  'clients:view'
)
WHERE r.name = 'saas_billing'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'saas:access',
  'saas:clients:view',
  'saas:clients:update',
  'clients:view'
)
WHERE r.name = 'saas_clients'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'saas:access',
  'saas:clients:view',
  'saas:client_admins:reset_password',
  'clients:view'
)
WHERE r.name = 'saas_support'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'saas:access',
  'saas:clients:view',
  'saas:audit:view',
  'audit:client:view',
  'clients:view',
  'reports:view'
)
WHERE r.name = 'saas_auditor'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name LIKE 'saas:%'
WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;
