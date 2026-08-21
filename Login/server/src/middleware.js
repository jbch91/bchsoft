import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

async function isActiveSession(userId, sessionId) {
  const { rows } = await query(
    `SELECT 1
     FROM refresh_tokens
     WHERE user_id = $1
       AND session_id = $2
       AND revoked_at IS NULL
       AND replaced_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, sessionId]
  );
  return rows.length > 0;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Token requerido.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.sessionId && !(await isActiveSession(payload.sub, payload.sessionId))) {
      return res.status(401).json({
        code: 'SESSION_REPLACED',
        message: 'Tu sesión se cerró porque iniciaste sesión en otro dispositivo.'
      });
    }
    req.user = payload;
    return next();
  } catch (error) {
    if (error?.message === 'jwt expired') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token expirado.' });
    }
    return res.status(401).json({ code: 'TOKEN_INVALID', message: 'Token inválido.' });
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.permissions?.includes(permission)) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }
    return next();
  };
}

export function requireActiveTemporaryPermission(permission) {
  return async (req, res, next) => {
    const userId = req.user?.sub;
    const clientId = req.user?.clientId;
    if (!userId || !clientId) {
      return res.status(403).json({
        code: 'TEMPORARY_PERMISSION_REQUIRED',
        message: 'Esta operación requiere un permiso temporal activo para un usuario del cliente.'
      });
    }

    try {
      const { rows } = await query(
        `SELECT utp.id, utp.expires_at, utp.granted_by, utp.reason
         FROM user_temporary_permissions utp
         JOIN permissions p ON p.id = utp.permission_id
         JOIN users u ON u.id = utp.user_id
         WHERE utp.user_id = $1
           AND p.name = $2
           AND utp.expires_at > NOW()
           AND u.client_id = $3
           AND u.is_active = TRUE
           AND EXISTS (
             SELECT 1
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = u.id
               AND r.name = 'ingeniero_biomedico'
           )
         LIMIT 1`,
        [userId, permission, clientId]
      );
      if (!rows[0]) {
        return res.status(403).json({
          code: 'TEMPORARY_PERMISSION_REQUIRED',
          message: 'El permiso temporal no está activo o ya venció. Actualiza tus permisos o solicita una nueva autorización.'
        });
      }
      req.temporaryPermission = {
        id: rows[0].id,
        expiresAt: rows[0].expires_at,
        grantedBy: rows[0].granted_by,
        reason: rows[0].reason
      };
      return next();
    } catch (error) {
      console.error('No se pudo validar el permiso temporal', error);
      return res.status(500).json({ message: 'No se pudo validar el permiso temporal.' });
    }
  };
}

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !permissions.some((perm) => user.permissions?.includes(perm))) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }
    return next();
  };
}
