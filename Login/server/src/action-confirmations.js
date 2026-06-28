import bcrypt from 'bcrypt';
import { query } from './db.js';
import { sendActionConfirmationCode } from './mailer.js';

const CODE_TTL_MINUTES = 10;

const ACTION_LABELS = {
  CLIENT_CREATE: 'Crear cliente',
  CLIENT_UPDATE: 'Editar cliente',
  CLIENT_DELETE: 'Eliminar cliente',
  CLIENT_LOGO_UPDATE: 'Actualizar logo del cliente',
  CLIENT_SOFTWARE_ACCESS_UPDATE: 'Actualizar softwares del cliente',
  CLIENT_MODULES_UPDATE: 'Actualizar módulos del cliente',
  CLIENT_SUBSCRIPTION_UPDATE: 'Actualizar suscripción',
  CLIENT_SUBSCRIPTION_PAYMENT: 'Registrar pago o renovación',
  CLIENT_ADMIN_CREATE: 'Crear administrador del cliente',
  CLIENT_ADMIN_PASSWORD_RESET: 'Enviar acceso al administrador del cliente',
  SUBSCRIPTION_PLAN_CREATE: 'Crear plan SaaS',
  SUBSCRIPTION_PLAN_UPDATE: 'Editar plan SaaS',
  SUBSCRIPTION_PLAN_APPLY_TO_CLIENTS: 'Aplicar plan a clientes',
  USER_CREATE: 'Crear usuario',
  USER_UPDATE: 'Editar usuario',
  USER_ROLE_UPDATE: 'Cambiar rol de usuario',
  USER_ACTIVE_UPDATE: 'Activar o bloquear usuario',
  USER_PASSWORD_RESET: 'Enviar correo de contraseña',
  USER_DELETE: 'Eliminar usuario',
  USER_TEMPORARY_PERMISSION_GRANT: 'Activar permiso temporal',
  USER_TEMPORARY_PERMISSION_REVOKE: 'Revocar permiso temporal',
  USER_READER_ACCESS_UPDATE: 'Actualizar acceso lector',
  ROLE_PERMISSIONS_UPDATE: 'Actualizar permisos de rol',
  CLIENT_ROLE_PERMISSIONS_UPDATE: 'Actualizar permisos de rol del cliente'
};

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function expiryDate() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name.slice(0, 2)}***@${domain}`;
}

export function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

export async function requestAdminActionConfirmation({ userId, action, summary }) {
  const { rows } = await query(
    'SELECT id, email, is_active FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user?.is_active || !user.email) {
    throw new Error('CONFIRMATION_EMAIL_UNAVAILABLE');
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = expiryDate();

  await query(
    `UPDATE admin_action_confirmations
     SET used_at = NOW()
     WHERE user_id = $1 AND action = $2 AND used_at IS NULL`,
    [userId, action]
  );

  await query(
    `INSERT INTO admin_action_confirmations (user_id, action, summary, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, summary || null, codeHash, expiresAt]
  );

  await sendActionConfirmationCode({
    to: user.email,
    code,
    actionLabel: actionLabel(action),
    summary
  });

  return {
    expiresAt: expiresAt.toISOString(),
    deliveryEmail: maskEmail(user.email)
  };
}

export async function verifyAdminActionConfirmation({ userId, action, code }) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) return false;

  const { rows } = await query(
    `SELECT id, code_hash, expires_at
     FROM admin_action_confirmations
     WHERE user_id = $1
       AND action = $2
       AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, action]
  );

  for (const row of rows) {
    if (new Date(row.expires_at).getTime() < Date.now()) {
      continue;
    }
    if (await bcrypt.compare(cleanCode, row.code_hash)) {
      await query('UPDATE admin_action_confirmations SET used_at = NOW() WHERE id = $1', [row.id]);
      return true;
    }
  }

  return false;
}
