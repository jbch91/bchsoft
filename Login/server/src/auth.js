import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

const tokenTtl = process.env.TOKEN_TTL || '15m';
const refreshTtl = process.env.REFRESH_TTL || '7d';

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

  const roleRows = await query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const roles = roleRows.rows.map((row) => row.name);

  const permRows = await query(
    `SELECT DISTINCT p.name
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const permissions = permRows.rows.map((row) => row.name);

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
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

  const roleRows = await query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const roles = roleRows.rows.map((row) => row.name);

  const permRows = await query(
    `SELECT DISTINCT p.name
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const permissions = permRows.rows.map((row) => row.name);

  const payload = {
    sub: user.id,
    username: user.username,
    displayName: user.display_name,
    clientId: user.client_id,
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
