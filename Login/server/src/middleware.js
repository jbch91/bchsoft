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

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !permissions.some((perm) => user.permissions?.includes(perm))) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }
    return next();
  };
}
