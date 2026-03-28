import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Token requerido.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido.' });
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
