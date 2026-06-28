import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './db.js';
import { listClientModules } from './admin.js';
import { getClientSubscriptionAccess } from './subscriptions.js';

dotenv.config();

const tokenTtl = process.env.TOKEN_TTL || '15m';
const refreshTtl = process.env.REFRESH_TTL || '7d';
const CLIENT_CONFIGURABLE_ROLES = [
  'almacenista',
  'ingeniero_biomedico',
  'calibracion',
  'lector',
  'odontologo',
  'auxiliar_odontologia',
  'recepcion_odontologia',
  'admin_odontologia',
  'auditor_odontologia',
  'bacteriologo',
  'auxiliar_laboratorio'
];

async function listAllowedClientPermissions(clientId) {
  const modules = await listClientModules(clientId);
  const enabledModules = new Set(
    modules.filter((module) => module.enabled).map((module) => module.key)
  );
  const enabledSuites = new Set(
    modules
      .filter((module) => module.enabled)
      .map((module) => module.suite_key || 'biomedico')
  );
  const allowed = new Set();
  const add = (values) => values.forEach((value) => allowed.add(value));

  if (enabledSuites.has('biomedico')) {
    add(['software:biomedico:access', 'areas:manage', 'read:all']);
  }
  if (enabledModules.has('hojas_de_vida')) {
    add(['hb:create', 'hb:view', 'hb:import', 'asset_history:upload']);
  }
  if (enabledModules.has('inventario')) {
    add(['hb:view', 'inventory:move', 'inventory:request']);
  }
  if (enabledModules.has('guias_rapidas')) {
    add(['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete']);
  }
  if (enabledModules.has('reportes_mantenimiento')) {
    add([
      'hb:view',
      'maintenance:request:create',
      'maintenance:report:create',
      'maintenance:report:sign',
      'maintenance:order:create',
      'maintenance:order:close',
      'service:order:create',
      'spareparts:order:create'
    ]);
  }
  if (enabledModules.has('cronogramas')) {
    allowed.add('schedules:manage');
  }
  if (enabledModules.has('calibraciones')) {
    add(['calibration:schedule:manage', 'calibration:report:upload']);
  }
  if (enabledSuites.has('odontologico') || enabledModules.has('odontologia')) {
    add([
      'software:odontologico:access',
      'odontology:access',
      'odontology:settings:manage',
      'odontology:patients:manage',
      'odontology:patients:import',
      'odontology:clinical_records:manage',
      'odontology:appointments:manage',
      'odontology:odontogram:manage',
      'odontology:periodontogram:manage',
      'odontology:consents:manage',
      'odontology:attachments:manage',
      'odontology:inventory:manage',
      'odontology:sterilization:manage',
      'odontology:treatment_plans:manage',
      'odontology:payments:manage',
      'odontology:financial:view',
      'odontology:prescriptions:manage',
      'odontology:documents:manage',
      'odontology:reports:view',
      'audit:odontology:view'
    ]);
  }
  if (enabledSuites.has('laboratorio') || enabledModules.has('laboratorio')) {
    add(['software:laboratorio:access', 'laboratory:orders:manage', 'laboratory:results:manage']);
  }

  return allowed;
}

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

async function storeRefreshToken(userId, refreshToken) {
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = calculateExpiry(refreshTtl);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
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
       WHERE utp.user_id = $1
         AND utp.expires_at > NOW()
     ) active_permissions
     ORDER BY name`,
    [userId, clientId || null, CLIENT_CONFIGURABLE_ROLES]
  );
  const permissions = permRows.rows.map((row) => row.name);
  if (!clientId || roles.includes('client_admin')) {
    return permissions;
  }
  const allowed = await listAllowedClientPermissions(clientId);
  return permissions.filter((permission) => allowed.has(permission));
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

export async function authenticateUser(username, password) {
  const { rows } = await query(
    `SELECT id, username, display_name, password_hash, is_active, client_id
     FROM users
     WHERE username = $1`,
    [username]
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

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
    subscription,
    roles,
    permissions
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenTtl });
  const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: refreshTtl
  });

  await storeRefreshToken(user.id, refreshToken);

  return {
    user: payload,
    accessToken,
    refreshToken
  };
}

export async function refreshSession(refreshToken) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const { rows } = await query(
    'SELECT id, user_id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
    [decoded.sub]
  );

  let valid = false;
  for (const row of rows) {
    const match = await bcrypt.compare(refreshToken, row.token_hash);
    if (match) {
      valid = true;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        throw new Error('Refresh expired');
      }
      break;
    }
  }

  if (!valid) {
    throw new Error('Invalid refresh token');
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

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
    subscription,
    roles,
    permissions
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenTtl });
  const newRefreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: refreshTtl
  });

  await storeRefreshToken(user.id, newRefreshToken);

  return {
    user: payload,
    accessToken,
    refreshToken: newRefreshToken
  };
}

export async function revokeRefreshToken(refreshToken) {
  const { rows } = await query('SELECT id, token_hash FROM refresh_tokens WHERE revoked_at IS NULL');
  for (const row of rows) {
    const match = await bcrypt.compare(refreshToken, row.token_hash);
    if (match) {
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
      return true;
    }
  }
  return false;
}
