import bcrypt from 'bcrypt';
import { pool, query } from './db.js';

const TEMPORARY_ONLY_PERMISSIONS = ['hb:import', 'asset_history:upload'];
const PLATFORM_ONLY_MODULES = ['clientes', 'auditoria'];

export async function listRoles() {
  const { rows } = await query('SELECT id, name, description FROM roles ORDER BY id');
  return rows;
}

export async function listUsers(scope = {}) {
  const actorRoles = scope.actorRoles || [];
  const actorClientId = scope.actorClientId || null;
  const isSuperuser = actorRoles.includes('superuser');
  const isClientAdmin = actorRoles.includes('client_admin');

  const filters = [];
  const values = [];

  if (isSuperuser) {
    filters.push('u.client_id IS NULL');
  } else if (isClientAdmin && actorClientId) {
    values.push(actorClientId);
    filters.push(`u.client_id = $${values.length}`);
    filters.push(
      `NOT EXISTS (
        SELECT 1
        FROM user_roles cur
        JOIN roles cr ON cr.id = cur.role_id
        WHERE cur.user_id = u.id
          AND cr.name = 'client_admin'
      )`
    );
  } else {
    filters.push('FALSE');
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.client_id,
            u.signature_path, u.document_type, u.document_number, u.invima_registration,
            c.name AS client_name,
            ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles,
            COALESCE(
              (
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', utp.id,
                    'permission', p.name,
                    'description', p.description,
                    'expiresAt', utp.expires_at,
                    'reason', utp.reason,
                    'createdAt', utp.created_at
                  )
                  ORDER BY utp.expires_at ASC
                )
                FROM user_temporary_permissions utp
                JOIN permissions p ON p.id = utp.permission_id
                WHERE utp.user_id = u.id
                  AND utp.expires_at > NOW()
              ),
              '[]'::json
            ) AS temporary_permissions
     FROM users u
     LEFT JOIN clients c ON c.id = u.client_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     ${whereClause}
     GROUP BY u.id, c.name
     ORDER BY u.created_at DESC`,
    values
  );
  return rows;
}

export async function listClientUsers() {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.client_id,
            u.document_type, u.document_number,
            c.name AS client_name,
            c.nit AS client_nit,
            c.city AS client_city,
            ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
     FROM users u
     JOIN clients c ON c.id = u.client_id
     JOIN user_roles admin_ur ON admin_ur.user_id = u.id
     JOIN roles admin_r ON admin_r.id = admin_ur.role_id AND admin_r.name = 'client_admin'
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.client_id IS NOT NULL
     GROUP BY u.id, c.id
     ORDER BY c.name, u.display_name, u.username`
  );
  return rows;
}

export async function getUserById(userId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.client_id, u.signature_path,
            u.document_type, u.document_number, u.invima_registration,
            ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  return rows[0];
}

export async function getUserRoles(userId) {
  const { rows } = await query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return rows.map((row) => row.name);
}

export async function getUserByUsername(username) {
  const { rows } = await query('SELECT id, username, email FROM users WHERE username = $1', [username]);
  return rows[0];
}

export async function listClientAdmins(clientId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.client_id,
            u.document_type, u.document_number,
            ARRAY_REMOVE(ARRAY_AGG(r.name), NULL) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.client_id = $1
       AND r.name = 'client_admin'
     GROUP BY u.id
     ORDER BY u.display_name, u.username`,
    [clientId]
  );
  return rows;
}

export async function listPermissions() {
  const { rows } = await query('SELECT id, name, description FROM permissions ORDER BY id');
  return rows;
}

export async function listModules() {
  const { rows } = await query(
    'SELECT key, name, description, suite_key, is_active FROM modules WHERE is_active = TRUE ORDER BY suite_key, key'
  );
  return rows;
}

export async function listSoftwareSuites() {
  const { rows } = await query(
    `SELECT key, name, description, display_order, is_active
     FROM software_suites
     WHERE is_active = TRUE
     ORDER BY display_order, name`
  );
  return rows;
}

export async function listClientSoftwareAccess(clientId) {
  const { rows } = await query(
    `SELECT s.key,
            s.name,
            s.description,
            s.display_order,
            s.is_active,
            COALESCE(csa.enabled, s.key = 'biomedico') AS enabled,
            COALESCE(csa.license_status, CASE WHEN s.key = 'biomedico' THEN 'active' ELSE 'trial' END) AS license_status,
            csa.plan_name,
            csa.starts_at,
            csa.expires_at,
            csa.notes
     FROM software_suites s
     LEFT JOIN client_software_access csa ON csa.suite_key = s.key AND csa.client_id = $1
     WHERE s.is_active = TRUE
     ORDER BY s.display_order, s.name`,
    [clientId]
  );
  return rows;
}

export async function updateClientSoftwareAccess(clientId, suites) {
  const normalized = Array.isArray(suites) ? suites : [];
  const enabledKeys = new Set(
    normalized
      .filter((entry) => typeof entry === 'string' || entry?.enabled === true)
      .map((entry) => (typeof entry === 'string' ? entry : entry.key))
      .filter(Boolean)
  );

  const { rows: suiteRows } = await query(
    'SELECT key FROM software_suites WHERE is_active = TRUE ORDER BY display_order'
  );

  for (const suite of suiteRows) {
    const config = normalized.find((entry) => typeof entry !== 'string' && entry?.key === suite.key) ?? {};
    const enabled = enabledKeys.has(suite.key);
    const licenseStatus = enabled ? (config.licenseStatus || config.license_status || 'active') : (config.licenseStatus || config.license_status || 'trial');
    await query(
      `INSERT INTO client_software_access (
         client_id, suite_key, enabled, license_status, plan_name, starts_at, expires_at, notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (client_id, suite_key)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     license_status = EXCLUDED.license_status,
                     plan_name = EXCLUDED.plan_name,
                     starts_at = EXCLUDED.starts_at,
                     expires_at = EXCLUDED.expires_at,
                     notes = EXCLUDED.notes`,
      [
        clientId,
        suite.key,
        enabled,
        licenseStatus,
        config.planName || config.plan_name || null,
        config.startsAt || config.starts_at || null,
        config.expiresAt || config.expires_at || null,
        config.notes || null
      ]
    );

    if (enabled) {
      await query(
        `INSERT INTO client_modules (client_id, module_key, enabled)
         SELECT $1, m.key, TRUE
         FROM modules m
         WHERE m.suite_key = $2
           AND m.is_active = TRUE
         ON CONFLICT (client_id, module_key)
         DO UPDATE SET enabled = TRUE`,
        [clientId, suite.key]
      );
    } else {
      await query(
        `UPDATE client_modules cm
         SET enabled = FALSE
         FROM modules m
         WHERE cm.client_id = $1
           AND cm.module_key = m.key
           AND m.suite_key = $2`,
        [clientId, suite.key]
      );
    }
  }
}

export async function listClientModules(clientId) {
  const { rows: counts } = await query(
    `SELECT COUNT(*)::int AS total,
            COALESCE(BOOL_OR(module_key <> 'guias_rapidas'), FALSE) AS has_non_quick_module
     FROM client_modules
     WHERE client_id = $1`,
    [clientId]
  );
  const total = counts[0]?.total ?? 0;
  const hasNonQuickModule = Boolean(counts[0]?.has_non_quick_module);
  // If the only saved row is the auto-created quick-guides module, treat the
  // client as unconfigured so existing clients keep all modules visible.
  const hasConfig = total > 0 && (total !== 1 || hasNonQuickModule);

  const { rows } = await query(
    `SELECT m.key,
            m.name,
            m.description,
            m.suite_key,
            COALESCE(cm.enabled, ${hasConfig ? 'FALSE' : 'TRUE'})
              AND COALESCE(csa.enabled, m.suite_key = 'biomedico') AS enabled
     FROM modules m
     LEFT JOIN client_modules cm ON cm.module_key = m.key AND cm.client_id = $1
     LEFT JOIN client_software_access csa ON csa.suite_key = m.suite_key AND csa.client_id = $1
     WHERE m.is_active = TRUE
       AND m.key <> ALL($2::text[])
     ORDER BY m.suite_key, m.key`,
    [clientId, PLATFORM_ONLY_MODULES]
  );
  return rows;
}

export async function updateClientModules(clientId, moduleKeys) {
  await query('DELETE FROM client_modules WHERE client_id = $1', [clientId]);
  const { rows: allowedRows } = await query(
    `SELECT m.key
     FROM modules m
     LEFT JOIN client_software_access csa ON csa.client_id = $1 AND csa.suite_key = m.suite_key
     WHERE m.is_active = TRUE
       AND m.key <> ALL($2::text[])
       AND COALESCE(csa.enabled, m.suite_key = 'biomedico') = TRUE`,
    [clientId, PLATFORM_ONLY_MODULES]
  );
  const allowed = new Set(allowedRows.map((row) => row.key));
  for (const key of moduleKeys.filter((moduleKey) => allowed.has(moduleKey))) {
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

export async function getClientRolePermissions(clientId, roleId) {
  const { rows: setRows } = await query(
    'SELECT 1 FROM client_role_permission_sets WHERE client_id = $1 AND role_id = $2',
    [clientId, roleId]
  );
  if (!setRows.length) {
    return getRolePermissions(roleId);
  }

  const { rows } = await query(
    `SELECT p.name
     FROM permissions p
     JOIN client_role_permissions crp ON crp.permission_id = p.id
     WHERE crp.client_id = $1
       AND crp.role_id = $2
     ORDER BY p.name`,
    [clientId, roleId]
  );
  return rows.map((row) => row.name);
}

export async function updateRolePermissions(roleId, permissions) {
  const { rows: roleRows } = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
  const roleName = roleRows[0]?.name;
  const allowedPermissions = roleName === 'superuser'
    ? permissions
    : permissions.filter((permission) => !TEMPORARY_ONLY_PERMISSIONS.includes(permission));

  await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

  const { rows: permissionRows } = await query(
    'SELECT id, name FROM permissions WHERE name = ANY($1)',
    [allowedPermissions]
  );

  for (const permission of permissionRows) {
    await query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, permission.id]
    );
  }
}

export async function updateClientRolePermissions({ clientId, roleId, permissions, actorUserId }) {
  const allowedPermissions = Array.from(new Set(permissions || []))
    .filter((permission) => !TEMPORARY_ONLY_PERMISSIONS.includes(permission));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO client_role_permission_sets (client_id, role_id, configured_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id, role_id)
       DO UPDATE SET configured_by = EXCLUDED.configured_by,
                     updated_at = NOW()`,
      [clientId, roleId, actorUserId || null]
    );
    await client.query(
      'DELETE FROM client_role_permissions WHERE client_id = $1 AND role_id = $2',
      [clientId, roleId]
    );

    if (allowedPermissions.length) {
      const { rows: permissionRows } = await client.query(
        'SELECT id, name FROM permissions WHERE name = ANY($1)',
        [allowedPermissions]
      );
      for (const permission of permissionRows) {
        await client.query(
          `INSERT INTO client_role_permissions (client_id, role_id, permission_id, granted_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [clientId, roleId, permission.id, actorUserId || null]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function grantTemporaryPermission({
  userId,
  permission,
  expiresAt,
  grantedBy,
  reason
}) {
  const { rows: userRows } = await query('SELECT id, username FROM users WHERE id = $1', [userId]);
  if (!userRows.length) {
    return { error: 'USER_NOT_FOUND' };
  }

  const { rows: permissionRows } = await query(
    'SELECT id, name, description FROM permissions WHERE name = $1',
    [permission]
  );
  if (!permissionRows.length) {
    return { error: 'PERMISSION_NOT_FOUND' };
  }

  const cleanReason = String(reason || '').trim() || null;
  const { rows } = await query(
    `INSERT INTO user_temporary_permissions (
       user_id, permission_id, expires_at, granted_by, reason
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, permission_id)
     DO UPDATE SET
       expires_at = EXCLUDED.expires_at,
       granted_by = EXCLUDED.granted_by,
       reason = EXCLUDED.reason
     RETURNING id, expires_at, reason, created_at`,
    [userId, permissionRows[0].id, expiresAt, grantedBy ?? null, cleanReason]
  );

  return {
    id: rows[0].id,
    permission: permissionRows[0].name,
    description: permissionRows[0].description,
    expiresAt: rows[0].expires_at,
    reason: rows[0].reason,
    createdAt: rows[0].created_at,
    username: userRows[0].username
  };
}

export async function revokeTemporaryPermission({ userId, permission }) {
  const { rows } = await query(
    `DELETE FROM user_temporary_permissions utp
     USING permissions p, users u
     WHERE utp.permission_id = p.id
       AND utp.user_id = u.id
       AND utp.user_id = $1
       AND p.name = $2
     RETURNING utp.id, p.name AS permission, u.username`,
    [userId, permission]
  );

  return rows[0] ?? null;
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
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanEmail = String(email).trim().toLowerCase();
    const fields = new Set();
    for (const row of existing) {
      if (String(row.username || '').trim().toLowerCase() === cleanUsername) fields.add('username');
      if (String(row.email || '').trim().toLowerCase() === cleanEmail) fields.add('email');
    }
    return { error: 'DUPLICATE', fields: Array.from(fields) };
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
  if (roleName !== 'ingeniero_biomedico') {
    await query(
      `DELETE FROM user_temporary_permissions utp
       USING permissions p
       WHERE utp.permission_id = p.id
         AND utp.user_id = $1
         AND p.name = ANY($2)`,
      [userId, TEMPORARY_ONLY_PERMISSIONS]
    );
  }

  return { before };
}

export async function updateUserActive(userId, isActive) {
  const before = await getUserById(userId);
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
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
