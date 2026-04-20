import bcrypt from 'bcrypt';
import { query } from './db.js';

export async function listRoles() {
  const { rows } = await query('SELECT id, name, description FROM roles ORDER BY id');
  return rows;
}

export async function listUsers() {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.client_id,
            u.signature_path, u.document_type, u.document_number, u.invima_registration,
            c.name AS client_name,
            ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles
     FROM users u
     LEFT JOIN clients c ON c.id = u.client_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id, c.name
     ORDER BY u.created_at DESC`
  );
  return rows;
}

export async function getUserById(userId) {
  const { rows } = await query(
    `SELECT id, username, email, signature_path, document_type, document_number,
            invima_registration
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0];
}

export async function getUserByUsername(username) {
  const { rows } = await query('SELECT id, username, email FROM users WHERE username = $1', [username]);
  return rows[0];
}

export async function listPermissions() {
  const { rows } = await query('SELECT id, name, description FROM permissions ORDER BY id');
  return rows;
}

export async function listModules() {
  const { rows } = await query(
    'SELECT key, name, description, is_active FROM modules WHERE is_active = TRUE ORDER BY key'
  );
  return rows;
}

export async function listClientModules(clientId) {
  const { rows: counts } = await query(
    'SELECT COUNT(*)::int AS total FROM client_modules WHERE client_id = $1',
    [clientId]
  );
  const hasConfig = (counts[0]?.total ?? 0) > 0;

  const { rows } = await query(
    `SELECT m.key, m.name, m.description, COALESCE(cm.enabled, ${hasConfig ? 'FALSE' : 'TRUE'}) AS enabled
     FROM modules m
     LEFT JOIN client_modules cm ON cm.module_key = m.key AND cm.client_id = $1
     WHERE m.is_active = TRUE
     ORDER BY m.key`,
    [clientId]
  );
  return rows;
}

export async function updateClientModules(clientId, moduleKeys) {
  await query('DELETE FROM client_modules WHERE client_id = $1', [clientId]);
  for (const key of moduleKeys) {
    await query(
      'INSERT INTO client_modules (client_id, module_key, enabled) VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING',
      [clientId, key]
    );
  }
}

export async function getRolePermissions(roleId) {
  const { rows } = await query(
    `SELECT p.name
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  return rows.map((row) => row.name);
}

export async function updateRolePermissions(roleId, permissions) {
  await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

  const { rows: permissionRows } = await query(
    'SELECT id, name FROM permissions WHERE name = ANY($1)',
    [permissions]
  );

  for (const permission of permissionRows) {
    await query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, permission.id]
    );
  }
}

export async function createUser({
  username,
  displayName,
  email,
  password,
  role,
  clientId,
  documentType,
  documentNumber,
  invimaRegistration
}) {
  const { rows: existing } = await query(
    'SELECT username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
    [username, email]
  );
  if (existing.length) {
    return { error: 'DUPLICATE' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (
       username, display_name, email, password_hash, client_id,
       document_type, document_number, invima_registration
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      username,
      displayName,
      email,
      passwordHash,
      clientId ?? null,
      documentType ?? null,
      documentNumber ?? null,
      invimaRegistration ?? null
    ]
  );

  const userId = rows[0].id;
  const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', [role]);
  if (roleRows.length) {
    await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleRows[0].id]);
  }

  return { id: userId };
}

export async function updateUserRole(userId, roleName) {
  const before = await getUserById(userId);
  const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
  if (!roleRows.length) {
    throw new Error('Role not found');
  }

  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
    userId,
    roleRows[0].id
  ]);

  return { before };
}

export async function updateUserActive(userId, isActive) {
  const before = await getUserById(userId);
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
  return { before };
}

export async function updateUserPassword(userId, password) {
  const before = await getUserById(userId);
  const passwordHash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  return { before };
}

export async function updateUserProfile(userId, payload) {
  const { displayName, email, clientId, documentType, documentNumber, invimaRegistration } = payload;
  await query(
    `UPDATE users
     SET display_name = $1,
         email = $2,
         client_id = $3,
         document_type = $4,
         document_number = $5,
         invima_registration = $6
     WHERE id = $7`,
    [
      displayName,
      email,
      clientId ?? null,
      documentType ?? null,
      documentNumber ?? null,
      invimaRegistration ?? null,
      userId
    ]
  );
}

export async function updateUserSignature(userId, signaturePath) {
  await query('UPDATE users SET signature_path = $1 WHERE id = $2', [signaturePath, userId]);
}

export async function deleteUser(userId) {
  await query('DELETE FROM users WHERE id = $1', [userId]);
}
