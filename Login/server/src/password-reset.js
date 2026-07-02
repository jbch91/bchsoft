import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { pool, query } from './db.js';
import { revokeUserActiveSessions } from './auth.js';
import { sendPasswordSetupCode, sendResetCode } from './mailer.js';

const CODE_TTL_MINUTES = 30;
const PASSWORD_MIN_LENGTH = 10;

function generateCode() {
  return String(randomInt(100000, 1000000));
}

function expiryDate() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
}

export async function requestPasswordReset(email) {
  const result = await createPasswordResetCode(email);
  if (!result) {
    return;
  }

  await sendResetCode({ to: email, code: result.code });
}

export async function requestPasswordSetup(email, { clientName } = {}) {
  const result = await createPasswordResetCode(email);
  if (!result) {
    return false;
  }

  await sendPasswordSetupCode({ to: email, code: result.code, clientName });
  return true;
}

async function createPasswordResetCode(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const { rows } = await query(
    'SELECT id, username FROM users WHERE LOWER(email) = $1 AND is_active = TRUE',
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user) {
    return null;
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await query(
    'UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
    [user.id]
  );

  await query(
    'INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, codeHash, expiryDate()]
  );

  return { user, code };
}

export async function resetPasswordWithCode({ email, code, newPassword }) {
  assertPasswordPolicy(newPassword);

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const { rows } = await query(
    'SELECT id FROM users WHERE LOWER(email) = $1 AND is_active = TRUE',
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user) {
    throw new Error('User not found');
  }

  const { rows: codeRows } = await query(
    `SELECT id, code_hash, expires_at
     FROM password_reset_codes
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 5`,
    [user.id]
  );

  let matchedId = null;
  for (const row of codeRows) {
    if (new Date(row.expires_at).getTime() < Date.now()) {
      continue;
    }
    const match = await bcrypt.compare(code, row.code_hash);
    if (match) {
      matchedId = row.id;
      break;
    }
  }

  if (!matchedId) {
    throw new Error('Invalid code');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      user.id
    ]);
    await client.query(
      'UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
    await revokeUserActiveSessions(user.id, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function assertPasswordPolicy(password) {
  const value = String(password || '');
  const hasMinimumLength = value.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);

  if (!hasMinimumLength || !hasUppercase || !hasLowercase || !hasNumber) {
    const error = new Error('PASSWORD_WEAK');
    error.code = 'PASSWORD_WEAK';
    throw error;
  }
}
