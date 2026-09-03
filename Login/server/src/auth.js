import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { pool, query } from './db.js';
import { listClientModules } from './admin.js';
import { getClientSubscriptionAccess } from './subscriptions.js';
import { allowedClientPermissionsForModules } from './permission-policy.js';
import {
  describeSessionDevice,
  normalizeMaxActiveSessions,
  normalizeSessionContext
} from './session-policy.js';

dotenv.config();

const tokenTtl = process.env.TOKEN_TTL || '15m';
const refreshTtl = process.env.REFRESH_TTL || '7d';
const maxActiveSessions = normalizeMaxActiveSessions(process.env.MAX_ACTIVE_SESSIONS);
const CLIENT_CONFIGURABLE_ROLES = [
  'almacenista',
  'ingeniero_biomedico',
  'calibracion',
  'responsable_area',
  'lector',
  'odontologo',
  'auxiliar_odontologia',
  'recepcion_odontologia',
  'admin_odontologia',
  'auditor_odontologia',
  'bacteriologo',
  'auxiliar_laboratorio'
];

function calculateExpiry(ttl) {
  const value = ttl.trim().toLowerCase();
  if (value.endsWith('d')) {
    const days = Number(value.replace('d', ''));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  if (value.endsWith('h')) {
    const hours = Number(value.replace('h', ''));
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  if (value.endsWith('m')) {
    const minutes = Number(value.replace('m', ''));
    return new Date(Date.now() + minutes * 60 * 1000);
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function createSessionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function storeRefreshToken(
  userId,
  refreshToken,
  sessionId,
  sessionContext = {},
  sessionStartedAt = new Date(),
  db = { query }
) {
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = calculateExpiry(refreshTtl);
  const context = normalizeSessionContext(sessionContext);
  await db.query(
    `INSERT INTO refresh_tokens (
       user_id, session_id, token_hash, session_started_at, last_seen_at,
       user_agent, ip_address, expires_at
     )
     VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)`,
    [
      userId,
      sessionId,
      tokenHash,
      sessionStartedAt,
      context.userAgent,
      context.ipAddress,
      expiresAt
    ]
  );
}

async function enforceSessionLimit(userId, currentSessionId, db = { query }) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND replaced_at IS NULL
       AND expires_at <= NOW()`,
    [userId]
  );

  const { rows } = await db.query(
    `SELECT session_id
     FROM refresh_tokens
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND replaced_at IS NULL
       AND expires_at > NOW()
     GROUP BY session_id
     ORDER BY
       CASE WHEN session_id = $2 THEN 0 ELSE 1 END,
       MAX(last_seen_at) DESC,
       MAX(created_at) DESC
     OFFSET $3`,
    [userId, currentSessionId, maxActiveSessions]
  );

  const sessionIds = rows.map((row) => row.session_id);
  if (!sessionIds.length) return;

  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND session_id = ANY($2::uuid[])
       AND revoked_at IS NULL`,
    [userId, sessionIds]
  );
}

export async function revokeUserActiveSessions(userId, db = { query }) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

export async function revokeRoleActiveSessions(roleId, clientId = null, db = { query }) {
  await db.query(
    `UPDATE refresh_tokens rt
     SET revoked_at = NOW()
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     WHERE rt.user_id = u.id
       AND ur.role_id = $1
       AND ($2::uuid IS NULL OR u.client_id = $2::uuid)
       AND rt.revoked_at IS NULL`,
    [roleId, clientId || null]
  );
}

export async function revokeClientActiveSessions(clientId, db = { query }) {
  await db.query(
    `UPDATE refresh_tokens rt
     SET revoked_at = NOW()
     FROM users u
     WHERE rt.user_id = u.id
       AND u.client_id = $1
       AND rt.revoked_at IS NULL`,
    [clientId]
  );
}

async function loadUserRoles(userId) {
  const roleRows = await query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return roleRows.rows.map((row) => row.name);
}

async function loadUserPermissions(userId, clientId, roles = []) {
  const permRows = await query(
    `SELECT DISTINCT name
     FROM (
       SELECT p.name
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND NOT (
           $2::uuid IS NOT NULL
           AND r.name = ANY($3::text[])
           AND EXISTS (
             SELECT 1
             FROM client_role_permission_sets crps
             WHERE crps.client_id = $2::uuid
               AND crps.role_id = ur.role_id
           )
         )

       UNION

       SELECT p.name
       FROM permissions p
       JOIN client_role_permissions crp ON crp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = crp.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND $2::uuid IS NOT NULL
         AND crp.client_id = $2::uuid
         AND r.name = ANY($3::text[])

       UNION

       SELECT p.name
       FROM permissions p
       JOIN user_temporary_permissions utp ON utp.permission_id = p.id
       JOIN users tu ON tu.id = utp.user_id
       JOIN user_roles tur ON tur.user_id = tu.id
       JOIN roles tr ON tr.id = tur.role_id
       WHERE utp.user_id = $1
         AND utp.expires_at > NOW()
         AND tu.client_id IS NOT NULL
         AND tr.name = 'ingeniero_biomedico'
     ) active_permissions
     ORDER BY name`,
    [userId, clientId || null, CLIENT_CONFIGURABLE_ROLES]
  );
  const permissions = permRows.rows.map((row) => row.name);
  if (!clientId || roles.includes('client_admin')) {
    return permissions;
  }
  const modules = await listClientModules(clientId);
  const allowed = allowedClientPermissionsForModules(modules);
  return permissions.filter((permission) => allowed.has(permission));
}

export async function getCurrentSessionUser(userId) {
  const { rows: userRows } = await query(
    `SELECT id, username, display_name, is_active, client_id
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userRows[0];
  if (!user || !user.is_active) {
    throw new Error('User inactive');
  }

  const roles = await loadUserRoles(user.id);
  const permissions = await loadUserPermissions(user.id, user.client_id, roles);
  const subscription = await loadClientSubscription(user.client_id);

  return {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
    subscription,
    roles,
    permissions
  };
}

async function loadClientSubscription(clientId) {
  if (!clientId) return null;
  try {
    const subscription = await getClientSubscriptionAccess(clientId);
    return {
      status: subscription.effective_status,
      accessMode: subscription.effective_access_mode,
      billingCycle: subscription.billing_cycle,
      currentPeriodEndsAt: subscription.current_period_ends_at,
      graceEndsAt: subscription.grace_ends_at,
      daysRemaining: subscription.days_remaining,
      isReadOnly: subscription.is_read_only,
      isBlocked: subscription.is_blocked
    };
  } catch {
    return null;
  }
}

export async function authenticateUser(username, password, sessionContext = {}) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername || typeof password !== 'string') {
    return null;
  }

  const { rows } = await query(
    `SELECT id, username, display_name, password_hash, is_active, client_id
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [normalizedUsername]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return null;
  }

  const roles = await loadUserRoles(user.id);
  const permissions = await loadUserPermissions(user.id, user.client_id, roles);
  const subscription = await loadClientSubscription(user.client_id);
  const sessionId = randomUUID();

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
    sessionId,
    subscription,
    roles,
    permissions
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenTtl });
  const refreshToken = jwt.sign({ sub: user.id, sessionId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: refreshTtl
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    await storeRefreshToken(user.id, refreshToken, sessionId, sessionContext, new Date(), client);
    await enforceSessionLimit(user.id, sessionId, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    user: payload,
    accessToken,
    refreshToken
  };
}

export async function refreshSession(refreshToken, sessionContext = {}) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const decodedSessionId = decoded.sessionId || null;
  const { rows } = await query(
    `SELECT id, user_id, session_id, token_hash, created_at, session_started_at,
            expires_at, revoked_at, replaced_at
     FROM refresh_tokens
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND replaced_at IS NULL
       AND ($2::uuid IS NULL OR session_id = $2::uuid)`,
    [decoded.sub, decodedSessionId]
  );

  let matchedRow = null;
  for (const row of rows) {
    const match = await bcrypt.compare(refreshToken, row.token_hash);
    if (match) {
      matchedRow = row;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        throw createSessionError('REFRESH_EXPIRED', 'Refresh expired');
      }
      break;
    }
  }

  if (!matchedRow) {
    if (decodedSessionId) {
      const previous = await query(
        `SELECT token_hash, revoked_at, replaced_at
         FROM refresh_tokens
         WHERE user_id = $1
           AND session_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [decoded.sub, decodedSessionId]
      );
      for (const row of previous.rows) {
        if (!(await bcrypt.compare(refreshToken, row.token_hash))) continue;
        if (row.replaced_at) {
          throw createSessionError('TOKEN_ROTATED', 'Refresh token already rotated');
        }
        throw createSessionError('SESSION_REPLACED', 'Session revoked');
      }
    }
    throw createSessionError('TOKEN_INVALID', 'Invalid refresh token');
  }

  const { rows: userRows } = await query(
    `SELECT id, username, display_name, is_active, client_id
     FROM users
     WHERE id = $1`,
    [decoded.sub]
  );

  const user = userRows[0];
  if (!user || !user.is_active) {
    throw new Error('User inactive');
  }

  const roles = await loadUserRoles(user.id);
  const permissions = await loadUserPermissions(user.id, user.client_id, roles);
  const subscription = await loadClientSubscription(user.client_id);
  const sessionId = matchedRow.session_id || decodedSessionId || randomUUID();

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
    sessionId,
    subscription,
    roles,
    permissions
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenTtl });
  const newRefreshToken = jwt.sign({ sub: user.id, sessionId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: refreshTtl
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: lockedRows } = await client.query(
      `SELECT id, created_at, session_started_at, revoked_at, replaced_at, expires_at
       FROM refresh_tokens
       WHERE id = $1
       FOR UPDATE`,
      [matchedRow.id]
    );
    const lockedToken = lockedRows[0];
    if (!lockedToken || lockedToken.revoked_at || lockedToken.replaced_at) {
      throw createSessionError(
        lockedToken?.replaced_at ? 'TOKEN_ROTATED' : 'SESSION_REPLACED',
        lockedToken?.replaced_at ? 'Refresh token already rotated' : 'Session revoked'
      );
    }
    if (new Date(lockedToken.expires_at).getTime() < Date.now()) {
      throw createSessionError('REFRESH_EXPIRED', 'Refresh expired');
    }

    await storeRefreshToken(
      user.id,
      newRefreshToken,
      sessionId,
      sessionContext,
      lockedToken.session_started_at || lockedToken.created_at,
      client
    );
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           replaced_at = NOW()
       WHERE id = $1`,
      [matchedRow.id]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    user: payload,
    accessToken,
    refreshToken: newRefreshToken
  };
}

export async function revokeRefreshToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return false;
  }

  const { rows } = await query(
    `SELECT id, user_id, session_id, token_hash
     FROM refresh_tokens
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR session_id = $2::uuid)
       AND revoked_at IS NULL`,
    [decoded.sub, decoded.sessionId || null]
  );
  for (const row of rows) {
    const match = await bcrypt.compare(refreshToken, row.token_hash);
    if (match) {
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND session_id = $2
           AND revoked_at IS NULL`,
        [row.user_id, row.session_id]
      );
      return true;
    }
  }
  return false;
}

export async function listActiveSessions(userId, currentSessionId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (session_id)
            session_id, session_started_at, last_seen_at, user_agent, ip_address
     FROM refresh_tokens
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND replaced_at IS NULL
       AND expires_at > NOW()
     ORDER BY session_id, last_seen_at DESC, created_at DESC`,
    [userId]
  );

  return {
    maxActiveSessions,
    sessions: rows
      .map((row) => ({
        id: row.session_id,
        device: describeSessionDevice(row.user_agent),
        startedAt: row.session_started_at,
        lastSeenAt: row.last_seen_at,
        ipAddress: row.ip_address,
        current: row.session_id === currentSessionId
      }))
      .sort((left, right) => {
        if (left.current !== right.current) return left.current ? -1 : 1;
        return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
      })
  };
}

export async function revokeActiveSession(userId, sessionId) {
  const { rowCount } = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND session_id = $2
       AND revoked_at IS NULL`,
    [userId, sessionId]
  );
  return rowCount > 0;
}

export async function revokeOtherActiveSessions(userId, currentSessionId) {
  const { rowCount } = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND session_id <> $2
       AND revoked_at IS NULL`,
    [userId, currentSessionId]
  );
  return rowCount;
}
