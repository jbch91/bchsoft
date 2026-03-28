import bcrypt from 'bcrypt';
import { query } from './db.js';
import { sendResetCode } from './mailer.js';

const CODE_TTL_MINUTES = 30;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function expiryDate() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
}

export async function requestPasswordReset(email) {
  const { rows } = await query(
    'SELECT id, username FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );

  const user = rows[0];
  if (!user) {
    return;
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

  await sendResetCode({ to: email, code });
}

export async function resetPasswordWithCode({ email, code, newPassword }) {
  const { rows } = await query(
    'SELECT id FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
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
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
  await query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = $1', [matchedId]);
}
