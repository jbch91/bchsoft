import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { finished } from 'stream/promises';
import { promisify } from 'util';
import multer from 'multer';
import sharp from 'sharp';
import { query } from './db.js';
import { authenticateUser, refreshSession, revokeRefreshToken } from './auth.js';
import { requireAnyPermission, requireAuth, requirePermission } from './middleware.js';
import {
  createUser,
  grantTemporaryPermission,
  getUserById,
  getRolePermissions,
  listClientModules,
  listModules,
  listPermissions,
  listRoles,
  listUsers,
  revokeTemporaryPermission,
  updateUserSignature,
  updateUserProfile,
  deleteUser,
  updateClientModules,
  updateRolePermissions,
  updateUserActive,
  updateUserPassword,
  updateUserRole
} from './admin.js';
import { requestPasswordReset, resetPasswordWithCode } from './password-reset.js';
import { logAudit, listAuditLogs } from './audit.js';
import {
  createClient,
  listClients,
  updateClientLogo,
  ensureClientLogoDir,
  getClientById,
  updateClient,
  deleteClient
} from './clients.js';
import {
  createArea,
  createAsset,
  createAssetMovement,
  createLocation,
  createSite,
  deleteArea,
  deleteAsset,
  deleteLocation,
  deleteSite,
  getAssetById,
  getAssetHistoryFileById,
  getAssetMovementById,
  createAssetHistoryFile,
  deleteAssetHistoryFile,
  listAssetHistory,
  listAssetsForReader,
  listAssetMovements,
  readerCanAccessAsset,
  listAreas,
  listAssets,
  listLocations,
  listSites,
  setAssetHvEngineer,
  setAssetPhoto,
  updateAssetStatus,
  moveAsset,
  updateAssetMovementPdf,
  updateArea,
  updateAsset,
  updateLocation,
  updateSite,
  replaceAccessories,
  replaceCleaning,
  replaceRecommendations,
  replaceDocuments
} from './biomed.js';
import PDFDocument from 'pdfkit';
import {
  buildAssetMovementPdf,
  buildAssetPdf,
  buildMaintenanceReportPdf,
  buildMaintenanceSchedulePdf,
  buildCalibrationSchedulePdf,
  buildTrainingSchedulePdf
} from './pdf.js';
import {
  createSchedule,
  listSchedules,
  getScheduleById,
  setSchedulePdf,
  approveSchedule,
  markEngineerEdited,
  listScheduleItemsWithSchema,
  insertScheduleItems,
  updateScheduleItems,
  setScheduleClosedIfDone,
  markScheduleItemDone,
  findScheduleItemForAsset,
  deleteSchedule
} from './schedules.js';
import {
  createTrainingSchedule,
  listTrainingSchedules,
  getTrainingScheduleById,
  approveTrainingSchedule,
  deleteTrainingSchedule,
  insertTrainingItems,
  listTrainingItemsWithSchema,
  setTrainingItemPdf,
  setTrainingSchedulePdf,
  clearTrainingItemPdf,
  updateTrainingItems
} from './training.js';
import {
  createCalibrationSchedule,
  listCalibrationSchedules,
  getCalibrationScheduleById,
  approveCalibrationSchedule,
  setCalibrationSchedulePdf,
  deleteCalibrationSchedule,
  insertCalibrationItems,
  listCalibrationItemsWithSchema,
  setCalibrationItemPdf,
  clearCalibrationItemPdf,
  listCalibrationReportsByAsset
} from './calibration.js';
import {
  createMaintenanceRequest,
  listMaintenanceRequests,
  listMaintenanceRequestsForReader,
  getMaintenanceRequestById,
  assignMaintenanceRequest,
  createMaintenanceReport,
  signMaintenanceReport,
  listMaintenanceReports,
  listMaintenanceReportsForReader,
  getMaintenanceReportById,
  updateMaintenanceReportPdf,
  listReportSignatures,
  listReportSignaturesByReports,
  updateMaintenanceRequestStatus,
  deleteMaintenanceReport,
  deleteMaintenanceRequest,
  createNotification,
  createNotificationOnce,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markMaintenanceRequestNotificationsResolved,
  listUsersByRoleAndClient
} from './maintenance.js';
import { sendNotificationEmail } from './mailer.js';
import { listReaderAccess, replaceReaderAccess } from './reader-access.js';
import { sendPreventiveRemindersForClient } from './preventive-reminders.js';

dotenv.config();

const execFileAsync = promisify(execFile);
const app = express();
const corsOriginList = String(process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // Same-origin requests (or server-to-server) may omit Origin.
      if (!origin) return cb(null, true);
      if (corsOriginList.includes('*')) return cb(null, true);
      if (corsOriginList.includes(origin)) return cb(null, true);
      // Allow any origin in local dev to reduce friction.
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      return cb(new Error('CORS: Origin no permitido'));
    }
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const upload = multer({ storage: multer.memoryStorage() });
const BIOMED_DOCUMENT_TYPES = ['cedula_ciudadania', 'cedula_extranjeria', 'pasaporte'];
const MAINTENANCE_ASSET_STATUSES = [
  'operativo',
  'operativo_observacion',
  'fuera_de_servicio'
];
const MAINTENANCE_SPARE_STATUSES = ['no_aplica', 'solicitado', 'recibido'];
const SIGNATURE_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
const SIGNATURE_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
];
const uploadAssetFiles = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'manualOperacion', maxCount: 1 },
  { name: 'manualServicio', maxCount: 1 }
]);

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function adjustToWeekday(date) {
  const d = new Date(date);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function addBusinessDays(date, days) {
  let d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) {
      added += 1;
    }
  }
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function freqToMonths(freq) {
  const map = {
    mensual: 1,
    bimensual: 2,
    trimestral: 3,
    cuatrimestral: 4,
    semestral: 6,
    anual: 12
  };
  return map[String(freq || '').toLowerCase()] ?? null;
}

function todayLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toLocalISODate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

async function readerCanAccessArea(clientId, userId, areaId) {
  const client = await getClientById(clientId);
  if (!client) return false;
  const schema = client.schema_name;
  const { rows } = await query(
    `SELECT 1
     FROM reader_access ra
     LEFT JOIN "${schema}".locations lo ON lo.id = ra.location_id
     WHERE ra.user_id = $1 AND ra.client_id = $2
       AND (ra.area_id = $3 OR lo.area_id = $3)
     LIMIT 1`,
    [userId, clientId, areaId]
  );
  return rows.length > 0;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
  }

  try {
    const result = await authenticateUser(username, password);
    if (!result) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error interno.' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token requerido.' });
  }

  try {
    const result = await refreshSession(refreshToken);
    return res.json(result);
  } catch (error) {
    return res.status(401).json({ message: 'Refresh inválido.' });
  }
});

app.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token requerido.' });
  }

  await revokeRefreshToken(refreshToken);
  return res.json({ ok: true });
});

app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'Correo requerido.' });
  }

  try {
    await requestPasswordReset(email);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo enviar el código.' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }

  try {
    await resetPasswordWithCode({ email, code, newPassword });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ message: 'Código inválido o expirado.' });
  }
});

app.get('/admin/roles', requireAuth, requirePermission('users:manage'), async (_req, res) => {
  const roles = await listRoles();
  return res.json(roles);
});

app.get('/admin/permissions', requireAuth, requirePermission('users:manage'), async (_req, res) => {
  const permissions = await listPermissions();
  return res.json(permissions);
});

app.get(
  '/admin/roles/:id/permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const permissions = await getRolePermissions(req.params.id);
    return res.json(permissions);
  }
);

app.put(
  '/admin/roles/:id/permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permisos inválidos.' });
    }

    await updateRolePermissions(req.params.id, permissions);
    return res.json({ ok: true });
  }
);

app.get('/admin/users', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const users = await listUsers();
  return res.json(users);
});

app.post(
  '/admin/users/:id/temporary-permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }

    const { permission, expiresAt, reason } = req.body || {};
    const allowedTemporaryPermissions = ['hb:import', 'asset_history:upload'];
    if (!allowedTemporaryPermissions.includes(permission)) {
      return res.status(400).json({ message: 'Permiso temporal inválido.' });
    }

    const parsedExpiresAt = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(parsedExpiresAt.getTime())) {
      return res.status(400).json({ message: 'Fecha de vencimiento inválida.' });
    }
    if (parsedExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'La fecha de vencimiento debe ser futura.' });
    }

    const result = await grantTemporaryPermission({
      userId: req.params.id,
      permission,
      expiresAt: parsedExpiresAt,
      grantedBy: req.user.sub,
      reason
    });
    if (result?.error === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    if (result?.error === 'PERMISSION_NOT_FOUND') {
      return res.status(404).json({ message: 'Permiso no encontrado.' });
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_TEMP_PERMISSION_GRANT',
      targetUserId: req.params.id,
      targetUsername: result.username,
      details: {
        permission,
        expiresAt: parsedExpiresAt.toISOString(),
        reason: reason || null
      }
    });

    return res.status(201).json(result);
  }
);

app.delete(
  '/admin/users/:id/temporary-permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }

    const permission = req.query.permission || req.body?.permission;
    if (!permission) {
      return res.status(400).json({ message: 'Permiso requerido.' });
    }

    const result = await revokeTemporaryPermission({
      userId: req.params.id,
      permission: String(permission)
    });
    if (!result) {
      return res.status(404).json({ message: 'Permiso temporal no encontrado.' });
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_TEMP_PERMISSION_REVOKE',
      targetUserId: req.params.id,
      targetUsername: result.username,
      details: {
        permission: result.permission
      }
    });

    return res.json({ ok: true });
  }
);

app.get('/admin/modules', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const modules = await listModules();
  return res.json(modules);
});

app.get('/admin/clients/:id/modules', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const modules = await listClientModules(req.params.id);
  return res.json(modules);
});

app.put('/admin/clients/:id/modules', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { modules } = req.body || {};
  if (!Array.isArray(modules)) {
    return res.status(400).json({ message: 'Módulos inválidos.' });
  }
  await updateClientModules(req.params.id, modules);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'CLIENT_MODULES_UPDATE',
    details: { clientId: req.params.id, modules }
  });
  return res.json({ ok: true });
});

app.get('/modules/me', requireAuth, async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) {
    const all = await listModules();
    return res.json(all.map((m) => ({ key: m.key, enabled: true })));
  }
  const modules = await listClientModules(clientId);
  return res.json(modules.map((m) => ({ key: m.key, enabled: m.enabled })));
});

app.get('/clients/me', requireAuth, async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) {
    return res.status(404).json({ message: 'Sin cliente asignado.' });
  }
  const client = await getClientById(clientId);
  return res.json(client);
});

app.post('/admin/users', requireAuth, requirePermission('users:manage'), upload.single('signature'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const {
    username,
    displayName,
    email,
    password,
    role,
    clientId,
    documentType,
    documentNumber,
    invimaRegistration
  } = req.body || {};
  if (!username || !displayName || !email || !password || !role) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ message: 'Correo inválido.' });
  }
  const clientScopedRoles = ['almacenista', 'ingeniero_biomedico', 'calibracion', 'lector'];
  if (clientScopedRoles.includes(role) && !clientId) {
    return res.status(400).json({ message: 'Debes seleccionar un cliente para este rol.' });
  }
  const cleanDocumentType = documentType?.trim?.() || null;
  const cleanDocumentNumber = documentNumber?.trim?.() || null;
  const cleanInvimaRegistration = invimaRegistration?.trim?.() || null;
  if (cleanDocumentType && !BIOMED_DOCUMENT_TYPES.includes(cleanDocumentType)) {
    return res.status(400).json({ message: 'Tipo de documento inválido.' });
  }
  if (!cleanDocumentType || !cleanDocumentNumber) {
    return res.status(400).json({ message: 'Tipo de documento y número de documento son obligatorios.' });
  }
  if (role === 'ingeniero_biomedico' && !cleanInvimaRegistration) {
    return res.status(400).json({
      message: 'Registro INVIMA obligatorio para el ingeniero biomédico.'
    });
  }
  if (req.file && !isAllowedSignatureFile(req.file)) {
    return res.status(400).json({
      message: 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.'
    });
  }

  try {
    const result = await createUser({
      username,
      displayName,
      email,
      password,
      role,
      clientId,
      documentType: cleanDocumentType,
      documentNumber: cleanDocumentNumber,
      invimaRegistration: cleanInvimaRegistration
    });
    if (result?.error === 'DUPLICATE') {
      return res.status(409).json({ message: 'Usuario o correo ya existe.' });
    }

    if (req.file && result?.id) {
      const signaturePath = await saveUserSignature(result.id, req.file);
      await updateUserSignature(result.id, signaturePath);
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_CREATE',
      targetUsername: username,
      details: {
        role,
        email,
        clientId: clientId ?? null,
        documentType: documentType ?? null,
        hasInvimaRegistration: Boolean(invimaRegistration)
      }
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el usuario.' });
  }
});

function isPdfBuffer(buffer) {
  return buffer?.subarray?.(0, 4)?.toString?.() === '%PDF';
}

function isPdfUploadFile(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  return extension === '.pdf' && (mimetype === 'application/pdf' || isPdfBuffer(file?.buffer));
}

function isAllowedSignatureFile(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  return SIGNATURE_ALLOWED_MIME_TYPES.includes(mimetype) || SIGNATURE_ALLOWED_EXTENSIONS.includes(extension);
}

function isPdfSignatureFile(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  return mimetype === 'application/pdf' || extension === '.pdf' || isPdfBuffer(file?.buffer);
}

async function renderSignaturePdfFirstPage(buffer) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bchsoft-signature-'));
  const pdfPath = path.join(tmpDir, 'signature.pdf');
  const outputPrefix = path.join(tmpDir, 'signature-page');
  const outputPath = `${outputPrefix}.png`;

  try {
    await fs.promises.writeFile(pdfPath, buffer);
    try {
      await execFileAsync('pdftoppm', ['-png', '-f', '1', '-singlefile', '-r', '240', pdfPath, outputPrefix], {
        timeout: 30000
      });
      return fs.promises.readFile(outputPath);
    } catch {
      // macOS development fallback. In production Docker we install poppler-utils.
      await execFileAsync('sips', ['-s', 'format', 'png', pdfPath, '--out', outputPath], {
        timeout: 30000
      });
      return fs.promises.readFile(outputPath);
    }
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function signatureFileToImageBuffer(file) {
  if (isPdfSignatureFile(file)) {
    return renderSignaturePdfFirstPage(file.buffer);
  }
  return file.buffer;
}

async function saveUserSignature(userId, file) {
  const dir = path.join(process.cwd(), 'uploads', 'users', userId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = path.join(dir, 'signature.png');
  const imageBuffer = await signatureFileToImageBuffer(file);
  await processSignatureImage(imageBuffer, filename);
  const publicPath = `/${path.join('uploads', 'users', userId, 'signature.png')}`;
  return publicPath.replace(/\\/g, '/');
}

async function processSignatureImage(buffer, filename) {
  const normalized = sharp(buffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(900, 360, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .ensureAlpha();
  const { data, info } = await normalized.raw().toBuffer({ resolveWithObject: true });
  const lumaValues = [];

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    lumaValues.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  lumaValues.sort((a, b) => a - b);
  const sampleIndex = Math.min(lumaValues.length - 1, Math.floor(lumaValues.length * 0.025));
  const dynamicCut = lumaValues[sampleIndex] || 128;
  const threshold = Math.max(118, Math.min(132, dynamicCut + 4));

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    // Convertimos la foto a una firma real: fondo transparente y trazo oscuro.
    // El umbral dinámico evita conservar sombras del papel cuando la foto queda gris.
    let alpha = 0;
    if (luma < threshold) {
      alpha = Math.max(170, Math.min(255, Math.round((threshold - luma) * 24)));
    }

    data[i] = 15;
    data[i + 1] = 23;
    data[i + 2] = 42;
    data[i + 3] = alpha;
  }

  const cleanedBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .trim({ background: { r: 15, g: 23, b: 42, alpha: 0 }, threshold: 5 })
    .extend({
      top: 14,
      bottom: 14,
      left: 28,
      right: 28,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  await sharp(cleanedBuffer)
    .resize(420, 160, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      withoutEnlargement: false
    })
    .png({ compressionLevel: 9 })
    .toFile(filename);
}


function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function assetLabel(asset) {
  if (!asset) return 'Equipo';
  const code = asset.code ? `${asset.code} - ` : '';
  return `${code}${asset.name || 'Equipo sin nombre'}`;
}

function isBiomedicalEngineer(user) {
  return user?.roles?.includes('ingeniero_biomedico');
}

function primaryRole(user) {
  return user?.roles?.[0] || 'usuario';
}

async function userHasRole(userId, roleName) {
  if (!userId) return false;
  const { rows } = await query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = $2
     LIMIT 1`,
    [userId, roleName]
  );
  return rows.length > 0;
}

async function resolveHvEngineerUserId(req) {
  if (!req.user?.sub) return null;
  if (isBiomedicalEngineer(req.user)) return req.user.sub;
  return (await userHasRole(req.user.sub, 'ingeniero_biomedico')) ? req.user.sub : null;
}

async function backfillHvEngineerFromAudit(clientId, asset) {
  if (!asset || asset.hv_engineer_user_id) return asset;
  const { rows } = await query(
    `SELECT al.actor_user_id
     FROM audit_logs al
     JOIN user_roles ur ON ur.user_id = al.actor_user_id
     JOIN roles r ON r.id = ur.role_id
     WHERE al.target_user_id = $1
       AND al.action IN ('ASSET_IMPORT', 'ASSET_CREATE', 'ASSET_UPDATE')
       AND r.name = 'ingeniero_biomedico'
     ORDER BY al.created_at DESC
     LIMIT 1`,
    [asset.id]
  );
  const engineerUserId = rows[0]?.actor_user_id;
  if (!engineerUserId) return asset;
  await setAssetHvEngineer(clientId, asset.id, engineerUserId);
  return getAssetById(clientId, asset.id);
}

function assetSnapshot(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    code: asset.code ?? null,
    name: asset.name ?? null,
    brand: asset.brand ?? null,
    model: asset.model ?? null,
    serial: asset.serial ?? null,
    area: asset.area_name ?? null,
    location: asset.location_name ?? asset.location ?? null,
    status: asset.status ?? null,
    riskClass: asset.risk_class ?? null,
    maintenanceFrequency: asset.maintenance_frequency ?? null,
    requiresCalibration: asset.requires_calibration ?? null,
    calibrationFrequency: asset.calibration_frequency ?? null
  };
}

function changedAssetFields(before, after) {
  if (!before || !after) return [];
  const fields = [
    ['code', 'Código'],
    ['name', 'Nombre'],
    ['brand', 'Marca'],
    ['model', 'Modelo'],
    ['serial', 'Serie'],
    ['area_id', 'Área'],
    ['location_id', 'Ubicación'],
    ['risk_class', 'Riesgo'],
    ['status', 'Estado'],
    ['maintenance_frequency', 'Frecuencia mantenimiento'],
    ['requires_calibration', 'Requiere calibración'],
    ['calibration_frequency', 'Frecuencia calibración']
  ];
  return fields
    .filter(([key]) => String(before[key] ?? '') !== String(after[key] ?? ''))
    .map(([key, label]) => ({
      field: key,
      label,
      before: before[key] ?? null,
      after: after[key] ?? null
    }));
}

async function logEquipmentAudit(req, {
  action,
  clientId,
  assetId,
  asset,
  description,
  details = {}
}) {
  try {
    const [client, resolvedAsset] = await Promise.all([
      clientId ? getClientById(clientId).catch(() => null) : Promise.resolve(null),
      asset ? Promise.resolve(asset) : assetId && clientId ? getAssetById(clientId, assetId).catch(() => null) : Promise.resolve(null)
    ]);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action,
      targetUserId: resolvedAsset?.id ?? assetId ?? clientId ?? null,
      targetUsername: assetLabel(resolvedAsset),
      details: {
        category: 'equipment',
        description,
        actorDisplayName: req.user.displayName ?? req.user.username,
        actorUsername: req.user.username,
        actorRoles: req.user.roles ?? [],
        clientId: clientId ?? null,
        clientName: client?.name ?? null,
        asset: assetSnapshot(resolvedAsset),
        ...details
      }
    });
  } catch (error) {
    console.error('No se pudo registrar auditoría de equipo', error);
  }
}

async function saveClientLogoBuffer(clientId, buffer) {
  await ensureClientLogoDir(clientId);
  const filename = path.join('uploads', 'clients', clientId, 'logo.png');
  const fullPath = path.join(process.cwd(), filename);

  await sharp(buffer)
    .resize(320, 160, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(fullPath);

  const publicPath = `/${filename}`.replace(/\\/g, '/');
  return updateClientLogo(clientId, publicPath);
}

app.get('/admin/clients', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const clients = await listClients();
  return res.json(clients);
});

app.get('/admin/clients/:id/areas', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  try {
    const areas = await listAreas(req.params.id);
    return res.json(areas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las áreas.' });
  }
});

app.get('/admin/clients/:id/locations', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  try {
    const areas = await listLocations(req.params.id, req.query.areaId);
    return res.json(areas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las ubicaciones.' });
  }
});

app.post('/admin/clients', requireAuth, requirePermission('clients:manage'), upload.single('logo'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { name, nit, city, address, habilitationCode, email } = req.body || {};
  if (!name || !nit || !city || !email || !address) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  if (req.file) {
    try {
      await sharp(req.file.buffer).metadata();
    } catch {
      return res.status(400).json({ message: 'El logo debe ser una imagen válida.' });
    }
  }

  try {
    const result = await createClient({ name, nit, city, address, habilitationCode, email });
    let logoPath = null;
    if (req.file) {
      const updatedLogo = await saveClientLogoBuffer(result.id, req.file.buffer);
      logoPath = updatedLogo?.logo_path ?? null;
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_CREATE',
      targetUserId: result.id,
      targetUsername: name,
      details: { nit, city, address, logo: logoPath }
    });
    return res.status(201).json({ ...result, logo_path: logoPath });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el cliente.' });
  }
});

app.patch('/admin/clients/:id', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { name, nit, city, address, habilitationCode, email } = req.body || {};
  if (!name || !nit || !city || !email || !address) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  await updateClient(req.params.id, { name, nit, city, address, habilitationCode, email });
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'CLIENT_UPDATE',
    targetUserId: req.params.id,
    details: { name, nit, city, address, email }
  });
  return res.json({ ok: true });
});

app.delete('/admin/clients/:id', requireAuth, requirePermission('clients:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  await deleteClient(req.params.id);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'CLIENT_DELETE',
    targetUserId: req.params.id
  });
  return res.json({ ok: true });
});

app.post(
  '/admin/clients/:id/logo',
  requireAuth,
  requirePermission('clients:manage'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Logo requerido.' });
    }

    const updated = await saveClientLogoBuffer(req.params.id, req.file.buffer);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_LOGO_UPDATE',
      targetUserId: req.params.id,
      details: { logo: updated?.logo_path }
    });

    return res.json(updated);
  }
);

app.get(
  '/biomed/:clientId/assets',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    try {
      const assets = req.user.roles?.includes('lector')
        ? await listAssetsForReader(clientId, req.user.sub)
        : await listAssets(clientId);
      return res.json(assets);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las hojas de vida.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets',
  requireAuth,
  requirePermission('hb:create'),
  uploadAssetFiles,
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const body = req.body || {};
    const {
      code,
      name,
      brand,
      model,
      serial,
      location,
      invimaReg,
      siteId,
      areaId,
      locationId,
      riskClass,
      isMobile,
      manufacturer,
      acquisitionType,
      contractText,
      acquisitionDate,
      usefulLifeYears,
      warrantyYears,
      supplierName,
      supplierPhone,
      supplierEmail,
      powerType,
      voltage,
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
      maintenanceFrequency,
      requiresCalibration,
      calibrationFrequency,
      accessories,
      cleaning,
      recommendations
    } = body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Código y nombre son requeridos.' });
    }

    try {
      const hvEngineerUserId = await resolveHvEngineerUserId(req);
      const result = await createAsset(clientId, {
        code,
        name,
        brand,
        model,
        serial,
        location,
        invimaReg,
        siteId: siteId || null,
        areaId: areaId || null,
        locationId: locationId || null,
        riskClass,
        isMobile: String(isMobile) === 'true',
        manufacturer,
        acquisitionType,
        contractText,
        acquisitionDate,
        usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : null,
        warrantyYears: warrantyYears ? Number(warrantyYears) : null,
        supplierName,
        supplierPhone,
        supplierEmail,
        powerType,
        voltage,
        tempMin: tempMin ? Number(tempMin) : null,
        tempMax: tempMax ? Number(tempMax) : null,
        humidityMin: humidityMin ? Number(humidityMin) : null,
        humidityMax: humidityMax ? Number(humidityMax) : null,
        maintenanceFrequency,
        requiresCalibration: String(requiresCalibration) === 'true',
        calibrationFrequency,
        hvEngineerUserId
      });

      if (req.files?.photo?.[0]) {
        const dir = await ensureClientLogoDir(clientId);
        const assetDir = path.join(dir, 'assets', result.id);
        await fs.promises.mkdir(assetDir, { recursive: true });
        const filename = path.join('uploads', 'clients', clientId, 'assets', result.id, 'photo.png');
        const fullPath = path.join(process.cwd(), filename);
        await sharp(req.files.photo[0].buffer)
          .resize(600, 600, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toFile(fullPath);

        await setAssetPhoto(clientId, result.id, `/${filename}`);
      }

      const docs = [];
      const dir = await ensureClientLogoDir(clientId);
      const assetDir = path.join(dir, 'assets', result.id);
      await fs.promises.mkdir(assetDir, { recursive: true });
      if (req.files?.manualOperacion?.[0]) {
        const filename = path.join('uploads', 'clients', clientId, 'assets', result.id, 'manual_operacion.pdf');
        const fullPath = path.join(process.cwd(), filename);
        await fs.promises.writeFile(fullPath, req.files.manualOperacion[0].buffer);
        docs.push({ doc_type: 'manual_operacion', file_path: `/${filename}` });
      }
      if (req.files?.manualServicio?.[0]) {
        const filename = path.join('uploads', 'clients', clientId, 'assets', result.id, 'manual_servicio.pdf');
        const fullPath = path.join(process.cwd(), filename);
        await fs.promises.writeFile(fullPath, req.files.manualServicio[0].buffer);
        docs.push({ doc_type: 'manual_servicio', file_path: `/${filename}` });
      }
      if (docs.length) {
        await replaceDocuments(clientId, result.id, docs);
      }

      const accessoriesList = parseJsonArray(accessories);
      const cleaningList = parseJsonArray(cleaning);
      const recommendationsList = parseJsonArray(recommendations);
      if (accessoriesList.length) await replaceAccessories(clientId, result.id, accessoriesList);
      if (cleaningList.length) await replaceCleaning(clientId, result.id, cleaningList);
      if (recommendationsList.length) await replaceRecommendations(clientId, result.id, recommendationsList);

      const createdAsset = await getAssetById(clientId, result.id);
      await logEquipmentAudit(req, {
        action: 'ASSET_CREATE',
        clientId,
        assetId: result.id,
        asset: createdAsset,
        description: `Creación de hoja de vida del equipo ${assetLabel(createdAsset)}.`,
        details: {
          eventType: 'hoja_vida_creada',
          uploadedFiles: {
            photo: Boolean(req.files?.photo?.[0]),
            manualOperacion: Boolean(req.files?.manualOperacion?.[0]),
            manualServicio: Boolean(req.files?.manualServicio?.[0])
          }
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear la hoja de vida.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets/import',
  requireAuth,
  requirePermission('hb:import'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    if (!assets.length) {
      return res.status(400).json({ message: 'No hay equipos para importar.' });
    }
    if (assets.length > 500) {
      return res.status(400).json({ message: 'Importa máximo 500 equipos por archivo.' });
    }

    const missing = assets.find((asset) =>
      !asset?.code ||
      !asset?.name ||
      !asset?.brand ||
      !asset?.model ||
      !asset?.serial ||
      !asset?.siteId ||
      !asset?.areaId ||
      !asset?.locationId ||
      !asset?.invimaReg ||
      !asset?.riskClass
    );
    if (missing) {
      return res.status(400).json({ message: 'Hay equipos con campos obligatorios incompletos.' });
    }

    try {
      const normalizedCodes = assets.map((asset) => String(asset.code || '').trim().toLowerCase());
      const repeatedCodes = normalizedCodes.filter((code, index) => code && normalizedCodes.indexOf(code) !== index);
      if (repeatedCodes.length) {
        return res.status(400).json({
          message: `Hay códigos repetidos en el archivo: ${Array.from(new Set(repeatedCodes)).join(', ')}.`
        });
      }

      const [existingAssets, sites, areas, locations] = await Promise.all([
        listAssets(clientId),
        listSites(clientId),
        listAreas(clientId),
        listLocations(clientId)
      ]);
      const existingCodes = new Set(existingAssets.map((asset) => String(asset.code || '').trim().toLowerCase()));
      const existingMatches = normalizedCodes.filter((code) => existingCodes.has(code));
      if (existingMatches.length) {
        return res.status(409).json({
          message: `Ya existen equipos con estos códigos: ${Array.from(new Set(existingMatches)).join(', ')}.`
        });
      }

      const siteIds = new Set(sites.map((site) => site.id));
      const areaById = new Map(areas.map((area) => [area.id, area]));
      const locationById = new Map(locations.map((location) => [location.id, location]));
      const invalidReference = assets.find((asset) => {
        const area = areaById.get(asset.areaId);
        const location = locationById.get(asset.locationId);
        return (
          !siteIds.has(asset.siteId) ||
          !area ||
          area.site_id !== asset.siteId ||
          !location ||
          location.area_id !== asset.areaId
        );
      });
      if (invalidReference) {
        return res.status(400).json({
          message: `La sede, área o ubicación del equipo ${invalidReference.code || invalidReference.name || ''} no corresponde al cliente seleccionado.`
        });
      }

      const hvEngineerUserId = await resolveHvEngineerUserId(req);
      const imported = [];
      for (const asset of assets) {
        const result = await createAsset(clientId, {
          code: String(asset.code).trim(),
          name: String(asset.name).trim(),
          brand: asset.brand || null,
          model: asset.model || null,
          serial: asset.serial || null,
          invimaReg: asset.invimaReg || null,
          siteId: asset.siteId || null,
          areaId: asset.areaId || null,
          locationId: asset.locationId || null,
          riskClass: asset.riskClass || null,
          isMobile: Boolean(asset.isMobile),
          manufacturer: asset.manufacturer || null,
          acquisitionType: asset.acquisitionType || null,
          contractText: asset.contractText || null,
          acquisitionDate: asset.acquisitionDate || null,
          usefulLifeYears: asset.usefulLifeYears ? Number(asset.usefulLifeYears) : null,
          warrantyYears: asset.warrantyYears ? Number(asset.warrantyYears) : null,
          supplierName: asset.supplierName || null,
          supplierPhone: asset.supplierPhone || null,
          supplierEmail: asset.supplierEmail || null,
          powerType: asset.powerType || 'AC',
          voltage: asset.voltage || null,
          tempMin: asset.tempMin ? Number(asset.tempMin) : null,
          tempMax: asset.tempMax ? Number(asset.tempMax) : null,
          humidityMin: asset.humidityMin ? Number(asset.humidityMin) : null,
          humidityMax: asset.humidityMax ? Number(asset.humidityMax) : null,
          maintenanceFrequency: asset.maintenanceFrequency || 'mensual',
          requiresCalibration: Boolean(asset.requiresCalibration),
          calibrationFrequency: asset.requiresCalibration ? asset.calibrationFrequency || 'anual' : null,
          hvEngineerUserId
        });
        const createdAsset = await getAssetById(clientId, result.id);
        imported.push(result.id);
        await logEquipmentAudit(req, {
          action: 'ASSET_IMPORT',
          clientId,
          assetId: result.id,
          asset: createdAsset,
          description: `Importación masiva de hoja de vida del equipo ${assetLabel(createdAsset)}.`,
          details: {
            eventType: 'hoja_vida_importada',
            importBatchSize: assets.length
          }
        });
      }

      return res.status(201).json({ imported: imported.length, ids: imported });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo completar la importación masiva.' });
    }
  }
);

app.put(
  '/biomed/:clientId/assets/:assetId',
  requireAuth,
  requirePermission('hb:create'),
  uploadAssetFiles,
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const body = req.body || {};
    const {
      code,
      name,
      brand,
      model,
      serial,
      invimaReg,
      siteId,
      areaId,
      locationId,
      riskClass,
      isMobile,
      manufacturer,
      acquisitionType,
      contractText,
      acquisitionDate,
      usefulLifeYears,
      warrantyYears,
      supplierName,
      supplierPhone,
      supplierEmail,
      powerType,
      voltage,
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
      maintenanceFrequency,
      requiresCalibration,
      calibrationFrequency,
      accessories,
      cleaning,
      recommendations
    } = body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Código y nombre son requeridos.' });
    }
    try {
      const hvEngineerUserId = await resolveHvEngineerUserId(req);
      const beforeAsset = await getAssetById(clientId, assetId);
      await updateAsset(clientId, assetId, {
        code,
        name,
        brand,
        model,
        serial,
        invimaReg,
        siteId: siteId || null,
        areaId,
        locationId,
        riskClass,
        isMobile: String(isMobile) === 'true',
        manufacturer,
        acquisitionType,
        contractText,
        acquisitionDate,
        usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : null,
        warrantyYears: warrantyYears ? Number(warrantyYears) : null,
        supplierName,
        supplierPhone,
        supplierEmail,
        powerType,
        voltage,
        tempMin: tempMin ? Number(tempMin) : null,
        tempMax: tempMax ? Number(tempMax) : null,
        humidityMin: humidityMin ? Number(humidityMin) : null,
        humidityMax: humidityMax ? Number(humidityMax) : null,
        maintenanceFrequency,
        requiresCalibration: String(requiresCalibration) === 'true',
        calibrationFrequency,
        hvEngineerUserId
      });

      if (req.files?.photo?.[0]) {
        const dir = await ensureClientLogoDir(clientId);
        const assetDir = path.join(dir, 'assets', assetId);
        await fs.promises.mkdir(assetDir, { recursive: true });
        const filename = path.join('uploads', 'clients', clientId, 'assets', assetId, 'photo.png');
        const fullPath = path.join(process.cwd(), filename);
        await sharp(req.files.photo[0].buffer)
          .resize(600, 600, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toFile(fullPath);
        await setAssetPhoto(clientId, assetId, `/${filename}`);
      }

      const docs = [];
      const dir = await ensureClientLogoDir(clientId);
      const assetDir = path.join(dir, 'assets', assetId);
      await fs.promises.mkdir(assetDir, { recursive: true });
      if (req.files?.manualOperacion?.[0]) {
        const filename = path.join('uploads', 'clients', clientId, 'assets', assetId, 'manual_operacion.pdf');
        const fullPath = path.join(process.cwd(), filename);
        await fs.promises.writeFile(fullPath, req.files.manualOperacion[0].buffer);
        docs.push({ doc_type: 'manual_operacion', file_path: `/${filename}` });
      }
      if (req.files?.manualServicio?.[0]) {
        const filename = path.join('uploads', 'clients', clientId, 'assets', assetId, 'manual_servicio.pdf');
        const fullPath = path.join(process.cwd(), filename);
        await fs.promises.writeFile(fullPath, req.files.manualServicio[0].buffer);
        docs.push({ doc_type: 'manual_servicio', file_path: `/${filename}` });
      }
      if (docs.length) {
        await replaceDocuments(clientId, assetId, docs);
      }

      const accessoriesList = parseJsonArray(accessories);
      const cleaningList = parseJsonArray(cleaning);
      const recommendationsList = parseJsonArray(recommendations);
      await replaceAccessories(clientId, assetId, accessoriesList);
      await replaceCleaning(clientId, assetId, cleaningList);
      await replaceRecommendations(clientId, assetId, recommendationsList);

      const updatedAsset = await getAssetById(clientId, assetId);
      await logEquipmentAudit(req, {
        action: 'ASSET_UPDATE',
        clientId,
        assetId,
        asset: updatedAsset,
        description: `Edición de hoja de vida del equipo ${assetLabel(updatedAsset)}.`,
        details: {
          eventType: 'hoja_vida_editada',
          changedFields: changedAssetFields(beforeAsset, updatedAsset),
          uploadedFiles: {
            photo: Boolean(req.files?.photo?.[0]),
            manualOperacion: Boolean(req.files?.manualOperacion?.[0]),
            manualServicio: Boolean(req.files?.manualServicio?.[0])
          }
        }
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo actualizar la hoja de vida.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets/:assetId/move',
  requireAuth,
  requirePermission('inventory:move'),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const { code, siteId, areaId, locationId, notes } = req.body || {};
    if (!siteId || !areaId || !locationId) {
      return res.status(400).json({ message: 'Sede, área y ubicación son obligatorias para mover el equipo.' });
    }

    try {
      const [sites, areas, locations] = await Promise.all([
        listSites(clientId),
        listAreas(clientId),
        listLocations(clientId)
      ]);
      const site = sites.find((item) => item.id === siteId);
      const area = areas.find((item) => item.id === areaId);
      const location = locations.find((item) => item.id === locationId);
      if (!site || !area || area.site_id !== siteId || !location || location.area_id !== areaId) {
        return res.status(400).json({ message: 'La sede, área o ubicación no corresponde al cliente seleccionado.' });
      }

      const { before, after } = await moveAsset(clientId, assetId, {
        code: String(code || '').trim(),
        siteId,
        areaId,
        locationId
      });

      const movement = await createAssetMovement(clientId, {
        before,
        after,
        movedBy: req.user.sub,
        movedByName: req.user.displayName || req.user.username,
        movedByRole: primaryRole(req.user),
        notes: String(notes || '').trim()
      });

      const client = await getClientById(clientId);
      const dir = await ensureClientLogoDir(clientId);
      const movementDir = path.join(dir, 'assets', assetId, 'movements');
      await fs.promises.mkdir(movementDir, { recursive: true });
      const filename = path.join('uploads', 'clients', clientId, 'assets', assetId, 'movements', `${movement.id}.pdf`);
      const fullPath = path.join(process.cwd(), filename);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);
      buildAssetMovementPdf(doc, { client, asset: after, movement });
      doc.end();
      await finished(stream);
      const publicPath = `/${filename}`.replace(/\\/g, '/');
      await updateAssetMovementPdf(clientId, movement.id, publicPath);

      await logEquipmentAudit(req, {
        action: 'ASSET_MOVE',
        clientId,
        assetId,
        asset: after,
        description: `Movimiento de equipo ${assetLabel(after)}.`,
        details: {
          eventType: 'equipo_movido',
          movementId: movement.id,
          from: {
            code: before.code,
            site: before.site_name,
            area: before.area_name,
            location: before.location_name
          },
          to: {
            code: after.code,
            site: after.site_name,
            area: after.area_name,
            location: after.location_name
          },
          pdfPath: publicPath
        }
      });

      return res.status(201).json({ ok: true, movementId: movement.id, pdfPath: publicPath });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo mover el equipo.' });
    }
  }
);

app.get(
  '/biomed/:clientId/assets/:assetId/movements',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all', 'inventory:move']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const limit = Math.min(Number(req.query.limit || 4), 25);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const rows = await listAssetMovements(clientId, assetId, limit, offset);
    return res.json(rows);
  }
);

app.get(
  '/biomed/:clientId/assets/:assetId/history',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all', 'inventory:move', 'maintenance:report:create', 'maintenance:report:sign']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    try {
      const limit = Math.min(Number(req.query.limit || 4), 25);
      const offset = Math.max(Number(req.query.offset || 0), 0);
      const rows = await listAssetHistory(clientId, assetId, {
        from: req.query.from || null,
        to: req.query.to || null,
        order: req.query.order || 'asc',
        limit,
        offset
      });
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo cargar el historial del equipo.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets/:assetId/history-files',
  requireAuth,
  requirePermission('asset_history:upload'),
  upload.single('file'),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo PDF requerido.' });
    }
    if (!isPdfUploadFile(req.file)) {
      return res.status(400).json({ message: 'Solo se permiten archivos PDF.' });
    }
    const documentDate = String(req.body?.documentDate || '').trim();
    if (!documentDate || Number.isNaN(new Date(documentDate).getTime())) {
      return res.status(400).json({ message: 'La fecha del documento es obligatoria.' });
    }

    try {
      const asset = await getAssetById(clientId, assetId);
      if (!asset) {
        return res.status(404).json({ message: 'Equipo no encontrado.' });
      }

      const dir = await ensureClientLogoDir(clientId);
      const historyDir = path.join(dir, 'assets', assetId, 'history');
      await fs.promises.mkdir(historyDir, { recursive: true });
      const filename = path.join(
        'uploads',
        'clients',
        clientId,
        'assets',
        assetId,
        'history',
        `historico-${Date.now()}-${randomUUID()}.pdf`
      );
      const fullPath = path.join(process.cwd(), filename);
      await fs.promises.writeFile(fullPath, req.file.buffer);
      const publicPath = `/${filename}`.replace(/\\/g, '/');

      const historyFile = await createAssetHistoryFile(clientId, {
        assetId,
        title: String(req.body?.title || '').trim() || 'Mantenimiento histórico migrado',
        description: String(req.body?.description || '').trim() || null,
        documentDate,
        filePath: publicPath,
        uploadedBy: req.user.sub,
        uploadedByName: req.user.displayName || req.user.username
      });

      await logEquipmentAudit(req, {
        action: 'ASSET_HISTORY_FILE_UPLOAD',
        clientId,
        assetId,
        asset,
        description: `Carga de PDF histórico para ${assetLabel(asset)}.`,
        details: {
          eventType: 'pdf_historico_cargado',
          historyFileId: historyFile.id,
          documentDate,
          pdfPath: publicPath
        }
      });

      return res.status(201).json(historyFile);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo cargar el PDF histórico.' });
    }
  }
);

app.get(
  '/biomed/:clientId/asset-history-files/:fileId/pdf',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all', 'inventory:move', 'maintenance:report:create', 'maintenance:report:sign']),
  async (req, res) => {
    const { clientId, fileId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const file = await getAssetHistoryFileById(clientId, fileId);
    if (!file) {
      return res.status(404).json({ message: 'PDF histórico no encontrado.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, file.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const fullPath = path.join(process.cwd(), file.file_path.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"historico-${fileId}.pdf\"`);
    return res.sendFile(fullPath);
  }
);

app.delete(
  '/biomed/:clientId/asset-history-files/:fileId',
  requireAuth,
  requirePermission('hb:create'),
  async (req, res) => {
    const { clientId, fileId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const file = await deleteAssetHistoryFile(clientId, fileId);
    if (!file) {
      return res.status(404).json({ message: 'PDF histórico no encontrado.' });
    }
    const fullPath = path.join(process.cwd(), file.file_path.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      await fs.promises.rm(fullPath, { force: true });
    }
    const asset = await getAssetById(clientId, file.asset_id);
    await logEquipmentAudit(req, {
      action: 'ASSET_HISTORY_FILE_DELETE',
      clientId,
      assetId: file.asset_id,
      asset,
      description: `Eliminación de PDF histórico para ${assetLabel(asset)}.`,
      details: {
        eventType: 'pdf_historico_eliminado',
        historyFileId: file.id,
        documentDate: file.document_date,
        pdfPath: file.file_path
      }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/biomed/:clientId/asset-movements/:movementId/pdf',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all', 'inventory:move']),
  async (req, res) => {
    const { clientId, movementId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const movement = await getAssetMovementById(clientId, movementId);
    if (!movement) {
      return res.status(404).json({ message: 'Movimiento no encontrado.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, movement.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    if (!movement.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const fullPath = path.join(process.cwd(), movement.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"movimiento-${movementId}.pdf\"`);
    return res.sendFile(fullPath);
  }
);

app.delete(
  '/biomed/:clientId/assets/:assetId',
  requireAuth,
  requireAnyPermission(['hb:create', 'inventory:move']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const asset = await getAssetById(clientId, assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    if (!req.user.permissions?.includes('hb:create')) {
      const canRemoveRetiredAsset = req.user.roles?.includes('almacenista') && asset?.status === 'dado_de_baja';
      if (!canRemoveRetiredAsset) {
        return res.status(403).json({
          message: 'Solo puedes retirar equipos que ya estén dados de baja.'
        });
      }
    }
    await deleteAsset(clientId, assetId);
    await logEquipmentAudit(req, {
      action: 'ASSET_DELETE',
      clientId,
      assetId,
      asset,
      description: `Eliminación del equipo ${assetLabel(asset)} y su hoja de vida.`,
      details: {
        eventType: 'hoja_vida_eliminada',
        deletedAsset: assetSnapshot(asset)
      }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/biomed/:clientId/assets/:assetId/pdf',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const client = await getClientById(clientId);
    let asset = await getAssetById(clientId, assetId);
    if (!client || !asset) {
      return res.status(404).json({ message: 'No encontrado.' });
    }
    asset = await backfillHvEngineerFromAudit(clientId, asset);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"hv-${asset.code}.pdf\"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    buildAssetPdf(doc, { client, asset });
    doc.end();
  }
);

app.get(
  '/biomed/:clientId/assets/:assetId',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const asset = await getAssetById(clientId, assetId);
    if (!asset) {
      return res.status(404).json({ message: 'No encontrado.' });
    }
    return res.json(asset);
  }
);

app.get(
  '/biomed/:clientId/sites',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const sites = await listSites(clientId);
      return res.json(sites);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las sedes.' });
    }
  }
);

app.post(
  '/biomed/:clientId/sites',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    const { name, address } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const result = await createSite(clientId, name, address);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'SITE_CREATE',
        targetUserId: clientId,
        details: { clientId, name, address }
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear la sede.' });
    }
  }
);

app.put(
  '/biomed/:clientId/sites/:siteId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, siteId } = req.params;
    const { name, address } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await updateSite(clientId, siteId, { name, address });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'SITE_UPDATE',
      targetUserId: clientId,
      details: { clientId, siteId, name, address }
    });
    return res.json({ ok: true });
  }
);

app.delete(
  '/biomed/:clientId/sites/:siteId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, siteId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      await deleteSite(clientId, siteId);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'SITE_DELETE',
        targetUserId: clientId,
        details: { clientId, siteId }
      });
      return res.json({ ok: true });
    } catch (error) {
      if (error.message === 'SITE_IN_USE') {
        return res.status(400).json({ message: 'No se puede eliminar una sede con áreas o equipos asociados.' });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo eliminar la sede.' });
    }
  }
);

app.get(
  '/biomed/:clientId/areas',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const areas = await listAreas(clientId);
      return res.json(areas);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las áreas.' });
    }
  }
);

app.post(
  '/biomed/:clientId/areas',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    const { name, siteId } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const result = await createArea(clientId, name, siteId || null);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'AREA_CREATE',
        targetUserId: clientId,
        details: { clientId, name, siteId: siteId || null }
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear el área.' });
    }
  }
);

app.put(
  '/biomed/:clientId/areas/:areaId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, areaId } = req.params;
    const { name, siteId } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await updateArea(clientId, areaId, { name, siteId: siteId || null });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'AREA_UPDATE',
      targetUserId: clientId,
      details: { clientId, areaId, name, siteId: siteId || null }
    });
    return res.json({ ok: true });
  }
);

app.delete(
  '/biomed/:clientId/areas/:areaId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, areaId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await deleteArea(clientId, areaId);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'AREA_DELETE',
      targetUserId: clientId,
      details: { areaId }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/biomed/:clientId/locations',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    const { areaId } = req.query;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const locations = await listLocations(clientId, areaId);
      return res.json(locations);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las ubicaciones.' });
    }
  }
);

app.post(
  '/biomed/:clientId/locations',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    const { areaId, name } = req.body || {};
    if (!areaId || !name) {
      return res.status(400).json({ message: 'Datos incompletos.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const result = await createLocation(clientId, areaId, name);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'LOCATION_CREATE',
        targetUserId: clientId,
        details: { name }
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear la ubicación.' });
    }
  }
);

app.put(
  '/biomed/:clientId/locations/:locationId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, locationId } = req.params;
    const { name, areaId } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await updateLocation(clientId, locationId, { name, areaId });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'LOCATION_UPDATE',
      targetUserId: clientId,
      details: { locationId, name }
    });
    return res.json({ ok: true });
  }
);

app.delete(
  '/biomed/:clientId/locations/:locationId',
  requireAuth,
  requirePermission('areas:manage'),
  async (req, res) => {
    const { clientId, locationId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await deleteLocation(clientId, locationId);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'LOCATION_DELETE',
      targetUserId: clientId,
      details: { locationId }
    });
    return res.json({ ok: true });
  }
);

app.patch('/admin/users/:id/role', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { role } = req.body || {};
  if (!role) {
    return res.status(400).json({ message: 'Rol requerido.' });
  }

  try {
    if (role === 'ingeniero_biomedico') {
      const targetUser = await getUserById(req.params.id);
      if (!targetUser?.document_type || !targetUser?.document_number || !targetUser?.invima_registration) {
        return res.status(400).json({
          message: 'Para asignar ingeniero biomédico, primero completa documento e INVIMA del usuario.'
        });
      }
    }
    const { before } = await updateUserRole(req.params.id, role);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_ROLE_UPDATE',
      targetUserId: req.params.id,
      targetUsername: before?.username,
      details: { newRole: role }
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el rol.' });
  }
});

app.patch('/admin/users/:id', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { displayName, email, clientId, documentType, documentNumber, invimaRegistration } = req.body || {};
  if (!displayName || !email) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  const cleanDocumentType = documentType?.trim?.() || null;
  const cleanDocumentNumber = documentNumber?.trim?.() || null;
  const cleanInvimaRegistration = invimaRegistration?.trim?.() || null;
  if (cleanDocumentType && !BIOMED_DOCUMENT_TYPES.includes(cleanDocumentType)) {
    return res.status(400).json({ message: 'Tipo de documento inválido.' });
  }
  if (!cleanDocumentType || !cleanDocumentNumber) {
    return res.status(400).json({ message: 'Tipo de documento y número de documento son obligatorios.' });
  }
  const { rows: roleRows } = await query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [req.params.id]
  );
  const isBiomedicalEngineer = roleRows.some((row) => row.name === 'ingeniero_biomedico');
  if (isBiomedicalEngineer && !cleanInvimaRegistration) {
    return res.status(400).json({ message: 'Registro INVIMA obligatorio para el ingeniero biomédico.' });
  }
  await updateUserProfile(req.params.id, {
    displayName,
    email,
    clientId,
    documentType: cleanDocumentType,
    documentNumber: cleanDocumentNumber,
    invimaRegistration: isBiomedicalEngineer ? cleanInvimaRegistration : null
  });
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'USER_UPDATE',
    targetUserId: req.params.id,
    details: {
      displayName,
      email,
      clientId: clientId ?? null,
      documentType: documentType ?? null,
      hasInvimaRegistration: Boolean(invimaRegistration)
    }
  });
  return res.json({ ok: true });
});

app.get('/admin/users/:id/reader-access', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const clientId = req.query.clientId;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ message: 'clientId requerido.' });
  }
  const rows = await listReaderAccess(req.params.id, clientId);
  return res.json(rows);
});

app.post('/admin/users/:id/reader-access', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const { clientId, areaIds, locationIds } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ message: 'clientId requerido.' });
  }
  const safeAreaIds = Array.isArray(areaIds) ? areaIds : [];
  const safeLocationIds = Array.isArray(locationIds) ? locationIds : [];
  await replaceReaderAccess(req.params.id, clientId, safeAreaIds, safeLocationIds);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'READER_ACCESS_UPDATE',
    targetUserId: req.params.id,
    details: { clientId, areaIds: safeAreaIds, locationIds: safeLocationIds }
  });
  return res.json({ ok: true });
});

app.post(
  '/admin/users/:id/signature',
  requireAuth,
  requirePermission('users:manage'),
  upload.single('signature'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Firma requerida.' });
    }
    if (!isAllowedSignatureFile(req.file)) {
      return res.status(400).json({
        message: 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.'
      });
    }
    try {
      const signaturePath = await saveUserSignature(req.params.id, req.file);
      await updateUserSignature(req.params.id, signaturePath);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'USER_SIGNATURE_UPDATE',
        targetUserId: req.params.id,
        details: { signaturePath }
      });
      return res.json({ ok: true, signaturePath });
    } catch (error) {
      console.error(error);
      return res.status(400).json({
        message: 'No se pudo procesar la firma. Sube una imagen clara con fondo blanco o un PDF con la firma en la primera página.'
      });
    }
  }
);

app.delete('/admin/users/:id', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  await deleteUser(req.params.id);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'USER_DELETE',
    targetUserId: req.params.id
  });
  return res.json({ ok: true });
});

app.patch(
  '/admin/users/:id/active',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Estado inválido.' });
    }

    const { before } = await updateUserActive(req.params.id, isActive);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_ACTIVE_UPDATE',
      targetUserId: req.params.id,
      targetUsername: before?.username,
      details: { isActive }
    });
    return res.json({ ok: true });
  }
);

app.patch(
  '/admin/users/:id/password',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ message: 'Contraseña requerida.' });
    }

    const { before } = await updateUserPassword(req.params.id, password);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_PASSWORD_RESET',
      targetUserId: req.params.id,
      targetUsername: before?.username,
      details: {}
    });
    return res.json({ ok: true });
  }
);

app.get('/admin/audit', requireAuth, requirePermission('users:manage'), async (_req, res) => {
  const logs = await listAuditLogs(500);
  return res.json(logs);
});

app.get(
  '/maintenance/requests/:clientId',
  requireAuth,
  requireAnyPermission(['maintenance:request:create', 'maintenance:report:create', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await syncDueScheduleRequests(clientId, req.user.sub);
    await sendPreventiveReminders(clientId);
    const rows = req.user.roles?.includes('lector')
      ? await listMaintenanceRequestsForReader(clientId, req.user.sub)
      : await listMaintenanceRequests(clientId);
    return res.json(rows);
  }
);

app.post(
  '/maintenance/requests',
  requireAuth,
  requirePermission('maintenance:request:create'),
  async (req, res) => {
    const { assetId, type, description, clientId: bodyClientId } = req.body || {};
    const clientId = req.user.clientId ?? bodyClientId;
    if (!clientId || !assetId || !type) {
      return res.status(400).json({ message: 'Datos incompletos.' });
    }
    if (!['preventivo', 'correctivo'].includes(type)) {
      return res.status(400).json({ message: 'Tipo inválido.' });
    }
    if (type === 'preventivo' && (req.user.roles?.includes('lector') || req.user.roles?.includes('almacenista'))) {
      return res.status(403).json({ message: 'No puedes solicitar mantenimiento preventivo.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const requestedAsset = await getAssetById(clientId, assetId);
    if (!requestedAsset) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    if (requestedAsset.status === 'dado_de_baja') {
      return res.status(400).json({
        message: 'Este equipo está dado de baja y no permite nuevas solicitudes de mantenimiento.'
      });
    }

    const result = await createMaintenanceRequest({
      clientId,
      assetId,
      type,
      description,
      requestedBy: req.user.sub
    });

    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REQUEST_CREATE',
      clientId,
      assetId,
      asset: requestedAsset,
      description: `Solicitud de mantenimiento ${type} creada para ${assetLabel(requestedAsset)}.`,
      details: {
        eventType: 'solicitud_mantenimiento_creada',
        requestId: result.id,
        maintenanceType: type,
        requestDescription: description ?? null
      }
    });

    const engineers = await listUsersByRoleAndClient('ingeniero_biomedico', clientId);
    for (const engineer of engineers) {
      const title = 'Nueva solicitud de mantenimiento';
      const message = `Se creó una solicitud ${type} para ${assetLabel(requestedAsset)}.${description ? ` Descripción: ${description}` : ''}`;
      await createNotification({
        userId: engineer.id,
        clientId,
        title,
        message,
        link: '/mantenimiento',
        type: 'maintenance_request_created',
        priority: 'high',
        data: {
          requestId: result.id,
          assetId,
          maintenanceType: type
        }
      });
      if (engineer.email) {
        try {
          await sendNotificationEmail({
            to: engineer.email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
        }
      }
    }

    return res.status(201).json(result);
  }
);

app.post(
  '/maintenance/requests/:id/assign',
  requireAuth,
  requirePermission('maintenance:report:create'),
  async (req, res) => {
    const requestId = req.params.id;
    const request = await getMaintenanceRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== request.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const assignedTo = req.body?.assignedTo ?? req.user.sub;
    if (!req.user.roles?.includes('superuser') && assignedTo !== req.user.sub) {
      return res.status(403).json({ message: 'Solo puedes asignarte a ti mismo.' });
    }
    await assignMaintenanceRequest(requestId, assignedTo);
    return res.json({ ok: true });
  }
);

app.get(
  '/maintenance/reports/:clientId',
  requireAuth,
  requireAnyPermission(['maintenance:report:create', 'maintenance:report:sign', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { assetId, from, to, order, limit, offset } = req.query;
    const parsedLimit = limit ? Math.min(Number(limit) || 0, 100) : undefined;
    const parsedOffset = offset ? Math.max(Number(offset) || 0, 0) : undefined;
    if (req.user.roles?.includes('lector') && assetId) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.json([]);
      }
    }
    const rows = req.user.roles?.includes('lector')
      ? await listMaintenanceReportsForReader(clientId, req.user.sub, { assetId, from, to, order, limit: parsedLimit, offset: parsedOffset })
      : await listMaintenanceReports(clientId, { assetId, from, to, order, limit: parsedLimit, offset: parsedOffset });
    const signatures = await listReportSignaturesByReports(rows.map((r) => r.id));
    const byReport = new Map();
    for (const sig of signatures) {
      if (!byReport.has(sig.report_id)) byReport.set(sig.report_id, []);
      byReport.get(sig.report_id).push(sig);
    }
    const enriched = rows.map((report) => {
      const sigs = byReport.get(report.id) || [];
      const signedByMe = sigs.some((sig) => sig.user_id === req.user.sub);
      const hasEngineer = sigs.some((sig) => sig.role === 'ingeniero_biomedico');
      const hasRequester = sigs.some((sig) => sig.user_id === report.requested_by);
      return {
        ...report,
        signed_by_me: signedByMe,
        is_fully_signed: hasEngineer && hasRequester
      };
    });
    return res.json(enriched);
  }
);

app.post(
  '/maintenance/reports',
  requireAuth,
  requirePermission('maintenance:report:create'),
  async (req, res) => {
    const {
      requestId,
      summary,
      findings,
      actionsTaken,
      assetStatusAfter,
      assetLifecycleAction,
      requiresSpareParts,
      sparePartsNeeded,
      sparePartsStatus
    } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ message: 'Solicitud requerida.' });
    }
    const cleanAssetStatus = MAINTENANCE_ASSET_STATUSES.includes(assetStatusAfter)
      ? assetStatusAfter
      : 'operativo';
    const cleanLifecycleAction = assetLifecycleAction === 'retire' ? 'retire' : null;
    const cleanRequiresSpareParts = Boolean(requiresSpareParts);
    const cleanSparePartsStatus = cleanRequiresSpareParts
      ? (MAINTENANCE_SPARE_STATUSES.includes(sparePartsStatus) ? sparePartsStatus : 'solicitado')
      : 'no_aplica';
    const cleanSparePartsNeeded = String(sparePartsNeeded || '').trim();
    if (cleanRequiresSpareParts && !cleanSparePartsNeeded) {
      return res.status(400).json({ message: 'Describe el repuesto requerido.' });
    }
    const requestStatusAfter = cleanRequiresSpareParts && cleanSparePartsStatus !== 'recibido'
      ? 'espera_repuesto'
      : 'reportado';
    const request = await getMaintenanceRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== request.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const result = await createMaintenanceReport({
      clientId: request.client_id,
      requestId,
      assetId: request.asset_id,
      type: request.type,
      summary,
      findings,
      actionsTaken,
      assetStatusAfter: cleanAssetStatus,
      requiresSpareParts: cleanRequiresSpareParts,
      sparePartsNeeded: cleanRequiresSpareParts ? cleanSparePartsNeeded : null,
      sparePartsStatus: cleanSparePartsStatus,
      requestStatusAfter,
      createdBy: req.user.sub
    });

    const assetStatusToPersist = cleanLifecycleAction === 'retire' ? 'dado_de_baja' : cleanAssetStatus;
    await updateAssetStatus(request.client_id, request.asset_id, assetStatusToPersist);

    const reportAsset = await getAssetById(request.client_id, request.asset_id);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REPORT_CREATE',
      clientId: request.client_id,
      assetId: request.asset_id,
      asset: reportAsset,
      description: `Reporte de mantenimiento ${request.type} creado para ${assetLabel(reportAsset)}.`,
      details: {
        eventType: 'reporte_mantenimiento_creado',
        reportId: result.id,
        requestId,
        maintenanceType: request.type,
        summary: summary ?? null,
        findings: findings ?? null,
        assetStatusAfter: cleanAssetStatus,
        assetLifecycleAction: cleanLifecycleAction,
        assetStatusPersisted: assetStatusToPersist,
        requiresSpareParts: cleanRequiresSpareParts,
        sparePartsNeeded: cleanRequiresSpareParts ? cleanSparePartsNeeded : null,
        sparePartsStatus: cleanSparePartsStatus
      }
    });

    const engineer = await getUserById(req.user.sub);
    if (engineer?.signature_path) {
      await signMaintenanceReport({
        reportId: result.id,
        userId: req.user.sub,
        role: req.user.roles?.[0] ?? 'ingeniero_biomedico',
        signaturePath: engineer.signature_path
      });
    }

    await writeMaintenanceReportPdfFile(result.id);

    if (request.type === 'preventivo' && requestStatusAfter !== 'espera_repuesto') {
      const year = new Date().getFullYear();
      const schedules = await listSchedules(request.client_id, year);
      if (schedules.length) {
        const schedule = schedules[0];
        const item = await findScheduleItemForAsset(schedule.id, request.asset_id, new Date());
        if (item) {
          await markScheduleItemDone(schedule.id, item.id, result.id);
          await setScheduleClosedIfDone(schedule.id);
        }
      }
    }

    if (requestStatusAfter === 'espera_repuesto') {
      const storekeepers = await listUsersByRoleAndClient('almacenista', request.client_id);
      for (const storekeeper of storekeepers) {
        const title = 'Solicitud de repuesto';
        const message = `El equipo ${assetLabel(reportAsset)} requiere repuesto: ${cleanSparePartsNeeded}. El caso queda en espera de repuestos.`;
        await createNotificationOnce({
          userId: storekeeper.id,
          clientId: request.client_id,
          title,
          message,
          link: '/mantenimiento',
          type: 'maintenance_spare_part_requested',
          priority: 'high',
          data: {
            reportId: result.id,
            requestId,
            assetId: request.asset_id,
            sparePartsNeeded: cleanSparePartsNeeded
          }
        });
        if (storekeeper.email) {
          try {
            await sendNotificationEmail({
              to: storekeeper.email,
              subject: title,
              text: message
            });
          } catch (error) {
            console.error('Email notificación falló', error);
          }
        }
      }
    } else if (request.requested_by) {
      const title = 'Reporte de mantenimiento listo';
      const message = `Se generó el reporte ${request.type}. Requiere tu firma.`;
      await createNotification({
        userId: request.requested_by,
        clientId: request.client_id,
        title,
        message,
        link: '/mantenimiento',
        type: 'maintenance_report_ready',
        priority: 'high',
        data: {
          reportId: result.id,
          requestId,
          assetId: request.asset_id,
          maintenanceType: request.type
        }
      });
      if (request.requester_email) {
        try {
          await sendNotificationEmail({
            to: request.requester_email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
        }
      }
    }

    return res.status(201).json(result);
  }
);

app.post(
  '/maintenance/reports/:id/sign',
  requireAuth,
  requirePermission('maintenance:report:sign'),
  async (req, res) => {
    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (report.requires_spare_parts && report.spare_parts_status !== 'recibido') {
      return res.status(400).json({
        message: 'Este reporte queda en espera de repuesto. Se firma cuando se registre la instalación del repuesto.'
      });
    }
    const user = await getUserById(req.user.sub);
    if (!user?.signature_path) {
      return res.status(400).json({ message: 'Firma no registrada para este usuario.' });
    }

    const existingSignatures = await listReportSignatures(report.id);
    if (existingSignatures.some((sig) => sig.user_id === req.user.sub)) {
      return res.status(409).json({ message: 'Ya firmaste este reporte.' });
    }

    const result = await signMaintenanceReport({
      reportId: report.id,
      userId: req.user.sub,
      role: req.user.roles?.[0] ?? 'user',
      signaturePath: user.signature_path
    });

    const signedAsset = await getAssetById(report.client_id, report.asset_id);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REPORT_SIGN',
      clientId: report.client_id,
      assetId: report.asset_id,
      asset: signedAsset,
      description: `Firma de reporte de mantenimiento para ${assetLabel(signedAsset)}.`,
      details: {
        eventType: 'reporte_mantenimiento_firmado',
        reportId: report.id,
        requestId: report.request_id,
        signerRole: req.user.roles?.[0] ?? 'user',
        signatureId: result?.id ?? null
      }
    });

    const signatures = await listReportSignatures(report.id);
    const hasEngineer = signatures.some((sig) => sig.role === 'ingeniero_biomedico');
    const hasRequester = signatures.some((sig) => sig.user_id === report.requested_by);
    if (!hasEngineer) {
      const engineerUser = await getUserById(report.created_by);
      if (engineerUser?.signature_path) {
        await signMaintenanceReport({
          reportId: report.id,
          userId: report.created_by,
          role: 'ingeniero_biomedico',
          signaturePath: engineerUser.signature_path
        });
      }
    }
    const signaturesAfter = await listReportSignatures(report.id);
    const hasEngineerFinal = signaturesAfter.some((sig) => sig.role === 'ingeniero_biomedico');
    const hasRequesterFinal = signaturesAfter.some((sig) => sig.user_id === report.requested_by);
    if (hasEngineerFinal && hasRequesterFinal) {
      await updateMaintenanceRequestStatus(report.request_id, 'firmado');
      await markMaintenanceRequestNotificationsResolved(report.request_id);
      await logEquipmentAudit(req, {
        action: 'MAINTENANCE_REPORT_FINALIZED',
        clientId: report.client_id,
        assetId: report.asset_id,
        asset: signedAsset,
        description: `Reporte de mantenimiento finalizado para ${assetLabel(signedAsset)}.`,
        details: {
          eventType: 'reporte_mantenimiento_finalizado',
          reportId: report.id,
          requestId: report.request_id
        }
      });
    }

    const client = await getClientById(report.client_id);
    const asset = await getAssetById(report.client_id, report.asset_id);
    const request = await getMaintenanceRequestById(report.request_id);
    const signaturesForPdf = await listReportSignatures(report.id);
    if (client && asset && request) {
      const dir = path.join(process.cwd(), 'uploads', 'clients', report.client_id, 'maintenance');
      await fs.promises.mkdir(dir, { recursive: true });
      const filename = path.join(dir, `reporte-${report.id}.pdf`);
      const publicPath = `/${path.join('uploads', 'clients', report.client_id, 'maintenance', `reporte-${report.id}.pdf`)}`.replace(/\\/g, '/');
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filename);
      doc.pipe(stream);
      buildMaintenanceReportPdf(doc, { client, asset, request, report, signatures: signaturesForPdf });
      doc.end();
      await new Promise((resolve) => stream.on('finish', resolve));
      await updateMaintenanceReportPdf(report.id, publicPath);
    }

    if (report.created_by) {
      const title = 'Reporte firmado';
      const message = 'El reporte fue firmado y queda finalizado.';
      await createNotification({
        userId: report.created_by,
        clientId: report.client_id,
        title,
        message,
        link: '/mantenimiento',
        type: 'maintenance_report_signed',
        priority: 'normal',
        data: {
          reportId: report.id,
          requestId: report.request_id,
          assetId: report.asset_id
        }
      });
    }

    return res.json(result);
  }
);

async function writeMaintenanceReportPdfFile(reportId) {
  const report = await getMaintenanceReportById(reportId);
  if (!report) return null;
  const client = await getClientById(report.client_id);
  const asset = await getAssetById(report.client_id, report.asset_id);
  const request = await getMaintenanceRequestById(report.request_id);
  const signaturesForPdf = await listReportSignatures(report.id);
  if (!client || !asset || !request) return null;

  const dir = path.join(process.cwd(), 'uploads', 'clients', report.client_id, 'maintenance');
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = path.join(dir, `reporte-${report.id}.pdf`);
  const publicPath = `/${path.join('uploads', 'clients', report.client_id, 'maintenance', `reporte-${report.id}.pdf`)}`.replace(/\\/g, '/');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);
  buildMaintenanceReportPdf(doc, { client, asset, request, report, signatures: signaturesForPdf });
  doc.end();
  await finished(stream);
  await updateMaintenanceReportPdf(report.id, publicPath);
  return publicPath;
}

app.get(
  '/maintenance/reports/:id/pdf',
  requireAuth,
  requireAnyPermission(['maintenance:report:create', 'maintenance:report:sign', 'read:all']),
  async (req, res) => {
    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessAsset(report.client_id, req.user.sub, report.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const reportRow = report;
    if (!reportRow.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), reportRow.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reporte-${reportRow.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.delete(
  '/maintenance/reports/:id',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    await deleteMaintenanceReport(report.id);
    const reportAsset = await getAssetById(report.client_id, report.asset_id);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REPORT_DELETE',
      clientId: report.client_id,
      assetId: report.asset_id,
      asset: reportAsset,
      description: `Eliminación de reporte de mantenimiento para ${assetLabel(reportAsset)}.`,
      details: {
        eventType: 'reporte_mantenimiento_eliminado',
        reportId: report.id,
        requestId: report.request_id,
        maintenanceType: report.type ?? null
      }
    });
    return res.json({ ok: true });
  }
);

app.get('/maintenance/notifications', requireAuth, async (req, res) => {
  const rows = await listNotifications(req.user.sub);
  return res.json(rows);
});

app.post('/maintenance/notifications/:id/read', requireAuth, async (req, res) => {
  await markNotificationRead(req.params.id, req.user.sub);
  return res.json({ ok: true });
});

app.get('/notifications', requireAuth, async (req, res) => {
  const rows = await listNotifications(req.user.sub);
  return res.json(rows);
});

app.post('/notifications/:id/read', requireAuth, async (req, res) => {
  await markNotificationRead(req.params.id, req.user.sub);
  return res.json({ ok: true });
});

app.post('/notifications/read-all', requireAuth, async (req, res) => {
  await markAllNotificationsRead(req.user.sub);
  return res.json({ ok: true });
});

async function writeTrainingSchedulePdf({ client, schedule, items }) {
  const dir = path.join(process.cwd(), 'uploads', 'clients', schedule.client_id, 'trainings');
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = path.join(dir, `cronograma-capacitaciones-${schedule.id}.pdf`);
  const publicPath = `/${path.join('uploads', 'clients', schedule.client_id, 'trainings', `cronograma-capacitaciones-${schedule.id}.pdf`)}`.replace(/\\/g, '/');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);
  buildTrainingSchedulePdf(doc, { client, schedule, items });
  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));
  await setTrainingSchedulePdf(schedule.id, publicPath);
  return publicPath;
}

async function syncDueScheduleRequests(clientId, fallbackUserId) {
  const today = new Date().toISOString().slice(0, 10);
  const client = await getClientById(clientId);
  if (!client?.schema_name) return;
  const { rows } = await query(
    `SELECT i.id, i.asset_id, i.planned_date, i.deadline_date, s.created_by
     FROM maintenance_schedule_items i
     JOIN maintenance_schedules s ON s.id = i.schedule_id
     JOIN "${client.schema_name}".assets a ON a.id = i.asset_id
     WHERE s.client_id = $1
       AND s.status = 'approved'
       AND i.status <> 'done'
       AND COALESCE(a.status, 'activo') <> 'dado_de_baja'
       AND i.planned_date <= $2`,
    [clientId, today]
  );

  if (!rows.length) return;

  for (const item of rows) {
    const exists = await query(
      `SELECT 1
       FROM maintenance_requests
       WHERE client_id = $1
         AND asset_id = $2
         AND source = 'cronograma'
         AND planned_date = $3
       LIMIT 1`,
      [clientId, item.asset_id, item.planned_date]
    );
    if (exists.rows.length) {
      continue;
    }

    const result = await createMaintenanceRequest({
      clientId,
      assetId: item.asset_id,
      type: 'preventivo',
      description: 'Mantenimiento preventivo programado',
      plannedDate: item.planned_date,
      deadlineDate: item.deadline_date,
      source: 'cronograma',
      requestedBy: item.created_by ?? fallbackUserId
    });

    const engineers = await listUsersByRoleAndClient('ingeniero_biomedico', clientId);
    for (const engineer of engineers) {
      const title = 'Solicitud de mantenimiento preventivo';
      const message = 'Se generó una solicitud preventiva según cronograma.';
      await createNotification({
        userId: engineer.id,
        clientId,
        title,
        message,
        link: '/mantenimiento',
        type: 'maintenance_preventive_generated',
        priority: 'normal',
        data: {
          requestId: result.id,
          scheduleItemId: item.id,
          assetId: item.asset_id
        }
      });
    }
  }
}

const sendPreventiveReminders = sendPreventiveRemindersForClient;

async function writeSchedulePdf({ client, schedule, items }) {
  const dir = path.join(process.cwd(), 'uploads', 'clients', schedule.client_id, 'schedules');
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = path.join(dir, `cronograma-${schedule.id}.pdf`);
  const publicPath = `/${path.join('uploads', 'clients', schedule.client_id, 'schedules', `cronograma-${schedule.id}.pdf`)}`.replace(/\\/g, '/');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);
  buildMaintenanceSchedulePdf(doc, { client, schedule, items });
  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));
  await setSchedulePdf(schedule.id, publicPath);
  return publicPath;
}

app.get(
  '/maintenance/schedules/:clientId',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const year = req.query.year ? Number(req.query.year) : undefined;
    const rows = await listSchedules(clientId, year);
    return res.json(rows);
  }
);

app.post(
  '/maintenance/schedules/:clientId/generate',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { year, startDate } = req.body || {};
    if (!year || !startDate) {
      return res.status(400).json({ message: 'Año y fecha inicial requeridos.' });
    }

    const existing = await listSchedules(clientId, Number(year));
    if (existing.length && !req.user.roles?.includes('superuser')) {
      return res.status(409).json({ message: 'Ya existe un cronograma para este año.' });
    }
    if (existing.length && req.user.roles?.includes('superuser')) {
      for (const prev of existing) {
        if (prev.pdf_path) {
          const pdfPath = path.join(process.cwd(), prev.pdf_path.replace(/^\//, ''));
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        }
        await deleteSchedule(prev.id);
      }
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const schema = client.schema_name;
    const assetsResult = await query(
      `SELECT id, code, name, brand, model, serial, maintenance_frequency
       FROM "${schema}".assets
       WHERE maintenance_frequency IS NOT NULL
         AND COALESCE(status, 'activo') <> 'dado_de_baja'
       ORDER BY created_at ASC`
    );
    const assets = assetsResult.rows;
    if (!assets.length) {
      return res.status(400).json({ message: 'No hay equipos con periodicidad definida.' });
    }

    const schedule = await createSchedule({
      clientId,
      year: Number(year),
      startDate,
      createdBy: req.user.sub,
      pdfPath: null
    });

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Fecha inicial inválida.' });
    }
    start.setFullYear(Number(year));
    const items = [];
    for (const asset of assets) {
      const months = freqToMonths(asset.maintenance_frequency);
      if (!months) continue;
      let planned = adjustToWeekday(start);
      while (planned.getFullYear() === Number(year)) {
        const deadline = addBusinessDays(planned, 10);
        items.push({
          scheduleId: schedule.id,
          assetId: asset.id,
          frequency: asset.maintenance_frequency,
          plannedDate: planned.toISOString().slice(0, 10),
          deadlineDate: deadline.toISOString().slice(0, 10)
        });
        planned = adjustToWeekday(addMonths(planned, months));
      }
    }

    await insertScheduleItems(items);
    const scheduleItems = await listScheduleItemsWithSchema(schedule.id, schema);
    await writeSchedulePdf({ client, schedule: { ...schedule, client_id: clientId }, items: scheduleItems });
    return res.status(201).json({ id: schedule.id });
  }
);

app.get(
  '/maintenance/schedules/:id/items',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const client = await getClientById(schedule.client_id);
    const items = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
    return res.json(items);
  }
);

app.patch(
  '/maintenance/schedules/:id/items',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items inválidos.' });
    }
    const canEdit = req.user.roles?.includes('superuser') || (!schedule.engineer_edited && schedule.status !== 'approved');
    if (!canEdit) {
      return res.status(403).json({ message: 'Cronograma bloqueado para edición.' });
    }

    const normalized = items.map((item) => {
      const planned = adjustToWeekday(new Date(item.plannedDate));
      const deadline = addBusinessDays(planned, 10);
      return {
        id: item.id,
        plannedDate: planned.toISOString().slice(0, 10),
        deadlineDate: deadline.toISOString().slice(0, 10)
      };
    });
    await updateScheduleItems(normalized);
    if (!req.user.roles?.includes('superuser')) {
      await markEngineerEdited(schedule.id);
    }
    const client = await getClientById(schedule.client_id);
    const scheduleItems = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
    await writeSchedulePdf({ client, schedule, items: scheduleItems });
    return res.json({ ok: true });
  }
);

app.post(
  '/maintenance/schedules/:id/approve',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!req.user.roles?.includes('superuser') && schedule.status === 'approved') {
      return res.status(400).json({ message: 'Cronograma ya aprobado.' });
    }
    await approveSchedule(schedule.id);
    const client = await getClientById(schedule.client_id);
    if (client) {
      const scheduleItems = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
      await writeSchedulePdf({ client, schedule, items: scheduleItems });
    }
    return res.json({ ok: true });
  }
);

app.get(
  '/maintenance/schedules/:id/pdf',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!schedule.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), schedule.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cronograma-${schedule.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.delete(
  '/maintenance/schedules/:id',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (schedule.pdf_path) {
      const pdfPath = path.join(process.cwd(), schedule.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    }
    await deleteSchedule(schedule.id);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'SCHEDULE_DELETE',
      targetUserId: schedule.client_id,
      details: { scheduleId: schedule.id, year: schedule.year }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/training/schedules/:clientId',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const year = req.query.year ? Number(req.query.year) : undefined;
    const rows = await listTrainingSchedules(clientId, year);
    return res.json(rows);
  }
);

app.get(
  '/training/schedules/:id/pdf',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getTrainingScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!schedule.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), schedule.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cronograma-capacitaciones-${schedule.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.post(
  '/training/schedules/:clientId/generate',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { year, startDate, periodicity, areaIds } = req.body || {};
    if (!year || !startDate || !periodicity || !Array.isArray(areaIds) || !areaIds.length) {
      return res.status(400).json({ message: 'Datos incompletos.' });
    }
    const months = freqToMonths(periodicity);
    if (!months) {
      return res.status(400).json({ message: 'Periodicidad inválida.' });
    }

    const existing = await listTrainingSchedules(clientId, Number(year));
    if (existing.length && !req.user.roles?.includes('superuser')) {
      return res.status(409).json({ message: 'Ya existe un cronograma de capacitaciones para este año.' });
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }

    const schedule = await createTrainingSchedule({
      clientId,
      year: Number(year),
      startDate,
      periodicity,
      createdBy: req.user.sub
    });

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Fecha inicial inválida.' });
    }
    start.setFullYear(Number(year));

    const items = [];
    for (const areaId of areaIds) {
      let planned = adjustToWeekday(start);
      while (planned.getFullYear() === Number(year)) {
        items.push({
          scheduleId: schedule.id,
          areaId,
          plannedDate: planned.toISOString().slice(0, 10)
        });
        planned = adjustToWeekday(addMonths(planned, months));
      }
    }

    await insertTrainingItems(items);
    const scheduleItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
    await writeTrainingSchedulePdf({ client, schedule: { ...schedule, client_id: clientId, periodicity }, items: scheduleItems });
    return res.status(201).json({ id: schedule.id });
  }
);

app.get(
  '/training/schedules/:id/items',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getTrainingScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const client = await getClientById(schedule.client_id);
    const items = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
    const today = todayLocalISO();
    const normalized = items.map((item) => {
      const plannedDate = toLocalISODate(item.planned_date);
      return {
        ...item,
        display_status: item.pdf_path
          ? 'done'
          : plannedDate && plannedDate <= today
            ? 'active'
            : 'pending'
      };
    });
    return res.json(normalized);
  }
);

app.get(
  '/training/items/by-client/:clientId',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const year = req.query.year ? Number(req.query.year) : undefined;
    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const params = [clientId];
    let yearFilter = '';
    if (year) {
      params.push(year);
      yearFilter = ` AND s.year = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT i.id, i.schedule_id, i.area_id, i.planned_date, i.status, i.pdf_path,
              ar.name AS area_name
       FROM training_schedule_items i
       JOIN training_schedules s ON s.id = i.schedule_id
       LEFT JOIN "${client.schema_name}".areas ar ON ar.id = i.area_id
       WHERE s.client_id = $1${yearFilter}
       ORDER BY s.year DESC, i.planned_date ASC`,
      params
    );
    const today = todayLocalISO();
    const normalized = rows.map((item) => {
      const plannedDate = toLocalISODate(item.planned_date);
      return {
        ...item,
        display_status: item.pdf_path
          ? 'done'
          : plannedDate && plannedDate <= today
            ? 'active'
            : 'pending'
      };
    });
    return res.json(normalized);
  }
);

app.post(
  '/training/schedules/:id/approve',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getTrainingScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!req.user.roles?.includes('superuser') && schedule.status === 'approved') {
      return res.status(400).json({ message: 'Cronograma ya aprobado.' });
    }
    await approveTrainingSchedule(schedule.id);
    const client = await getClientById(schedule.client_id);
    if (client) {
      const scheduleItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
      await writeTrainingSchedulePdf({ client, schedule, items: scheduleItems });
    }
    return res.json({ ok: true });
  }
);

app.patch(
  '/training/schedules/:id/items',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getTrainingScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!req.user.roles?.includes('superuser') && schedule.status === 'approved') {
      return res.status(403).json({ message: 'Cronograma bloqueado para edición.' });
    }
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items inválidos.' });
    }
    const normalized = items.map((item) => ({
      id: item.id,
      plannedDate: item.plannedDate
    }));
    await updateTrainingItems(normalized);
    const client = await getClientById(schedule.client_id);
    if (client) {
      const scheduleItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
      await writeTrainingSchedulePdf({ client, schedule, items: scheduleItems });
    }
    return res.json({ ok: true });
  }
);

app.post(
  '/training/items/:id/upload',
  requireAuth,
  requirePermission('schedules:manage'),
  upload.single('pdf'),
  async (req, res) => {
    const itemId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo requerido.' });
    }
    const { rows } = await query(
      `SELECT i.id, i.schedule_id, i.area_id, s.client_id
       FROM training_schedule_items i
       JOIN training_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Capacitación no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== item.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessArea(item.client_id, req.user.sub, item.area_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al área.' });
      }
    }

    const dir = path.join(process.cwd(), 'uploads', 'clients', item.client_id, 'trainings');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = path.join(dir, `capacitacion-${item.id}.pdf`);
    await fs.promises.writeFile(filename, req.file.buffer);
    const publicPath = `/${path.join('uploads', 'clients', item.client_id, 'trainings', `capacitacion-${item.id}.pdf`)}`.replace(/\\/g, '/');
    await setTrainingItemPdf(item.id, publicPath);
    const client = await getClientById(item.client_id);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'TRAINING_RECORD_UPLOAD',
      targetUserId: item.client_id,
      targetUsername: client?.name ?? 'Cliente',
      details: {
        category: 'training',
        eventType: 'acta_capacitacion_cargada',
        description: `Carga de acta de capacitación para ${client?.name ?? 'cliente'}.`,
        actorDisplayName: req.user.displayName ?? req.user.username,
        actorUsername: req.user.username,
        clientId: item.client_id,
        clientName: client?.name ?? null,
        trainingItemId: item.id,
        scheduleId: item.schedule_id,
        areaId: item.area_id,
        pdfPath: publicPath
      }
    });
    return res.json({ ok: true, pdfPath: publicPath });
  }
);

app.get(
  '/training/items/:id/pdf',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const itemId = req.params.id;
    const { rows } = await query(
      `SELECT i.id, i.pdf_path, s.client_id, i.area_id
       FROM training_schedule_items i
       JOIN training_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Capacitación no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== item.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (req.user.roles?.includes('lector')) {
      const allowed = await readerCanAccessArea(item.client_id, req.user.sub, item.area_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al área.' });
      }
    }
    if (!item.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), item.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="capacitacion-${item.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.delete(
  '/training/items/:id/pdf',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const itemId = req.params.id;
    const { rows } = await query(
      `SELECT i.id, i.pdf_path, s.client_id
       FROM training_schedule_items i
       JOIN training_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Capacitación no encontrada.' });
    }
    if (item.pdf_path) {
      const pdfPath = path.join(process.cwd(), item.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    }
    await clearTrainingItemPdf(itemId);
    return res.json({ ok: true });
  }
);

app.delete(
  '/training/schedules/:id',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const schedule = await getTrainingScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    await deleteTrainingSchedule(schedule.id);
    return res.json({ ok: true });
  }
);

async function writeCalibrationSchedulePdf({ client, schedule, items }) {
  const dir = path.join(process.cwd(), 'uploads', 'clients', schedule.client_id, 'calibrations');
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = path.join(dir, `cronograma-calibracion-${schedule.id}.pdf`);
  const publicPath = `/${path.join('uploads', 'clients', schedule.client_id, 'calibrations', `cronograma-calibracion-${schedule.id}.pdf`)}`.replace(/\\/g, '/');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);
  buildCalibrationSchedulePdf(doc, { client, schedule, items });
  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));
  await setCalibrationSchedulePdf(schedule.id, publicPath);
  return publicPath;
}

app.get(
  '/calibration/schedules/:clientId',
  requireAuth,
  requireAnyPermission(['calibration:schedule:manage', 'calibration:report:upload', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const year = req.query.year ? Number(req.query.year) : undefined;
    const rows = await listCalibrationSchedules(clientId, year);
    return res.json(rows);
  }
);

app.get(
  '/calibration/schedules/:id/pdf',
  requireAuth,
  requireAnyPermission(['calibration:schedule:manage', 'calibration:report:upload', 'read:all']),
  async (req, res) => {
    const schedule = await getCalibrationScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!schedule.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), schedule.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cronograma-calibracion-${schedule.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.post(
  '/calibration/schedules/:clientId/generate',
  requireAuth,
  requirePermission('calibration:schedule:manage'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { year, startDate } = req.body || {};
    if (!year || !startDate) {
      return res.status(400).json({ message: 'Año y fecha inicial requeridos.' });
    }

    const existing = await listCalibrationSchedules(clientId, Number(year));
    if (existing.length && !req.user.roles?.includes('superuser')) {
      return res.status(409).json({ message: 'Ya existe un cronograma de calibración para este año.' });
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const schema = client.schema_name;
    const assetsResult = await query(
      `SELECT id, code, name, brand, model, serial, calibration_frequency, requires_calibration
       FROM "${schema}".assets
       WHERE requires_calibration = TRUE AND calibration_frequency IS NOT NULL
       ORDER BY created_at ASC`
    );
    const assets = assetsResult.rows;
    if (!assets.length) {
      return res.status(400).json({ message: 'No hay equipos con calibración definida.' });
    }

    const schedule = await createCalibrationSchedule({
      clientId,
      year: Number(year),
      startDate,
      createdBy: req.user.sub
    });

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Fecha inicial inválida.' });
    }
    start.setFullYear(Number(year));

    const items = [];
    for (const asset of assets) {
      const months = freqToMonths(asset.calibration_frequency);
      if (!months) continue;
      let planned = adjustToWeekday(start);
      while (planned.getFullYear() === Number(year)) {
        const deadline = addMonths(planned, 1);
        items.push({
          scheduleId: schedule.id,
          assetId: asset.id,
          frequency: asset.calibration_frequency,
          plannedDate: planned.toISOString().slice(0, 10),
          deadlineDate: deadline.toISOString().slice(0, 10)
        });
        planned = adjustToWeekday(addMonths(planned, months));
      }
    }

    await insertCalibrationItems(items);
    const scheduleItems = await listCalibrationItemsWithSchema(schedule.id, schema);
    await writeCalibrationSchedulePdf({ client, schedule: { ...schedule, client_id: clientId }, items: scheduleItems });
    return res.status(201).json({ id: schedule.id });
  }
);

app.get(
  '/calibration/schedules/:id/items',
  requireAuth,
  requireAnyPermission(['calibration:schedule:manage', 'calibration:report:upload', 'read:all']),
  async (req, res) => {
    const schedule = await getCalibrationScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const client = await getClientById(schedule.client_id);
    const items = await listCalibrationItemsWithSchema(schedule.id, client.schema_name);
    const today = todayLocalISO();
    const normalized = items.map((item) => {
      const planned = toLocalISODate(item.planned_date);
      const deadline = toLocalISODate(item.deadline_date);
      return {
        ...item,
        display_status: item.pdf_path
          ? 'done'
          : planned && deadline && planned <= today && today <= deadline
            ? 'active'
            : 'pending'
      };
    });
    return res.json(normalized);
  }
);

app.post(
  '/calibration/schedules/:id/approve',
  requireAuth,
  requirePermission('calibration:schedule:manage'),
  async (req, res) => {
    const schedule = await getCalibrationScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    await approveCalibrationSchedule(schedule.id);
    const client = await getClientById(schedule.client_id);
    if (client) {
      const scheduleItems = await listCalibrationItemsWithSchema(schedule.id, client.schema_name);
      await writeCalibrationSchedulePdf({ client, schedule, items: scheduleItems });
    }
    return res.json({ ok: true });
  }
);

app.post(
  '/calibration/items/:id/upload',
  requireAuth,
  requirePermission('calibration:report:upload'),
  upload.single('pdf'),
  async (req, res) => {
    const itemId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo requerido.' });
    }
    const { rows } = await query(
      `SELECT i.id, i.schedule_id, i.asset_id, s.client_id
       FROM calibration_schedule_items i
       JOIN calibration_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Calibración no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== item.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const dir = path.join(process.cwd(), 'uploads', 'clients', item.client_id, 'calibrations');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = path.join(dir, `calibracion-${item.id}.pdf`);
    await fs.promises.writeFile(filename, req.file.buffer);
    const publicPath = `/${path.join('uploads', 'clients', item.client_id, 'calibrations', `calibracion-${item.id}.pdf`)}`.replace(/\\/g, '/');
    await setCalibrationItemPdf(item.id, publicPath);
    const calibratedAsset = await getAssetById(item.client_id, item.asset_id);
    await logEquipmentAudit(req, {
      action: 'CALIBRATION_CERTIFICATE_UPLOAD',
      clientId: item.client_id,
      assetId: item.asset_id,
      asset: calibratedAsset,
      description: `Carga de certificado de calibración para ${assetLabel(calibratedAsset)}.`,
      details: {
        eventType: 'certificado_calibracion_cargado',
        calibrationItemId: item.id,
        scheduleId: item.schedule_id,
        pdfPath: publicPath
      }
    });
    return res.json({ ok: true, pdfPath: publicPath });
  }
);

app.get(
  '/calibration/items/:id/pdf',
  requireAuth,
  requireAnyPermission(['calibration:schedule:manage', 'calibration:report:upload', 'read:all']),
  async (req, res) => {
    const itemId = req.params.id;
    const { rows } = await query(
      `SELECT i.id, i.pdf_path, s.client_id
       FROM calibration_schedule_items i
       JOIN calibration_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Calibración no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== item.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (!item.pdf_path) {
      return res.status(404).json({ message: 'PDF no disponible.' });
    }
    const pdfPath = path.join(process.cwd(), item.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="calibracion-${item.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.delete(
  '/calibration/items/:id/pdf',
  requireAuth,
  requirePermission('calibration:schedule:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const itemId = req.params.id;
    const { rows } = await query(
      `SELECT i.id, i.pdf_path, s.client_id
       FROM calibration_schedule_items i
       JOIN calibration_schedules s ON s.id = i.schedule_id
       WHERE i.id = $1`,
      [itemId]
    );
    const item = rows[0];
    if (!item) {
      return res.status(404).json({ message: 'Calibración no encontrada.' });
    }
    if (item.pdf_path) {
      const pdfPath = path.join(process.cwd(), item.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    }
    await clearCalibrationItemPdf(itemId);
    return res.json({ ok: true });
  }
);

app.get(
  '/calibration/reports/:clientId',
  requireAuth,
  requireAnyPermission(['calibration:schedule:manage', 'calibration:report:upload', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { assetId, limit, offset } = req.query || {};
    if (!assetId) {
      return res.json([]);
    }
    const parsedLimit = limit ? Math.min(Number(limit) || 0, 100) : undefined;
    const parsedOffset = offset ? Math.max(Number(offset) || 0, 0) : undefined;
    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const assetCheck = await query(
      `SELECT 1 FROM "${client.schema_name}".assets WHERE id = $1`,
      [String(assetId)]
    );
    if (!assetCheck.rows.length) {
      return res.json([]);
    }
    const rows = await listCalibrationReportsByAsset(String(assetId), parsedLimit, parsedOffset);
    return res.json(rows);
  }
);

app.delete(
  '/calibration/schedules/:id',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const schedule = await getCalibrationScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    await deleteCalibrationSchedule(schedule.id);
    return res.json({ ok: true });
  }
);

app.delete(
  '/maintenance/requests/:id',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (!req.user.roles?.includes('superuser')) {
      return res.status(403).json({ message: 'Solo superuser.' });
    }
    const request = await getMaintenanceRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    await deleteMaintenanceRequest(request.id);
    const requestAsset = await getAssetById(request.client_id, request.asset_id);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REQUEST_DELETE',
      clientId: request.client_id,
      assetId: request.asset_id,
      asset: requestAsset,
      description: `Eliminación de solicitud de mantenimiento para ${assetLabel(requestAsset)}.`,
      details: {
        eventType: 'solicitud_mantenimiento_eliminada',
        requestId: request.id,
        maintenanceType: request.type ?? null
      }
    });
    return res.json({ ok: true });
  }
);

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
