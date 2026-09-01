import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import { finished } from 'stream/promises';
import { promisify } from 'util';
import multer from 'multer';
import sharp from 'sharp';
import { PDFDocument as PdfMergerDocument } from 'pdf-lib';
import { query, withTransaction } from './db.js';
import {
  authenticateUser,
  getCurrentSessionUser,
  refreshSession,
  revokeClientActiveSessions,
  revokeRefreshToken,
  revokeRoleActiveSessions,
  revokeUserActiveSessions
} from './auth.js';
import {
  requireActiveTemporaryPermission,
  requireAnyPermission,
  requireAuth,
  requirePermission
} from './middleware.js';
import {
  SUITE_ACCESS_PERMISSIONS,
  TEMPORARY_ONLY_PERMISSIONS,
  allowedClientPermissionsForModules
} from './permission-policy.js';
import { validateAndNormalizeHvImportAsset } from './hv-import-validation.js';
import { assetCategoryLabel, normalizeAssetCategory } from './asset-category.js';
import {
  extendLateMaintenanceAuthorizations,
  LATE_MAINTENANCE_EXECUTION_PERMISSION,
  normalizeLateMaintenanceOpening,
  openLateMaintenancePeriod,
  validateLateExecutionTemporaryGrant
} from './late-maintenance-execution.js';
import {
  createUser,
  getClientRolePermissions,
  grantTemporaryPermission,
  getUserById,
  getRolePermissions,
  listClientAdmins,
  listClientUsers,
  listClientSoftwareAccess,
  listClientModules,
  listModules,
  listPermissions,
  listRoles,
  listSoftwareSuites,
  listUsers,
  revokeTemporaryPermission,
  updateUserSignature,
  updateUserProfile,
  deleteUser,
  updateClientModules,
  updateClientRolePermissions,
  updateClientSoftwareAccess,
  updateRolePermissions,
  updateUserActive,
  updateUserRole
} from './admin.js';
import { requestPasswordReset, requestPasswordSetup, resetPasswordWithCode } from './password-reset.js';
import {
  requestAdminActionConfirmation,
  verifyAdminActionConfirmation
} from './action-confirmations.js';
import { logAudit, listAuditLogs } from './audit.js';
import {
  applySubscriptionPlanToClients,
  clientHasActiveAdmin,
  createSubscriptionPlan,
  getClientSubscription,
  getClientSubscriptionAccess,
  listSubscriptionPlans,
  recordSubscriptionPayment,
  updateSubscriptionPlan,
  updateClientSubscription
} from './subscriptions.js';
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
  acceptOdontologyTreatmentPlan,
  canAccessOdontology,
  canImportOdontologyPatients,
  canManageOdontologyAttachments,
  canManageOdontologyAppointments,
  canManageOdontologyClinicalRecords,
  canManageOdontologyClinicalDocuments,
  canManageOdontologyConsents,
  canManageOdontologyInventory,
  canManageOdontologySterilization,
  canManageOdontologyOdontogram,
  canManageOdontologyPeriodontogram,
  canManageOdontologyPatients,
  canManageOdontologyPayments,
  canManageOdontologyPrescriptions,
  canManageOdontologySettings,
  canManageOdontologyTreatmentPlans,
  canViewOdontologyFinancialValues,
  canViewOdontologyReports,
  createOdontologyChair,
  createOdontologyAppointment,
  createOdontologyAttachment,
  createOdontologyCatalogItem,
  createOdontologyClinicalRecord,
  createOdontologyClinicalRecordNote,
  createOdontologyClinicalDocument,
  createOdontologyConsentTemplate,
  createOdontologyAppointmentReminderLog,
  createOdontologyInventoryItem,
  createOdontologyInventoryMovement,
  createOdontologyInstrument,
  createOdontologyOdontogramEntry,
  createOdontologyPeriodontogram,
  createOdontologyPatientConsent,
  createOdontologyPatient,
  createOdontologyCashClosure,
  createOdontologyPayment,
  createOdontologyMedication,
  createOdontologyProcedureType,
  createOdontologyPrescription,
  createOdontologySite,
  createOdontologySterilizationCycle,
  createOdontologySupplier,
  createOdontologyTreatmentPlan,
  deleteOdontologyAttachment,
  getOdontologyConsentForPdf,
  getOdontologyAppointmentById,
  getOdontologyAttachmentById,
  getOdontologyClinicalRecordById,
  getOdontologyOdontogram,
  getOdontologyPeriodontogramById,
  getOdontologyPatientById,
  getOdontologyCashClosureById,
  getOdontologyPaymentById,
  getOdontologySterilizationCycleById,
  getOdontologyDashboard,
  getOdontologyReportDetails,
  getOdontologyReports,
  getOdontologySettings,
  getOdontologyTreatmentPlan,
  listOdontologyAttachments,
  listOdontologyAppointments,
  listOdontologyAppointmentReminders,
  listOdontologyClinicalRecords,
  listOdontologyClinicalRecordNotes,
  listOdontologyClinicalDocuments,
  listOdontologyConsentTemplates,
  listOdontologyDentistSchedules,
  listOdontologyInventoryItems,
  listOdontologyInventoryMovements,
  listOdontologyInstruments,
  listOdontologyPatientConsents,
  listOdontologyPatients,
  listOdontologyCashClosures,
  listOdontologyPayments,
  listOdontologyPeriodontograms,
  listOdontologyMedications,
  listOdontologyPrescriptions,
  listOdontologyPurchaseRequests,
  listOdontologyCatalog,
  listOdontologyChairs,
  listOdontologyDentists,
  listOdontologyProcedureTypes,
  listOdontologyProcedureInventoryKit,
  listOdontologySites,
  listOdontologySterilizationCycles,
  listOdontologySuppliers,
  listOdontologyTreatmentPlans,
  setOdontologyConsentPdf,
  setOdontologyClinicalRecordPdf,
  setOdontologyClinicalDocumentPdf,
  setOdontologyCashClosurePdf,
  setOdontologyPrescriptionPdf,
  setOdontologySterilizationCyclePdf,
  updateOdontologySettings,
  updateOdontologyChair,
  updateOdontologyAppointment,
  updateOdontologyCatalogItem,
  replaceOdontologyProcedureInventoryKit,
  replaceOdontologyDentistSchedules,
  signOdontologyPatientConsent,
  signOdontologyClinicalRecord,
  updateOdontologyConsentTemplate,
  updateOdontologyClinicalRecord,
  updateOdontologyInventoryItem,
  updateOdontologyInstrument,
  createOdontologyPurchaseRequest,
  updateOdontologyPurchaseRequestStatus,
  updateOdontologySite,
  updateOdontologySupplier,
  updateOdontologyPatient,
  updateOdontologyProcedureType,
  updateOdontologyTreatmentPlan,
  validateOdontologyPatientPayload,
  voidOdontologyPayment
} from './odontology.js';
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
  isAssetHistoryFileReconciled,
  listAssetHistory,
  listHistoricalMaintenanceOccurrences,
  listPendingHistoricalMaintenanceEvidence,
  listAssetsForBlankMaintenanceProtocols,
  listAssetsForReader,
  listAssetMovements,
  readerCanAccessAsset,
  listAreas,
  listAreasForScopedUser,
  listAssets,
  listLocations,
  listLocationsForScopedUser,
  listSites,
  listSitesForScopedUser,
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
  buildQuickGuidePdf,
  buildMaintenanceReportPdf,
  buildMaintenanceSchedulePdf,
  buildCalibrationSchedulePdf,
  buildTrainingSchedulePdf
} from './pdf.js';
import {
  createScheduleWithItems,
  listSchedules,
  getScheduleById,
  setSchedulePdf,
  approveSchedule,
  listScheduleItemsWithSchema,
  rescheduleDraftAsset,
  updateScheduleItems,
  countScheduleItems,
  countPendingScheduleItems,
  countUnprogrammedScheduleItems,
  setScheduleClosedIfDone,
  markScheduleItemDone,
  findScheduleItemForAsset,
  deleteDraftSchedule,
  setScheduleEngineerEditAccess,
  syncAssetsIntoMaintenanceSchedules,
  previewApprovedAssetScheduleProgramming,
  applyAssetScheduleProgramming
} from './schedules.js';
import {
  createTrainingScheduleWithItems,
  listTrainingSchedules,
  getTrainingScheduleById,
  approveTrainingSchedule,
  deleteTrainingSchedule,
  listTrainingItemsWithSchema,
  setTrainingItemPdf,
  setTrainingSchedulePdf,
  clearTrainingItemPdf,
  updateTrainingItems,
  countTrainingItems,
  countUnprogrammedTrainingItems,
  refreshTrainingScheduleStatus
} from './training.js';
import {
  createCalibrationScheduleWithItems,
  listCalibrationSchedules,
  getCalibrationScheduleById,
  approveCalibrationSchedule,
  setCalibrationSchedulePdf,
  deleteCalibrationSchedule,
  listCalibrationItemsWithSchema,
  setCalibrationItemPdf,
  clearCalibrationItemPdf,
  updateCalibrationItems,
  listCalibrationReportsByAsset,
  countCalibrationItems,
  countUnprogrammedCalibrationItems,
  refreshCalibrationScheduleStatus
} from './calibration.js';
import {
  createMaintenanceRequest,
  createMaintenanceProtocolPrintBatch,
  getPreventiveMaintenanceProgress,
  listMaintenanceRequests,
  listMaintenanceRequestsForReader,
  getMaintenanceRequestById,
  assignMaintenanceRequest,
  createMaintenanceReport,
  deleteReportSignatures,
  getLatestWaitingSpareReportByRequest,
  getMaintenanceReportWithOpenCorrectionByRequest,
  updateMaintenanceReport,
  signMaintenanceReport,
  updateMaintenanceReportSignatureSnapshot,
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
  markMaintenanceReportNotificationsResolved,
  markMaintenanceRequestNotificationsResolved,
  reopenMaintenanceReportForEngineer,
  requestMaintenanceReportCorrection,
  resolveMaintenanceReportCorrections,
  listUsersByRoleAndClient
} from './maintenance.js';
import {
  createMaintenanceSignatureSnapshot,
  isMaintenanceSignatureSnapshotPath,
  removeMaintenanceSignatureSnapshot
} from './maintenance-signature-snapshots.js';
import {
  MAINTENANCE_REQUEST_CLAIMABLE_STATUSES,
  MAINTENANCE_REQUEST_REPORTABLE_STATUSES,
  canOperateAssignedMaintenanceRequest,
  isMaintenanceReportFullySigned,
  maintenanceAssetStatusObservationError,
  maintenanceReportEngineerReopenError,
  maintenanceSpareWorkflowForReport,
  maintenanceRequestDescriptionError,
  normalizeMaintenanceRequestDescription,
  shouldCompletePreventiveScheduleItem
} from './maintenance-workflow.js';
import {
  ScheduleValidationError,
  addMonthsUtc as addScheduleMonths,
  assetWarrantyReleaseDate,
  buildAssetMaintenanceOccurrences,
  buildRecurringDates,
  canEditMaintenanceSchedule,
  capDateAtScheduleYearEndUtc as capScheduleDateAtYearEnd,
  changedMaintenanceItemUpdates,
  dateOnlyFromDatabase,
  endOfMonthUtc as endOfScheduleMonth,
  formatDateOnly as formatScheduleDate,
  frequencyToMonths as scheduleFrequencyToMonths,
  normalizeCalibrationItemUpdates,
  normalizeAssetScheduleEnrollmentMode,
  normalizeAssetScheduleProgrammingSelection,
  normalizeDateOnly,
  normalizeMaintenanceItemUpdates,
  normalizePeriodicity,
  normalizeScheduleStart,
  normalizeTrainingItemUpdates,
  normalizeUuidList,
  parseDateOnly as parseScheduleDate
} from './schedule-workflow.js';
import {
  BLANK_MAINTENANCE_PROTOCOL_PERMISSION,
  MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH,
  buildBlankMaintenanceProtocolBatchPdf,
  createBlankMaintenanceProtocolBatchCode,
  normalizeBlankMaintenanceProtocolRequest
} from './blank-maintenance-protocols.js';
import {
  approveQuickGuide,
  createQuickGuide,
  deleteQuickGuide,
  findQuickGuideForAsset,
  getQuickGuideById,
  listQuickGuides,
  setQuickGuideVisual,
  updateQuickGuide
} from './quick-guides.js';
import {
  createApprovedCatalogNode,
  listEquipmentCatalog,
  listEquipmentCatalogForAdmin,
  mergeCatalogNodes,
  reviewCatalogNode,
  updateCatalogNode
} from './equipment-catalog.js';
import { sendNotificationEmail } from './mailer.js';
import { listReaderAccess, replaceReaderAccess } from './reader-access.js';
import { sendPreventiveRemindersForClient } from './preventive-reminders.js';
import {
  sendManualOdontologyAppointmentWhatsappReminder,
  sendOdontologyAppointmentRemindersForAllClients
} from './odontology-reminders.js';

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
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const upload = multer({ storage: multer.memoryStorage() });
const MAX_SCHEDULE_PDF_BYTES = 15 * 1024 * 1024;
const MAX_HISTORICAL_PDF_BYTES = 15 * 1024 * 1024;
const schedulePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCHEDULE_PDF_BYTES },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('Solo se permiten archivos PDF.'));
      return;
    }
    callback(null, true);
  }
});
const uploadSchedulePdf = (req, res, next) => {
  schedulePdfUpload.single('pdf')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'El PDF supera el límite de 15 MB.'
        : error.message || 'No se pudo procesar el PDF.';
    res.status(400).json({ message });
  });
};
const historicalPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HISTORICAL_PDF_BYTES }
});
const uploadHistoricalPdf = (req, res, next) => {
  historicalPdfUpload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'El PDF supera el límite de 15 MB.'
        : error.message || 'No se pudo procesar el PDF.';
    res.status(400).json({ message });
  });
};

function isPdfFile(file) {
  return Boolean(file?.buffer?.subarray(0, 5).equals(Buffer.from('%PDF-')));
}

function respondScheduleError(res, error, fallbackMessage) {
  if (error instanceof ScheduleValidationError || error?.code === 'SCHEDULE_ITEM_MISMATCH') {
    return res.status(400).json({ message: error.message, code: error.code });
  }
  if (error?.code === 'SCHEDULE_EDIT_LOCKED' || error?.code === 'SCHEDULE_EDIT_STATE_CHANGED') {
    return res.status(409).json({ message: error.message, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ message: fallbackMessage });
}
const BIOMED_DOCUMENT_TYPES = ['cedula_ciudadania', 'cedula_extranjeria', 'pasaporte'];
const MAINTENANCE_ASSET_STATUSES = [
  'operativo',
  'operativo_observacion',
  'fuera_de_servicio'
];
const AREA_RESPONSIBLE_ROLE = 'responsable_area';
const AREA_SCOPED_OPERATIONAL_ROLES = ['lector', AREA_RESPONSIBLE_ROLE];
const MAINTENANCE_ACCEPTANCE_SIGNER_ROLES = [
  'almacenista',
  AREA_RESPONSIBLE_ROLE,
  'lector',
  'viewer',
  'visor',
  'superuser'
];
const MAINTENANCE_REPORT_ACCESS_ROLES = [
  'almacenista',
  'ingeniero_biomedico',
  AREA_RESPONSIBLE_ROLE,
  'lector',
  'viewer',
  'visor',
  'superuser'
];
const MAINTENANCE_CHECK_OPTIONS = [
  'revision_visual',
  'revision_cables_conexiones',
  'revision_accesorios',
  'verificacion_alimentacion',
  'revision_alarmas_errores',
  'prueba_funcional_inicial',
  'revision_seguridad_basica'
];
const MAINTENANCE_ACTIVITY_OPTIONS = [
  'limpieza_externa',
  'limpieza_interna',
  'ajuste_conexiones',
  'configuracion_parametros',
  'reparacion_componente',
  'instalacion_repuesto',
  'lubricacion',
  'actualizacion_software',
  'capacitacion_usuario',
  'prueba_funcional_final'
];
const MAINTENANCE_TEST_OPTIONS = [
  'encendido_apagado',
  'prueba_modos_operacion',
  'verificacion_alarmas',
  'verificacion_accesorios',
  'prueba_con_paciente_simulado',
  'verificacion_parametros',
  'verificacion_temperatura_presion',
  'prueba_carga_operativa',
  'verificacion_consumo_electrico',
  'verificacion_fugas_drenajes',
  'equipo_operativo_entregado'
];
const SIGNATURE_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
const SIGNATURE_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
];
const SIGNATURE_MAX_FILE_SIZE_MB = 8;
const SIGNATURE_MAX_FILE_SIZE_BYTES = SIGNATURE_MAX_FILE_SIZE_MB * 1024 * 1024;
const CLIENT_ADMIN_ROLE = 'client_admin';
const SCHEDULE_UNLOCK_PERMISSION = 'schedules:unlock_approved';
const SCHEDULE_READ_PERMISSIONS = ['schedules:manage', SCHEDULE_UNLOCK_PERMISSION];
const SAAS_ADMIN_ROLES = ['saas_admin', 'saas_billing', 'saas_clients', 'saas_support', 'saas_auditor'];
const PLATFORM_LEGACY_ROLES = ['viewer'];
const PLATFORM_ASSIGNABLE_ROLES = ['superuser', 'admin', ...SAAS_ADMIN_ROLES];
const PLATFORM_ADMIN_ROLES = [...PLATFORM_ASSIGNABLE_ROLES, ...PLATFORM_LEGACY_ROLES];
const BIOMEDICAL_CATALOG_ADMIN_ROLES = ['superuser', 'admin', 'saas_admin'];
const SAAS_READ_PERMISSIONS = [
  'clients:manage',
  'saas:access',
  'saas:clients:view',
  'saas:clients:update',
  'saas:subscriptions:manage',
  'saas:plans:manage',
  'saas:client_admins:reset_password',
  'saas:audit:view'
];
const SAAS_CLIENT_UPDATE_PERMISSIONS = ['clients:manage', 'saas:clients:update'];
const SAAS_SUBSCRIPTION_PERMISSIONS = ['clients:manage', 'saas:subscriptions:manage'];
const SAAS_PLAN_MANAGE_PERMISSIONS = ['clients:manage', 'saas:plans:manage'];
const SAAS_CLIENT_ADMIN_RESET_PERMISSIONS = [
  'clients:manage',
  'users:manage',
  'saas:client_admins:reset_password'
];
const CLIENT_ASSIGNABLE_ROLES = [
  'almacenista',
  'ingeniero_biomedico',
  'calibracion',
  AREA_RESPONSIBLE_ROLE,
  'lector',
  'odontologo',
  'auxiliar_odontologia',
  'recepcion_odontologia',
  'admin_odontologia',
  'auditor_odontologia',
  'bacteriologo',
  'auxiliar_laboratorio'
];
const BIOMEDICAL_CLIENT_ROLES = [
  'almacenista',
  'ingeniero_biomedico',
  AREA_RESPONSIBLE_ROLE,
  'lector'
];
const ODONTOLOGY_CLIENT_ROLES = [
  'odontologo',
  'auxiliar_odontologia',
  'recepcion_odontologia',
  'admin_odontologia',
  'auditor_odontologia'
];
const LABORATORY_CLIENT_ROLES = ['bacteriologo', 'auxiliar_laboratorio'];
const TEMPORARY_BIOMEDICAL_PERMISSIONS = TEMPORARY_ONLY_PERMISSIONS;
const BIOMEDICAL_MODULE_KEYS = [
  'hojas_de_vida',
  'inventario',
  'guias_rapidas',
  'reportes_mantenimiento',
  'cronogramas',
  'calibraciones'
];
const SUPERUSER_VISIBLE_USER_ROLES = [...SAAS_ADMIN_ROLES];
const SUPERUSER_ASSIGNABLE_USER_ROLES = [...SAAS_ADMIN_ROLES];
const SUPERUSER_VISIBLE_ROLE_PERMISSIONS = [
  'clients:create',
  'clients:manage',
  'clients:view',
  'reports:view',
  'users:manage',
  'audit:client:view',
  'platform:templates:manage',
  'platform:biomedical_catalog:manage',
  'saas:access',
  'saas:clients:view',
  'saas:clients:update',
  'saas:subscriptions:manage',
  'saas:plans:manage',
  'saas:client_admins:reset_password',
  'saas:audit:view'
];

function hasRole(user, role) {
  return Boolean(user?.roles?.includes(role));
}

function isSuperuser(user) {
  return hasRole(user, 'superuser');
}

function isPlatformUser(user) {
  return !user?.clientId && PLATFORM_ADMIN_ROLES.some((role) => hasRole(user, role));
}

function isClientAdmin(user) {
  return hasRole(user, CLIENT_ADMIN_ROLE);
}

function isOperationalClientRole(role) {
  return CLIENT_ASSIGNABLE_ROLES.includes(role);
}

function clientModuleAccessContext(modules) {
  const enabledModules = new Set(
    modules.filter((module) => module.enabled).map((module) => module.key)
  );
  const enabledSuites = new Set(
    modules
      .filter((module) => module.enabled)
      .map((module) => module.suite_key || 'biomedico')
  );
  return { enabledModules, enabledSuites };
}

async function listEnabledClientRoleNames(clientId) {
  if (!clientId) return new Set();
  const modules = await listClientModules(clientId);
  const { enabledModules, enabledSuites } = clientModuleAccessContext(modules);
  const roles = new Set();
  const add = (values) => values.forEach((value) => roles.add(value));

  const hasBiomedicalSoftware = enabledSuites.has('biomedico')
    || BIOMEDICAL_MODULE_KEYS.some((key) => enabledModules.has(key));
  if (hasBiomedicalSoftware) {
    add(BIOMEDICAL_CLIENT_ROLES);
  }
  if (enabledModules.has('calibraciones')) {
    roles.add('calibracion');
  }
  if (enabledSuites.has('odontologico') || enabledModules.has('odontologia')) {
    add(ODONTOLOGY_CLIENT_ROLES);
  }
  if (enabledSuites.has('laboratorio') || enabledModules.has('laboratorio')) {
    add(LABORATORY_CLIENT_ROLES);
  }

  return roles;
}

async function canClientUseRole(clientId, role) {
  if (!isOperationalClientRole(role)) return false;
  const enabledRoles = await listEnabledClientRoleNames(clientId);
  return enabledRoles.has(role);
}

function isClientVisiblePermission(permission) {
  return Boolean(
    permission?.startsWith('software:')
    || permission?.startsWith('hb:')
    || permission?.startsWith('quick_guides:')
    || permission?.startsWith('inventory:')
    || permission?.startsWith('maintenance:')
    || permission?.startsWith('service:')
    || permission?.startsWith('spareparts:')
    || permission?.startsWith('calibration:')
    || permission?.startsWith('odontology:')
    || permission?.startsWith('laboratory:')
    || permission === 'areas:manage'
    || permission === 'asset_history:upload'
    || permission === 'schedules:manage'
    || permission === 'audit:odontology:view'
    || permission === 'read:all'
  );
}

async function listAllowedClientRolePermissions(clientId) {
  const modules = await listClientModules(clientId);
  return allowedClientPermissionsForModules(modules, { includeTemporary: false });
}

async function getRoleNameById(roleId) {
  const { rows } = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
  return rows[0]?.name || null;
}

function cleanPermissionList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String)));
}

function parseAreaScopeIds(value, label) {
  if (value === undefined || value === null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      const error = new Error(`${label} no tienen un formato válido.`);
      error.code = 'INVALID_AREA_SCOPE';
      throw error;
    }
  }
  if (!Array.isArray(parsed)) {
    const error = new Error(`${label} no tienen un formato válido.`);
    error.code = 'INVALID_AREA_SCOPE';
    throw error;
  }
  return parsed;
}

function isSuperuserAssignableRole(role) {
  return SUPERUSER_ASSIGNABLE_USER_ROLES.includes(role);
}

function isSaasUserCreatableRole(role) {
  return SAAS_ADMIN_ROLES.includes(role);
}

function isSuperuserVisibleRole(role) {
  return SUPERUSER_VISIBLE_USER_ROLES.includes(role);
}

function isSuperuserVisibleRolePermission(permission) {
  return SUPERUSER_VISIBLE_ROLE_PERMISSIONS.includes(permission);
}

function denyPlatformOperationalAccess(req, res, next) {
  if (isSuperuser(req.user) || isPlatformUser(req.user) || !req.user?.clientId) {
    return res.status(403).json({
      message: 'La operación de clientes requiere una cuenta asignada al cliente. Usa un usuario interno del cliente para acceder a datos operativos.'
    });
  }
  return next();
}

function requirePlatformCatalogManager(req, res, next) {
  if (
    !isPlatformUser(req.user)
    || req.user?.clientId
    || !BIOMEDICAL_CATALOG_ADMIN_ROLES.some((role) => hasRole(req.user, role))
  ) {
    return res.status(403).json({
      message: 'El catálogo global de equipos solo puede administrarse desde una cuenta de plataforma.'
    });
  }
  if (!req.user?.permissions?.includes('platform:biomedical_catalog:manage')) {
    return res.status(403).json({ message: 'Sin permisos para administrar el catálogo global de equipos.' });
  }
  return next();
}

async function enforceTenantSubscription(req, res, next) {
  if (isSuperuser(req.user) || !req.user?.clientId) {
    return next();
  }

  try {
    const subscription = await getClientSubscriptionAccess(req.user.clientId);
    req.subscription = subscription;

    if (subscription.is_blocked) {
      return res.status(423).json({
        message: 'La suscripción del cliente está suspendida. Contacta al administrador de la plataforma.',
        subscription
      });
    }

    if (subscription.is_read_only && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      return res.status(402).json({
        message: 'La suscripción del cliente está en modo solo lectura. Puedes consultar información, pero no realizar cambios.',
        subscription
      });
    }

    return next();
  } catch (error) {
    console.error('No se pudo validar la suscripción del cliente', error);
    return res.status(500).json({ message: 'No se pudo validar la suscripción.' });
  }
}

async function enforceOperationalSubscription(req, res, next) {
  if (isSuperuser(req.user) || !req.user?.clientId) {
    return next();
  }

  try {
    const subscription = await getClientSubscriptionAccess(req.user.clientId);
    req.subscription = subscription;

    if (subscription.is_blocked) {
      return res.status(423).json({
        message: 'La suscripción del cliente está suspendida. Contacta al administrador de la plataforma.',
        subscription
      });
    }

    if (subscription.is_read_only && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      return res.status(402).json({
        message: 'La suscripción del cliente está en modo solo lectura. Puedes consultar información, pero no realizar cambios.',
        subscription
      });
    }

    return next();
  } catch (error) {
    console.error('No se pudo validar la suscripción operativa', error);
    return res.status(500).json({ message: 'No se pudo validar la suscripción.' });
  }
}

function subscriptionRequiresClientAdmin(payload = {}) {
  const status = payload.status || 'active';
  const accessMode = payload.accessMode || payload.access_mode || 'full';
  return ['active', 'grace'].includes(status) && accessMode === 'full';
}

async function getAdminTargetUser(userId) {
  return getUserById(userId);
}

function canManageTargetUser(actor, target) {
  if (!actor || !target) return false;
  const targetRoles = target.roles || [];
  if (isSuperuser(actor)) {
    return !target.client_id || targetRoles.includes(CLIENT_ADMIN_ROLE);
  }
  if (isClientAdmin(actor)) {
    return Boolean(actor.clientId)
      && target.client_id === actor.clientId
      && !targetRoles.includes('superuser')
      && !targetRoles.includes(CLIENT_ADMIN_ROLE);
  }
  return false;
}

function canReceiveTemporaryBiomedicalPermissions(target) {
  return Boolean(target?.client_id) && Boolean(target?.roles?.includes('ingeniero_biomedico'));
}

async function ensureCanManageTargetUser(req, res, userId) {
  const target = await getAdminTargetUser(userId);
  if (!target) {
    res.status(404).json({ message: 'Usuario no encontrado.' });
    return null;
  }
  if (!canManageTargetUser(req.user, target)) {
    res.status(403).json({ message: 'Sin acceso para administrar este usuario.' });
    return null;
  }
  return target;
}

async function resolveManagedUserClientId(req, requestedRole, requestedClientId) {
  if (isSuperuser(req.user)) {
    if (!isSaasUserCreatableRole(requestedRole)) {
      return {
        error: 'Desde Usuarios solo se crean usuarios administrativos SaaS.'
      };
    }
    if (requestedClientId) {
      return { error: 'Los usuarios de plataforma no deben quedar ligados a un cliente.' };
    }
    return { clientId: null };
  }

  if (isClientAdmin(req.user)) {
    if (!req.user.clientId) {
      return { error: 'El administrador del cliente no tiene cliente asignado.' };
    }
    if (!(await canClientUseRole(req.user.clientId, requestedRole))) {
      return { error: 'Este rol no está habilitado para los softwares y módulos de tu cliente.' };
    }
    return { clientId: req.user.clientId };
  }

  return { error: 'Sin permisos para crear usuarios.' };
}
const uploadAssetFiles = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'manualOperacion', maxCount: 1 },
  { name: 'manualServicio', maxCount: 1 }
]);

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function sanitizeList(values, allowed) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => allowed.includes(value));
}

function hasAnyPermission(user, permissions = []) {
  return permissions.some((permission) => user?.permissions?.includes(permission));
}

function hasAnyRole(user, roles = []) {
  return roles.some((role) => user?.roles?.includes(role));
}

function isAreaScopedOperationalUser(user) {
  return hasAnyRole(user, AREA_SCOPED_OPERATIONAL_ROLES);
}

function maintenanceAcceptanceRoleForUser(user) {
  return MAINTENANCE_ACCEPTANCE_SIGNER_ROLES.find((role) => hasRole(user, role))
    || user?.roles?.[0]
    || 'user';
}

function requireAnyPermissionOrRole(permissions = [], roles = []) {
  return (req, res, next) => {
    if (hasAnyPermission(req.user, permissions) || hasAnyRole(req.user, roles)) {
      return next();
    }
    return res.status(403).json({ message: 'Sin permisos.' });
  };
}

async function listAreaResponsibleUsersForAsset(clientId, asset) {
  if (!asset?.area_id && !asset?.location_id) return [];
  const { rows } = await query(
    `SELECT DISTINCT u.id, u.email, u.display_name
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     JOIN reader_access ra ON ra.user_id = u.id AND ra.client_id = $1
     WHERE u.client_id = $1
       AND u.is_active = TRUE
       AND r.name = $4
       AND (
         ($2::uuid IS NOT NULL AND ra.area_id = $2::uuid)
         OR ($3::uuid IS NOT NULL AND ra.location_id = $3::uuid)
       )
     ORDER BY u.display_name`,
    [clientId, asset.area_id || null, asset.location_id || null, AREA_RESPONSIBLE_ROLE]
  );
  return rows;
}

async function listLegacyMaintenanceReportSigningUsers(clientId, asset, request) {
  const storekeepers = await listUsersByRoleAndClient('almacenista', clientId);
  const byId = new Map(storekeepers.map((user) => [user.id, user]));

  let readers = [];
  if (asset?.area_id || asset?.location_id) {
    const { rows } = await query(
      `SELECT DISTINCT u.id, u.email, u.display_name
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       JOIN reader_access ra ON ra.user_id = u.id AND ra.client_id = $1
       WHERE u.client_id = $1
         AND u.is_active = TRUE
         AND r.name IN ('lector', 'viewer', 'visor')
         AND (
           ($2::uuid IS NOT NULL AND ra.area_id = $2::uuid)
           OR ($3::uuid IS NOT NULL AND ra.location_id = $3::uuid)
         )`,
      [clientId, asset.area_id || null, asset.location_id || null]
    );
    readers = rows;
  } else {
    readers = await listUsersByRoleAndClient('lector', clientId);
  }

  for (const user of readers) {
    byId.set(user.id, user);
  }

  if (request?.type !== 'preventivo' && request?.requested_by) {
    const requester = await getUserById(request.requested_by);
    if (requester?.id) {
      byId.set(requester.id, requester);
    }
  }

  return Array.from(byId.values());
}

async function buildMaintenanceReportSigningPlan(clientId, asset, request) {
  const areaResponsibleUsers = await listAreaResponsibleUsersForAsset(clientId, asset);
  if (areaResponsibleUsers.length) {
    return {
      areaResponsibleRequired: true,
      users: areaResponsibleUsers
    };
  }
  return {
    areaResponsibleRequired: false,
    users: await listLegacyMaintenanceReportSigningUsers(clientId, asset, request)
  };
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

app.use('/admin', requireAuth, enforceTenantSubscription);
app.use('/biomed', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);
app.use('/odontology', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);
app.use('/maintenance', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);
app.use('/training', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);
app.use('/calibration', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);
app.use('/quick-guides', requireAuth, denyPlatformOperationalAccess, enforceOperationalSubscription);

async function requireActionConfirmation(req, res, action) {
  const code = req.body?.securityCode
    || req.body?.actionConfirmationCode
    || req.headers['x-action-confirmation-code'];
  const ok = await verifyAdminActionConfirmation({
    userId: req.user.sub,
    action,
    code
  });
  if (!ok) {
    res.status(428).json({ message: 'Código de confirmación requerido o inválido.' });
    return false;
  }
  return true;
}

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
    if (error?.message === 'SESSION_REPLACED') {
      return res.status(401).json({
        code: 'SESSION_REPLACED',
        message: 'Tu sesión se cerró porque iniciaste sesión en otro dispositivo.'
      });
    }
    return res.status(401).json({ message: 'Refresh inválido.' });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentSessionUser(req.user.sub);
    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Sesión inválida.' });
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
    if (error?.code === 'PASSWORD_WEAK') {
      return res.status(400).json({
        message: 'La contraseña debe tener mínimo 10 caracteres, una mayúscula, una minúscula y un número.'
      });
    }
    return res.status(400).json({ message: 'Código inválido o expirado.' });
  }
});

app.post('/admin/security/action-confirmation', requireAuth, async (req, res) => {
  const { action, summary } = req.body || {};
  if (!action) {
    return res.status(400).json({ message: 'Acción requerida.' });
  }

  try {
    const result = await requestAdminActionConfirmation({
      userId: req.user.sub,
      action: String(action),
      summary: summary ? String(summary).slice(0, 500) : ''
    });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo enviar el código de confirmación.' });
  }
});

app.get('/admin/roles', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const roles = await listRoles();
  if (isSuperuser(req.user)) {
    return res.json(roles.filter((role) => isSuperuserVisibleRole(role.name)));
  }
  if (isClientAdmin(req.user)) {
    const enabledRoles = await listEnabledClientRoleNames(req.user.clientId);
    return res.json(roles.filter((role) => enabledRoles.has(role.name)));
  }
  return res.status(403).json({ message: 'Sin permisos.' });
});

app.get('/admin/permissions', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const permissions = await listPermissions();
  if (isSuperuser(req.user)) {
    return res.json(permissions.filter((permission) => isSuperuserVisibleRolePermission(permission.name)));
  }
  if (isClientAdmin(req.user)) {
    const allowed = await listAllowedClientRolePermissions(req.user.clientId);
    return res.json(permissions.filter((permission) => allowed.has(permission.name)));
  }
  return res.json([]);
});

app.get(
  '/admin/roles/:id/permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    if (isClientAdmin(req.user)) {
      const roleName = await getRoleNameById(req.params.id);
      if (!(await canClientUseRole(req.user.clientId, roleName))) {
        return res.status(403).json({ message: 'Este rol no está habilitado para los softwares y módulos de tu cliente.' });
      }
      const allowed = await listAllowedClientRolePermissions(req.user.clientId);
      const permissions = await getClientRolePermissions(req.user.clientId, req.params.id);
      return res.json(permissions.filter((permission) => allowed.has(permission)));
    }
    if (!isSuperuser(req.user)) {
      return res.json([]);
    }
    const roleName = await getRoleNameById(req.params.id);
    if (!isSuperuserVisibleRole(roleName)) {
      return res.status(403).json({ message: 'Este rol no se administra desde Roles y permisos SaaS.' });
    }
    const permissions = await getRolePermissions(req.params.id);
    return res.json(permissions.filter((permission) => isSuperuserVisibleRolePermission(permission)));
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

    if (isClientAdmin(req.user)) {
      const roleName = await getRoleNameById(req.params.id);
      if (!(await canClientUseRole(req.user.clientId, roleName))) {
        return res.status(403).json({ message: 'Este rol no está habilitado para los softwares y módulos de tu cliente.' });
      }

      const requested = cleanPermissionList(permissions);
      const allowed = await listAllowedClientRolePermissions(req.user.clientId);
      const invalid = requested.filter((permission) => !allowed.has(permission));
      if (invalid.length) {
        return res.status(400).json({
          message: 'Algunos permisos no están habilitados para este cliente.',
          invalid
        });
      }
      if (!(await requireActionConfirmation(req, res, 'CLIENT_ROLE_PERMISSIONS_UPDATE'))) return;

      await updateClientRolePermissions({
        clientId: req.user.clientId,
        roleId: req.params.id,
        permissions: requested,
        actorUserId: req.user.sub
      });
      await revokeRoleActiveSessions(req.params.id, req.user.clientId);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'CLIENT_ROLE_PERMISSIONS_UPDATE',
        details: {
          clientId: req.user.clientId,
          role: roleName,
          permissions: requested
        }
      });
      return res.json({ ok: true });
    }

    if (!isSuperuser(req.user)) {
      return res.status(403).json({ message: 'Solo superadmin de plataforma.' });
    }
    const roleName = await getRoleNameById(req.params.id);
    if (!isSuperuserVisibleRole(roleName)) {
      return res.status(403).json({ message: 'Este rol no se administra desde Roles y permisos SaaS.' });
    }
    const requested = cleanPermissionList(permissions);
    const invalid = requested.filter((permission) => !isSuperuserVisibleRolePermission(permission));
    if (invalid.length) {
      return res.status(400).json({
        message: 'Algunos permisos no pertenecen a Administración SaaS.',
        invalid
      });
    }
    if (!(await requireActionConfirmation(req, res, 'ROLE_PERMISSIONS_UPDATE'))) return;

    await updateRolePermissions(req.params.id, requested);
    await revokeRoleActiveSessions(req.params.id);
    return res.json({ ok: true });
  }
);

app.get('/admin/users', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const users = await listUsers({
    actorRoles: req.user.roles || [],
    actorClientId: req.user.clientId || null
  });
  return res.json(users);
});

app.get(
  '/admin/client-users',
  requireAuth,
  requireAnyPermission(['clients:manage', 'saas:clients:view', 'saas:clients:update', 'users:manage', 'saas:client_admins:reset_password']),
  async (req, res) => {
    if (req.user.clientId) {
      return res.status(403).json({ message: 'Solo usuarios de plataforma pueden consultar usuarios de clientes.' });
    }
    const users = await listClientUsers();
    return res.json(users);
  }
);

app.post(
  '/admin/users/:id/temporary-permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;

    const { permission, expiresAt, reason } = req.body || {};
    if (!TEMPORARY_BIOMEDICAL_PERMISSIONS.includes(permission)) {
      return res.status(400).json({ message: 'Permiso temporal inválido.' });
    }
    if (!canReceiveTemporaryBiomedicalPermissions(target)) {
      return res.status(400).json({
        message: 'Los permisos temporales solo aplican a ingenieros biomédicos de un cliente.'
      });
    }
    const targetModules = await listClientModules(target.client_id);
    const allowedTemporaryPermissions = allowedClientPermissionsForModules(targetModules);
    if (!allowedTemporaryPermissions.has(permission)) {
      return res.status(400).json({
        message: 'El permiso temporal no corresponde a un módulo biomédico contratado por el cliente.'
      });
    }

    const parsedExpiresAt = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(parsedExpiresAt.getTime())) {
      return res.status(400).json({ message: 'Fecha de vencimiento inválida.' });
    }
    if (parsedExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'La fecha de vencimiento debe ser futura.' });
    }
    let normalizedReason = reason;
    if (permission === LATE_MAINTENANCE_EXECUTION_PERMISSION) {
      try {
        const authorization = validateLateExecutionTemporaryGrant({
          expiresAt: parsedExpiresAt,
          reason
        });
        normalizedReason = authorization.reason;
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }
    if (!(await requireActionConfirmation(req, res, 'USER_TEMPORARY_PERMISSION_GRANT'))) return;

    let result;
    let lateAuthorizationUpdate = { updatedActivities: 0, authorizedUntil: null };
    if (permission === LATE_MAINTENANCE_EXECUTION_PERMISSION) {
      const bundledResult = await withTransaction(async (client) => {
        const queryRunner = (text, params) => client.query(text, params);
        const permissionResult = await grantTemporaryPermission({
          userId: req.params.id,
          permission,
          expiresAt: parsedExpiresAt,
          grantedBy: req.user.sub,
          reason: normalizedReason,
          queryRunner
        });
        if (permissionResult?.error) {
          return { permissionResult, authorizationUpdate: lateAuthorizationUpdate };
        }
        const authorizationUpdate = await extendLateMaintenanceAuthorizations({
          clientId: target.client_id,
          temporaryPermissionId: permissionResult.id,
          permissionExpiresAt: parsedExpiresAt,
          queryRunner
        });
        return { permissionResult, authorizationUpdate };
      });
      result = bundledResult.permissionResult;
      lateAuthorizationUpdate = bundledResult.authorizationUpdate;
    } else {
      result = await grantTemporaryPermission({
        userId: req.params.id,
        permission,
        expiresAt: parsedExpiresAt,
        grantedBy: req.user.sub,
        reason: normalizedReason
      });
    }
    if (result?.error === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    if (result?.error === 'PERMISSION_NOT_FOUND') {
      return res.status(404).json({ message: 'Permiso no encontrado.' });
    }
    // Existing access tokens do not gain this permission until the user refreshes the session.
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_TEMP_PERMISSION_GRANT',
      targetUserId: req.params.id,
      targetUsername: result.username,
      details: {
        clientId: target.client_id ?? null,
        permission,
        expiresAt: parsedExpiresAt.toISOString(),
        reason: normalizedReason || null,
        updatedLateActivities: lateAuthorizationUpdate.updatedActivities,
        lateAuthorizationUntil: lateAuthorizationUpdate.authorizedUntil
      }
    });

    return res.status(201).json({
      ...result,
      updatedLateActivities: lateAuthorizationUpdate.updatedActivities,
      lateAuthorizationUntil: lateAuthorizationUpdate.authorizedUntil
    });
  }
);

app.delete(
  '/admin/users/:id/temporary-permissions',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;

    const permission = req.query.permission || req.body?.permission;
    if (!permission) {
      return res.status(400).json({ message: 'Permiso requerido.' });
    }
    if (!TEMPORARY_BIOMEDICAL_PERMISSIONS.includes(String(permission))) {
      return res.status(400).json({ message: 'Permiso temporal inválido.' });
    }
    if (!(await requireActionConfirmation(req, res, 'USER_TEMPORARY_PERMISSION_REVOKE'))) return;

    const result = await revokeTemporaryPermission({
      userId: req.params.id,
      permission: String(permission)
    });
    if (!result) {
      return res.status(404).json({ message: 'Permiso temporal no encontrado.' });
    }
    await revokeUserActiveSessions(req.params.id);

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_TEMP_PERMISSION_REVOKE',
      targetUserId: req.params.id,
      targetUsername: result.username,
      details: {
        clientId: target.client_id ?? null,
        permission: result.permission
      }
    });

    return res.json({ ok: true });
  }
);

app.get('/admin/modules', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const modules = await listModules();
  return res.json(modules);
});

app.get('/admin/software-suites', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const suites = await listSoftwareSuites();
  return res.json(suites);
});

app.get('/admin/subscription-plans', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const plans = await listSubscriptionPlans({ includeInactive: req.query.includeInactive === 'true' });
  return res.json(plans);
});

app.post('/admin/subscription-plans', requireAuth, requireAnyPermission(SAAS_PLAN_MANAGE_PERMISSIONS), async (req, res) => {
  try {
    if (!(await requireActionConfirmation(req, res, 'SUBSCRIPTION_PLAN_CREATE'))) return;
    const plan = await createSubscriptionPlan(req.body || {});
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'SUBSCRIPTION_PLAN_CREATE',
      details: { plan }
    });
    return res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    const message = error?.code === '23505'
      ? 'Ya existe un plan con ese código.'
      : 'No se pudo crear el plan.';
    return res.status(400).json({ message });
  }
});

app.put('/admin/subscription-plans/:key', requireAuth, requireAnyPermission(SAAS_PLAN_MANAGE_PERMISSIONS), async (req, res) => {
  try {
    if (!(await requireActionConfirmation(req, res, 'SUBSCRIPTION_PLAN_UPDATE'))) return;
    const plan = await updateSubscriptionPlan(req.params.key, req.body || {});
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'SUBSCRIPTION_PLAN_UPDATE',
      details: { planKey: req.params.key, plan }
    });
    return res.json(plan);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'No se pudo actualizar el plan.' });
  }
});

app.post('/admin/subscription-plans/:key/apply', requireAuth, requireAnyPermission(SAAS_PLAN_MANAGE_PERMISSIONS), async (req, res) => {
  try {
    if (!(await requireActionConfirmation(req, res, 'SUBSCRIPTION_PLAN_APPLY_TO_CLIENTS'))) return;
    const result = await applySubscriptionPlanToClients(req.params.key);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'SUBSCRIPTION_PLAN_APPLY_TO_CLIENTS',
      details: { planKey: req.params.key, ...result }
    });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'No se pudo aplicar el plan a los clientes adheridos.' });
  }
});

app.get('/admin/clients/:id/software-suites', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const suites = await listClientSoftwareAccess(req.params.id);
  return res.json(suites);
});

app.put('/admin/clients/:id/software-suites', requireAuth, requireAnyPermission(SAAS_CLIENT_UPDATE_PERMISSIONS), async (req, res) => {
  const { suites } = req.body || {};
  if (!Array.isArray(suites)) {
    return res.status(400).json({ message: 'Softwares inválidos.' });
  }
  if (!(await requireActionConfirmation(req, res, 'CLIENT_SOFTWARE_ACCESS_UPDATE'))) return;
  await updateClientSoftwareAccess(req.params.id, suites);
  await revokeClientActiveSessions(req.params.id);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'CLIENT_SOFTWARE_ACCESS_UPDATE',
    details: { clientId: req.params.id, suites }
  });
  return res.json({ ok: true });
});

app.get('/admin/clients/:id/modules', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const modules = await listClientModules(req.params.id);
  return res.json(modules);
});

app.put('/admin/clients/:id/modules', requireAuth, requireAnyPermission(SAAS_CLIENT_UPDATE_PERMISSIONS), async (req, res) => {
  const { modules } = req.body || {};
  if (!Array.isArray(modules)) {
    return res.status(400).json({ message: 'Módulos inválidos.' });
  }
  if (!(await requireActionConfirmation(req, res, 'CLIENT_MODULES_UPDATE'))) return;
  await updateClientModules(req.params.id, modules);
  await revokeClientActiveSessions(req.params.id);
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
  if (isPlatformUser(req.user)) {
    return res.json([]);
  }
  if (!clientId) {
    const all = await listModules();
    return res.json(all.map((m) => ({ key: m.key, suite_key: m.suite_key, enabled: true })));
  }
  const subscription = await getClientSubscription(clientId);
  if (subscription.is_blocked) {
    const all = await listModules();
    return res.json(all.map((m) => ({ key: m.key, suite_key: m.suite_key, enabled: false })));
  }
  const modules = await listClientModules(clientId);
  return res.json(modules.map((m) => ({ key: m.key, suite_key: m.suite_key, enabled: m.enabled })));
});

function canAccessSuite(req, suiteKey) {
  if (isSuperuser(req.user)) return false;
  if (isClientAdmin(req.user)) return true;
  const permissions = new Set(req.user.permissions || []);
  return (SUITE_ACCESS_PERMISSIONS[suiteKey] || [])
    .some((permission) => permissions.has(permission));
}

app.get('/software-suites/me', requireAuth, async (req, res) => {
  const clientId = req.user.clientId;
  if (isPlatformUser(req.user)) {
    return res.json([]);
  }
  if (!clientId) {
    const all = await listSoftwareSuites();
    return res.json(all.map((suite) => ({
      ...suite,
      enabled: true,
      client_enabled: true,
      can_access: true,
      license_status: 'active'
    })));
  }

  const subscription = await getClientSubscription(clientId);
  const suites = await listClientSoftwareAccess(clientId);
  return res.json(suites.map((suite) => {
    const roleCanAccess = canAccessSuite(req, suite.key);
    const clientEnabled = Boolean(suite.enabled);
    const subscriptionAllowsOpen = !subscription.is_blocked;
    return {
      ...suite,
      subscription_status: subscription.effective_status,
      subscription_access_mode: subscription.effective_access_mode,
      client_enabled: clientEnabled,
      can_access: roleCanAccess,
      enabled: subscriptionAllowsOpen
        && clientEnabled
        && roleCanAccess
        && !['suspended', 'expired'].includes(suite.license_status)
    };
  }));
});

app.get('/clients/me', requireAuth, async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId) {
    return res.status(404).json({ message: 'Sin cliente asignado.' });
  }
  const client = await getClientById(clientId);
  return res.json(client);
});

app.get('/subscription/me', requireAuth, async (req, res) => {
  const clientId = req.user.clientId;
  if (!clientId || isSuperuser(req.user)) {
    return res.json(null);
  }
  const subscription = await getClientSubscription(clientId);
  return res.json(subscription);
});

async function ensureOdontologyApiAccess(req, res) {
  const clientId = req.params.clientId;
  const allowed = await canAccessOdontology({ user: req.user, clientId });
  if (!allowed) {
    res.status(403).json({ message: 'Sin acceso al software odontológico.' });
    return false;
  }
  return true;
}

function formatOdontologyConsentDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota'
  }).format(new Date(value));
}

function formatOdontologyAppointmentDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota'
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function formatDateOnly(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'America/Bogota'
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function documentTypeLabel(value) {
  const labels = {
    cedula_ciudadania: 'Cédula de ciudadanía',
    cedula_extranjeria: 'Cédula de extranjería',
    tarjeta_identidad: 'Tarjeta de identidad',
    registro_civil: 'Registro civil',
    pasaporte: 'Pasaporte',
    permiso_especial: 'Permiso especial',
    otro: 'Otro'
  };
  return labels[value] || value || '-';
}

function sexLabel(value) {
  const labels = {
    femenino: 'Femenino',
    masculino: 'Masculino',
    otro: 'Otro',
    no_especifica: 'No especifica'
  };
  return labels[value] || value || '-';
}

async function buildOdontologyConsentPdf(consent) {
  const client = await getClientById(consent.client_id).catch(() => null);
  const relativeDir = path.join('uploads', 'clients', consent.client_id, 'odontology', 'consents');
  const fileName = `consentimiento-${consent.id}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  const publicPath = `/${relativePath}`.replace(/\\/g, '/');

  await fs.promises.mkdir(fullDir, { recursive: true });

  const doc = new PDFDocument({ size: 'A4', margin: 46 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  const brand = '#a64045';
  const brandDark = '#5f1f25';
  const ink = '#111827';
  const muted = '#64748b';
  const light = '#fef2f2';
  const border = '#f0cfd3';
  const pale = '#fff7f7';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const ensureSpace = (height) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };
  const sectionTitle = (title) => {
    ensureSpace(28);
    doc.moveDown(0.6);
    doc
      .fillColor(brandDark)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(title.toUpperCase());
    doc
      .moveTo(doc.page.margins.left, doc.y + 3)
      .lineTo(doc.page.margins.left + pageWidth, doc.y + 3)
      .strokeColor(border)
      .stroke();
    doc.moveDown(0.7);
  };
  const infoRows = (rows) => {
    const labelWidth = 112;
    rows.forEach(([label, value]) => {
      ensureSpace(22);
      const y = doc.y;
      doc
        .roundedRect(doc.page.margins.left, y, pageWidth, 20, 6)
        .fill('#ffffff')
        .stroke(border);
      doc
        .fillColor(brand)
        .font('Helvetica-Bold')
        .fontSize(7.8)
        .text(label, doc.page.margins.left + 9, y + 6, { width: labelWidth });
      doc
        .fillColor(ink)
        .font('Helvetica')
        .fontSize(8.2)
        .text(value || '-', doc.page.margins.left + labelWidth + 14, y + 6, {
          width: pageWidth - labelWidth - 24
        });
      doc.y = y + 24;
    });
  };

  doc
    .roundedRect(doc.page.margins.left, 30, pageWidth, 92, 16)
    .fill(pale)
    .stroke(border);
  drawClientLogoOrBadge(doc, client, {
    x: doc.page.margins.left + 14,
    y: 46,
    fit: [74, 44]
  });
  doc
    .fillColor(brand)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('Consentimiento informado odontológico', doc.page.margins.left + 104, 48, {
      width: pageWidth - 120
    });
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(client?.name || 'INBIHOSPITALARIO', doc.page.margins.left + 104, 68, {
      width: pageWidth - 120
    });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      [
        client?.nit ? `NIT: ${client.nit}` : '',
        client?.habilitation_code ? `Código habilitación: ${client.habilitation_code}` : '',
        client?.city || ''
      ].filter(Boolean).join(' · ') || 'Formato institucional',
      doc.page.margins.left + 104,
      84,
      { width: pageWidth - 120 }
    )
    .text(`Generado: ${formatOdontologyConsentDate(new Date())}`, {
      width: pageWidth - 120
    });

  doc.y = 142;
  sectionTitle('Datos principales');

  const rows = [
    ['Paciente', `${consent.patient_name} · ${documentTypeLabel(consent.patient_document_type)} ${consent.patient_document_number || ''}`],
    ['Plantilla', `${consent.template_title} · versión ${consent.template_version}`],
    ['Procedimiento', consent.procedure_name || 'Procedimiento odontológico'],
    ['Estado', consent.status === 'signed' ? 'Firmado' : 'Borrador'],
    ['Fecha de firma', consent.signed_at ? formatOdontologyConsentDate(consent.signed_at) : 'Pendiente']
  ];
  infoRows(rows);

  sectionTitle('Texto del consentimiento');
  ensureSpace(80);
  const bodyStartY = doc.y;
  doc
    .roundedRect(doc.page.margins.left, bodyStartY, pageWidth, 38, 10)
    .fill(light)
    .stroke(border);
  doc
    .font('Helvetica')
    .fillColor(ink)
    .fontSize(9)
    .text(consent.rendered_body || '', doc.page.margins.left + 12, bodyStartY + 12, {
      width: pageWidth - 24,
      align: 'justify',
      lineGap: 2.8
    });

  doc.moveDown(1.6);
  ensureSpace(132);
  sectionTitle('Firmas');
  const signatureTop = doc.y;
  const signatureWidth = (pageWidth - 18) / 2;
  const signerSignatureFullPath = consent.signer_signature_path
    ? path.join(process.cwd(), String(consent.signer_signature_path).replace(/^\//, ''))
    : '';
  const providerSignatureFullPath = consent.signed_by_signature_path
    ? path.join(process.cwd(), String(consent.signed_by_signature_path).replace(/^\//, ''))
    : '';
  doc.roundedRect(doc.page.margins.left, signatureTop, signatureWidth, 64, 10).fill('#ffffff').stroke(border);
  doc.roundedRect(doc.page.margins.left + signatureWidth + 18, signatureTop, signatureWidth, 64, 10).fill('#ffffff').stroke(border);

  if (signerSignatureFullPath && fs.existsSync(signerSignatureFullPath)) {
    doc.image(signerSignatureFullPath, doc.page.margins.left + 12, signatureTop + 7, {
      fit: [signatureWidth - 24, 46],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fillColor(muted)
      .fontSize(7.5)
      .text('Firma pendiente', doc.page.margins.left, signatureTop + 26, {
        width: signatureWidth,
        align: 'center'
      });
  }

  if (providerSignatureFullPath && fs.existsSync(providerSignatureFullPath)) {
    doc.image(providerSignatureFullPath, doc.page.margins.left + signatureWidth + 30, signatureTop + 7, {
      fit: [signatureWidth - 24, 46],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fillColor(muted)
      .fontSize(7.5)
      .text('Firma digital no cargada', doc.page.margins.left + signatureWidth + 18, signatureTop + 26, {
        width: signatureWidth,
        align: 'center'
      });
  }

  doc
    .font('Helvetica-Bold')
    .fillColor(ink)
    .fontSize(9)
    .text('Paciente / acudiente', doc.page.margins.left, signatureTop + 72, { width: signatureWidth, align: 'center' });
  doc
    .font('Helvetica')
    .fillColor(muted)
    .fontSize(8.5)
    .text(consent.signer_name || '-', { width: signatureWidth, align: 'center' })
    .text(`${documentTypeLabel(consent.signer_document_type)} ${consent.signer_document_number || ''}`.trim() || '-', {
      width: signatureWidth,
      align: 'center'
    });
  if (consent.signer_relationship) {
    doc.text(`Parentesco: ${consent.signer_relationship}`, { width: signatureWidth, align: 'center' });
  }

  doc
    .font('Helvetica-Bold')
    .fillColor(ink)
    .fontSize(9)
    .text('Odontólogo / responsable', doc.page.margins.left + signatureWidth + 18, signatureTop + 72, {
      width: signatureWidth,
      align: 'center'
    });
  doc
    .font('Helvetica')
    .fillColor(muted)
    .fontSize(8.5)
    .text(consent.signed_by_name || 'Pendiente', { width: signatureWidth, align: 'center' })
    .text(`Documento: ${documentTypeLabel(consent.signed_by_document_type)} ${consent.signed_by_document_number || '-'}`, {
      width: signatureWidth,
      align: 'center'
    });
  if (consent.signed_by_invima_registration) {
    doc.text(`Registro profesional / INVIMA: ${consent.signed_by_invima_registration}`, {
      width: signatureWidth,
      align: 'center'
    });
  }

  doc
    .font('Helvetica')
    .fillColor(muted)
    .fontSize(7)
    .text('Documento generado por INBIHOSPITALARIO. La firma digital deja trazabilidad de responsable, fecha y bloqueo documental.', doc.page.margins.left, doc.page.height - 42, {
      width: pageWidth,
      align: 'center'
    });

  doc.end();
  await finished(stream);
  return publicPath;
}

async function buildOdontologyPrescriptionPdf(prescription) {
  const relativeDir = path.join('uploads', 'clients', prescription.client_id, 'odontology', 'prescriptions');
  const fileName = `receta-${prescription.id}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.promises.mkdir(fullDir, { recursive: true });

  const client = await getClientById(prescription.client_id).catch(() => null);
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  const brand = '#a64045';
  const ink = '#172033';
  const muted = '#64748b';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .roundedRect(doc.page.margins.left, 34, pageWidth, 58, 14)
    .fill('#fff7f7');
  doc
    .fillColor(brand)
    .font('Helvetica-Bold')
    .fontSize(17)
    .text('Receta odontológica', doc.page.margins.left + 16, 48);
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(9)
    .text(client?.name || 'INBIHOSPITALARIO', doc.page.margins.left + 16, 70, { width: pageWidth - 32 });

  doc.y = 112;
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text('Paciente');
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(ink)
    .text(`${prescription.patient_name || '-'} · ${prescription.patient_code || ''}`)
    .fillColor(muted)
    .text(`Documento: ${prescription.patient_document_number || '-'}   Fecha: ${formatDateOnly(prescription.prescription_date)}`);

  if (prescription.diagnosis) {
    doc.moveDown(0.7).fillColor(ink).font('Helvetica-Bold').fontSize(10).text('Diagnóstico / motivo');
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(prescription.diagnosis, { width: pageWidth });
  }

  doc.moveDown(0.9).fillColor(brand).font('Helvetica-Bold').fontSize(11).text('Medicamentos');
  const tableTop = doc.y + 8;
  const columns = [0, 145, 245, 338, 430];
  const widths = [137, 90, 85, 84, 80];
  const headers = ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Cantidad'];
  doc.roundedRect(doc.page.margins.left, tableTop, pageWidth, 24, 8).fill(brand);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  headers.forEach((header, index) => {
    doc.text(header, doc.page.margins.left + columns[index] + 8, tableTop + 7, { width: widths[index] });
  });
  doc.y = tableTop + 30;

  for (const item of prescription.items || []) {
    const rowTop = doc.y;
    const medication = [
      item.medication_name,
      item.concentration,
      item.pharmaceutical_form
    ].filter(Boolean).join(' · ');
    const notes = item.instructions ? `\n${item.instructions}` : '';
    const rowHeight = Math.max(
      doc.heightOfString(`${medication}${notes}`, { width: widths[0], lineGap: 2 }) + 12,
      34
    );
    if (rowTop + rowHeight > doc.page.height - 118) {
      doc.addPage();
      doc.y = 48;
    }
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, rowHeight, 8).fill('#ffffff').stroke('#e2e8f0');
    const y = doc.y + 7;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5).text(medication || '-', doc.page.margins.left + 8, y, { width: widths[0] });
    if (item.instructions) {
      doc.fillColor(muted).font('Helvetica').fontSize(7.8).text(item.instructions, doc.page.margins.left + 8, y + 12, { width: widths[0], lineGap: 1 });
    }
    doc.fillColor(ink).font('Helvetica').fontSize(8.2)
      .text(item.dose || '-', doc.page.margins.left + columns[1] + 8, y, { width: widths[1] })
      .text(item.frequency || '-', doc.page.margins.left + columns[2] + 8, y, { width: widths[2] })
      .text(item.duration || '-', doc.page.margins.left + columns[3] + 8, y, { width: widths[3] })
      .text(item.quantity || '-', doc.page.margins.left + columns[4] + 8, y, { width: widths[4] });
    doc.y = rowTop + rowHeight + 7;
  }

  if (prescription.general_instructions) {
    doc.moveDown(0.6).fillColor(ink).font('Helvetica-Bold').fontSize(10).text('Indicaciones generales');
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(prescription.general_instructions, { width: pageWidth });
  }

  const signatureTop = Math.min(doc.y + 32, doc.page.height - 118);
  doc.strokeColor('#cbd5e1')
    .moveTo(doc.page.margins.left, signatureTop)
    .lineTo(doc.page.margins.left + 220, signatureTop)
    .stroke();
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(prescription.issued_by_name || 'Odontólogo responsable', doc.page.margins.left, signatureTop + 8, { width: 260 });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8)
    .text(`Documento: ${prescription.issued_by_document_number || '-'}`, { width: 260 });
  if (prescription.issued_by_invima_registration) {
    doc.text(`Registro: ${prescription.issued_by_invima_registration}`, { width: 260 });
  }

  doc.end();
  await finished(stream);
  return relativePath;
}

function clinicalDocumentTypeLabel(type) {
  const labels = {
    certificado: 'Certificado odontológico',
    incapacidad: 'Incapacidad odontológica',
    constancia: 'Constancia odontológica',
    remision: 'Remisión odontológica',
    otro: 'Documento odontológico'
  };
  return labels[type] || 'Documento odontológico';
}

async function buildOdontologyClinicalDocumentPdf(documentRow) {
  const relativeDir = path.join('uploads', 'clients', documentRow.client_id, 'odontology', 'documents');
  const fileName = `${documentRow.document_type}-${documentRow.id}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.promises.mkdir(fullDir, { recursive: true });

  const client = await getClientById(documentRow.client_id).catch(() => null);
  const doc = new PDFDocument({ size: 'A4', margin: 46 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  const brand = '#a64045';
  const ink = '#172033';
  const muted = '#64748b';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.roundedRect(doc.page.margins.left, 34, pageWidth, 62, 16).fill('#fff7f7');
  doc
    .fillColor(brand)
    .font('Helvetica-Bold')
    .fontSize(17)
    .text(clinicalDocumentTypeLabel(documentRow.document_type), doc.page.margins.left + 16, 48);
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(9)
    .text(client?.name || 'INBIHOSPITALARIO', doc.page.margins.left + 16, 72, { width: pageWidth - 32 });

  doc.y = 118;
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(11).text(documentRow.title || clinicalDocumentTypeLabel(documentRow.document_type));
  doc.moveDown(0.6);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(muted)
    .text(`Fecha: ${formatDateOnly(documentRow.document_date)}`)
    .text(`Paciente: ${documentRow.patient_name || '-'} · Documento: ${documentRow.patient_document_number || '-'}`);
  if (documentRow.document_type === 'incapacidad') {
    const period = [documentRow.start_date ? formatDateOnly(documentRow.start_date) : null, documentRow.end_date ? formatDateOnly(documentRow.end_date) : null]
      .filter(Boolean)
      .join(' - ');
    doc.text(`Periodo: ${period || '-'}${documentRow.days !== null && documentRow.days !== undefined ? ` · ${documentRow.days} día(s)` : ''}`);
  }

  doc.moveDown(1.2);
  doc
    .fillColor(ink)
    .font('Helvetica')
    .fontSize(10)
    .text(documentRow.body || '-', {
      width: pageWidth,
      align: 'justify',
      lineGap: 4
    });

  if (documentRow.recommendations) {
    doc.moveDown(1);
    doc.fillColor(brand).font('Helvetica-Bold').fontSize(10).text('Recomendaciones');
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(documentRow.recommendations, { width: pageWidth, lineGap: 3 });
  }

  const signatureTop = Math.min(doc.y + 42, doc.page.height - 122);
  doc.strokeColor('#cbd5e1')
    .moveTo(doc.page.margins.left, signatureTop)
    .lineTo(doc.page.margins.left + 230, signatureTop)
    .stroke();
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(documentRow.issued_by_name || 'Odontólogo responsable', doc.page.margins.left, signatureTop + 8, { width: 270 });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8)
    .text(`Documento: ${documentRow.issued_by_document_number || '-'}`, { width: 270 });
  if (documentRow.issued_by_invima_registration) {
    doc.text(`Registro: ${documentRow.issued_by_invima_registration}`, { width: 270 });
  }

  doc.end();
  await finished(stream);
  return relativePath;
}

async function buildOdontologyClinicalRecordPdf(record) {
  const relativeDir = path.join('uploads', 'clients', record.client_id, 'odontology', 'clinical-records');
  const fileName = `historia-clinica-${record.id}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  const publicPath = `/${relativePath}`.replace(/\\/g, '/');

  await fs.promises.mkdir(fullDir, { recursive: true });

  const client = await getClientById(record.client_id).catch(() => null);
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  const brand = '#a64045';
  const brandDark = '#7f1d1d';
  const ink = '#172033';
  const muted = '#64748b';
  const border = '#f0cfd3';
  const soft = '#fff7f7';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  const safe = (value) => (value === null || value === undefined || String(value).trim() === '' ? '-' : String(value).trim());

  const ensureSpace = (height = 96) => {
    if (doc.y + height > bottomLimit()) {
      doc.addPage();
      doc.y = 42;
    }
  };

  const section = (title) => {
    ensureSpace(56);
    doc.moveDown(0.7);
    doc
      .roundedRect(doc.page.margins.left, doc.y, pageWidth, 22, 8)
      .fill(brand);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(title, doc.page.margins.left + 10, doc.y + 6, { width: pageWidth - 20 });
    doc.y += 28;
  };

  const rows = (items, options = {}) => {
    const labelWidth = options.labelWidth || 145;
    const valueWidth = pageWidth - labelWidth;
    for (const [label, value] of items) {
      const cleanValue = safe(value);
      const height = Math.max(
        24,
        doc.heightOfString(cleanValue, { width: valueWidth - 14, lineGap: 2 }) + 12
      );
      ensureSpace(height + 4);
      const y = doc.y;
      doc.roundedRect(doc.page.margins.left, y, pageWidth, height, 6).fill('#ffffff').stroke(border);
      doc
        .fillColor(brandDark)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(label, doc.page.margins.left + 8, y + 7, { width: labelWidth - 14 });
      doc
        .fillColor(ink)
        .font('Helvetica')
        .fontSize(8.7)
        .text(cleanValue, doc.page.margins.left + labelWidth + 6, y + 7, {
          width: valueWidth - 14,
          lineGap: 2
        });
      doc.y = y + height + 5;
    }
  };

  doc.roundedRect(doc.page.margins.left, 34, pageWidth, 82, 16).fill(soft);
  drawClientLogoOrBadge(doc, client, { x: doc.page.margins.left + 14, y: 46, fit: [92, 46] });
  doc
    .fillColor(brand)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('Historia clínica odontológica', doc.page.margins.left + 120, 48, { width: pageWidth - 134 });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(client?.name || 'INBIHOSPITALARIO', doc.page.margins.left + 120, 72, { width: pageWidth - 134 })
    .text(`Generado: ${formatOdontologyConsentDate(new Date())}`, { width: pageWidth - 134 });

  doc.y = 132;
  section('DATOS DEL PACIENTE');
  rows([
    ['Paciente', `${safe(record.patient_name)} · Código ${safe(record.patient_code)}`],
    ['Documento', `${documentTypeLabel(record.patient_document_type)} ${safe(record.patient_document_number)}`],
    ['Nacimiento / sexo', `${formatDateOnly(record.patient_birth_date) || '-'} · ${sexLabel(record.patient_sex)}`],
    ['Contacto', `Tel: ${safe(record.patient_phone)} · Correo: ${safe(record.patient_email)}`],
    ['Dirección', record.patient_address]
  ]);

  section('DATOS DE ATENCIÓN');
  rows([
    ['Fecha creación', formatOdontologyConsentDate(record.created_at)],
    ['Cita relacionada', record.appointment_date
      ? `${formatDateOnly(record.appointment_date)} ${String(record.appointment_start_time || '').slice(0, 5)}`
      : 'Sin cita relacionada'],
    ['Odontólogo de la cita', record.dentist_name],
    ['Estado', record.status === 'signed' ? 'Firmada' : 'Borrador']
  ]);

  section('ANAMNESIS Y ANTECEDENTES');
  rows([
    ['Motivo de consulta', record.chief_complaint],
    ['Enfermedad actual', record.current_illness],
    ['Antecedentes médicos', record.medical_history],
    ['Antecedentes odontológicos', record.dental_history],
    ['Antecedentes familiares', record.family_history],
    ['Medicamentos actuales', record.current_medications],
    ['Alergias', record.allergies],
    ['Hábitos', record.habits]
  ]);

  section('EXAMEN, DIAGNÓSTICO Y PLAN');
  rows([
    ['Examen extraoral', record.extraoral_exam],
    ['Examen intraoral', record.intraoral_exam],
    ['Código diagnóstico', record.diagnosis_code],
    ['Diagnóstico', record.diagnosis_text],
    ['Plan de manejo', record.treatment_plan],
    ['Notas clínicas', record.clinical_notes]
  ]);

  if (Array.isArray(record.sterilization_cycles) && record.sterilization_cycles.length) {
    section('TRAZABILIDAD DE ESTERILIZACIÓN');
    rows(record.sterilization_cycles.map((cycle) => [
      cycle.cycle_code || cycle.id,
      [
        `Fecha: ${formatDateOnly(cycle.cycle_date)}`,
        `Método: ${odontologySterilizationMethodLabel(cycle.method)}`,
        `Resultado: ${odontologySterilizationResultLabel(cycle.result)}`,
        `Responsable: ${pdfSafe(cycle.operator_name)}`,
        `Instrumental: ${cycle.item_count || 0}`
      ].join(' · ')
    ]), { labelWidth: 130 });
  }

  section('FIRMAS Y RESPONSABLES');
  ensureSpace(144);
  const signatureTop = doc.y;
  const signatureWidth = (pageWidth - 18) / 2;
  const patientSignaturePath = record.patient_signature_path
    ? path.join(process.cwd(), String(record.patient_signature_path).replace(/^\//, ''))
    : null;
  const signaturePath = record.signed_by_signature_path
    ? path.join(process.cwd(), String(record.signed_by_signature_path).replace(/^\//, ''))
    : null;
  doc.roundedRect(doc.page.margins.left, signatureTop, signatureWidth, 72, 8).fill('#ffffff').stroke(border);
  doc.roundedRect(doc.page.margins.left + signatureWidth + 18, signatureTop, signatureWidth, 72, 8).fill('#ffffff').stroke(border);
  if (patientSignaturePath && fs.existsSync(patientSignaturePath)) {
    doc.image(patientSignaturePath, doc.page.margins.left + 12, signatureTop + 8, {
      fit: [signatureWidth - 24, 56],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text('Firma paciente/acudiente no registrada.', doc.page.margins.left, signatureTop + 28, {
        width: signatureWidth,
        align: 'center'
      });
  }
  if (signaturePath && fs.existsSync(signaturePath)) {
    doc.image(signaturePath, doc.page.margins.left + signatureWidth + 30, signatureTop + 8, {
      fit: [signatureWidth - 24, 56],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text('Firma digital no cargada.', doc.page.margins.left + signatureWidth + 18, signatureTop + 30, {
        width: signatureWidth,
        align: 'center'
      });
  }

  const infoTop = signatureTop + 80;
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text('Paciente / acudiente', doc.page.margins.left, infoTop, { width: signatureWidth });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8.2)
    .text(record.patient_signer_name || '-', { width: signatureWidth })
    .text(`${documentTypeLabel(record.patient_signer_document_type)} ${safe(record.patient_signer_document_number)}`, {
      width: signatureWidth
    });
  if (record.patient_signer_relationship) {
    doc.text(`Relación: ${record.patient_signer_relationship}`, { width: signatureWidth });
  }
  doc.text(`Fecha firma: ${formatOdontologyConsentDate(record.patient_signed_at) || '-'}`, { width: signatureWidth });

  const infoX = doc.page.margins.left + signatureWidth + 18;
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(record.signed_by_name || 'Odontólogo responsable', infoX, infoTop, {
      width: signatureWidth
    });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8.2)
    .text(`Documento: ${documentTypeLabel(record.signed_by_document_type)} ${safe(record.signed_by_document_number)}`, {
      width: signatureWidth
    })
    .text(`Registro profesional / INVIMA: ${safe(record.signed_by_invima_registration)}`, {
      width: signatureWidth
    })
    .text(`Fecha de firma: ${formatOdontologyConsentDate(record.signed_at) || '-'}`, {
      width: signatureWidth
    })
    .moveDown(0.4)
    .fillColor(brandDark)
    .font('Helvetica-Bold')
    .text('Historia clínica firmada digitalmente y bloqueada para edición.', {
      width: signatureWidth
    });

  doc.end();
  await finished(stream);
  return publicPath;
}

function pdfSafe(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function pdfFilename(value) {
  return String(value || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function odontogramSurfaceLabel(value) {
  const labels = {
    whole: 'Diente completo',
    occlusal: 'Oclusal',
    mesial: 'Mesial',
    distal: 'Distal',
    vestibular: 'Vestibular',
    lingual: 'Lingual',
    palatal: 'Palatal'
  };
  return labels[value] || value || '-';
}

function odontologyDentitionLabel(value) {
  const labels = {
    permanent: 'Permanente',
    temporary: 'Temporal',
    mixed: 'Mixta'
  };
  return labels[value] || value || '-';
}

function drawOdontologyReportHeader(doc, { title, subtitle, client }) {
  const brand = '#a64045';
  const muted = '#64748b';
  const soft = '#fff7f7';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.roundedRect(doc.page.margins.left, 34, pageWidth, 72, 16).fill(soft);
  drawClientLogoOrBadge(doc, client, { x: doc.page.margins.left + 14, y: 46, fit: [84, 42] });
  doc
    .fillColor(brand)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(title, doc.page.margins.left + 112, 50, { width: pageWidth - 126 });
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(subtitle || client?.name || 'INBIHOSPITALARIO', doc.page.margins.left + 112, 74, {
      width: pageWidth - 126
    })
    .text(`Generado: ${formatOdontologyConsentDate(new Date())}`, {
      width: pageWidth - 126
    });
  doc.y = 126;
}

function drawOdontologyInfoGrid(doc, items) {
  const brand = '#7f1d1d';
  const ink = '#172033';
  const border = '#f0cfd3';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = (pageWidth - 8) / 2;
  let x = doc.page.margins.left;
  let y = doc.y;

  items.forEach(([label, value], index) => {
    if (index > 0 && index % 2 === 0) {
      x = doc.page.margins.left;
      y += 38;
    }
    const boxHeight = 30;
    doc.roundedRect(x, y, columnWidth, boxHeight, 7).fill('#ffffff').stroke(border);
    doc.fillColor(brand).font('Helvetica-Bold').fontSize(7.5).text(label, x + 8, y + 6, { width: columnWidth - 16 });
    doc.fillColor(ink).font('Helvetica').fontSize(8.2).text(pdfSafe(value), x + 8, y + 17, { width: columnWidth - 16 });
    x += columnWidth + 8;
  });
  doc.y = y + 42;
}

function drawOdontologySectionTitle(doc, title) {
  const brand = '#a64045';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (doc.y + 42 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = 42;
  }
  doc.moveDown(0.5);
  doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 22, 8).fill(brand);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(title, doc.page.margins.left + 10, doc.y + 6, {
    width: pageWidth - 20
  });
  doc.y += 30;
}

function buildOdontologyOdontogramPdf(doc, { client, odontogram }) {
  const brand = '#a64045';
  const ink = '#172033';
  const muted = '#64748b';
  const border = '#f0cfd3';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const patient = odontogram.patient || {};
  const latest = odontogram.latest || [];
  const history = odontogram.history || [];

  drawOdontologyReportHeader(doc, {
    title: 'Odontograma',
    subtitle: client?.name || 'INBIHOSPITALARIO',
    client
  });
  drawOdontologyInfoGrid(doc, [
    ['Paciente', `${pdfSafe(patient.full_name)} · ${pdfSafe(patient.internal_code)}`],
    ['Documento', `${documentTypeLabel(patient.document_type)} ${pdfSafe(patient.document_number)}`],
    ['Nacimiento / sexo', `${formatDateOnly(patient.birth_date) || '-'} · ${sexLabel(patient.sex)}`],
    ['Contacto', `${pdfSafe(patient.phone)} · ${pdfSafe(patient.email)}`]
  ]);

  drawOdontologySectionTitle(doc, 'ESTADO ACTUAL POR DIENTE');
  if (!latest.length) {
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('No hay registros de odontograma para este paciente.');
  } else {
    const col = [0, 58, 128, 268, 342, 424];
    const widths = [48, 62, 130, 64, 74, 74];
    const headers = ['Diente', 'Superficie', 'Condición', 'Fecha', 'Responsable', 'Notas'];
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 22, 7).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.4);
    headers.forEach((header, index) => {
      doc.text(header, doc.page.margins.left + col[index] + 6, doc.y + 7, { width: widths[index] });
    });
    doc.y += 28;

    latest.forEach((entry) => {
      const y = doc.y;
      const notes = pdfSafe(entry.notes, '');
      const rowHeight = Math.max(
        30,
        doc.heightOfString(notes || '-', { width: widths[5], lineGap: 1 }) + 14,
        doc.heightOfString(entry.condition_name || '-', { width: widths[2], lineGap: 1 }) + 14
      );
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        doc.y = 42;
      }
      const rowY = doc.y;
      doc.roundedRect(doc.page.margins.left, rowY, pageWidth, rowHeight, 7).fill('#ffffff').stroke(border);
      doc.circle(doc.page.margins.left + col[2] + 11, rowY + 15, 4).fill(entry.condition_color || brand);
      doc.fillColor(ink).font('Helvetica').fontSize(7.5)
        .text(pdfSafe(entry.tooth_number), doc.page.margins.left + col[0] + 6, rowY + 9, { width: widths[0] })
        .text(odontogramSurfaceLabel(entry.surface), doc.page.margins.left + col[1] + 6, rowY + 9, { width: widths[1] })
        .text(pdfSafe(entry.condition_name), doc.page.margins.left + col[2] + 20, rowY + 9, { width: widths[2] - 14 })
        .text(formatDateOnly(entry.record_date) || '-', doc.page.margins.left + col[3] + 6, rowY + 9, { width: widths[3] })
        .text(pdfSafe(entry.created_by_name, 'Usuario'), doc.page.margins.left + col[4] + 6, rowY + 9, { width: widths[4] })
        .text(notes || '-', doc.page.margins.left + col[5] + 6, rowY + 9, { width: widths[5], lineGap: 1 });
      doc.y = rowY + rowHeight + 5;
    });
  }

  drawOdontologySectionTitle(doc, 'HISTORIAL DE CAMBIOS');
  const historyRows = history.slice(0, 80);
  if (!historyRows.length) {
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('Sin historial odontológico registrado.');
  } else {
    historyRows.forEach((entry) => {
      const text = `Diente ${entry.tooth_number} · ${entry.condition_name} · ${formatDateOnly(entry.record_date) || '-'} · ${entry.created_by_name || 'Usuario'}`;
      const y = doc.y;
      const height = Math.max(24, doc.heightOfString(`${text}\n${entry.notes || ''}`, { width: pageWidth - 18, lineGap: 1 }) + 12);
      if (y + height > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        doc.y = 42;
      }
      doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, height, 7).fill('#ffffff').stroke(border);
      doc.circle(doc.page.margins.left + 12, doc.y + 13, 4).fill(entry.condition_color || brand);
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.8).text(text, doc.page.margins.left + 24, doc.y + 7, {
        width: pageWidth - 34
      });
      if (entry.notes) {
        doc.fillColor(muted).font('Helvetica').fontSize(7.3).text(entry.notes, doc.page.margins.left + 24, doc.y + 17, {
          width: pageWidth - 34
        });
      }
      doc.y += height + 5;
    });
  }
}

function periodontalLine(item, prefix) {
  return [
    item[`${prefix}_mb`],
    item[`${prefix}_b`],
    item[`${prefix}_db`],
    item[`${prefix}_ml`],
    item[`${prefix}_l`],
    item[`${prefix}_dl`]
  ].map((value) => value === null || value === undefined ? '-' : value).join(' / ');
}

function periodontalBleedingLine(item) {
  const labels = [
    ['bleeding_mb', 'MB'],
    ['bleeding_b', 'B'],
    ['bleeding_db', 'DB'],
    ['bleeding_ml', 'ML'],
    ['bleeding_l', 'L'],
    ['bleeding_dl', 'DL']
  ];
  const active = labels.filter(([key]) => item[key]).map(([, label]) => label);
  return active.length ? active.join(', ') : 'No';
}

function buildOdontologyPeriodontogramPdf(doc, { client, chart }) {
  const brand = '#a64045';
  const ink = '#172033';
  const muted = '#64748b';
  const border = '#f0cfd3';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const measurements = chart.measurements || [];

  drawOdontologyReportHeader(doc, {
    title: 'Periodontograma',
    subtitle: client?.name || 'INBIHOSPITALARIO',
    client
  });
  drawOdontologyInfoGrid(doc, [
    ['Paciente', `${pdfSafe(chart.patient_name)} · ${pdfSafe(chart.patient_code)}`],
    ['Documento', pdfSafe(chart.patient_document_number)],
    ['Fecha', formatDateOnly(chart.chart_date) || '-'],
    ['Dentición', odontologyDentitionLabel(chart.dentition)]
  ]);

  if (chart.notes) {
    drawOdontologySectionTitle(doc, 'NOTAS GENERALES');
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 42, 8).fill('#ffffff').stroke(border);
    doc.fillColor(ink).font('Helvetica').fontSize(8.4).text(chart.notes, doc.page.margins.left + 10, doc.y + 9, {
      width: pageWidth - 20,
      lineGap: 2
    });
    doc.y += 50;
  }

  drawOdontologySectionTitle(doc, 'MEDICIONES PERIODONTALES');
  if (!measurements.length) {
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('No hay mediciones registradas.');
    return;
  }

  const col = [0, 42, 132, 222, 298, 368, 444];
  const widths = [34, 82, 82, 68, 62, 66, 62];
  const drawHeader = () => {
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 22, 7).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.1);
    ['Diente', 'Sondaje', 'Recesión', 'Sangrado', 'Placa/Cálc.', 'Mov/Furca', 'Notas'].forEach((header, index) => {
      doc.text(header, doc.page.margins.left + col[index] + 5, doc.y + 7, { width: widths[index] });
    });
    doc.y += 28;
  };

  drawHeader();
  measurements.forEach((item) => {
    const plaqueCalculus = [
      item.plaque ? 'Placa' : null,
      item.calculus ? 'Cálculo' : null
    ].filter(Boolean).join(', ') || '-';
    const mobilityFurcation = [
      item.mobility ? `Mov: ${item.mobility}` : null,
      item.furcation ? `Furca: ${item.furcation}` : null
    ].filter(Boolean).join(' · ') || '-';
    const notes = pdfSafe(item.notes, '-');
    const rowHeight = Math.max(32, doc.heightOfString(notes, { width: widths[6], lineGap: 1 }) + 14);
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = 42;
      drawHeader();
    }
    const y = doc.y;
    doc.roundedRect(doc.page.margins.left, y, pageWidth, rowHeight, 7).fill('#ffffff').stroke(border);
    doc.fillColor(ink).font('Helvetica').fontSize(7.1)
      .text(pdfSafe(item.tooth_number), doc.page.margins.left + col[0] + 5, y + 8, { width: widths[0] })
      .text(periodontalLine(item, 'probing'), doc.page.margins.left + col[1] + 5, y + 8, { width: widths[1] })
      .text(periodontalLine(item, 'recession'), doc.page.margins.left + col[2] + 5, y + 8, { width: widths[2] })
      .text(periodontalBleedingLine(item), doc.page.margins.left + col[3] + 5, y + 8, { width: widths[3] })
      .text(plaqueCalculus, doc.page.margins.left + col[4] + 5, y + 8, { width: widths[4] })
      .text(mobilityFurcation, doc.page.margins.left + col[5] + 5, y + 8, { width: widths[5] })
      .text(notes, doc.page.margins.left + col[6] + 5, y + 8, { width: widths[6], lineGap: 1 });
    doc.y = y + rowHeight + 5;
  });
}

function odontologyReportStatusLabel(status) {
  const labels = {
    draft: 'Borrador',
    signed: 'Firmado',
    proposed: 'Propuesto',
    accepted: 'Aceptado',
    in_progress: 'En tratamiento',
    completed: 'Completado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status || '-';
}

function odontologyTreatmentFinancialStatusLabel(status) {
  const labels = {
    'no-value': 'Sin valor',
    unpaid: 'Sin abonos',
    partial: 'Abono parcial',
    paid: 'Pagado'
  };
  return labels[status] || status || '-';
}

function odontologyTreatmentItemStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    completed: 'Realizado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status || '-';
}

function odontologyPaymentMethodLabel(method) {
  const labels = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    tarjeta_credito: 'Tarjeta de crédito',
    tarjeta_debito: 'Tarjeta débito',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    cheque: 'Cheque',
    convenio: 'Convenio',
    otro: 'Otro'
  };
  return labels[method] || method || '-';
}

function odontologyPaymentStatusLabel(status) {
  const labels = {
    registered: 'Registrado',
    voided: 'Anulado'
  };
  return labels[status] || status || '-';
}

function maskOdontologyPaymentFinancialFields(payment, canViewFinancial) {
  if (canViewFinancial || !payment) return payment;
  return {
    ...payment,
    amount: null,
    treatment_plan_total: null
  };
}

function maskOdontologyCashClosureFinancialFields(closure, canViewFinancial) {
  if (canViewFinancial || !closure) return closure;
  return {
    ...closure,
    total_registered: null,
    total_voided: null
  };
}

function maskOdontologyTreatmentPlanFinancialFields(plan, canViewFinancial) {
  if (canViewFinancial || !plan) return plan;
  return {
    ...plan,
    total_amount: null,
    paid_amount: null,
    balance_amount: null,
    items: (plan.items || []).map((item) => ({
      ...item,
      unit_price: null
    }))
  };
}

function maskOdontologyDashboardFinancialFields(dashboard, canViewFinancial) {
  if (canViewFinancial || !dashboard) return dashboard;
  return {
    ...dashboard,
    counters: {
      ...(dashboard.counters || {}),
      paymentsToday: null
    }
  };
}

function maskOdontologyReportFinancialFields(report, canViewFinancial) {
  if (canViewFinancial || !report) return report;
  return {
    ...report,
    counters: {
      ...(report.counters || {}),
      treatmentPlanAmount: null,
      paymentAmount: null
    },
    paymentsByMethod: (report.paymentsByMethod || []).map((row) => ({ ...row, total_amount: null })),
    treatmentPlanValuesByStatus: (report.treatmentPlanValuesByStatus || []).map((row) => ({ ...row, total_amount: null })),
    treatmentPlanFinancialSummary: (report.treatmentPlanFinancialSummary || []).map((row) => ({
      ...row,
      total_amount: null,
      paid_amount: null,
      balance_amount: null
    })),
    revenueByPeriod: (report.revenueByPeriod || []).map((row) => ({ ...row, total_amount: null })),
    inventoryConsumptionByProcedureDentist: (report.inventoryConsumptionByProcedureDentist || []).map((row) => ({
      ...row,
      estimated_total_cost: null
    }))
  };
}

function maskOdontologyReportDetailsFinancialFields(details, canViewFinancial) {
  if (canViewFinancial || !details) return details;
  return {
    ...details,
    payments: (details.payments || []).map((payment) => maskOdontologyPaymentFinancialFields(payment, false))
  };
}

function formatCopValue(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function clientInitials(client) {
  const words = String(client?.name || 'INBIHOSPITALARIO')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || 'IN').toUpperCase();
}

function resolveStoredFilePath(filePath) {
  const clean = String(filePath || '').replace(/^\/+/, '');
  if (!clean) return null;
  const fullPath = path.join(process.cwd(), clean);
  return fs.existsSync(fullPath) ? fullPath : null;
}

const MAINTENANCE_REPORT_PDF_TEMPLATE_VERSION = 'v4';

async function signMaintenanceReportWithSnapshot({ reportId, clientId, user, role }) {
  if (!user?.signature_path) return null;

  const snapshot = await createMaintenanceSignatureSnapshot({
    clientId,
    reportId,
    sourceSignaturePath: user.signature_path
  });
  try {
    return await signMaintenanceReport({
      reportId,
      userId: user.id,
      role,
      signaturePath: snapshot.publicPath,
      signerName: user.display_name || user.username || 'FIRMANTE AUTORIZADO',
      signerInvimaRegistration: user.invima_registration,
      signatureSha256: snapshot.sha256
    });
  } catch (error) {
    await removeMaintenanceSignatureSnapshot(snapshot.fullPath).catch(() => {});
    throw error;
  }
}

async function ensureMaintenanceReportSignatureSnapshots(report) {
  const signatures = await listReportSignatures(report.id);
  for (const signature of signatures) {
    if (isMaintenanceSignatureSnapshotPath(signature.signature_path, report.id)) continue;

    let snapshot;
    try {
      snapshot = await createMaintenanceSignatureSnapshot({
        clientId: report.client_id,
        reportId: report.id,
        sourceSignaturePath: signature.signature_path
      });
      const updated = await updateMaintenanceReportSignatureSnapshot({
        signatureId: signature.id,
        previousSignaturePath: signature.signature_path,
        signaturePath: snapshot.publicPath,
        signatureSha256: snapshot.sha256,
        signerName: signature.display_name,
        signerInvimaRegistration: signature.invima_registration
      });
      if (!updated) {
        await removeMaintenanceSignatureSnapshot(snapshot.fullPath);
      }
    } catch (error) {
      if (snapshot?.fullPath) {
        await removeMaintenanceSignatureSnapshot(snapshot.fullPath).catch(() => {});
      }
      console.error(
        `No se pudo inmovilizar la firma ${signature.id} del reporte ${report.id}`,
        error
      );
    }
  }
  return listReportSignatures(report.id);
}

function maintenanceReportPdfFilename(reportId) {
  return `reporte-${reportId}-${MAINTENANCE_REPORT_PDF_TEMPLATE_VERSION}.pdf`;
}

function maintenanceReportPdfUsesCurrentTemplate(pdfPath, reportId) {
  return path.basename(String(pdfPath || '')) === maintenanceReportPdfFilename(reportId);
}

function buildPdfKitBuffer(builder) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    builder(doc);
    doc.end();
  });
}

async function resolveAssetHistoryPdfFile(item) {
  let filePath = resolveStoredFilePath(item.pdf_path);
  if (
    item.item_type === 'maintenance_report' &&
    (!filePath || !maintenanceReportPdfUsesCurrentTemplate(item.pdf_path, item.id))
  ) {
    const publicPath = await writeMaintenanceReportPdfFile(item.id);
    filePath = resolveStoredFilePath(publicPath);
  }
  return filePath;
}

async function appendPdfFile(mergedPdf, filePath) {
  const sourceBytes = await fs.promises.readFile(filePath);
  const sourcePdf = await PdfMergerDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false
  });
  const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  for (const page of pages) {
    mergedPdf.addPage(page);
  }
}

async function buildAssetFullHistoryPdfBuffer({ client, asset, historyItems }) {
  const mergedPdf = await PdfMergerDocument.create({ updateMetadata: false });
  const basePdfBuffer = await buildPdfKitBuffer((doc) => buildAssetPdf(doc, { client, asset }));
  const basePdf = await PdfMergerDocument.load(basePdfBuffer, { updateMetadata: false });
  const basePages = await mergedPdf.copyPages(basePdf, basePdf.getPageIndices());
  for (const page of basePages) {
    mergedPdf.addPage(page);
  }

  for (const item of historyItems) {
    const filePath = await resolveAssetHistoryPdfFile(item);
    if (!filePath) continue;
    try {
      await appendPdfFile(mergedPdf, filePath);
    } catch (error) {
      console.warn(`No se pudo anexar PDF histórico ${item.id}`, error.message);
    }
  }

  return Buffer.from(await mergedPdf.save());
}

function drawClientLogoOrBadge(doc, client, { x, y, fit = [84, 42] }) {
  const logoPath = resolveStoredFilePath(client?.logo_path);
  if (logoPath) {
    try {
      doc.image(logoPath, x, y, { fit });
      return;
    } catch (error) {
      console.warn('No se pudo dibujar el logo del cliente en PDF', error.message);
    }
  }

  const [width, height] = fit;
  doc
    .roundedRect(x, y, width, height, 10)
    .fill('#ffffff')
    .stroke('#f0cfd3');
  doc
    .fillColor('#a64045')
    .font('Helvetica-Bold')
    .fontSize(Math.min(15, height / 2.2))
    .text(clientInitials(client), x, y + height / 2 - 8, {
      width,
      align: 'center'
    });
}

function drawReportMetricCard(doc, { x, y, width, title, value, caption, accent = '#a64045' }) {
  doc.roundedRect(x, y, width, 52, 12).fill('#ffffff').stroke('#f0cfd3');
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(7.4).text(title, x + 10, y + 9, {
    width: width - 20
  });
  doc.fillColor('#172033').font('Helvetica-Bold').fontSize(13).text(String(value ?? '-'), x + 10, y + 21, {
    width: width - 20
  });
  doc.fillColor('#64748b').font('Helvetica').fontSize(7.2).text(caption || '', x + 10, y + 39, {
    width: width - 20
  });
}

function drawReportList(doc, title, rows, columns) {
  const brand = '#a64045';
  const ink = '#172033';
  const muted = '#64748b';
  const border = '#f0cfd3';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  drawOdontologySectionTitle(doc, title);
  if (!rows.length) {
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text('Sin datos en el rango seleccionado.');
    doc.moveDown(0.4);
    return;
  }

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = pageWidth / totalWidth;
  const scaledColumns = columns.map((column) => ({ ...column, width: column.width * scale }));

  doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 21, 7).fill(brand);
  let x = doc.page.margins.left;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.4);
  scaledColumns.forEach((column) => {
    doc.text(column.label, x + 6, doc.y + 7, { width: column.width - 12, align: column.align || 'left' });
    x += column.width;
  });
  doc.y += 27;

  rows.forEach((row) => {
    const rowHeight = 28;
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = 42;
    }
    const y = doc.y;
    doc.roundedRect(doc.page.margins.left, y, pageWidth, rowHeight, 7).fill('#ffffff').stroke(border);
    x = doc.page.margins.left;
    doc.fillColor(ink).font('Helvetica').fontSize(7.8);
    scaledColumns.forEach((column) => {
      const value = typeof column.value === 'function' ? column.value(row) : row[column.value];
      doc.text(pdfSafe(value), x + 6, y + 9, { width: column.width - 12, align: column.align || 'left' });
      x += column.width;
    });
    doc.y = y + rowHeight + 5;
  });
}

function buildOdontologyReportsPdf(doc, { client, report }) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardGap = 8;
  const cardWidth = (pageWidth - cardGap * 3) / 4;

  drawOdontologyReportHeader(doc, {
    title: 'Reporte odontológico',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · ${formatDateOnly(report.range.startDate)} al ${formatDateOnly(report.range.endDate)}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Cliente', client?.name || 'INBIHOSPITALARIO'],
    ['Rango', `${formatDateOnly(report.range.startDate)} - ${formatDateOnly(report.range.endDate)}`],
    ['Generado por', 'INBIHOSPITALARIO'],
    ['Tipo de reporte', 'Clínico, agenda, pagos y soportes']
  ]);

  const cards = [
    ['Pacientes nuevos', report.counters.newPatients, 'Registros creados'],
    ['Citas', report.counters.appointments, `${report.counters.attendedAppointments} atendidas`],
    ['Pagos', formatCopValue(report.counters.paymentAmount), `${report.counters.payments} pagos`],
    ['Planes', formatCopValue(report.counters.treatmentPlanAmount), `${report.counters.treatmentPlans} creados`],
    ['Historias firmadas', report.counters.clinicalSigned, `${report.counters.clinicalDrafts} borrador`],
    ['Consentimientos', report.counters.consentsSigned, `${report.counters.consentsDraft} borrador`],
    ['Adjuntos', report.counters.attachments, 'Soportes cargados'],
    ['Canceladas / no asistió', report.counters.cancelledOrMissedAppointments, 'Seguimiento agenda']
  ];

  let x = doc.page.margins.left;
  let y = doc.y;
  cards.forEach(([title, value, caption], index) => {
    if (index > 0 && index % 4 === 0) {
      x = doc.page.margins.left;
      y += 62;
    }
    drawReportMetricCard(doc, { x, y, width: cardWidth, title, value, caption });
    x += cardWidth + cardGap;
  });
  doc.y = y + 66;

  drawReportList(doc, 'CITAS POR ESTADO', report.appointmentsByStatus || [], [
    { label: 'Estado', value: 'status', width: 340 },
    { label: 'Cantidad', value: 'total', width: 100, align: 'right' }
  ]);
  drawReportList(doc, 'PROCEDIMIENTOS PRINCIPALES', report.topProcedures || [], [
    { label: 'Procedimiento', value: 'name', width: 340 },
    { label: 'Cantidad', value: 'total', width: 100, align: 'right' }
  ]);
  drawReportList(doc, 'PAGOS POR MÉTODO', report.paymentsByMethod || [], [
    { label: 'Método', value: (row) => odontologyPaymentMethodLabel(row.method), width: 230 },
    { label: 'Cantidad', value: 'total', width: 90, align: 'right' },
    { label: 'Valor', value: (row) => formatCopValue(row.total_amount), width: 120, align: 'right' }
  ]);
  drawReportList(doc, 'INGRESOS POR PERIODO', report.revenueByPeriod || [], [
    { label: 'Fecha', value: (row) => formatDateOnly(row.period_date), width: 180 },
    { label: 'Pagos', value: 'total', width: 90, align: 'right' },
    { label: 'Valor', value: (row) => formatCopValue(row.total_amount), width: 170, align: 'right' }
  ]);
  drawReportList(doc, 'TRATAMIENTOS POR ESTADO', report.treatmentPlanValuesByStatus || [], [
    { label: 'Estado', value: (row) => odontologyReportStatusLabel(row.status), width: 220 },
    { label: 'Cantidad', value: 'total', width: 90, align: 'right' },
    { label: 'Valor proyectado', value: (row) => formatCopValue(row.total_amount), width: 170, align: 'right' }
  ]);
  drawReportList(doc, 'PLANES POR ESTADO DE PAGO', report.treatmentPlanFinancialSummary || [], [
    { label: 'Estado pago', value: (row) => odontologyTreatmentFinancialStatusLabel(row.financial_status), width: 142 },
    { label: 'Planes', value: 'total', width: 58, align: 'right' },
    { label: 'Total', value: (row) => formatCopValue(row.total_amount), width: 104, align: 'right' },
    { label: 'Pagado', value: (row) => formatCopValue(row.paid_amount), width: 104, align: 'right' },
    { label: 'Saldo', value: (row) => formatCopValue(row.balance_amount), width: 104, align: 'right' }
  ]);
  drawReportList(doc, 'CONSUMO DE INVENTARIO POR PROCEDIMIENTO Y ODONTÓLOGO', report.inventoryConsumptionByProcedureDentist || [], [
    { label: 'Procedimiento', value: 'procedure_name', width: 128 },
    { label: 'Odontólogo', value: 'dentist_name', width: 116 },
    { label: 'Insumo', value: 'item_name', width: 112 },
    { label: 'Cantidad', value: (row) => `${row.total_quantity} ${row.item_unit || ''}`, width: 74, align: 'right' },
    { label: 'Costo', value: (row) => formatCopValue(row.estimated_total_cost), width: 90, align: 'right' }
  ]);
  drawReportList(doc, 'PRODUCCIÓN POR ODONTÓLOGO', report.productionByDentist || [], [
    { label: 'Odontólogo', value: 'dentist_name', width: 220 },
    { label: 'Citas', value: 'total', width: 70, align: 'right' },
    { label: 'Atendidas', value: 'attended', width: 80, align: 'right' },
    { label: 'Canceladas / no asistió', value: 'cancelled_or_missed', width: 110, align: 'right' }
  ]);
  drawReportList(doc, 'INASISTENCIAS Y CANCELACIONES', report.cancellationsAndNoShows || [], [
    { label: 'Fecha', value: (row) => `${formatDateOnly(row.scheduled_date)} ${String(row.start_time || '').slice(0, 5)}`, width: 94 },
    { label: 'Estado', value: 'status', width: 74 },
    { label: 'Paciente', value: 'patient_name', width: 126 },
    { label: 'Odontólogo', value: 'dentist_name', width: 126 },
    { label: 'Motivo', value: (row) => String(row.cancellation_reason || '-').slice(0, 80), width: 130 }
  ]);
  drawReportList(doc, 'PLANES POR ESTADO', report.treatmentPlansByStatus || [], [
    { label: 'Estado', value: (row) => odontologyReportStatusLabel(row.status), width: 340 },
    { label: 'Cantidad', value: 'total', width: 100, align: 'right' }
  ]);
  drawReportList(doc, 'HISTORIAS CLÍNICAS', report.clinicalByStatus || [], [
    { label: 'Estado', value: (row) => odontologyReportStatusLabel(row.status), width: 340 },
    { label: 'Cantidad', value: 'total', width: 100, align: 'right' }
  ]);
  drawReportList(doc, 'CONSENTIMIENTOS', report.consentsByStatus || [], [
    { label: 'Estado', value: (row) => odontologyReportStatusLabel(row.status), width: 340 },
    { label: 'Cantidad', value: 'total', width: 100, align: 'right' }
  ]);
}

function buildOdontologyTreatmentPlanPdf(doc, { client, plan }) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const paid = Number(plan.paid_amount || 0);
  const balance = Number(plan.balance_amount || 0);

  drawOdontologyReportHeader(doc, {
    title: 'Presupuesto / Plan de tratamiento',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · ${plan.title}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Paciente', `${plan.patient_name} · ${plan.patient_code || 'Sin código'}`],
    ['Documento', plan.patient_document_number || '-'],
    ['Estado del plan', odontologyReportStatusLabel(plan.status)],
    ['Historia asociada', plan.clinical_record_status ? odontologyReportStatusLabel(plan.clinical_record_status) : 'Sin historia asociada'],
    ['Total plan', formatCopValue(plan.total_amount)],
    ['Pagado', formatCopValue(paid)],
    ['Saldo', formatCopValue(balance)],
    ['Fecha', formatOdontologyConsentDate(plan.created_at)]
  ]);

  drawReportList(doc, 'PROCEDIMIENTOS PROPUESTOS', plan.items || [], [
    { label: 'Procedimiento', value: 'procedure_name', width: 190 },
    { label: 'Diente', value: (row) => row.tooth_number || '-', width: 54 },
    { label: 'Cant.', value: 'quantity', width: 46, align: 'right' },
    { label: 'Ses.', value: 'estimated_sessions', width: 46, align: 'right' },
    { label: 'Estado', value: (row) => odontologyTreatmentItemStatusLabel(row.status), width: 76 },
    { label: 'Valor unit.', value: (row) => formatCopValue(row.unit_price), width: 86, align: 'right' },
    { label: 'Subtotal', value: (row) => formatCopValue(Number(row.quantity || 0) * Number(row.unit_price || 0)), width: 92, align: 'right' }
  ]);

  const descriptiveRows = [
    ['Diagnóstico', plan.diagnosis_text],
    ['Objetivo', plan.objective],
    ['Notas clínicas / administrativas', plan.notes]
  ].filter(([, value]) => String(value || '').trim());

  if (descriptiveRows.length) {
    drawReportList(doc, 'DESCRIPCIÓN DEL PLAN', descriptiveRows.map(([label, value]) => ({ label, value })), [
      { label: 'Campo', value: 'label', width: 150 },
      { label: 'Detalle', value: 'value', width: 390 }
    ]);
  }

  drawOdontologySectionTitle(doc, 'RESUMEN ECONÓMICO');
  const y = doc.y;
  const cardWidth = (pageWidth - 16) / 3;
  drawReportMetricCard(doc, {
    x: doc.page.margins.left,
    y,
    width: cardWidth,
    title: 'Valor total',
    value: formatCopValue(plan.total_amount),
    caption: `${(plan.items || []).length} procedimiento(s)`
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + cardWidth + 8,
    y,
    width: cardWidth,
    title: 'Pagado',
    value: formatCopValue(paid),
    caption: 'Pagos registrados'
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + (cardWidth + 8) * 2,
    y,
    width: cardWidth,
    title: 'Saldo',
    value: formatCopValue(balance),
    caption: 'Pendiente por pagar'
  });
  doc.y = y + 66;

  drawOdontologySectionTitle(doc, 'ACEPTACIÓN');
  doc
    .fillColor('#172033')
    .font('Helvetica')
    .fontSize(8.4)
    .text('Este documento presenta una propuesta de tratamiento y presupuesto. La aceptación del paciente/acudiente confirma que conoce el alcance económico y clínico del plan, sin reemplazar los consentimientos específicos que apliquen por procedimiento.', {
      align: 'justify',
      lineGap: 2
    });
  doc.moveDown(1.2);
  const signatureY = doc.y;
  const signatureWidth = (pageWidth - 28) / 2;
  const patientSignaturePath = plan.accepted_signature_path
    ? path.join(process.cwd(), String(plan.accepted_signature_path).replace(/^\//, ''))
    : null;
  const creatorSignaturePath = plan.created_by_signature_path
    ? path.join(process.cwd(), String(plan.created_by_signature_path).replace(/^\//, ''))
    : null;
  doc.roundedRect(doc.page.margins.left, signatureY, signatureWidth, 64, 10).fill('#ffffff').stroke('#f0cfd3');
  doc.roundedRect(doc.page.margins.left + signatureWidth + 28, signatureY, signatureWidth, 64, 10).fill('#ffffff').stroke('#f0cfd3');
  if (patientSignaturePath && fs.existsSync(patientSignaturePath)) {
    doc.image(patientSignaturePath, doc.page.margins.left + 12, signatureY + 8, {
      fit: [signatureWidth - 24, 46],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(7.8)
      .text('Aceptación pendiente', doc.page.margins.left, signatureY + 27, { width: signatureWidth, align: 'center' });
  }
  if (creatorSignaturePath && fs.existsSync(creatorSignaturePath)) {
    doc.image(creatorSignaturePath, doc.page.margins.left + signatureWidth + 40, signatureY + 8, {
      fit: [signatureWidth - 24, 46],
      align: 'center',
      valign: 'center'
    });
  }
  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7.8)
    .text('Firma paciente / acudiente', doc.page.margins.left, signatureY + 72, { width: signatureWidth, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(7.6)
    .text(plan.accepted_signer_name || '-', { width: signatureWidth, align: 'center' })
    .text(`${documentTypeLabel(plan.accepted_signer_document_type)} ${plan.accepted_signer_document_number || ''}`.trim() || '-', {
      width: signatureWidth,
      align: 'center'
    });
  if (plan.accepted_signer_relationship) {
    doc.text(`Relación: ${plan.accepted_signer_relationship}`, { width: signatureWidth, align: 'center' });
  }
  doc.text(`Fecha aceptación: ${formatOdontologyConsentDate(plan.accepted_at) || 'Pendiente'}`, { width: signatureWidth, align: 'center' });

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7.8)
    .text('Profesional / responsable', doc.page.margins.left + signatureWidth + 28, signatureY + 72, { width: signatureWidth, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(7.6)
    .text(plan.created_by_name || 'No registrado', { width: signatureWidth, align: 'center' })
    .text(`Registró aceptación: ${plan.accepted_by_name || '-'}`, { width: signatureWidth, align: 'center' });
}

function buildOdontologyPaymentReceiptPdf(doc, { client, payment }) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const receiptNumber = String(payment.id || '').slice(0, 8).toUpperCase();

  drawOdontologyReportHeader(doc, {
    title: 'Recibo de pago odontológico',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · Recibo ${receiptNumber}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Recibo', receiptNumber],
    ['Estado', odontologyPaymentStatusLabel(payment.status)],
    ['Paciente', `${payment.patient_name} · ${payment.patient_code || 'Sin código'}`],
    ['Documento', payment.patient_document_number || '-'],
    ['Fecha de pago', formatDateOnly(payment.payment_date)],
    ['Método', odontologyPaymentMethodLabel(payment.payment_method)],
    ['Valor recibido', formatCopValue(payment.amount)],
    ['Registrado por', payment.created_by_name || 'No registrado']
  ]);

  drawOdontologySectionTitle(doc, 'DETALLE DEL PAGO');
  drawReportList(doc, 'CONCEPTO Y REFERENCIA', [
    { label: 'Concepto', value: payment.concept },
    { label: 'Plan de tratamiento', value: payment.treatment_plan_title || 'Pago general' },
    { label: 'Valor del plan', value: payment.treatment_plan_total ? formatCopValue(payment.treatment_plan_total) : 'No aplica' },
    { label: 'Referencia', value: payment.reference || '-' },
    { label: 'Notas', value: payment.notes || '-' }
  ], [
    { label: 'Campo', value: 'label', width: 160 },
    { label: 'Detalle', value: 'value', width: 380 }
  ]);

  const y = doc.y;
  const cardWidth = (pageWidth - 16) / 3;
  drawReportMetricCard(doc, {
    x: doc.page.margins.left,
    y,
    width: cardWidth,
    title: 'Valor pagado',
    value: formatCopValue(payment.amount),
    caption: odontologyPaymentMethodLabel(payment.payment_method)
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + cardWidth + 8,
    y,
    width: cardWidth,
    title: 'Fecha',
    value: formatDateOnly(payment.payment_date),
    caption: 'Fecha contable'
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + (cardWidth + 8) * 2,
    y,
    width: cardWidth,
    title: 'Estado',
    value: odontologyPaymentStatusLabel(payment.status),
    caption: payment.status === 'voided' ? 'Pago anulado' : 'Pago válido'
  });
  doc.y = y + 68;

  if (payment.status === 'voided') {
    drawOdontologySectionTitle(doc, 'ANULACIÓN');
    drawReportList(doc, 'DETALLE DE ANULACIÓN', [
      { label: 'Motivo', value: payment.void_reason || '-' },
      { label: 'Anulado por', value: payment.voided_by_name || '-' },
      { label: 'Fecha anulación', value: payment.voided_at ? formatOdontologyConsentDate(payment.voided_at) : '-' }
    ], [
      { label: 'Campo', value: 'label', width: 160 },
      { label: 'Detalle', value: 'value', width: 380 }
    ]);
  }

  drawOdontologySectionTitle(doc, 'CONSTANCIA');
  doc
    .fillColor('#172033')
    .font('Helvetica')
    .fontSize(8.6)
    .text('Este recibo certifica el registro del pago en el software odontológico. Su validez administrativa depende de la verificación interna del cliente y de los comprobantes externos cuando apliquen.', {
      align: 'justify',
      lineGap: 2
    });
  doc.moveDown(1.3);
  doc
    .moveTo(doc.page.margins.left, doc.y + 34)
    .lineTo(doc.page.margins.left + 220, doc.y + 34)
    .stroke('#f0cfd3');
  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7.8)
    .text('Firma / sello de recepción', doc.page.margins.left, doc.y + 40, { width: 220, align: 'center' });
}

function buildOdontologyPaymentCashierReportPdf(doc, { client, payments, filters }) {
  const registered = payments.filter((payment) => payment.status === 'registered');
  const voided = payments.filter((payment) => payment.status === 'voided');
  const totalRegistered = registered.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalVoided = voided.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const byCashier = Array.from(payments.reduce((map, payment) => {
    const key = payment.created_by_name || 'No registrado';
    const row = map.get(key) || { cashier: key, total: 0, registered: 0, voided: 0, amount: 0 };
    row.total += 1;
    if (payment.status === 'registered') {
      row.registered += 1;
      row.amount += Number(payment.amount || 0);
    } else {
      row.voided += 1;
    }
    map.set(key, row);
    return map;
  }, new Map()).values());

  drawOdontologyReportHeader(doc, {
    title: 'Reporte de pagos por cajero',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · ${formatDateOnly(filters.startDate)} al ${formatDateOnly(filters.endDate)}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Cliente', client?.name || 'INBIHOSPITALARIO'],
    ['Rango', `${formatDateOnly(filters.startDate)} - ${formatDateOnly(filters.endDate)}`],
    ['Cajero / usuario', filters.cashier || 'Todos'],
    ['Estado', filters.status ? odontologyPaymentStatusLabel(filters.status) : 'Todos'],
    ['Pagos registrados', registered.length],
    ['Pagos anulados', voided.length],
    ['Total recibido', formatCopValue(totalRegistered)],
    ['Total anulado', formatCopValue(totalVoided)]
  ]);

  drawReportList(doc, 'RESUMEN POR CAJERO / USUARIO', byCashier, [
    { label: 'Cajero / usuario', value: 'cashier', width: 230 },
    { label: 'Registrados', value: 'registered', width: 90, align: 'right' },
    { label: 'Anulados', value: 'voided', width: 80, align: 'right' },
    { label: 'Total pagos', value: 'total', width: 80, align: 'right' },
    { label: 'Valor recibido', value: (row) => formatCopValue(row.amount), width: 130, align: 'right' }
  ]);

  drawReportList(doc, 'DETALLE DE PAGOS', payments, [
    { label: 'Fecha', value: (row) => formatDateOnly(row.payment_date), width: 74 },
    { label: 'Paciente', value: 'patient_name', width: 126 },
    { label: 'Concepto', value: 'concept', width: 120 },
    { label: 'Método', value: (row) => odontologyPaymentMethodLabel(row.payment_method), width: 78 },
    { label: 'Cajero', value: (row) => row.created_by_name || '-', width: 94 },
    { label: 'Estado', value: (row) => odontologyPaymentStatusLabel(row.status), width: 66 },
    { label: 'Valor', value: (row) => formatCopValue(row.amount), width: 82, align: 'right' }
  ]);
}

function buildOdontologyCashClosurePdf(doc, { client, closure, payments }) {
  const registered = payments.filter((payment) => payment.status === 'registered');
  const voided = payments.filter((payment) => payment.status === 'voided');
  const totalRegistered = Number(closure.total_registered || 0);
  const totalVoided = Number(closure.total_voided || 0);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardWidth = (pageWidth - 16) / 3;

  drawOdontologyReportHeader(doc, {
    title: 'Cierre de caja odontológico',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · ${formatDateOnly(closure.date_from)} al ${formatDateOnly(closure.date_to)}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Cliente', client?.name || 'INBIHOSPITALARIO'],
    ['Rango cerrado', `${formatDateOnly(closure.date_from)} - ${formatDateOnly(closure.date_to)}`],
    ['Cajero / usuario', closure.cashier_filter || 'Todos'],
    ['Cerrado por', closure.created_by_name || 'No registrado'],
    ['Fecha de cierre', formatOdontologyConsentDate(closure.created_at)],
    ['Estado', 'Cierre generado']
  ]);

  const metricY = doc.y + 12;
  drawReportMetricCard(doc, {
    x: doc.page.margins.left,
    y: metricY,
    width: cardWidth,
    title: 'Total recibido',
    value: formatCopValue(totalRegistered),
    caption: `${closure.registered_count || registered.length} pagos registrados`
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + cardWidth + 8,
    y: metricY,
    width: cardWidth,
    title: 'Total anulado',
    value: formatCopValue(totalVoided),
    caption: `${closure.voided_count || voided.length} pagos anulados`
  });
  drawReportMetricCard(doc, {
    x: doc.page.margins.left + (cardWidth + 8) * 2,
    y: metricY,
    width: cardWidth,
    title: 'Neto operativo',
    value: formatCopValue(totalRegistered - totalVoided),
    caption: 'Recibido menos anulados'
  });
  doc.y = metricY + 72;

  if (closure.notes) {
    drawOdontologySectionTitle(doc, 'OBSERVACIONES DEL CIERRE');
    doc
      .fillColor('#172033')
      .font('Helvetica')
      .fontSize(8.4)
      .text(pdfSafe(closure.notes), { align: 'justify', lineGap: 2 });
  }

  drawReportList(doc, 'DETALLE DE PAGOS DEL CIERRE', payments, [
    { label: 'Fecha', value: (row) => formatDateOnly(row.payment_date), width: 72 },
    { label: 'Paciente', value: 'patient_name', width: 132 },
    { label: 'Concepto', value: 'concept', width: 130 },
    { label: 'Método', value: (row) => odontologyPaymentMethodLabel(row.payment_method), width: 80 },
    { label: 'Estado', value: (row) => odontologyPaymentStatusLabel(row.status), width: 70 },
    { label: 'Valor', value: (row) => formatCopValue(row.amount), width: 86, align: 'right' }
  ]);

  doc.moveDown(0.8);
  const signatureY = doc.y + 8;
  doc
    .moveTo(doc.page.margins.left, signatureY + 34)
    .lineTo(doc.page.margins.left + 230, signatureY + 34)
    .stroke('#f0cfd3');
  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7.8)
    .text('Firma / responsable de cierre', doc.page.margins.left, signatureY + 40, { width: 230, align: 'center' });
}

async function buildOdontologyCashClosurePdfFile({ client, closure, payments }) {
  const relativeDir = path.join('uploads', 'clients', closure.client_id, 'odontology', 'payments', 'cash-closures');
  const fileName = `${pdfFilename(`cierre-caja-${closure.date_from}-${closure.date_to}-${closure.id}`)}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  const publicPath = `/${relativePath}`.replace(/\\/g, '/');

  await fs.promises.mkdir(fullDir, { recursive: true });

  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);
  buildOdontologyCashClosurePdf(doc, { client, closure, payments });
  doc.end();
  await finished(stream);
  return publicPath;
}

function odontologySterilizationMethodLabel(value) {
  const labels = {
    autoclave: 'Autoclave',
    chemical: 'Químico',
    dry_heat: 'Calor seco',
    other: 'Otro'
  };
  return labels[value] || value || '-';
}

function odontologySterilizationResultLabel(value) {
  const labels = {
    successful: 'Exitoso',
    failed: 'Fallido',
    pending: 'Pendiente'
  };
  return labels[value] || value || '-';
}

function buildOdontologySterilizationCyclePdf(doc, { client, cycle }) {
  drawOdontologyReportHeader(doc, {
    title: 'Certificado interno de esterilización',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · Ciclo ${cycle.cycle_code || cycle.id}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Código / lote', cycle.cycle_code || cycle.id],
    ['Fecha del ciclo', formatDateOnly(cycle.cycle_date)],
    ['Método', odontologySterilizationMethodLabel(cycle.method)],
    ['Resultado', odontologySterilizationResultLabel(cycle.result)],
    ['Hora de inicio', cycle.start_time ? String(cycle.start_time).slice(0, 5) : '-'],
    ['Hora de fin', cycle.end_time ? String(cycle.end_time).slice(0, 5) : '-'],
    ['Responsable', cycle.operator_name || cycle.created_by_name || 'No registrado'],
    ['Instrumental procesado', cycle.item_count || cycle.items?.length || 0]
  ]);

  drawReportList(doc, 'PARÁMETROS E INDICADORES', [
    { label: 'Temperatura', value: cycle.temperature || '-' },
    { label: 'Presión', value: cycle.pressure || '-' },
    { label: 'Indicador biológico', value: cycle.biological_indicator || '-' },
    { label: 'Indicador químico', value: cycle.chemical_indicator || '-' }
  ], [
    { label: 'Campo', value: 'label', width: 190 },
    { label: 'Registro', value: 'value', width: 350 }
  ]);

  drawReportList(doc, 'TRAZABILIDAD CLÍNICA', [
    { label: 'Paciente', value: cycle.patient_name || 'Sin cita asociada' },
    { label: 'Procedimiento', value: cycle.procedure_name || 'No aplica' },
    {
      label: 'Cita',
      value: cycle.appointment_date
        ? `${formatDateOnly(cycle.appointment_date)} ${cycle.appointment_start_time ? String(cycle.appointment_start_time).slice(0, 5) : ''}`.trim()
        : 'No aplica'
    }
  ], [
    { label: 'Campo', value: 'label', width: 190 },
    { label: 'Detalle', value: 'value', width: 350 }
  ]);

  drawReportList(doc, 'INSTRUMENTAL PROCESADO', cycle.items || [], [
    { label: 'Código', value: (row) => row.instrument_code || '-', width: 90 },
    { label: 'Instrumental', value: 'instrument_name', width: 220 },
    { label: 'Categoría', value: (row) => row.instrument_category || '-', width: 120 },
    { label: 'Cantidad', value: 'quantity', width: 70, align: 'right' },
    { label: 'Nota', value: (row) => row.notes || '-', width: 130 }
  ]);

  if (cycle.observations) {
    drawOdontologySectionTitle(doc, 'OBSERVACIONES');
    doc
      .fillColor('#172033')
      .font('Helvetica')
      .fontSize(8.6)
      .text(pdfSafe(cycle.observations), {
        align: 'justify',
        lineGap: 2
      });
  }

  drawOdontologySectionTitle(doc, 'RESPONSABLE Y CONTROL DOCUMENTAL');
  doc
    .fillColor('#172033')
    .font('Helvetica')
    .fontSize(8.4)
    .text(`Registrado por: ${pdfSafe(cycle.created_by_name || cycle.operator_name)}`)
    .text(`Generado: ${formatOdontologyConsentDate(new Date())}`)
    .text('Documento interno para soporte de trazabilidad, auditoría y control de esterilización odontológica.');
}

async function buildOdontologySterilizationCyclePdfFile({ client, cycle }) {
  const relativeDir = path.join('uploads', 'clients', cycle.client_id, 'odontology', 'sterilization');
  const fileName = `${pdfFilename(`ciclo-esterilizacion-${cycle.cycle_code || cycle.id}`)}.pdf`;
  const relativePath = path.join(relativeDir, fileName);
  const fullDir = path.join(process.cwd(), relativeDir);
  const fullPath = path.join(process.cwd(), relativePath);
  const publicPath = `/${relativePath}`.replace(/\\/g, '/');

  await fs.promises.mkdir(fullDir, { recursive: true });

  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);
  buildOdontologySterilizationCyclePdf(doc, { client, cycle });
  doc.end();
  await finished(stream);
  return publicPath;
}

function buildOdontologySterilizationLabelsPdf(doc, { client, cycle }) {
  const brand = '#a64045';
  const brandDark = '#7f1d1d';
  const ink = '#172033';
  const muted = '#64748b';
  const border = '#f0cfd3';
  const soft = '#fff7f7';
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const labelWidth = (pageWidth - gap) / 2;
  const labelHeight = 92;
  const labels = [];

  for (const item of cycle.items || []) {
    const quantity = Math.max(1, Math.min(Number(item.quantity || 1), 120 - labels.length));
    for (let index = 0; index < quantity; index += 1) {
      labels.push({
        ...item,
        copyIndex: index + 1,
        copyTotal: Number(item.quantity || 1)
      });
      if (labels.length >= 120) break;
    }
    if (labels.length >= 120) break;
  }

  const drawPageHeader = () => {
    doc.fillColor(brand).font('Helvetica-Bold').fontSize(13).text('Etiquetas de esterilización', doc.page.margins.left, 22, {
      width: pageWidth - 110
    });
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(7.8)
      .text(`${client?.name || 'INBIHOSPITALARIO'} · Ciclo ${cycle.cycle_code || cycle.id}`, {
        width: pageWidth - 110
      });
    drawClientLogoOrBadge(doc, client, { x: doc.page.width - doc.page.margins.right - 86, y: 18, fit: [82, 34] });
    doc.y = 62;
  };

  drawPageHeader();

  if (!labels.length) {
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('Este ciclo no tiene instrumental asociado.');
    return;
  }

  labels.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor((index % 10) / 2);
    if (index > 0 && index % 10 === 0) {
      doc.addPage();
      drawPageHeader();
    }

    const x = doc.page.margins.left + column * (labelWidth + gap);
    const y = 70 + row * (labelHeight + 8);
    const resultColor = cycle.result === 'successful' ? '#15803d' : cycle.result === 'failed' ? '#b91c1c' : '#92400e';

    doc.roundedRect(x, y, labelWidth, labelHeight, 10).fill('#ffffff').stroke(border);
    doc.roundedRect(x + 8, y + 8, labelWidth - 16, 19, 7).fill(soft);
    doc.fillColor(brandDark).font('Helvetica-Bold').fontSize(7.3).text('LOTE / CICLO', x + 14, y + 13, { width: 72 });
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.4).text(pdfSafe(cycle.cycle_code || cycle.id), x + 84, y + 12, {
      width: labelWidth - 104,
      align: 'right'
    });

    doc
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(pdfSafe(item.instrument_name), x + 12, y + 34, { width: labelWidth - 24, height: 24 });
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(7.2)
      .text(`Código: ${pdfSafe(item.instrument_code)} · ${pdfSafe(item.instrument_category, 'Sin categoría')}`, x + 12, y + 55, {
        width: labelWidth - 24
      });
    doc
      .fillColor(muted)
      .fontSize(7.2)
      .text(`Fecha: ${formatDateOnly(cycle.cycle_date)} · Método: ${odontologySterilizationMethodLabel(cycle.method)}`, x + 12, y + 67, {
        width: labelWidth - 24
      });
    doc
      .fillColor(resultColor)
      .font('Helvetica-Bold')
      .fontSize(7.4)
      .text(`Resultado: ${odontologySterilizationResultLabel(cycle.result)}`, x + 12, y + 79, {
        width: labelWidth - 95
      });
    doc
      .fillColor(brand)
      .font('Helvetica-Bold')
      .fontSize(7.4)
      .text(`${item.copyIndex}/${item.copyTotal}`, x + labelWidth - 70, y + 79, {
        width: 58,
        align: 'right'
      });
  });

  if ((cycle.items || []).some((item) => Number(item.quantity || 0) > 120) || (cycle.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0) > 120) {
    doc.addPage();
    drawPageHeader();
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(9)
      .text('Nota: por control de tamaño se generaron máximo 120 etiquetas. Si necesitas más, divide el ciclo en grupos de impresión.');
  }
}

function buildOdontologySterilizationReportPdf(doc, { client, cycles, filters }) {
  const totalItems = cycles.reduce((sum, cycle) => sum + Number(cycle.item_count || cycle.items?.length || 0), 0);
  const successful = cycles.filter((cycle) => cycle.result === 'successful').length;
  const failed = cycles.filter((cycle) => cycle.result === 'failed').length;
  const pending = cycles.filter((cycle) => cycle.result === 'pending').length;

  drawOdontologyReportHeader(doc, {
    title: 'Reporte de ciclos de esterilización',
    subtitle: `${client?.name || 'INBIHOSPITALARIO'} · ${formatDateOnly(filters.startDate)} al ${formatDateOnly(filters.endDate)}`,
    client
  });

  drawOdontologyInfoGrid(doc, [
    ['Cliente', client?.name || 'INBIHOSPITALARIO'],
    ['Rango', `${formatDateOnly(filters.startDate)} - ${formatDateOnly(filters.endDate)}`],
    ['Resultado', filters.result ? odontologySterilizationResultLabel(filters.result) : 'Todos'],
    ['Método', filters.method ? odontologySterilizationMethodLabel(filters.method) : 'Todos'],
    ['Responsable', filters.responsible || 'Todos'],
    ['Ciclos listados', cycles.length],
    ['Ciclos exitosos', successful],
    ['Instrumentales procesados', totalItems]
  ]);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardWidth = (pageWidth - 16) / 3;
  const y = doc.y;
  drawReportMetricCard(doc, { x: doc.page.margins.left, y, width: cardWidth, title: 'Exitosos', value: successful, caption: 'Ciclos finalizados', accent: '#15803d' });
  drawReportMetricCard(doc, { x: doc.page.margins.left + cardWidth + 8, y, width: cardWidth, title: 'Pendientes', value: pending, caption: 'Requieren seguimiento', accent: '#92400e' });
  drawReportMetricCard(doc, { x: doc.page.margins.left + (cardWidth + 8) * 2, y, width: cardWidth, title: 'Fallidos', value: failed, caption: 'No conformes', accent: '#b91c1c' });
  doc.y = y + 62;

  drawReportList(doc, 'CICLOS DE ESTERILIZACIÓN', cycles, [
    { label: 'Fecha', value: (row) => formatDateOnly(row.cycle_date), width: 80 },
    { label: 'Lote', value: (row) => row.cycle_code || row.id, width: 105 },
    { label: 'Método', value: (row) => odontologySterilizationMethodLabel(row.method), width: 82 },
    { label: 'Resultado', value: (row) => odontologySterilizationResultLabel(row.result), width: 74 },
    { label: 'Responsable', value: (row) => row.operator_name || row.created_by_name || '-', width: 118 },
    { label: 'Instrumental', value: (row) => row.item_count || row.items?.length || 0, width: 70, align: 'right' }
  ]);

  const instrumentRows = cycles.flatMap((cycle) =>
    (cycle.items || []).map((item) => ({
      cycle_code: cycle.cycle_code || cycle.id,
      cycle_date: cycle.cycle_date,
      instrument_name: item.instrument_name,
      quantity: item.quantity,
      notes: item.notes
    }))
  );
  drawReportList(doc, 'DETALLE DE INSTRUMENTAL PROCESADO', instrumentRows, [
    { label: 'Fecha', value: (row) => formatDateOnly(row.cycle_date), width: 80 },
    { label: 'Lote', value: 'cycle_code', width: 110 },
    { label: 'Instrumental', value: 'instrument_name', width: 230 },
    { label: 'Cantidad', value: 'quantity', width: 70, align: 'right' },
    { label: 'Nota', value: (row) => row.notes || '-', width: 120 }
  ]);
}

app.get('/odontology/:clientId/bootstrap', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const dashboard = await getOdontologyDashboard(req.params.clientId);
    return res.json(maskOdontologyDashboardFinancialFields(dashboard, canViewOdontologyFinancialValues(req.user)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar odontología.' });
  }
});

app.get('/odontology/:clientId/dashboard', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const dashboard = await getOdontologyDashboard(req.params.clientId);
    return res.json(maskOdontologyDashboardFinancialFields(dashboard, canViewOdontologyFinancialValues(req.user)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el tablero odontológico.' });
  }
});

app.get('/odontology/:clientId/reports', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canViewOdontologyReports(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver reportes odontológicos.' });
    }
    const report = await getOdontologyReports({
      clientId: req.params.clientId,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || ''
    });
    return res.json(maskOdontologyReportFinancialFields(report, canViewOdontologyFinancialValues(req.user)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los reportes odontológicos.' });
  }
});

app.get('/odontology/:clientId/reports/details', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canViewOdontologyReports(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver reportes odontológicos.' });
    }
    const details = await getOdontologyReportDetails({
      clientId: req.params.clientId,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || ''
    });
    return res.json(maskOdontologyReportDetailsFinancialFields(details, canViewOdontologyFinancialValues(req.user)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el detalle de reportes odontológicos.' });
  }
});

app.get('/odontology/:clientId/reports/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canViewOdontologyReports(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver reportes odontológicos.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para exportar valores económicos.' });
    }
    const report = await getOdontologyReports({
      clientId: req.params.clientId,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || ''
    });
    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`reporte-odontologia-${report.range.startDate}-${report.range.endDate}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyReportsPdf(doc, { client, report });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el PDF de reportes odontológicos.' });
  }
});

app.get('/odontology/:clientId/settings', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const settings = await getOdontologySettings(req.params.clientId);
    return res.json(settings);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar la configuración odontológica.' });
  }
});

app.patch('/odontology/:clientId/settings', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar odontología.' });
    }
    const result = await updateOdontologySettings({
      clientId: req.params.clientId,
      payload: req.body || {}
    });
    if (result.error) return res.status(400).json({ message: result.message });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_SETTINGS_UPDATE',
      details: {
        clientId: req.params.clientId,
        defaultLandingPage: result.settings.default_landing_page
      }
    });
    return res.json(result.settings);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la configuración odontológica.' });
  }
});

app.get('/odontology/:clientId/sites', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const sites = await listOdontologySites(req.params.clientId);
    return res.json(sites);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las sedes odontológicas.' });
  }
});

app.get('/odontology/:clientId/chairs', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const chairs = await listOdontologyChairs(req.params.clientId);
    return res.json(chairs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las unidades odontológicas.' });
  }
});

app.post('/odontology/:clientId/sites', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar odontología.' });
    }
    const result = await createOdontologySite({
      clientId: req.params.clientId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_SITE_CREATE',
      details: { clientId: req.params.clientId, siteId: result.site.id, name: result.site.name }
    });
    return res.status(201).json(result.site);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la sede odontológica.' });
  }
});

app.patch('/odontology/:clientId/sites/:siteId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar odontología.' });
    }
    const result = await updateOdontologySite({
      clientId: req.params.clientId,
      siteId: req.params.siteId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_SITE_UPDATE',
      details: { clientId: req.params.clientId, siteId: result.site.id, name: result.site.name }
    });
    return res.json(result.site);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la sede odontológica.' });
  }
});

app.post('/odontology/:clientId/chairs', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar odontología.' });
    }
    const result = await createOdontologyChair({
      clientId: req.params.clientId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CHAIR_CREATE',
      details: {
        clientId: req.params.clientId,
        chairId: result.chair.id,
        siteId: result.chair.site_id,
        name: result.chair.name
      }
    });
    return res.status(201).json(result.chair);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la unidad odontológica.' });
  }
});

app.patch('/odontology/:clientId/chairs/:chairId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar odontología.' });
    }
    const result = await updateOdontologyChair({
      clientId: req.params.clientId,
      chairId: req.params.chairId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CHAIR_UPDATE',
      details: {
        clientId: req.params.clientId,
        chairId: result.chair.id,
        siteId: result.chair.site_id,
        name: result.chair.name
      }
    });
    return res.json(result.chair);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la unidad odontológica.' });
  }
});

app.get('/odontology/:clientId/procedure-types', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const procedures = await listOdontologyProcedureTypes(req.params.clientId);
    return res.json(procedures);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los procedimientos odontológicos.' });
  }
});

app.post('/odontology/:clientId/procedure-types', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar procedimientos odontológicos.' });
    }
    const result = await createOdontologyProcedureType({
      clientId: req.params.clientId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PROCEDURE_TYPE_CREATE',
      details: {
        clientId: req.params.clientId,
        procedureTypeId: result.procedure?.id,
        name: result.procedure?.name
      }
    });
    return res.status(201).json(result.procedure);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el procedimiento odontológico.' });
  }
});

app.patch('/odontology/:clientId/procedure-types/:procedureTypeId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar procedimientos odontológicos.' });
    }
    const result = await updateOdontologyProcedureType({
      clientId: req.params.clientId,
      procedureTypeId: req.params.procedureTypeId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PROCEDURE_TYPE_UPDATE',
      details: {
        clientId: req.params.clientId,
        procedureTypeId: result.procedure?.id,
        name: result.procedure?.name,
        isActive: result.procedure?.is_active
      }
    });
    return res.json(result.procedure);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el procedimiento odontológico.' });
  }
});

app.get('/odontology/:clientId/catalog', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    const catalog = await listOdontologyCatalog(
      req.params.clientId,
      req.query.type ? String(req.query.type) : null
    );
    return res.json(catalog);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el catálogo odontológico.' });
  }
});

app.post('/odontology/:clientId/catalog', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar catálogos odontológicos.' });
    }
    const result = await createOdontologyCatalogItem({
      clientId: req.params.clientId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CATALOG_ITEM_CREATE',
      details: {
        clientId: req.params.clientId,
        catalogItemId: result.item?.id,
        catalogType: result.item?.catalog_type,
        name: result.item?.name
      }
    });
    return res.status(201).json(result.item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el elemento del catálogo.' });
  }
});

app.patch('/odontology/:clientId/catalog/:itemId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar catálogos odontológicos.' });
    }
    const result = await updateOdontologyCatalogItem({
      clientId: req.params.clientId,
      itemId: req.params.itemId,
      payload: req.body || {}
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CATALOG_ITEM_UPDATE',
      details: {
        clientId: req.params.clientId,
        catalogItemId: result.item?.id,
        catalogType: result.item?.catalog_type,
        name: result.item?.name,
        isActive: result.item?.is_active
      }
    });
    return res.json(result.item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el elemento del catálogo.' });
  }
});

app.get('/odontology/:clientId/dentists', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver agenda odontológica.' });
    }
    const dentists = await listOdontologyDentists(req.params.clientId);
    return res.json(dentists);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los odontólogos.' });
  }
});

app.get('/odontology/:clientId/dentist-schedules', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver horarios odontológicos.' });
    }
    const schedules = await listOdontologyDentistSchedules({
      clientId: req.params.clientId,
      dentistUserId: req.query.dentistId || ''
    });
    return res.json(schedules);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los horarios odontológicos.' });
  }
});

app.put('/odontology/:clientId/dentist-schedules/:dentistId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySettings(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar horarios odontológicos.' });
    }
    const result = await replaceOdontologyDentistSchedules({
      clientId: req.params.clientId,
      dentistUserId: req.params.dentistId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) return res.status(400).json({ message: result.message });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_DENTIST_SCHEDULES_UPDATE',
      details: {
        clientId: req.params.clientId,
        dentistUserId: req.params.dentistId,
        schedulesCount: result.schedules.length
      }
    });
    return res.json(result.schedules);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron guardar los horarios odontológicos.' });
  }
});

app.get('/odontology/:clientId/appointments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver agenda odontológica.' });
    }
    const appointments = await listOdontologyAppointments({
      clientId: req.params.clientId,
      date: req.query.date || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || '',
      status: req.query.status || '',
      dentistId: req.query.dentistId || '',
      patientId: req.query.patientId || '',
      siteId: req.query.siteId || '',
      chairId: req.query.chairId || '',
      search: req.query.search || ''
    });
    return res.json(appointments);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las citas.' });
  }
});

app.get('/odontology/:clientId/appointment-reminders', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver recordatorios odontológicos.' });
    }
    const reminders = await listOdontologyAppointmentReminders({
      clientId: req.params.clientId,
      date: req.query.date || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || '',
      status: req.query.status || '',
      channel: req.query.channel || '',
      reminderKind: req.query.reminderKind || '',
      search: req.query.search || ''
    });
    return res.json(reminders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los recordatorios odontológicos.' });
  }
});

app.post('/odontology/:clientId/appointments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear citas odontológicas.' });
    }
    const result = await createOdontologyAppointment({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'CONFLICT' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_APPOINTMENT_CREATE',
      details: {
        clientId: req.params.clientId,
        appointmentId: result.appointment.id,
        patientId: result.appointment.patient_id,
        dentistUserId: result.appointment.dentist_user_id,
        scheduledDate: result.appointment.scheduled_date
      }
    });
    return res.status(201).json(result.appointment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la cita.' });
  }
});

app.patch('/odontology/:clientId/appointments/:appointmentId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar citas odontológicas.' });
    }
    const result = await updateOdontologyAppointment({
      clientId: req.params.clientId,
      appointmentId: req.params.appointmentId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'CONFLICT' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_APPOINTMENT_UPDATE',
      details: {
        clientId: req.params.clientId,
        appointmentId: result.appointment.id,
        patientId: result.appointment.patient_id,
        dentistUserId: result.appointment.dentist_user_id,
        scheduledDate: result.appointment.scheduled_date,
        status: result.appointment.status,
        inventoryConsumptions: result.inventoryConsumptions?.length || 0
      }
    });
    return res.json(result.appointment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la cita.' });
  }
});

app.post('/odontology/:clientId/appointments/:appointmentId/reminders/email', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para enviar recordatorios odontológicos.' });
    }

    const appointment = await getOdontologyAppointmentById({
      clientId: req.params.clientId,
      appointmentId: req.params.appointmentId
    });
    if (!appointment) return res.status(404).json({ message: 'Cita no encontrada.' });
    if (!appointment.patient_email) {
      return res.status(400).json({ message: 'El paciente no tiene correo registrado.' });
    }

    const client = await getClientById(req.params.clientId).catch(() => null);
    const dateLabel = formatOdontologyAppointmentDate(appointment.scheduled_date);
    const timeLabel = `${String(appointment.start_time || '').slice(0, 5)} - ${String(appointment.end_time || '').slice(0, 5)}`;
    const subject = `Recordatorio de cita odontológica - ${dateLabel}`;
    const message = [
      `Hola ${appointment.patient_name},`,
      '',
      `Te recordamos tu cita odontológica en ${client?.name || 'nuestra institución'}.`,
      `Fecha: ${dateLabel}`,
      `Hora: ${timeLabel}`,
      `Odontólogo: ${appointment.dentist_name || 'Por confirmar'}`,
      `Procedimiento: ${appointment.procedure_name || 'Consulta odontológica'}`,
      `Sede: ${appointment.site_name || 'Por confirmar'}`,
      appointment.chair_name ? `Unidad: ${appointment.chair_name}` : '',
      '',
      'Si necesitas reprogramar o cancelar, por favor comunícate con la institución.',
      '',
      'INBIHOSPITALARIO'
    ].filter(Boolean).join('\n');

    try {
      await sendNotificationEmail({
        to: appointment.patient_email,
        subject,
        text: message
      });
      const reminder = await createOdontologyAppointmentReminderLog({
        clientId: req.params.clientId,
        appointmentId: appointment.id,
        channel: 'email',
        recipientName: appointment.patient_name,
        recipientEmail: appointment.patient_email,
        subject,
        message,
        status: 'sent',
        actorUserId: req.user.sub
      });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'ODONTOLOGY_APPOINTMENT_REMINDER_EMAIL',
        details: {
          clientId: req.params.clientId,
          appointmentId: appointment.id,
          patientId: appointment.patient_id,
          recipientEmail: appointment.patient_email,
          reminderId: reminder.id
        }
      });
      return res.json({ ok: true, reminder });
    } catch (emailError) {
      const reminder = await createOdontologyAppointmentReminderLog({
        clientId: req.params.clientId,
        appointmentId: appointment.id,
        channel: 'email',
        recipientName: appointment.patient_name,
        recipientEmail: appointment.patient_email,
        subject,
        message,
        status: 'failed',
        errorMessage: emailError?.message || 'No se pudo enviar el correo.',
        actorUserId: req.user.sub
      });
      console.error('Email recordatorio odontológico falló', emailError);
      return res.status(502).json({
        message: 'No se pudo enviar el correo de recordatorio.',
        reminderId: reminder.id
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo procesar el recordatorio de la cita.' });
  }
});

app.post('/odontology/:clientId/appointments/:appointmentId/reminders/whatsapp', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAppointments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para enviar recordatorios odontológicos.' });
    }

    const result = await sendManualOdontologyAppointmentWhatsappReminder({
      clientId: req.params.clientId,
      appointmentId: req.params.appointmentId,
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'SEND_FAILED' ? 502 : 400;
      return res.status(status).json({ message: result.message, reminderId: result.reminder?.id });
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_APPOINTMENT_REMINDER_WHATSAPP',
      details: {
        clientId: req.params.clientId,
        appointmentId: req.params.appointmentId,
        reminderId: result.reminder.id,
        mode: 'manual'
      }
    });
    return res.json({ ok: true, reminder: result.reminder });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo procesar el recordatorio por WhatsApp.' });
  }
});

app.get('/odontology/:clientId/clinical-records', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver historias clínicas odontológicas.' });
    }
    const records = await listOdontologyClinicalRecords({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      status: req.query.status || '',
      search: req.query.search || ''
    });
    return res.json(records);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las historias clínicas.' });
  }
});

app.get('/odontology/:clientId/clinical-record-notes', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver notas aclaratorias odontológicas.' });
    }
    const notes = await listOdontologyClinicalRecordNotes({
      clientId: req.params.clientId,
      clinicalRecordId: req.query.clinicalRecordId || '',
      patientId: req.query.patientId || ''
    });
    return res.json(notes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las notas aclaratorias.' });
  }
});

app.post('/odontology/:clientId/clinical-records', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear historias clínicas odontológicas.' });
    }
    const result = await createOdontologyClinicalRecord({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) return res.status(400).json({ message: result.message });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CLINICAL_RECORD_CREATE',
      details: {
        clientId: req.params.clientId,
        clinicalRecordId: result.clinicalRecord.id,
        patientId: result.clinicalRecord.patient_id
      }
    });
    return res.status(201).json(result.clinicalRecord);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la historia clínica.' });
  }
});

app.post('/odontology/:clientId/clinical-records/:recordId/notes', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear notas aclaratorias odontológicas.' });
    }
    const result = await createOdontologyClinicalRecordNote({
      clientId: req.params.clientId,
      clinicalRecordId: req.params.recordId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CLINICAL_RECORD_NOTE_CREATE',
      details: {
        clientId: req.params.clientId,
        clinicalRecordId: result.note.clinical_record_id,
        patientId: result.note.patient_id,
        noteId: result.note.id
      }
    });
    return res.status(201).json(result.note);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la nota aclaratoria.' });
  }
});

app.patch('/odontology/:clientId/clinical-records/:recordId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar historias clínicas odontológicas.' });
    }
    const result = await updateOdontologyClinicalRecord({
      clientId: req.params.clientId,
      clinicalRecordId: req.params.recordId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'SIGNED' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CLINICAL_RECORD_UPDATE',
      details: {
        clientId: req.params.clientId,
        clinicalRecordId: result.clinicalRecord.id,
        patientId: result.clinicalRecord.patient_id
      }
    });
    return res.json(result.clinicalRecord);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la historia clínica.' });
  }
});

app.post('/odontology/:clientId/clinical-records/:recordId/sign', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para firmar historias clínicas odontológicas.' });
    }
    let patientSignaturePath = null;
    try {
      patientSignaturePath = await saveOdontologyClinicalRecordPatientSignature(
        req.params.clientId,
        req.params.recordId,
        req.body?.patientSignatureDataUrl
      );
    } catch (signatureError) {
      if (signatureError?.code === 'INVALID_SIGNATURE') {
        return res.status(400).json({ message: signatureError.message });
      }
      throw signatureError;
    }
    if (!patientSignaturePath) {
      return res.status(400).json({ message: 'Dibuja la firma del paciente o acudiente antes de firmar la historia clínica.' });
    }
    const result = await signOdontologyClinicalRecord({
      clientId: req.params.clientId,
      clinicalRecordId: req.params.recordId,
      actorUserId: req.user.sub,
      patientSignaturePath,
      patientSignerName: req.body?.patientSignerName,
      patientSignerDocumentType: req.body?.patientSignerDocumentType,
      patientSignerDocumentNumber: req.body?.patientSignerDocumentNumber,
      patientSignerRelationship: req.body?.patientSignerRelationship
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'SIGNED' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    const signedRecord = await getOdontologyClinicalRecordById({
      clientId: req.params.clientId,
      clinicalRecordId: result.clinicalRecord.id
    });
    if (!signedRecord) return res.status(404).json({ message: 'Historia clínica no encontrada.' });
    const pdfPath = await buildOdontologyClinicalRecordPdf(signedRecord);
    const clinicalRecord = await setOdontologyClinicalRecordPdf({
      clientId: req.params.clientId,
      clinicalRecordId: result.clinicalRecord.id,
      pdfPath
    });

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CLINICAL_RECORD_SIGN',
      details: {
        clientId: req.params.clientId,
        clinicalRecordId: clinicalRecord.id,
        patientId: clinicalRecord.patient_id,
        pdfPath,
        attendedAppointmentId: result.attendedAppointment?.id || null,
        inventoryConsumptions: result.inventoryConsumptions?.length || 0
      }
    });
    return res.json(clinicalRecord);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo firmar la historia clínica.' });
  }
});

app.get('/odontology/:clientId/clinical-records/:recordId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalRecords(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver el PDF de la historia clínica.' });
    }

    let record = await getOdontologyClinicalRecordById({
      clientId: req.params.clientId,
      clinicalRecordId: req.params.recordId
    });
    if (!record) return res.status(404).json({ message: 'Historia clínica no encontrada.' });
    if (record.status !== 'signed') {
      return res.status(400).json({ message: 'La historia clínica debe estar firmada para generar el PDF.' });
    }

    const currentPdfPath = record.pdf_path ? path.join(process.cwd(), record.pdf_path.replace(/^\//, '')) : '';
    if (!record.pdf_path || !fs.existsSync(currentPdfPath)) {
      const pdfPath = await buildOdontologyClinicalRecordPdf(record);
      record = await setOdontologyClinicalRecordPdf({
        clientId: req.params.clientId,
        clinicalRecordId: req.params.recordId,
        pdfPath
      });
    }

    const pdfFilePath = path.join(process.cwd(), record.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfFilePath)) {
      return res.status(404).json({ message: 'PDF de historia clínica no encontrado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="historia-clinica-${record.id}.pdf"`);
    return fs.createReadStream(pdfFilePath).pipe(res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo abrir el PDF de la historia clínica.' });
  }
});

app.get('/odontology/:clientId/treatment-plans', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver planes de tratamiento.' });
    }
    const plans = await listOdontologyTreatmentPlans({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      status: req.query.status || '',
      search: req.query.search || ''
    });
    const canViewFinancial = canViewOdontologyFinancialValues(req.user);
    return res.json(plans.map((plan) => maskOdontologyTreatmentPlanFinancialFields(plan, canViewFinancial)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los planes de tratamiento.' });
  }
});

app.get('/odontology/:clientId/treatment-plans/:planId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver planes de tratamiento.' });
    }
    const plan = await getOdontologyTreatmentPlan({
      clientId: req.params.clientId,
      treatmentPlanId: req.params.planId
    });
    if (!plan) return res.status(404).json({ message: 'Plan de tratamiento no encontrado.' });
    return res.json(maskOdontologyTreatmentPlanFinancialFields(plan, canViewOdontologyFinancialValues(req.user)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el plan de tratamiento.' });
  }
});

app.get('/odontology/:clientId/treatment-plans/:planId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver el PDF del plan de tratamiento.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver valores económicos del plan.' });
    }
    const plan = await getOdontologyTreatmentPlan({
      clientId: req.params.clientId,
      treatmentPlanId: req.params.planId
    });
    if (!plan) return res.status(404).json({ message: 'Plan de tratamiento no encontrado.' });
    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`plan-tratamiento-${plan.patient_name}-${plan.title}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyTreatmentPlanPdf(doc, { client, plan });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el PDF del plan de tratamiento.' });
  }
});

app.post('/odontology/:clientId/treatment-plans', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear planes de tratamiento.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para registrar valores económicos del plan.' });
    }
    const result = await createOdontologyTreatmentPlan({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_TREATMENT_PLAN_CREATE',
      details: {
        clientId: req.params.clientId,
        treatmentPlanId: result.treatmentPlan.id,
        patientId: result.treatmentPlan.patient_id,
        totalAmount: result.treatmentPlan.total_amount
      }
    });
    return res.status(201).json(result.treatmentPlan);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el plan de tratamiento.' });
  }
});

app.patch('/odontology/:clientId/treatment-plans/:planId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar planes de tratamiento.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar valores económicos del plan.' });
    }
    const result = await updateOdontologyTreatmentPlan({
      clientId: req.params.clientId,
      treatmentPlanId: req.params.planId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_TREATMENT_PLAN_UPDATE',
      details: {
        clientId: req.params.clientId,
        treatmentPlanId: result.treatmentPlan.id,
        patientId: result.treatmentPlan.patient_id,
        status: result.treatmentPlan.status,
        totalAmount: result.treatmentPlan.total_amount
      }
    });
    return res.json(result.treatmentPlan);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el plan de tratamiento.' });
  }
});

app.post('/odontology/:clientId/treatment-plans/:planId/accept', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyTreatmentPlans(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para aceptar planes de tratamiento.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para aceptar valores económicos del plan.' });
    }
    let signaturePath = null;
    try {
      signaturePath = await saveOdontologyTreatmentPlanAcceptanceSignature(
        req.params.clientId,
        req.params.planId,
        req.body?.signatureDataUrl
      );
    } catch (signatureError) {
      if (signatureError?.code === 'INVALID_SIGNATURE') {
        return res.status(400).json({ message: signatureError.message });
      }
      throw signatureError;
    }
    if (!signaturePath) {
      return res.status(400).json({ message: 'Dibuja la firma del paciente o acudiente antes de aceptar el plan.' });
    }

    const result = await acceptOdontologyTreatmentPlan({
      clientId: req.params.clientId,
      treatmentPlanId: req.params.planId,
      actorUserId: req.user.sub,
      signerName: req.body?.signerName,
      signerDocumentType: req.body?.signerDocumentType,
      signerDocumentNumber: req.body?.signerDocumentNumber,
      signerRelationship: req.body?.signerRelationship,
      signaturePath
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_TREATMENT_PLAN_ACCEPT',
      details: {
        clientId: req.params.clientId,
        treatmentPlanId: result.treatmentPlan.id,
        patientId: result.treatmentPlan.patient_id,
        signerName: result.treatmentPlan.accepted_signer_name
      }
    });
    return res.json(maskOdontologyTreatmentPlanFinancialFields(result.treatmentPlan, true));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo aceptar el plan de tratamiento.' });
  }
});

app.get('/odontology/:clientId/payments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver pagos odontológicos.' });
    }
    const payments = await listOdontologyPayments({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      treatmentPlanId: req.query.treatmentPlanId || '',
      status: req.query.status || '',
      search: req.query.search || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      cashier: req.query.cashier || ''
    });
    const canViewFinancial = canViewOdontologyFinancialValues(req.user);
    return res.json(payments.map((payment) => maskOdontologyPaymentFinancialFields(payment, canViewFinancial)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los pagos odontológicos.' });
  }
});

app.get('/odontology/:clientId/payments/report/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para generar reportes de pagos.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para exportar valores económicos.' });
    }
    const filters = {
      patientId: req.query.patientId || '',
      treatmentPlanId: req.query.treatmentPlanId || '',
      status: req.query.status || '',
      search: req.query.search || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      cashier: req.query.cashier || ''
    };
    const payments = await listOdontologyPayments({
      clientId: req.params.clientId,
      ...filters
    });
    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`reporte-pagos-${filters.startDate || 'inicio'}-${filters.endDate || 'fin'}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyPaymentCashierReportPdf(doc, { client, payments, filters });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el reporte de pagos.' });
  }
});

app.get('/odontology/:clientId/payments/cash-closures', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver cierres de caja.' });
    }
    const closures = await listOdontologyCashClosures({
      clientId: req.params.clientId,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      cashier: req.query.cashier || ''
    });
    const canViewFinancial = canViewOdontologyFinancialValues(req.user);
    return res.json(closures.map((closure) => maskOdontologyCashClosureFinancialFields(closure, canViewFinancial)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los cierres de caja.' });
  }
});

app.post('/odontology/:clientId/payments/cash-closures', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para realizar cierres de caja.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para cerrar caja con valores económicos.' });
    }
    const result = await createOdontologyCashClosure({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    const client = await getClientById(req.params.clientId).catch(() => null);
    const pdfPath = await buildOdontologyCashClosurePdfFile({
      client,
      closure: result.closure,
      payments: result.payments
    });
    await setOdontologyCashClosurePdf({
      clientId: req.params.clientId,
      closureId: result.closure.id,
      pdfPath
    });
    const closure = await getOdontologyCashClosureById({
      clientId: req.params.clientId,
      closureId: result.closure.id
    });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CASH_CLOSURE_CREATE',
      details: {
        clientId: req.params.clientId,
        closureId: closure.id,
        dateFrom: closure.date_from,
        dateTo: closure.date_to,
        cashier: closure.cashier_filter,
        totalRegistered: closure.total_registered,
        registeredCount: closure.registered_count
      }
    });
    return res.status(201).json(closure);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el cierre de caja.' });
  }
});

app.get('/odontology/:clientId/payments/cash-closures/:closureId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver cierres de caja.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver valores económicos del cierre.' });
    }
    let closure = await getOdontologyCashClosureById({
      clientId: req.params.clientId,
      closureId: req.params.closureId
    });
    if (!closure) return res.status(404).json({ message: 'Cierre de caja no encontrado.' });
    let fullPath = resolveStoredFilePath(closure.pdf_path);
    if (!fullPath) {
      const [client, payments] = await Promise.all([
        getClientById(req.params.clientId).catch(() => null),
        listOdontologyPayments({
          clientId: req.params.clientId,
          startDate: closure.date_from,
          endDate: closure.date_to,
          cashier: closure.cashier_filter || '',
          limit: 5000
        })
      ]);
      const pdfPath = await buildOdontologyCashClosurePdfFile({ client, closure, payments });
      await setOdontologyCashClosurePdf({
        clientId: req.params.clientId,
        closureId: closure.id,
        pdfPath
      });
      closure = await getOdontologyCashClosureById({
        clientId: req.params.clientId,
        closureId: req.params.closureId
      });
      fullPath = resolveStoredFilePath(closure.pdf_path);
    }
    if (!fullPath) return res.status(404).json({ message: 'PDF de cierre no encontrado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`cierre-caja-${closure.date_from}-${closure.date_to}`)}.pdf"`);
    return fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo abrir el cierre de caja.' });
  }
});

app.get('/odontology/:clientId/payments/:paymentId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver recibos de pago.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver valores económicos del recibo.' });
    }
    const payment = await getOdontologyPaymentById({
      clientId: req.params.clientId,
      paymentId: req.params.paymentId
    });
    if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`recibo-pago-${payment.patient_name}-${payment.id}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyPaymentReceiptPdf(doc, { client, payment });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el recibo de pago.' });
  }
});

app.post('/odontology/:clientId/payments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para registrar pagos odontológicos.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para registrar valores económicos.' });
    }
    const result = await createOdontologyPayment({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PAYMENT_CREATE',
      details: {
        clientId: req.params.clientId,
        paymentId: result.payment.id,
        patientId: result.payment.patient_id,
        treatmentPlanId: result.payment.treatment_plan_id,
        amount: result.payment.amount,
        paymentMethod: result.payment.payment_method
      }
    });
    return res.status(201).json(result.payment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo registrar el pago odontológico.' });
  }
});

app.post('/odontology/:clientId/payments/:paymentId/void', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPayments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para anular pagos odontológicos.' });
    }
    if (!canViewOdontologyFinancialValues(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para anular valores económicos.' });
    }
    const result = await voidOdontologyPayment({
      clientId: req.params.clientId,
      paymentId: req.params.paymentId,
      reason: req.body?.reason || '',
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PAYMENT_VOID',
      details: {
        clientId: req.params.clientId,
        paymentId: result.payment.id,
        patientId: result.payment.patient_id,
        treatmentPlanId: result.payment.treatment_plan_id,
        amount: result.payment.amount,
        reason: req.body?.reason || ''
      }
    });
    return res.json(result.payment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo anular el pago odontológico.' });
  }
});

app.get('/odontology/:clientId/medications', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPrescriptions(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver medicamentos odontológicos.' });
    }
    const medications = await listOdontologyMedications({
      clientId: req.params.clientId,
      activeOnly: req.query.activeOnly === 'true',
      search: req.query.search || ''
    });
    return res.json(medications);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los medicamentos odontológicos.' });
  }
});

app.post('/odontology/:clientId/medications', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPrescriptions(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear medicamentos odontológicos.' });
    }
    const result = await createOdontologyMedication({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_MEDICATION_CREATE',
      details: {
        clientId: req.params.clientId,
        medicationId: result.medication.id,
        name: result.medication.name
      }
    });
    return res.status(201).json(result.medication);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el medicamento odontológico.' });
  }
});

app.get('/odontology/:clientId/prescriptions', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPrescriptions(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver recetas odontológicas.' });
    }
    const prescriptions = await listOdontologyPrescriptions({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      status: req.query.status || '',
      search: req.query.search || ''
    });
    return res.json(prescriptions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las recetas odontológicas.' });
  }
});

app.post('/odontology/:clientId/prescriptions', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPrescriptions(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear recetas odontológicas.' });
    }
    const result = await createOdontologyPrescription({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }

    const pdfPath = await buildOdontologyPrescriptionPdf(result.prescription);
    const prescription = await setOdontologyPrescriptionPdf({
      clientId: req.params.clientId,
      prescriptionId: result.prescription.id,
      pdfPath
    });

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PRESCRIPTION_CREATE',
      details: {
        clientId: req.params.clientId,
        prescriptionId: result.prescription.id,
        patientId: result.prescription.patient_id,
        pdfPath
      }
    });
    return res.status(201).json(prescription);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la receta odontológica.' });
  }
});

app.get('/odontology/:clientId/clinical-documents', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalDocuments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver documentos clínicos odontológicos.' });
    }
    const documents = await listOdontologyClinicalDocuments({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      documentType: req.query.documentType || '',
      status: req.query.status || '',
      search: req.query.search || ''
    });
    return res.json(documents);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los documentos clínicos odontológicos.' });
  }
});

app.post('/odontology/:clientId/clinical-documents', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyClinicalDocuments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear documentos clínicos odontológicos.' });
    }
    const result = await createOdontologyClinicalDocument({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }

    const pdfPath = await buildOdontologyClinicalDocumentPdf(result.document);
    const documentRow = await setOdontologyClinicalDocumentPdf({
      clientId: req.params.clientId,
      documentId: result.document.id,
      pdfPath
    });

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CLINICAL_DOCUMENT_CREATE',
      details: {
        clientId: req.params.clientId,
        documentId: result.document.id,
        patientId: result.document.patient_id,
        documentType: result.document.document_type,
        pdfPath
      }
    });
    return res.status(201).json(documentRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el documento clínico odontológico.' });
  }
});

app.get('/odontology/:clientId/attachments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAttachments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver adjuntos odontológicos.' });
    }
    const attachments = await listOdontologyAttachments({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      category: req.query.category || '',
      search: req.query.search || ''
    });
    return res.json(attachments);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los adjuntos odontológicos.' });
  }
});

app.post('/odontology/:clientId/attachments', requireAuth, upload.single('file'), async (req, res) => {
  const { clientId } = req.params;
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAttachments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para cargar adjuntos odontológicos.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo requerido.' });
    }
    if (!isAllowedOdontologyAttachment(req.file)) {
      return res.status(400).json({ message: 'Solo se permiten archivos PDF, JPG, PNG o WEBP.' });
    }
    if (req.file.size > 15 * 1024 * 1024) {
      return res.status(400).json({ message: 'El archivo no puede superar 15 MB.' });
    }

    const extension = odontologyAttachmentExtension(req.file);
    const relativeDir = path.join('uploads', 'clients', clientId, 'odontology', 'attachments');
    const fullDir = path.join(process.cwd(), relativeDir);
    await fs.promises.mkdir(fullDir, { recursive: true });
    const fileName = `adjunto-${Date.now()}-${randomUUID()}${extension}`;
    const relativePath = path.join(relativeDir, fileName);
    const fullPath = path.join(process.cwd(), relativePath);
    const publicPath = `/${relativePath}`.replace(/\\/g, '/');
    await fs.promises.writeFile(fullPath, req.file.buffer);

    const result = await createOdontologyAttachment({
      clientId,
      payload: {
        ...req.body,
        title: String(req.body?.title || '').trim() || req.file.originalname,
        filePath: publicPath,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      },
      actorUserId: req.user.sub
    });

    if (result.error) {
      await fs.promises.rm(fullPath, { force: true });
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_ATTACHMENT_UPLOAD',
      details: {
        clientId,
        attachmentId: result.attachment.id,
        patientId: result.attachment.patient_id,
        category: result.attachment.category,
        filePath: publicPath
      }
    });
    return res.status(201).json(result.attachment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el adjunto odontológico.' });
  }
});

app.delete('/odontology/:clientId/attachments/:attachmentId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyAttachments(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para eliminar adjuntos odontológicos.' });
    }
    const existing = await getOdontologyAttachmentById({
      clientId: req.params.clientId,
      attachmentId: req.params.attachmentId
    });
    if (!existing) return res.status(404).json({ message: 'Adjunto odontológico no encontrado.' });
    const deleted = await deleteOdontologyAttachment({
      clientId: req.params.clientId,
      attachmentId: req.params.attachmentId
    });
    const fullPath = path.join(process.cwd(), String(existing.file_path || '').replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      await fs.promises.rm(fullPath, { force: true });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_ATTACHMENT_DELETE',
      details: {
        clientId: req.params.clientId,
        attachmentId: deleted.id,
        patientId: deleted.patient_id,
        category: deleted.category,
        filePath: existing.file_path
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo eliminar el adjunto odontológico.' });
  }
});

app.get('/odontology/:clientId/inventory/items', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver inventario odontológico.' });
    }
    const items = await listOdontologyInventoryItems({
      clientId: req.params.clientId,
      status: req.query.status || '',
      lowStockOnly: req.query.lowStockOnly === 'true',
      search: req.query.search || ''
    });
    return res.json(items);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el inventario odontológico.' });
  }
});

app.post('/odontology/:clientId/inventory/items', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear insumos odontológicos.' });
    }
    const result = await createOdontologyInventoryItem({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_INVENTORY_ITEM_CREATE',
      details: {
        clientId: req.params.clientId,
        itemId: result.item.id,
        name: result.item.name,
        code: result.item.code
      }
    });
    await syncOdontologyInventoryLowStockNotifications({
      clientId: req.params.clientId,
      item: result.item
    });
    return res.status(201).json(result.item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el insumo odontológico.' });
  }
});

app.put('/odontology/:clientId/inventory/items/:itemId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar insumos odontológicos.' });
    }
    const result = await updateOdontologyInventoryItem({
      clientId: req.params.clientId,
      itemId: req.params.itemId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_INVENTORY_ITEM_UPDATE',
      details: {
        clientId: req.params.clientId,
        itemId: result.item.id,
        name: result.item.name,
        code: result.item.code,
        isActive: result.item.is_active
      }
    });
    await syncOdontologyInventoryLowStockNotifications({
      clientId: req.params.clientId,
      item: result.item
    });
    return res.json(result.item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo editar el insumo odontológico.' });
  }
});

app.get('/odontology/:clientId/inventory/movements', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver movimientos de inventario.' });
    }
    const movements = await listOdontologyInventoryMovements({
      clientId: req.params.clientId,
      itemId: req.query.itemId || '',
      movementType: req.query.movementType || '',
      search: req.query.search || ''
    });
    return res.json(movements);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los movimientos de inventario.' });
  }
});

app.post('/odontology/:clientId/inventory/movements', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para registrar movimientos de inventario.' });
    }
    const result = await createOdontologyInventoryMovement({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_INVENTORY_MOVEMENT_CREATE',
      details: {
        clientId: req.params.clientId,
        movementId: result.movement?.id,
        itemId: result.item?.id,
        movementType: result.movement?.movement_type,
        quantity: result.movement?.quantity,
        stockAfter: result.movement?.stock_after
      }
    });
    await syncOdontologyInventoryLowStockNotifications({
      clientId: req.params.clientId,
      item: result.item
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo registrar el movimiento de inventario.' });
  }
});

app.get('/odontology/:clientId/inventory/suppliers', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver proveedores odontológicos.' });
    }
    const suppliers = await listOdontologySuppliers({
      clientId: req.params.clientId,
      status: req.query.status || 'active',
      search: req.query.search || ''
    });
    return res.json(suppliers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los proveedores odontológicos.' });
  }
});

app.post('/odontology/:clientId/inventory/suppliers', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear proveedores odontológicos.' });
    }
    const result = await createOdontologySupplier({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_SUPPLIER_CREATE',
      details: {
        clientId: req.params.clientId,
        supplierId: result.supplier?.id,
        name: result.supplier?.name
      }
    });
    return res.status(201).json(result.supplier);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el proveedor odontológico.' });
  }
});

app.put('/odontology/:clientId/inventory/suppliers/:supplierId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar proveedores odontológicos.' });
    }
    const result = await updateOdontologySupplier({
      clientId: req.params.clientId,
      supplierId: req.params.supplierId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_SUPPLIER_UPDATE',
      details: {
        clientId: req.params.clientId,
        supplierId: result.supplier?.id,
        name: result.supplier?.name,
        isActive: result.supplier?.is_active
      }
    });
    return res.json(result.supplier);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo editar el proveedor odontológico.' });
  }
});

app.get('/odontology/:clientId/inventory/purchase-requests', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver solicitudes de compra.' });
    }
    const requests = await listOdontologyPurchaseRequests({
      clientId: req.params.clientId,
      status: req.query.status || '',
      search: req.query.search || ''
    });
    return res.json(requests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las solicitudes de compra.' });
  }
});

app.post('/odontology/:clientId/inventory/purchase-requests', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear solicitudes de compra.' });
    }
    const result = await createOdontologyPurchaseRequest({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PURCHASE_REQUEST_CREATE',
      details: {
        clientId: req.params.clientId,
        purchaseRequestId: result.request?.id,
        itemId: result.request?.item_id,
        quantity: result.request?.quantity
      }
    });
    return res.status(201).json(result.request);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la solicitud de compra.' });
  }
});

app.patch('/odontology/:clientId/inventory/purchase-requests/:requestId/status', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para actualizar solicitudes de compra.' });
    }
    const result = await updateOdontologyPurchaseRequestStatus({
      clientId: req.params.clientId,
      requestId: req.params.requestId,
      status: req.body?.status || '',
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PURCHASE_REQUEST_STATUS_UPDATE',
      details: {
        clientId: req.params.clientId,
        purchaseRequestId: result.request?.id,
        status: result.request?.status
      }
    });
    return res.json(result.request);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la solicitud de compra.' });
  }
});

app.get('/odontology/:clientId/inventory/procedure-kits', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver kits de inventario.' });
    }
    const kit = await listOdontologyProcedureInventoryKit({
      clientId: req.params.clientId,
      procedureTypeId: req.query.procedureTypeId || ''
    });
    return res.json(kit);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el kit del procedimiento.' });
  }
});

app.put('/odontology/:clientId/inventory/procedure-kits/:procedureTypeId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyInventory(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para configurar kits de inventario.' });
    }
    const result = await replaceOdontologyProcedureInventoryKit({
      clientId: req.params.clientId,
      procedureTypeId: req.params.procedureTypeId,
      items: req.body?.items || [],
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PROCEDURE_KIT_UPDATE',
      details: {
        clientId: req.params.clientId,
        procedureTypeId: req.params.procedureTypeId,
        items: result.kit.length
      }
    });
    return res.json(result.kit);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo guardar el kit del procedimiento.' });
  }
});

app.get('/odontology/:clientId/instruments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver instrumental odontológico.' });
    }
    const instruments = await listOdontologyInstruments({
      clientId: req.params.clientId,
      status: req.query.status || 'active',
      search: req.query.search || ''
    });
    return res.json(instruments);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el instrumental odontológico.' });
  }
});

app.post('/odontology/:clientId/instruments', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear instrumental odontológico.' });
    }
    const result = await createOdontologyInstrument({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_INSTRUMENT_CREATE',
      details: {
        clientId: req.params.clientId,
        instrumentId: result.instrument.id,
        name: result.instrument.name,
        code: result.instrument.code
      }
    });
    return res.status(201).json(result.instrument);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el instrumental odontológico.' });
  }
});

app.put('/odontology/:clientId/instruments/:instrumentId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar instrumental odontológico.' });
    }
    const result = await updateOdontologyInstrument({
      clientId: req.params.clientId,
      instrumentId: req.params.instrumentId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_INSTRUMENT_UPDATE',
      details: {
        clientId: req.params.clientId,
        instrumentId: result.instrument.id,
        name: result.instrument.name,
        isActive: result.instrument.is_active
      }
    });
    return res.json(result.instrument);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo editar el instrumental odontológico.' });
  }
});

app.get('/odontology/:clientId/sterilization-cycles', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver ciclos de esterilización.' });
    }
    const cycles = await listOdontologySterilizationCycles({
      clientId: req.params.clientId,
      result: req.query.result || '',
      method: req.query.method || '',
      search: req.query.search || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      responsible: req.query.responsible || ''
    });
    return res.json(cycles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los ciclos de esterilización.' });
  }
});

app.get('/odontology/:clientId/sterilization-cycles/report/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para generar reportes de esterilización.' });
    }

    const filters = {
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      result: req.query.result || '',
      method: req.query.method || '',
      responsible: req.query.responsible || '',
      search: req.query.search || ''
    };
    const cycles = await listOdontologySterilizationCycles({
      clientId: req.params.clientId,
      ...filters
    });
    const client = await getClientById(req.params.clientId).catch(() => null);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`reporte-esterilizacion-${filters.startDate || 'inicio'}-${filters.endDate || 'fin'}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologySterilizationReportPdf(doc, { client, cycles, filters });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el reporte de esterilización.' });
  }
});

app.post('/odontology/:clientId/sterilization-cycles', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear ciclos de esterilización.' });
    }
    const result = await createOdontologySterilizationCycle({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    let cycle = result.cycle;
    try {
      const client = await getClientById(req.params.clientId).catch(() => null);
      const pdfPath = await buildOdontologySterilizationCyclePdfFile({ client, cycle });
      cycle = await setOdontologySterilizationCyclePdf({
        clientId: req.params.clientId,
        cycleId: cycle.id,
        pdfPath
      }) || cycle;
    } catch (pdfError) {
      console.warn('No se pudo generar PDF del ciclo de esterilización', pdfError.message);
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_STERILIZATION_CYCLE_CREATE',
      details: {
        clientId: req.params.clientId,
        cycleId: cycle.id,
        cycleCode: cycle.cycle_code,
        result: cycle.result,
        itemCount: cycle.items?.length || 0,
        pdfPath: cycle.pdf_path || null
      }
    });
    return res.status(201).json(cycle);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el ciclo de esterilización.' });
  }
});

app.get('/odontology/:clientId/sterilization-cycles/:cycleId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver el PDF de esterilización.' });
    }

    let cycle = await getOdontologySterilizationCycleById({
      clientId: req.params.clientId,
      cycleId: req.params.cycleId
    });
    if (!cycle) return res.status(404).json({ message: 'Ciclo de esterilización no encontrado.' });

    const currentPdfPath = cycle.pdf_path ? path.join(process.cwd(), cycle.pdf_path.replace(/^\//, '')) : '';
    if (!cycle.pdf_path || !fs.existsSync(currentPdfPath)) {
      const client = await getClientById(req.params.clientId).catch(() => null);
      const pdfPath = await buildOdontologySterilizationCyclePdfFile({ client, cycle });
      cycle = await setOdontologySterilizationCyclePdf({
        clientId: req.params.clientId,
        cycleId: req.params.cycleId,
        pdfPath
      }) || cycle;
    }

    const pdfFilePath = path.join(process.cwd(), cycle.pdf_path.replace(/^\//, ''));
    if (!fs.existsSync(pdfFilePath)) {
      return res.status(404).json({ message: 'PDF de esterilización no encontrado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`ciclo-esterilizacion-${cycle.cycle_code || cycle.id}`)}.pdf"`);
    return fs.createReadStream(pdfFilePath).pipe(res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo abrir el PDF del ciclo de esterilización.' });
  }
});

app.get('/odontology/:clientId/sterilization-cycles/:cycleId/labels/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologySterilization(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para imprimir etiquetas de esterilización.' });
    }

    const cycle = await getOdontologySterilizationCycleById({
      clientId: req.params.clientId,
      cycleId: req.params.cycleId
    });
    if (!cycle) return res.status(404).json({ message: 'Ciclo de esterilización no encontrado.' });

    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`etiquetas-esterilizacion-${cycle.cycle_code || cycle.id}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 26 });
    doc.pipe(res);
    buildOdontologySterilizationLabelsPdf(doc, { client, cycle });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron generar las etiquetas de esterilización.' });
  }
});

app.get('/odontology/:clientId/consent-templates', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver plantillas de consentimiento.' });
    }
    const templates = await listOdontologyConsentTemplates({
      clientId: req.params.clientId,
      activeOnly: req.query.activeOnly === 'true'
    });
    return res.json(templates);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las plantillas de consentimiento.' });
  }
});

app.post('/odontology/:clientId/consent-templates', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear plantillas de consentimiento.' });
    }
    const result = await createOdontologyConsentTemplate({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) return res.status(400).json({ message: result.message });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CONSENT_TEMPLATE_CREATE',
      details: {
        clientId: req.params.clientId,
        templateId: result.template.id,
        title: result.template.title
      }
    });
    return res.status(201).json(result.template);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la plantilla de consentimiento.' });
  }
});

app.patch('/odontology/:clientId/consent-templates/:templateId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar plantillas de consentimiento.' });
    }
    const result = await updateOdontologyConsentTemplate({
      clientId: req.params.clientId,
      templateId: req.params.templateId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CONSENT_TEMPLATE_UPDATE',
      details: {
        clientId: req.params.clientId,
        templateId: result.template.id,
        title: result.template.title,
        isActive: result.template.is_active
      }
    });
    return res.json(result.template);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar la plantilla de consentimiento.' });
  }
});

app.get('/odontology/:clientId/consents', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver consentimientos.' });
    }
    const consents = await listOdontologyPatientConsents({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      status: req.query.status || '',
      search: req.query.search || ''
    });
    return res.json(consents);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los consentimientos.' });
  }
});

app.post('/odontology/:clientId/consents', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear consentimientos.' });
    }
    const result = await createOdontologyPatientConsent({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CONSENT_CREATE',
      details: {
        clientId: req.params.clientId,
        consentId: result.consent.id,
        patientId: result.consent.patient_id,
        templateTitle: result.consent.template_title
      }
    });
    return res.status(201).json(result.consent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el consentimiento.' });
  }
});

app.post('/odontology/:clientId/consents/:consentId/sign', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyConsents(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para firmar consentimientos.' });
    }
    let signerSignaturePath = null;
    try {
      signerSignaturePath = await saveOdontologyConsentSignerSignature(
        req.params.clientId,
        req.params.consentId,
        req.body?.signerSignatureDataUrl
      );
    } catch (signatureError) {
      if (signatureError?.code === 'INVALID_SIGNATURE') {
        return res.status(400).json({ message: signatureError.message });
      }
      throw signatureError;
    }
    if (!signerSignaturePath) {
      return res.status(400).json({ message: 'Dibuja la firma del paciente o acudiente antes de firmar.' });
    }
    const result = await signOdontologyPatientConsent({
      clientId: req.params.clientId,
      consentId: req.params.consentId,
      actorUserId: req.user.sub,
      signerSignaturePath
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }

    const consentForPdf = await getOdontologyConsentForPdf({
      clientId: req.params.clientId,
      consentId: req.params.consentId
    });
    if (!consentForPdf) {
      return res.status(404).json({ message: 'Consentimiento firmado no encontrado para generar PDF.' });
    }
    const pdfPath = await buildOdontologyConsentPdf(consentForPdf);
    const signedConsent = await setOdontologyConsentPdf({
      clientId: req.params.clientId,
      consentId: req.params.consentId,
      pdfPath
    });

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_CONSENT_SIGN',
      details: {
        clientId: req.params.clientId,
        consentId: req.params.consentId,
        patientId: result.consent.patient_id,
        pdfPath
      }
    });
    return res.json(signedConsent || result.consent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo firmar el consentimiento.' });
  }
});

app.get('/odontology/:clientId/patients/:patientId/odontogram', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyOdontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver odontograma.' });
    }
    const result = await getOdontologyOdontogram({
      clientId: req.params.clientId,
      patientId: req.params.patientId
    });
    if (result.error) return res.status(404).json({ message: result.message });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el odontograma.' });
  }
});

app.get('/odontology/:clientId/patients/:patientId/odontogram/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyOdontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver odontograma.' });
    }
    const odontogram = await getOdontologyOdontogram({
      clientId: req.params.clientId,
      patientId: req.params.patientId
    });
    if (odontogram.error) return res.status(404).json({ message: odontogram.message });
    const client = await getClientById(req.params.clientId).catch(() => null);
    const patientCode = odontogram.patient?.internal_code || req.params.patientId;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`odontograma-${patientCode}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyOdontogramPdf(doc, { client, odontogram });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el PDF del odontograma.' });
  }
});

app.post('/odontology/:clientId/odontogram', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyOdontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para modificar odontograma.' });
    }
    const result = await createOdontologyOdontogramEntry({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_ODONTOGRAM_ENTRY_CREATE',
      details: {
        clientId: req.params.clientId,
        patientId: result.entry.patient_id,
        toothNumber: result.entry.tooth_number,
        condition: result.entry.condition_name
      }
    });
    return res.status(201).json(result.entry);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo guardar el odontograma.' });
  }
});

app.get('/odontology/:clientId/periodontograms', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPeriodontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver periodontogramas.' });
    }
    const charts = await listOdontologyPeriodontograms({
      clientId: req.params.clientId,
      patientId: req.query.patientId || '',
      search: req.query.search || ''
    });
    return res.json(charts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los periodontogramas.' });
  }
});

app.get('/odontology/:clientId/periodontograms/:chartId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPeriodontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver periodontogramas.' });
    }
    const chart = await getOdontologyPeriodontogramById({
      clientId: req.params.clientId,
      chartId: req.params.chartId
    });
    if (!chart) return res.status(404).json({ message: 'Periodontograma no encontrado.' });
    return res.json(chart);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el periodontograma.' });
  }
});

app.get('/odontology/:clientId/periodontograms/:chartId/pdf', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPeriodontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para ver periodontogramas.' });
    }
    const chart = await getOdontologyPeriodontogramById({
      clientId: req.params.clientId,
      chartId: req.params.chartId
    });
    if (!chart) return res.status(404).json({ message: 'Periodontograma no encontrado.' });
    const client = await getClientById(req.params.clientId).catch(() => null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfFilename(`periodontograma-${chart.patient_code || chart.id}`)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    doc.pipe(res);
    buildOdontologyPeriodontogramPdf(doc, { client, chart });
    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo generar el PDF del periodontograma.' });
  }
});

app.post('/odontology/:clientId/periodontograms', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPeriodontogram(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear periodontogramas.' });
    }
    const result = await createOdontologyPeriodontogram({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PERIODONTOGRAM_CREATE',
      details: {
        clientId: req.params.clientId,
        chartId: result.chart.id,
        patientId: result.chart.patient_id,
        chartDate: result.chart.chart_date,
        measurementCount: result.chart.measurement_count
      }
    });
    return res.status(201).json(result.chart);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el periodontograma.' });
  }
});

app.get('/odontology/:clientId/patients', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (
      !canManageOdontologyPatients(req.user) &&
      !canManageOdontologyAppointments(req.user) &&
      !canManageOdontologyClinicalRecords(req.user) &&
      !canManageOdontologyTreatmentPlans(req.user) &&
      !canManageOdontologyAttachments(req.user) &&
      !canManageOdontologyPayments(req.user)
    ) {
      return res.status(403).json({ message: 'Sin permiso para ver pacientes odontológicos.' });
    }
    const patients = await listOdontologyPatients({
      clientId: req.params.clientId,
      search: req.query.search || '',
      status: req.query.status || ''
    });
    return res.json(patients);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los pacientes.' });
  }
});

app.get('/odontology/:clientId/patients/:patientId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (
      !canManageOdontologyPatients(req.user) &&
      !canManageOdontologyAppointments(req.user) &&
      !canManageOdontologyClinicalRecords(req.user) &&
      !canManageOdontologyTreatmentPlans(req.user) &&
      !canManageOdontologyAttachments(req.user) &&
      !canManageOdontologyPayments(req.user)
    ) {
      return res.status(403).json({ message: 'Sin permiso para ver pacientes odontológicos.' });
    }
    const patient = await getOdontologyPatientById({
      clientId: req.params.clientId,
      patientId: req.params.patientId
    });
    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }
    return res.json(patient);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo cargar el paciente.' });
  }
});

app.post('/odontology/:clientId/patients', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPatients(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para crear pacientes odontológicos.' });
    }
    const result = await createOdontologyPatient({
      clientId: req.params.clientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PATIENT_CREATE',
      details: {
        clientId: req.params.clientId,
        patientId: result.patient.id,
        internalCode: result.patient.internal_code,
        documentType: result.patient.document_type
      }
    });
    return res.status(201).json(result.patient);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el paciente.' });
  }
});

app.post('/odontology/:clientId/patients/import', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canImportOdontologyPatients(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para importar pacientes odontológicos.' });
    }

    const patients = Array.isArray(req.body?.patients) ? req.body.patients : [];
    if (!patients.length) {
      return res.status(400).json({ message: 'No hay pacientes para importar.' });
    }
    if (patients.length > 500) {
      return res.status(400).json({ message: 'Importa máximo 500 pacientes por archivo.' });
    }

    const settings = await getOdontologySettings(req.params.clientId);
    const requiredFields = settings?.required_patient_fields;
    const normalized = [];
    for (const [index, patient] of patients.entries()) {
      const validation = validateOdontologyPatientPayload(patient || {}, { requiredFields });
      if (!validation.ok) {
        return res.status(400).json({ message: `Fila ${index + 2}: ${validation.message}` });
      }
      normalized.push(validation.data);
    }

    const fileKeys = normalized.map((patient) =>
      `${patient.documentType}|${patient.documentNumber}`.toLowerCase()
    );
    const repeatedKeys = fileKeys.filter((key, index) => fileKeys.indexOf(key) !== index);
    if (repeatedKeys.length) {
      return res.status(400).json({ message: 'Hay documentos repetidos dentro del archivo.' });
    }

    const documentNumbers = Array.from(new Set(normalized.map((patient) => patient.documentNumber)));
    const { rows: existingRows } = await query(
      `SELECT document_type, document_number
       FROM odontology_patients
       WHERE client_id = $1
         AND document_number = ANY($2::text[])`,
      [req.params.clientId, documentNumbers]
    );
    const existingKeys = new Set(existingRows.map((row) =>
      `${row.document_type}|${row.document_number}`.toLowerCase()
    ));
    const existingMatches = normalized.filter((patient) =>
      existingKeys.has(`${patient.documentType}|${patient.documentNumber}`.toLowerCase())
    );
    if (existingMatches.length) {
      return res.status(409).json({
        message: `Ya existen pacientes con estos documentos: ${existingMatches.map((patient) => patient.documentNumber).join(', ')}.`
      });
    }

    const imported = [];
    for (const patient of normalized) {
      const result = await createOdontologyPatient({
        clientId: req.params.clientId,
        payload: patient,
        actorUserId: req.user.sub,
        requiredFields
      });
      if (result.error) {
        return res.status(400).json({ message: result.message });
      }
      imported.push(result.patient.id);
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PATIENT_IMPORT',
      details: {
        clientId: req.params.clientId,
        imported: imported.length,
        patientIds: imported
      }
    });
    return res.status(201).json({ imported: imported.length, ids: imported });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo completar la importación de pacientes.' });
  }
});

app.patch('/odontology/:clientId/patients/:patientId', requireAuth, async (req, res) => {
  try {
    if (!(await ensureOdontologyApiAccess(req, res))) return;
    if (!canManageOdontologyPatients(req.user)) {
      return res.status(403).json({ message: 'Sin permiso para editar pacientes odontológicos.' });
    }
    const result = await updateOdontologyPatient({
      clientId: req.params.clientId,
      patientId: req.params.patientId,
      payload: req.body || {},
      actorUserId: req.user.sub
    });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'DUPLICATE' ? 409 : 400;
      return res.status(status).json({ message: result.message });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'ODONTOLOGY_PATIENT_UPDATE',
      details: {
        clientId: req.params.clientId,
        patientId: result.patient.id,
        internalCode: result.patient.internal_code,
        documentType: result.patient.document_type
      }
    });
    return res.json(result.patient);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el paciente.' });
  }
});

app.post('/admin/users', requireAuth, requirePermission('users:manage'), upload.single('signature'), async (req, res) => {
  const {
    username,
    displayName,
    email,
    role,
    clientId,
    documentType,
    documentNumber,
    invimaRegistration
  } = req.body || {};
  if (!username || !displayName || !email || !role) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  if (!String(email).includes('@')) {
    return res.status(400).json({ message: 'Correo inválido.' });
  }
  const resolvedScope = await resolveManagedUserClientId(req, role, clientId || null);
  if (resolvedScope.error) {
    return res.status(403).json({ message: resolvedScope.error });
  }
  const cleanDocumentType = documentType?.trim?.() || null;
  const cleanDocumentNumber = documentNumber?.trim?.() || null;
  const cleanInvimaRegistration = invimaRegistration?.trim?.() || null;
  let scopedAreaIds = [];
  let scopedLocationIds = [];
  try {
    if (AREA_SCOPED_OPERATIONAL_ROLES.includes(role)) {
      scopedAreaIds = parseAreaScopeIds(req.body?.areaIds, 'Las áreas');
      scopedLocationIds = parseAreaScopeIds(req.body?.locationIds, 'Las ubicaciones');
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
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
  if (role === AREA_RESPONSIBLE_ROLE && !scopedAreaIds.length && !scopedLocationIds.length) {
    return res.status(400).json({
      message: 'Asigna al menos un área o una ubicación al responsable antes de crear el usuario.'
    });
  }
  if (role === AREA_RESPONSIBLE_ROLE && !req.file) {
    return res.status(400).json({
      message: 'La firma digital es obligatoria para el responsable de área.'
    });
  }
  if (req.file && !isAllowedSignatureFile(req.file)) {
    return res.status(400).json({
      message: 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.'
    });
  }
  if (req.file && !isAllowedSignatureSize(req.file)) {
    return res.status(413).json({ message: signatureSizeMessage() });
  }
  try {
    const result = await createUser({
      username,
      displayName,
      email,
      password: randomBytes(32).toString('base64url'),
      role,
      clientId: resolvedScope.clientId,
      documentType: cleanDocumentType,
      documentNumber: cleanDocumentNumber,
      invimaRegistration: cleanInvimaRegistration
    });
    if (result?.error === 'DUPLICATE') {
      return res.status(409).json({ message: createUserDuplicateMessage(result.fields) });
    }
    if (result?.error === 'ROLE_NOT_FOUND') {
      return res.status(400).json({
        message: 'El rol seleccionado no existe o no está disponible para crear usuarios.'
      });
    }
    if (!result?.id) {
      return res.status(500).json({
        message: 'No se pudo crear el usuario porque la base de datos no devolvió el identificador.'
      });
    }

    if (AREA_SCOPED_OPERATIONAL_ROLES.includes(role)) {
      try {
        await replaceReaderAccess(
          result.id,
          resolvedScope.clientId,
          scopedAreaIds,
          scopedLocationIds
        );
      } catch (scopeError) {
        console.error('No se pudo asignar el alcance por áreas o ubicaciones', scopeError);
        await cleanupPartiallyCreatedUser(result.id, 'alcance por áreas o ubicaciones');
        return res.status(400).json({
          message: scopeError.message || 'No se pudo asignar el alcance por áreas o ubicaciones.'
        });
      }
    }

    if (req.file) {
      try {
        const signaturePath = await saveUserSignature(result.id, req.file);
        await updateUserSignature(result.id, signaturePath);
      } catch (signatureError) {
        console.error('No se pudo procesar la firma del usuario', signatureError);
        await cleanupPartiallyCreatedUser(result.id, 'firma del usuario');
        return res.status(400).json({
          message: 'No se pudo procesar la firma digital. Usa una imagen PNG/JPG/WEBP válida o un PDF legible.'
        });
      }
    }

    let invitationSent = false;
    if (result?.id) {
      try {
        const client = resolvedScope.clientId ? await getClientById(resolvedScope.clientId) : null;
        invitationSent = await requestPasswordSetup(String(email).trim(), { clientName: client?.name });
      } catch (inviteError) {
        console.error('No se pudo enviar invitación al administrador de cliente', inviteError);
      }
    }

    try {
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'USER_CREATE',
        targetUserId: result.id,
        targetUsername: username,
        details: {
          role,
          email,
          clientId: resolvedScope.clientId ?? null,
          documentType: documentType ?? null,
          hasInvimaRegistration: Boolean(invimaRegistration),
          areaIds: scopedAreaIds,
          locationIds: scopedLocationIds,
          invitationSent
        }
      });
    } catch (auditError) {
      console.error('No se pudo registrar auditoría de creación de usuario', auditError);
    }
    return res.status(201).json({ ...result, invitation_sent: invitationSent });
  } catch (error) {
    console.error('No se pudo crear el usuario', error);
    const failure = createUserFailureResponse(error);
    return res.status(failure.status).json({ message: failure.message });
  }
});

function isPdfBuffer(buffer) {
  return buffer?.subarray?.(0, 4)?.toString?.() === '%PDF';
}

function isPdfUploadFile(file) {
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  return extension === '.pdf' && isPdfFile(file);
}

const ASSET_HISTORY_DOCUMENT_TYPES = new Set([
  'maintenance_preventive',
  'maintenance_corrective',
  'calibration',
  'other'
]);

const ASSET_HISTORY_DEFAULT_TITLES = Object.freeze({
  maintenance_preventive: 'Mantenimiento preventivo histórico',
  maintenance_corrective: 'Mantenimiento correctivo histórico',
  calibration: 'Calibración histórica',
  other: 'Documento histórico migrado'
});

function odontologyAttachmentExtension(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  if (extension === '.pdf' && (mimetype === 'application/pdf' || isPdfBuffer(file?.buffer))) return '.pdf';
  if (['.jpg', '.jpeg'].includes(extension) || mimetype === 'image/jpeg') return '.jpg';
  if (extension === '.png' || mimetype === 'image/png') return '.png';
  if (extension === '.webp' || mimetype === 'image/webp') return '.webp';
  return '';
}

function isAllowedOdontologyAttachment(file) {
  return Boolean(odontologyAttachmentExtension(file));
}

function isAllowedSignatureFile(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  return SIGNATURE_ALLOWED_MIME_TYPES.includes(mimetype) || SIGNATURE_ALLOWED_EXTENSIONS.includes(extension);
}

function isAllowedSignatureSize(file) {
  return Number(file?.size || 0) <= SIGNATURE_MAX_FILE_SIZE_BYTES;
}

function signatureSizeMessage(label = 'La firma') {
  return `${label} no puede superar ${SIGNATURE_MAX_FILE_SIZE_MB} MB. Usa una imagen o PDF más liviano.`;
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
  const signatureFilename = `signature-${randomUUID()}.png`;
  const filename = path.join(dir, signatureFilename);
  const imageBuffer = await signatureFileToImageBuffer(file);
  await processSignatureImage(imageBuffer, filename);
  const publicPath = `/${path.join('uploads', 'users', userId, signatureFilename)}`;
  return publicPath.replace(/\\/g, '/');
}

function createUserDuplicateMessage(fields = []) {
  if (fields.includes('username') && fields.includes('email')) {
    return 'El usuario y el correo ya están registrados.';
  }
  if (fields.includes('username')) {
    return 'Ese usuario ya está registrado.';
  }
  if (fields.includes('email')) {
    return 'Ese correo ya está registrado.';
  }
  return 'Usuario o correo ya existe.';
}

function createUserFailureResponse(error) {
  const code = String(error?.code || '');
  const constraint = String(error?.constraint || '').toLowerCase();

  if (code === '23505') {
    if (constraint.includes('username') && constraint.includes('email')) {
      return { status: 409, message: 'El usuario y el correo ya están registrados.' };
    }
    if (constraint.includes('username')) {
      return { status: 409, message: 'Ese usuario ya está registrado.' };
    }
    if (constraint.includes('email')) {
      return { status: 409, message: 'Ese correo ya está registrado.' };
    }
    return { status: 409, message: 'Usuario o correo ya existe.' };
  }

  if (code === '23503') {
    return {
      status: 400,
      message: 'No se pudo asociar el usuario al cliente o rol seleccionado. Revisa que el cliente y el rol existan.'
    };
  }

  if (code === '23502') {
    return {
      status: 400,
      message: 'Falta un dato obligatorio para crear el usuario. Revisa los campos marcados en el formulario.'
    };
  }

  if (code === '22P02') {
    return {
      status: 400,
      message: 'Uno de los datos enviados no tiene el formato esperado. Revisa cliente, rol y datos de identificación.'
    };
  }

  return {
    status: 500,
    message: 'No se pudo crear el usuario por un error interno. Intenta nuevamente o revisa los logs del servidor.'
  };
}

async function cleanupPartiallyCreatedUser(userId, context) {
  try {
    await deleteUser(userId);
  } catch (cleanupError) {
    console.error(`No se pudo revertir usuario creado parcialmente (${context})`, cleanupError);
  }
}

async function saveOdontologyConsentSignerSignature(clientId, consentId, dataUrl) {
  const cleanDataUrl = String(dataUrl || '').trim();
  if (!cleanDataUrl) return null;
  const match = cleanDataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('La firma debe enviarse como imagen válida.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    const error = new Error('La firma está vacía o supera el tamaño permitido.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const relativeDir = path.join('uploads', 'clients', clientId, 'odontology', 'consents', 'signatures');
  const dir = path.join(process.cwd(), relativeDir);
  await fs.promises.mkdir(dir, { recursive: true });
  const fileName = `firma-firmante-${consentId}-${randomUUID()}.png`;
  const fullPath = path.join(dir, fileName);
  await processSignatureImage(buffer, fullPath);
  return `/${path.join(relativeDir, fileName)}`.replace(/\\/g, '/');
}

async function saveOdontologyClinicalRecordPatientSignature(clientId, recordId, dataUrl) {
  const cleanDataUrl = String(dataUrl || '').trim();
  if (!cleanDataUrl) return null;
  const match = cleanDataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('La firma debe enviarse como imagen válida.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    const error = new Error('La firma está vacía o supera el tamaño permitido.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const relativeDir = path.join('uploads', 'clients', clientId, 'odontology', 'clinical-records', 'signatures');
  const dir = path.join(process.cwd(), relativeDir);
  await fs.promises.mkdir(dir, { recursive: true });
  const fileName = `firma-paciente-${recordId}-${randomUUID()}.png`;
  const fullPath = path.join(dir, fileName);
  await processSignatureImage(buffer, fullPath);
  return `/${path.join(relativeDir, fileName)}`.replace(/\\/g, '/');
}

async function saveOdontologyTreatmentPlanAcceptanceSignature(clientId, planId, dataUrl) {
  const cleanDataUrl = String(dataUrl || '').trim();
  if (!cleanDataUrl) return null;
  const match = cleanDataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('La firma debe enviarse como imagen válida.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    const error = new Error('La firma está vacía o supera el tamaño permitido.');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  const relativeDir = path.join('uploads', 'clients', clientId, 'odontology', 'treatment-plans', 'signatures');
  const dir = path.join(process.cwd(), relativeDir);
  await fs.promises.mkdir(dir, { recursive: true });
  const fileName = `firma-aceptacion-${planId}-${randomUUID()}.png`;
  const fullPath = path.join(dir, fileName);
  await processSignatureImage(buffer, fullPath);
  return `/${path.join(relativeDir, fileName)}`.replace(/\\/g, '/');
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

function parseJsonObject(value, label) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // The validation message below is intentionally consistent for malformed JSON and wrong shapes.
  }
  throw new ScheduleValidationError(`${label} no tiene un formato válido.`);
}

function assetLabel(asset) {
  if (!asset) return 'Equipo';
  const code = asset.code ? `${asset.code} - ` : '';
  return `${code}${asset.name || 'Equipo sin nombre'}`;
}

function maintenanceRouteForAsset(asset) {
  return asset?.asset_category === 'industrial'
    ? '/mantenimiento-industrial'
    : '/mantenimiento';
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
    assetCategory: asset.asset_category ?? 'biomedical',
    code: asset.code ?? null,
    name: asset.name ?? null,
    brand: asset.brand ?? null,
    model: asset.model ?? null,
    serial: asset.serial ?? null,
    area: asset.area_name ?? null,
    location: asset.location_name ?? asset.location ?? null,
    status: asset.status ?? null,
    riskClass: asset.risk_class ?? null,
    requiresSanitaryClassification: asset.requires_sanitary_classification ?? null,
    requiresElectricalClassification: asset.requires_electrical_classification ?? null,
    electricalProtectionClass: asset.electrical_protection_class ?? null,
    appliedPartType: asset.applied_part_type ?? null,
    maintenanceFrequency: asset.maintenance_frequency ?? null,
    requiresCalibration: asset.requires_calibration ?? null,
    calibrationFrequency: asset.calibration_frequency ?? null
  };
}

function changedAssetFields(before, after) {
  if (!before || !after) return [];
  const fields = [
    ['asset_category', 'Categoría'],
    ['code', 'Código'],
    ['name', 'Nombre'],
    ['brand', 'Marca'],
    ['model', 'Modelo'],
    ['serial', 'Serie'],
    ['site_id', 'Sede'],
    ['area_id', 'Área'],
    ['location_id', 'Ubicación'],
    ['acquisition_date', 'Fecha de adquisición'],
    ['warranty_years', 'Garantía'],
    ['requires_sanitary_classification', 'Requiere riesgo sanitario'],
    ['risk_class', 'Clasificación de riesgo sanitario'],
    ['requires_electrical_classification', 'Requiere riesgo eléctrico'],
    ['electrical_protection_class', 'Clase de protección eléctrica'],
    ['applied_part_type', 'Tipo de parte aplicada'],
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

function assetScheduleConfigurationChanged(before, after) {
  const scheduleFields = new Set([
    'asset_category',
    'site_id',
    'area_id',
    'location_id',
    'acquisition_date',
    'warranty_years',
    'status',
    'maintenance_frequency'
  ]);
  return changedAssetFields(before, after).some((change) => scheduleFields.has(change.field));
}

function assetSchedulePlacementChanged(before, after) {
  const placementFields = new Set(['site_id', 'area_id', 'location_id']);
  return changedAssetFields(before, after).some((change) => placementFields.has(change.field));
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

async function listOdontologyInventoryNotificationRecipients(clientId) {
  const { rows } = await query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE u.is_active = TRUE
       AND (u.client_id = $1 OR r.name = 'superuser')
       AND (r.name = 'superuser' OR p.name = 'odontology:inventory:manage')`,
    [clientId]
  );
  return rows.map((row) => row.id);
}

async function syncOdontologyInventoryLowStockNotifications({ clientId, item }) {
  if (!item?.id) return;
  const isLowStock = Boolean(item.is_active && item.low_stock);
  if (!isLowStock) {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE client_id = $1
         AND type = 'odontology_inventory_low_stock'
         AND payload->>'itemId' = $2
         AND read_at IS NULL`,
      [clientId, item.id]
    );
    return;
  }

  const recipients = await listOdontologyInventoryNotificationRecipients(clientId);
  await Promise.all(
    recipients.map(async (userId) => {
      const { rows } = await query(
        `SELECT id
         FROM notifications
         WHERE user_id = $1
           AND client_id = $2
           AND type = 'odontology_inventory_low_stock'
           AND payload->>'itemId' = $3
           AND read_at IS NULL
         LIMIT 1`,
        [userId, clientId, item.id]
      );
      if (rows[0]) return rows[0];
      return createNotification({
        userId,
        clientId,
        title: 'Stock bajo odontológico',
        message: `${item.name} está en ${item.current_stock} ${item.unit || 'unidad(es)'}; mínimo ${item.min_stock}.`,
        link: '/odontologia?tab=inventory&lowStock=true',
        type: 'odontology_inventory_low_stock',
        priority: 'high',
        data: {
          itemId: item.id,
          itemName: item.name,
          currentStock: item.current_stock,
          minStock: item.min_stock,
          unit: item.unit
        }
      });
    })
  );
}

async function isValidImageBuffer(buffer) {
  try {
    await sharp(buffer).metadata();
    return true;
  } catch {
    return false;
  }
}

async function saveQuickGuideVisual(clientId, guideId, file) {
  const dir = await ensureClientLogoDir(clientId);
  const guideDir = path.join(dir, 'quick-guides', guideId);
  await fs.promises.mkdir(guideDir, { recursive: true });
  const filename = path.join('uploads', 'clients', clientId, 'quick-guides', guideId, 'visual.png');
  const fullPath = path.join(process.cwd(), filename);

  await sharp(file.buffer)
    .rotate()
    .resize(1000, 620, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .png({ compressionLevel: 9 })
    .toFile(fullPath);

  return `/${filename}`.replace(/\\/g, '/');
}

app.get('/admin/clients', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const clients = await listClients();
  return res.json(clients);
});

app.get('/admin/clients/:id/subscription', requireAuth, requireAnyPermission(SAAS_READ_PERMISSIONS), async (req, res) => {
  const client = await getClientById(req.params.id);
  if (!client) {
    return res.status(404).json({ message: 'Cliente no encontrado.' });
  }
  const subscription = await getClientSubscription(req.params.id, { includeHistory: true });
  return res.json(subscription);
});

app.put('/admin/clients/:id/subscription', requireAuth, requireAnyPermission(SAAS_SUBSCRIPTION_PERMISSIONS), async (req, res) => {
  const client = await getClientById(req.params.id);
  if (!client) {
    return res.status(404).json({ message: 'Cliente no encontrado.' });
  }
  if (subscriptionRequiresClientAdmin(req.body || {}) && !(await clientHasActiveAdmin(req.params.id))) {
    return res.status(400).json({
      message: 'Para activar el cliente con acceso completo primero debe existir un administrador del cliente activo.'
    });
  }
  try {
    if (!(await requireActionConfirmation(req, res, 'CLIENT_SUBSCRIPTION_UPDATE'))) return;
    const subscription = await updateClientSubscription(req.params.id, req.body || {}, {
      userId: req.user.sub,
      username: req.user.username
    });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_SUBSCRIPTION_UPDATE',
      targetUserId: req.params.id,
      targetUsername: client.name,
      details: { subscription }
    });
    return res.json(subscription);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'No se pudo actualizar la suscripción.' });
  }
});

app.post('/admin/clients/:id/subscription/payments', requireAuth, requireAnyPermission(SAAS_SUBSCRIPTION_PERMISSIONS), async (req, res) => {
  const client = await getClientById(req.params.id);
  if (!client) {
    return res.status(404).json({ message: 'Cliente no encontrado.' });
  }
  if (!(await clientHasActiveAdmin(req.params.id))) {
    return res.status(400).json({
      message: 'Para registrar renovación y activar el cliente primero debe existir un administrador del cliente activo.'
    });
  }
  try {
    if (!(await requireActionConfirmation(req, res, 'CLIENT_SUBSCRIPTION_PAYMENT'))) return;
    const payment = await recordSubscriptionPayment(req.params.id, req.body || {}, {
      userId: req.user.sub,
      username: req.user.username
    });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_SUBSCRIPTION_PAYMENT',
      targetUserId: req.params.id,
      targetUsername: client.name,
      details: { payment }
    });
    return res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'No se pudo registrar el pago.' });
  }
});

app.get('/admin/clients/:id/admin-users', requireAuth, requireAnyPermission(SAAS_CLIENT_ADMIN_RESET_PERMISSIONS), async (req, res) => {
  if (req.user.clientId) {
    return res.status(403).json({ message: 'Solo administradores SaaS pueden gestionar administradores del cliente.' });
  }
  const client = await getClientById(req.params.id);
  if (!client) {
    return res.status(404).json({ message: 'Cliente no encontrado.' });
  }
  const admins = await listClientAdmins(req.params.id);
  return res.json(admins);
});

app.post(
  '/admin/clients/:id/admin-users',
  requireAuth,
  requireAnyPermission(SAAS_CLIENT_ADMIN_RESET_PERMISSIONS),
  upload.single('signature'),
  async (req, res) => {
    if (req.user.clientId) {
      return res.status(403).json({ message: 'Solo administradores SaaS pueden crear administradores del cliente.' });
    }
    const client = await getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const { username, displayName, email, documentType, documentNumber } = req.body || {};
    if (!username || !displayName || !email || !documentType || !documentNumber) {
      return res.status(400).json({ message: 'Datos incompletos.' });
    }
    if (!String(email).includes('@')) {
      return res.status(400).json({ message: 'Correo inválido.' });
    }
    const cleanDocumentType = documentType?.trim?.() || null;
    const cleanDocumentNumber = documentNumber?.trim?.() || null;
    if (!BIOMED_DOCUMENT_TYPES.includes(cleanDocumentType)) {
      return res.status(400).json({ message: 'Tipo de documento inválido.' });
    }
    if (req.file && !isAllowedSignatureFile(req.file)) {
      return res.status(400).json({
        message: 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.'
      });
    }
    if (req.file && !isAllowedSignatureSize(req.file)) {
      return res.status(413).json({ message: signatureSizeMessage() });
    }
    if (!(await requireActionConfirmation(req, res, 'CLIENT_ADMIN_CREATE'))) return;

    try {
      const result = await createUser({
        username: String(username).trim(),
        displayName: String(displayName).trim(),
        email: String(email).trim(),
        password: randomBytes(32).toString('base64url'),
        role: CLIENT_ADMIN_ROLE,
        clientId: req.params.id,
        documentType: cleanDocumentType,
        documentNumber: cleanDocumentNumber,
        invimaRegistration: null
      });
      if (result?.error === 'DUPLICATE') {
        return res.status(409).json({ message: 'Usuario o correo ya existe.' });
      }
      if (req.file && result?.id) {
        const signaturePath = await saveUserSignature(result.id, req.file);
        await updateUserSignature(result.id, signaturePath);
      }
      let invitationSent = false;
      try {
        invitationSent = await requestPasswordSetup(String(email).trim(), { clientName: client.name });
      } catch (inviteError) {
        console.error('No se pudo enviar invitación al administrador del cliente', inviteError);
      }
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'CLIENT_ADMIN_CREATE',
        targetUserId: result.id,
        targetUsername: username,
        details: {
          clientId: req.params.id,
          clientName: client.name,
          email,
          invitationSent
        }
      });
      return res.status(201).json({ ...result, invitation_sent: invitationSent });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear el administrador del cliente.' });
    }
  }
);

app.patch(
  '/admin/clients/:id/admin-users/:userId/password',
  requireAuth,
  requireAnyPermission(SAAS_CLIENT_ADMIN_RESET_PERMISSIONS),
  async (req, res) => {
    if (req.user.clientId) {
      return res.status(403).json({ message: 'Solo administradores SaaS pueden enviar acceso al administrador del cliente.' });
    }
    const client = await getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const target = await getUserById(req.params.userId);
    if (!target || target.client_id !== req.params.id || !target.roles?.includes(CLIENT_ADMIN_ROLE)) {
      return res.status(404).json({ message: 'Administrador del cliente no encontrado.' });
    }
    if (!(await requireActionConfirmation(req, res, 'CLIENT_ADMIN_PASSWORD_RESET'))) return;
    try {
      await requestPasswordSetup(String(target.email).trim(), { clientName: client.name });
    } catch (error) {
      console.error('No se pudo enviar correo de activación al administrador de cliente', error);
      return res.status(500).json({ message: 'No se pudo enviar el correo de activación.' });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_ADMIN_PASSWORD_RESET',
      targetUserId: req.params.userId,
      targetUsername: target.username,
      details: { clientId: req.params.id, clientName: client.name, delivery: 'email' }
    });
    return res.json({ ok: true, delivery: 'email' });
  }
);

app.get('/admin/clients/:id/areas', requireAuth, requirePermission('users:manage'), async (req, res) => {
  if (!isSuperuser(req.user) && req.user.clientId !== req.params.id) {
    return res.status(403).json({ message: 'Sin acceso al cliente.' });
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
  if (!isSuperuser(req.user) && req.user.clientId !== req.params.id) {
    return res.status(403).json({ message: 'Sin acceso al cliente.' });
  }
  try {
    const areas = await listLocations(req.params.id, req.query.areaId);
    return res.json(areas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar las ubicaciones.' });
  }
});

app.post('/admin/clients', requireAuth, requirePermission('clients:manage'), upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'adminSignature', maxCount: 1 }
]), async (req, res) => {
  if (!req.user.roles?.includes('superuser')) {
    return res.status(403).json({ message: 'Solo superuser.' });
  }
  const {
    name,
    nit,
    city,
    address,
    habilitationCode,
    email,
    adminUsername,
    adminDisplayName,
    adminEmail,
    adminDocumentType,
    adminDocumentNumber,
    planKey,
    billingCycle
  } = req.body || {};
  if (!name || !nit || !city || !email || !address) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  if (!adminUsername || !adminDisplayName || !adminEmail || !adminDocumentType || !adminDocumentNumber) {
    return res.status(400).json({
      message: 'Para crear un cliente debes crear también el administrador inicial del cliente.'
    });
  }
  if (!String(adminEmail).includes('@')) {
    return res.status(400).json({ message: 'Correo del administrador inválido.' });
  }
  const cleanPlanKey = String(planKey || 'biomedico_ips').trim();
  const cleanBillingCycle = ['monthly', 'annual'].includes(billingCycle) ? billingCycle : 'monthly';
  const plans = await listSubscriptionPlans();
  if (!plans.some((plan) => plan.key === cleanPlanKey)) {
    return res.status(400).json({ message: 'Plan comercial inválido.' });
  }
  const cleanAdminDocumentType = adminDocumentType?.trim?.() || null;
  const cleanAdminDocumentNumber = adminDocumentNumber?.trim?.() || null;
  if (!BIOMED_DOCUMENT_TYPES.includes(cleanAdminDocumentType)) {
    return res.status(400).json({ message: 'Tipo de documento del administrador inválido.' });
  }
  const logoFile = req.files?.logo?.[0] ?? null;
  const adminSignatureFile = req.files?.adminSignature?.[0] ?? null;
  if (logoFile) {
    try {
      await sharp(logoFile.buffer).metadata();
    } catch {
      return res.status(400).json({ message: 'El logo debe ser una imagen válida.' });
    }
  }
  if (adminSignatureFile && !isAllowedSignatureFile(adminSignatureFile)) {
    return res.status(400).json({
      message: 'La firma del administrador debe ser una imagen PNG/JPG/WEBP o un PDF.'
    });
  }
  if (adminSignatureFile && !isAllowedSignatureSize(adminSignatureFile)) {
    return res.status(413).json({ message: signatureSizeMessage('La firma del administrador') });
  }

  const { rows: duplicateAdminRows } = await query(
    'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1',
    [adminUsername, adminEmail]
  );
  if (duplicateAdminRows.length) {
    return res.status(409).json({ message: 'El usuario o correo del administrador ya existe.' });
  }
  if (!(await requireActionConfirmation(req, res, 'CLIENT_CREATE'))) return;

  try {
    const result = await createClient({ name, nit, city, address, habilitationCode, email });
    let logoPath = null;
    if (logoFile) {
      const updatedLogo = await saveClientLogoBuffer(result.id, logoFile.buffer);
      logoPath = updatedLogo?.logo_path ?? null;
    }
    const adminResult = await createUser({
      username: String(adminUsername).trim(),
      displayName: String(adminDisplayName).trim(),
      email: String(adminEmail).trim(),
      password: randomBytes(32).toString('base64url'),
      role: CLIENT_ADMIN_ROLE,
      clientId: result.id,
      documentType: cleanAdminDocumentType,
      documentNumber: cleanAdminDocumentNumber,
      invimaRegistration: null
    });
    if (adminResult?.error === 'DUPLICATE') {
      return res.status(409).json({ message: 'Usuario o correo del administrador ya existe.' });
    }
    let adminSignaturePath = null;
    if (adminSignatureFile && adminResult?.id) {
      adminSignaturePath = await saveUserSignature(adminResult.id, adminSignatureFile);
      await updateUserSignature(adminResult.id, adminSignaturePath);
    }
    let adminInvitationSent = false;
    try {
      adminInvitationSent = await requestPasswordSetup(String(adminEmail).trim(), { clientName: String(name).trim() });
    } catch (inviteError) {
      console.error('No se pudo enviar invitación al administrador inicial', inviteError);
    }
    const periodStart = todayLocalISO();
    const periodEndDate = addMonths(`${periodStart}T00:00:00`, cleanBillingCycle === 'annual' ? 12 : 1);
    periodEndDate.setDate(periodEndDate.getDate() - 1);
    const subscription = await updateClientSubscription(result.id, {
      planKey: cleanPlanKey,
      billingCycle: cleanBillingCycle,
      status: 'active',
      accessMode: 'full',
      currentPeriodStartsAt: periodStart,
      currentPeriodEndsAt: toLocalISODate(periodEndDate),
      graceEndsAt: null,
      amount: null,
      notes: 'Suscripción inicial creada con el cliente.'
    }, {
      userId: req.user.sub,
      username: req.user.username
    });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_CREATE',
      targetUserId: result.id,
      targetUsername: name,
      details: {
        nit,
        city,
        address,
        logo: logoPath,
        planKey: cleanPlanKey,
        billingCycle: cleanBillingCycle,
        subscription,
        initialAdminUserId: adminResult?.id,
        initialAdminUsername: adminUsername,
        initialAdminInvitationSent: adminInvitationSent,
        hasAdminSignature: Boolean(adminSignaturePath)
      }
    });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_ADMIN_CREATE',
      targetUserId: adminResult?.id,
      targetUsername: adminUsername,
      details: {
        clientId: result.id,
        email: adminEmail,
        documentType: cleanAdminDocumentType,
        invitationSent: adminInvitationSent
      }
    });
    return res.status(201).json({
      ...result,
      logo_path: logoPath,
      initial_admin_id: adminResult?.id,
      initial_admin_invitation_sent: adminInvitationSent
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear el cliente.' });
  }
});

app.patch('/admin/clients/:id', requireAuth, requireAnyPermission(SAAS_CLIENT_UPDATE_PERMISSIONS), async (req, res) => {
  const { name, nit, city, address, habilitationCode, email } = req.body || {};
  if (!name || !nit || !city || !email || !address) {
    return res.status(400).json({ message: 'Datos incompletos.' });
  }
  if (!(await requireActionConfirmation(req, res, 'CLIENT_UPDATE'))) return;
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
  if (!(await requireActionConfirmation(req, res, 'CLIENT_DELETE'))) return;
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
  requireAnyPermission(SAAS_CLIENT_UPDATE_PERMISSIONS),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Logo requerido.' });
    }
    if (!(await requireActionConfirmation(req, res, 'CLIENT_LOGO_UPDATE'))) return;

    const updated = await saveClientLogoBuffer(req.params.id, req.file.buffer);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CLIENT_LOGO_UPDATE',
      targetUserId: req.params.id,
      details: { clientId: req.params.id, logo: updated?.logo_path }
    });

    return res.json(updated);
  }
);

function sendCatalogError(res, error, fallbackMessage) {
  const code = String(error?.code || '');
  if (code === 'CATALOG_NODE_NOT_FOUND' || code === 'CATALOG_PARENT_NOT_FOUND') {
    return res.status(404).json({ code, message: error.message });
  }
  if (
    code === 'CATALOG_DUPLICATE'
    || code === 'CATALOG_PARENT_NOT_APPROVED'
    || code === 'CATALOG_MERGE_TARGET_NOT_APPROVED'
    || code === 'CATALOG_APPROVED_REJECT_FORBIDDEN'
  ) {
    return res.status(409).json({ code, message: error.message });
  }
  if (code.startsWith('CATALOG_')) {
    return res.status(400).json({ code, message: error.message });
  }
  if (code === 'INVALID_ASSET_CATEGORY') {
    return res.status(400).json({ code, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: fallbackMessage });
}

app.get(
  '/admin/biomedical-catalog',
  requireAuth,
  requirePlatformCatalogManager,
  async (_req, res) => {
    try {
      return res.json(await listEquipmentCatalogForAdmin());
    } catch (error) {
      return sendCatalogError(res, error, 'No se pudo cargar el catálogo global de equipos.');
    }
  }
);

app.post(
  '/admin/biomedical-catalog/nodes',
  requireAuth,
  requirePlatformCatalogManager,
  async (req, res) => {
    const { type, name, parentId = null, assetCategory = 'biomedical' } = req.body || {};
    try {
      const node = await createApprovedCatalogNode({
        type,
        name,
        parentId,
        assetCategory,
        actorUserId: req.user.sub
      });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'BIOMEDICAL_CATALOG_CREATE',
        targetUserId: node.id,
        details: { type, name: node.name, parentId, assetCategory: node.asset_category || assetCategory }
      });
      return res.status(201).json({ node });
    } catch (error) {
      return sendCatalogError(res, error, 'No se pudo crear el elemento del catálogo.');
    }
  }
);

app.patch(
  '/admin/biomedical-catalog/:type/:id',
  requireAuth,
  requirePlatformCatalogManager,
  async (req, res) => {
    const { type, id } = req.params;
    const { name, parentId, isActive } = req.body || {};
    try {
      const result = await updateCatalogNode({
        type,
        id,
        name,
        parentId,
        isActive,
        actorUserId: req.user.sub
      });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'BIOMEDICAL_CATALOG_UPDATE',
        targetUserId: id,
        details: { type, name, parentId, isActive, sync: result.sync }
      });
      return res.json(result);
    } catch (error) {
      return sendCatalogError(res, error, 'No se pudo actualizar el elemento del catálogo.');
    }
  }
);

app.post(
  '/admin/biomedical-catalog/:type/:id/review',
  requireAuth,
  requirePlatformCatalogManager,
  async (req, res) => {
    const { type, id } = req.params;
    const { decision, cascade = false, notes = null } = req.body || {};
    try {
      const result = await reviewCatalogNode({
        type,
        id,
        decision,
        cascade: Boolean(cascade),
        notes,
        actorUserId: req.user.sub
      });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: decision === 'approve' ? 'BIOMEDICAL_CATALOG_APPROVE' : 'BIOMEDICAL_CATALOG_REJECT',
        targetUserId: id,
        details: { type, cascade: Boolean(cascade), notes, sync: result.sync }
      });
      return res.json(result);
    } catch (error) {
      return sendCatalogError(res, error, 'No se pudo revisar el elemento del catálogo.');
    }
  }
);

app.post(
  '/admin/biomedical-catalog/:type/:id/merge',
  requireAuth,
  requirePlatformCatalogManager,
  async (req, res) => {
    const { type, id } = req.params;
    const { targetId } = req.body || {};
    try {
      const result = await mergeCatalogNodes({ type, sourceId: id, targetId });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'BIOMEDICAL_CATALOG_MERGE',
        targetUserId: targetId,
        details: { type, sourceId: id, targetId, sync: result.sync }
      });
      return res.json(result);
    } catch (error) {
      return sendCatalogError(res, error, 'No se pudieron fusionar los elementos del catálogo.');
    }
  }
);

function validateQuickGuidePayload(body) {
  const required = [
    ['equipmentName', 'Nombre del equipo'],
    ['brand', 'Marca'],
    ['model', 'Modelo'],
    ['basicOperation', 'Operación básica'],
    ['cleaningDisinfection', 'Limpieza y desinfección'],
    ['emergencyActions', 'Emergencia o falla']
  ];
  const missing = required
    .filter(([key]) => !String(body?.[key] || '').trim())
    .map(([, label]) => label);
  return missing;
}

app.get(
  '/quick-guides/:clientId',
  requireAuth,
  requireAnyPermission(['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const guides = await listQuickGuides(clientId, {
        search: req.query.search || '',
        status: req.query.status || ''
      });
      return res.json(guides);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las guías rápidas.' });
    }
  }
);

app.get(
  '/quick-guides/:clientId/assets/:assetId',
  requireAuth,
  requireAnyPermission(['quick_guides:view', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const includeDrafts = hasAnyPermission(req.user, ['quick_guides:create', 'quick_guides:edit', 'quick_guides:approve']);
    const guide = await findQuickGuideForAsset(clientId, assetId, { includeDrafts });
    if (!guide) {
      return res.status(404).json({ message: 'No hay guía rápida aprobada para este equipo, marca y modelo.' });
    }
    return res.json(guide);
  }
);

app.get(
  '/quick-guides/:clientId/assets/:assetId/pdf',
  requireAuth,
  requireAnyPermission(['quick_guides:view', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const client = await getClientById(clientId);
    const includeDrafts = hasAnyPermission(req.user, ['quick_guides:create', 'quick_guides:edit', 'quick_guides:approve']);
    const guide = await findQuickGuideForAsset(clientId, assetId, { includeDrafts });
    if (!client || !guide) {
      return res.status(404).json({ message: 'No hay guía rápida aprobada para este equipo, marca y modelo.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"guia-rapida-${guide.brand}-${guide.model}.pdf\"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    buildQuickGuidePdf(doc, { client, guide });
    doc.end();
  }
);

app.get(
  '/quick-guides/:clientId/:guideId',
  requireAuth,
  requireAnyPermission(['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, guideId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const guide = await getQuickGuideById(clientId, guideId);
    if (!guide) {
      return res.status(404).json({ message: 'Guía rápida no encontrada.' });
    }
    return res.json(guide);
  }
);

app.post(
  '/quick-guides/:clientId',
  requireAuth,
  requirePermission('quick_guides:create'),
  upload.single('visual'),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const missing = validateQuickGuidePayload(req.body);
    if (missing.length) {
      return res.status(400).json({ message: `Campos obligatorios: ${missing.join(', ')}.` });
    }
    if (req.file && !(await isValidImageBuffer(req.file.buffer))) {
      return res.status(400).json({ message: 'La imagen visual debe ser PNG, JPG o WEBP.' });
    }
    try {
      const result = await createQuickGuide(clientId, req.body, req.user.sub);
      let visualPath = null;
      if (req.file) {
        visualPath = await saveQuickGuideVisual(clientId, result.id, req.file);
        await setQuickGuideVisual(clientId, result.id, visualPath);
      }
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'QUICK_GUIDE_CREATE',
        targetUserId: result.id,
        details: {
          clientId,
          brand: req.body.brand,
          model: req.body.model,
          hasVisual: Boolean(visualPath)
        }
      });
      return res.status(201).json({ ...result, visual_path: visualPath });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe una guía rápida para este equipo, marca y modelo en el cliente.' });
      }
      if (String(error?.code || '').startsWith('CATALOG_')) {
        return sendCatalogError(res, error, 'No se pudo registrar la propuesta en el catálogo de equipos.');
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo crear la guía rápida.' });
    }
  }
);

app.put(
  '/quick-guides/:clientId/:guideId',
  requireAuth,
  requirePermission('quick_guides:edit'),
  upload.single('visual'),
  async (req, res) => {
    const { clientId, guideId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const missing = validateQuickGuidePayload(req.body);
    if (missing.length) {
      return res.status(400).json({ message: `Campos obligatorios: ${missing.join(', ')}.` });
    }
    if (req.file && !(await isValidImageBuffer(req.file.buffer))) {
      return res.status(400).json({ message: 'La imagen visual debe ser PNG, JPG o WEBP.' });
    }
    try {
      const result = await updateQuickGuide(clientId, guideId, req.body, req.user.sub);
      if (!result) {
        return res.status(404).json({ message: 'Guía rápida no encontrada.' });
      }
      if (req.file) {
        const visualPath = await saveQuickGuideVisual(clientId, guideId, req.file);
        await setQuickGuideVisual(clientId, guideId, visualPath);
      }
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'QUICK_GUIDE_UPDATE',
        targetUserId: guideId,
        details: {
          clientId,
          brand: req.body.brand,
          model: req.body.model,
          hasNewVisual: Boolean(req.file)
        }
      });
      return res.json({ ok: true, catalogReview: result.catalogReview });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe una guía rápida para este equipo, marca y modelo en el cliente.' });
      }
      if (String(error?.code || '').startsWith('CATALOG_')) {
        return sendCatalogError(res, error, 'No se pudo registrar la propuesta en el catálogo de equipos.');
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo actualizar la guía rápida.' });
    }
  }
);

app.post(
  '/quick-guides/:clientId/:guideId/approve',
  requireAuth,
  requirePermission('quick_guides:approve'),
  async (req, res) => {
    const { clientId, guideId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const result = await approveQuickGuide(clientId, guideId, req.user.sub);
    if (!result) {
      return res.status(404).json({ message: 'Guía rápida no encontrada.' });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'QUICK_GUIDE_APPROVE',
      targetUserId: guideId,
      details: { clientId }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/quick-guides/:clientId/:guideId/pdf',
  requireAuth,
  requireAnyPermission(['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, guideId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const client = await getClientById(clientId);
    const guide = await getQuickGuideById(clientId, guideId);
    if (!client || !guide) {
      return res.status(404).json({ message: 'Guía rápida no encontrada.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=\"guia-rapida-${guide.brand}-${guide.model}.pdf\"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    buildQuickGuidePdf(doc, { client, guide });
    doc.end();
  }
);

app.delete(
  '/quick-guides/:clientId/:guideId',
  requireAuth,
  requirePermission('quick_guides:delete'),
  async (req, res) => {
    const { clientId, guideId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const guide = await deleteQuickGuide(clientId, guideId);
    if (!guide) {
      return res.status(404).json({ message: 'Guía rápida no encontrada.' });
    }
    const guideDir = path.join(process.cwd(), 'uploads', 'clients', clientId, 'quick-guides', guideId);
    if (fs.existsSync(guideDir)) {
      await fs.promises.rm(guideDir, { recursive: true, force: true });
    }
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'QUICK_GUIDE_DELETE',
      targetUserId: guideId,
      details: {
        clientId,
        brand: guide.brand,
        model: guide.model
      }
    });
    return res.json({ ok: true });
  }
);

app.get(
  '/biomed/:clientId/equipment-catalog',
  requireAuth,
  requireAnyPermission([
    'hb:create',
    'hb:view',
    'hb:import',
    'read:all',
    'quick_guides:view',
    'quick_guides:create',
    'quick_guides:edit'
  ]),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const assetCategory = normalizeAssetCategory(req.query.category);
      return res.json(await listEquipmentCatalog(assetCategory));
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo cargar el catálogo de equipos.' });
    }
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
      const assetCategory = normalizeAssetCategory(req.query.category);
      const assets = isAreaScopedOperationalUser(req.user)
        ? await listAssetsForReader(clientId, req.user.sub, { assetCategory })
        : await listAssets(clientId, { assetCategory });
      return res.json(assets);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
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
      requiresSanitaryClassification,
      requiresElectricalClassification,
      electricalProtectionClass,
      appliedPartType,
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
      scheduleEnrollmentMode,
      requiresCalibration,
      calibrationFrequency,
      assetCategory,
      accessories,
      cleaning,
      recommendations
    } = body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Código y nombre son requeridos.' });
    }

    try {
      const normalizedScheduleEnrollmentMode = normalizeAssetScheduleEnrollmentMode(
        scheduleEnrollmentMode
      );
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
        requiresSanitaryClassification,
        requiresElectricalClassification,
        electricalProtectionClass,
        appliedPartType,
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
        assetCategory,
        hvEngineerUserId,
        catalogCreatedBy: req.user.sub
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
      const scheduleSyncResult = await syncAssetsIntoMaintenanceSchedules({
        clientId,
        schema: (await getClientById(clientId))?.schema_name,
        assetIds: [result.id],
        today: todayInBogota(),
        actorUserId: req.user.sub,
        enrollmentMode: normalizedScheduleEnrollmentMode
      });
      const scheduleSync = scheduleSyncResult.assets[0] || null;
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
          },
          scheduleEnrollmentMode: normalizedScheduleEnrollmentMode,
          scheduleSync
        }
      });
      return res.status(201).json({ ...result, scheduleSync });
    } catch (error) {
      if (String(error?.code || '').startsWith('CATALOG_')) {
        return sendCatalogError(res, error, 'No se pudo registrar la propuesta en el catálogo de equipos.');
      }
      if (error?.code === 'INVALID_RISK_CLASSIFICATION') {
        return res.status(400).json({ message: error.message });
      }
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof ScheduleValidationError) {
        return res.status(400).json({ message: error.message });
      }
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

    let assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    if (!assets.length) {
      return res.status(400).json({ message: 'No hay equipos para importar.' });
    }
    if (assets.length > 500) {
      return res.status(400).json({ message: 'Importa máximo 500 equipos por archivo.' });
    }

    let assetCategory;
    try {
      assetCategory = normalizeAssetCategory(req.body?.assetCategory ?? assets[0]?.assetCategory);
      const mixedCategory = assets.some(
        (asset) => normalizeAssetCategory(asset?.assetCategory ?? assetCategory) !== assetCategory
      );
      if (mixedCategory) {
        return res.status(400).json({ message: 'Todos los equipos del archivo deben pertenecer a la misma categoría.' });
      }
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    assets = assets.map((asset) => ({ ...asset, assetCategory }));

    const missing = assets.find((asset) =>
      !asset?.code ||
      !asset?.name ||
      !asset?.brand ||
      !asset?.model ||
      !asset?.serial ||
      !asset?.siteId ||
      !asset?.areaId ||
      !asset?.locationId ||
      (assetCategory === 'biomedical' && !asset?.invimaReg)
    );
    if (missing) {
      return res.status(400).json({ message: 'Hay equipos con campos obligatorios incompletos.' });
    }

    const validationResults = assets.map((asset) => validateAndNormalizeHvImportAsset(asset));
    const invalidDataIndex = validationResults.findIndex((result) => result.errors.length > 0);
    if (invalidDataIndex >= 0) {
      const invalidAsset = assets[invalidDataIndex];
      const assetName = invalidAsset?.code || invalidAsset?.name || `fila ${invalidDataIndex + 2}`;
      return res.status(400).json({
        message: `Equipo ${assetName}: ${validationResults[invalidDataIndex].errors.join('. ')}.`
      });
    }
    assets = validationResults.map((result) => result.asset);

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
      const pendingCatalogNodes = new Map();
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
          requiresSanitaryClassification: asset.requiresSanitaryClassification,
          requiresElectricalClassification: asset.requiresElectricalClassification,
          electricalProtectionClass: asset.electricalProtectionClass || null,
          appliedPartType: asset.appliedPartType || null,
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
          calibrationFrequency: asset.calibrationFrequency,
          assetCategory,
          hvEngineerUserId,
          catalogCreatedBy: req.user.sub
        });
        for (const node of result.catalogReview?.pendingNodes || []) {
          pendingCatalogNodes.set(`${node.type}:${node.id}`, node);
        }
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

      const importClient = await getClientById(clientId);
      const scheduleSync = await syncAssetsIntoMaintenanceSchedules({
        clientId,
        schema: importClient.schema_name,
        assetIds: imported,
        today: todayInBogota(),
        actorUserId: req.user.sub
      });

      return res.status(201).json({
        imported: imported.length,
        ids: imported,
        scheduleSync,
        catalogReview: {
          status: pendingCatalogNodes.size ? 'pending' : 'approved',
          pendingNodes: Array.from(pendingCatalogNodes.values())
        }
      });
    } catch (error) {
      if (String(error?.code || '').startsWith('CATALOG_')) {
        return sendCatalogError(res, error, 'No se pudo registrar la propuesta en el catálogo de equipos.');
      }
      if (error?.code === 'INVALID_RISK_CLASSIFICATION') {
        return res.status(400).json({ message: error.message });
      }
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof ScheduleValidationError) {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo completar la importación masiva.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets/:assetId/maintenance-schedule-preview',
  requireAuth,
  requirePermission('hb:create'),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const client = await getClientById(clientId);
      if (!client?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const maintenanceFrequency = normalizePeriodicity(req.body?.maintenanceFrequency);
      const preview = await previewApprovedAssetScheduleProgramming({
        clientId,
        schema: client.schema_name,
        assetId,
        today: todayInBogota(),
        configuration: {
          maintenanceFrequency,
          changeMode: req.body?.changeMode,
          areaId: req.body?.areaId || null,
          locationId: req.body?.locationId || null,
          acquisitionDate: req.body?.acquisitionDate || null,
          warrantyYears: req.body?.warrantyYears ?? null
        }
      });
      const frequencyChanged =
        String(preview.previousFrequency || '').trim().toLowerCase() !== preview.frequency;
      return res.json({
        ...preview,
        requiresConfirmation: frequencyChanged && preview.requiresConfirmation,
        schedules: frequencyChanged ? preview.schedules : []
      });
    } catch (error) {
      return respondScheduleError(
        res,
        error,
        'No se pudieron preparar las fechas del cronograma aprobado.'
      );
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
      requiresSanitaryClassification,
      requiresElectricalClassification,
      electricalProtectionClass,
      appliedPartType,
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
      assetCategory,
      accessories,
      cleaning,
      recommendations,
      maintenanceScheduleProgramming
    } = body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Código y nombre son requeridos.' });
    }
    try {
      const hvEngineerUserId = await resolveHvEngineerUserId(req);
      const beforeAsset = await getAssetById(clientId, assetId);
      if (!beforeAsset) {
        return res.status(404).json({ message: 'Equipo no encontrado.' });
      }
      const requestedPlacement = {
        siteId: siteId || null,
        areaId: areaId || null,
        locationId: locationId || null
      };
      const currentPlacement = {
        siteId: beforeAsset.site_id || null,
        areaId: beforeAsset.area_id || null,
        locationId: beforeAsset.location_id || null
      };
      if (
        requestedPlacement.siteId !== currentPlacement.siteId
        || requestedPlacement.areaId !== currentPlacement.areaId
        || requestedPlacement.locationId !== currentPlacement.locationId
      ) {
        return res.status(409).json({
          code: 'ASSET_LOCATION_REQUIRES_MOVEMENT',
          message: 'La sede, el área y la ubicación solo pueden cambiarse desde Inventario para registrar la trazabilidad del traslado.'
        });
      }
      const currentCategory = normalizeAssetCategory(beforeAsset.asset_category);
      const requestedAssetCategory = normalizeAssetCategory(assetCategory ?? currentCategory);
      if (currentCategory !== requestedAssetCategory) {
        return res.status(409).json({
          message: 'La categoría de la hoja de vida se define al crearla y no puede cambiarse al editar.'
        });
      }
      const requestedMaintenanceFrequency = normalizePeriodicity(maintenanceFrequency);
      const requestedWarrantyYears = warrantyYears ? Number(warrantyYears) : null;
      const requestedAcquisitionDate = acquisitionDate || null;
      const frequencyChanged =
        String(beforeAsset.maintenance_frequency || '').trim().toLowerCase()
        !== requestedMaintenanceFrequency;
      const assetClient = await getClientById(clientId);
      if (!assetClient?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      let scheduleProgrammingPreview = null;
      let scheduleProgrammingSelection = null;
      const submittedScheduleProgramming = maintenanceScheduleProgramming
        ? parseJsonObject(
            maintenanceScheduleProgramming,
            'La programación del mantenimiento'
          )
        : null;
      if (frequencyChanged) {
        scheduleProgrammingPreview = await previewApprovedAssetScheduleProgramming({
          clientId,
          schema: assetClient.schema_name,
          assetId,
          today: todayInBogota(),
          configuration: {
            maintenanceFrequency: requestedMaintenanceFrequency,
            changeMode: submittedScheduleProgramming?.changeMode,
            areaId: currentPlacement.areaId,
            locationId: currentPlacement.locationId,
            acquisitionDate: requestedAcquisitionDate,
            warrantyYears: requestedWarrantyYears
          }
        });
        if (scheduleProgrammingPreview.requiresConfirmation) {
          scheduleProgrammingSelection = submittedScheduleProgramming;
          if (!scheduleProgrammingSelection) {
            return res.status(409).json({
              message: 'Selecciona las fechas de mantenimiento antes de guardar la nueva periodicidad.',
              code: 'MAINTENANCE_SCHEDULE_DATES_REQUIRED'
            });
          }
          normalizeAssetScheduleProgrammingSelection(
            scheduleProgrammingSelection,
            scheduleProgrammingPreview.schedules,
            {
              expectedChangeMode: scheduleProgrammingPreview.changeMode,
              expectedEffectiveDate: scheduleProgrammingPreview.effectiveDate
            }
          );
        }
      }
      if (maintenanceScheduleProgramming && !scheduleProgrammingPreview?.requiresConfirmation) {
        return res.status(409).json({
          message: 'La programación enviada ya no corresponde a un cambio de periodicidad pendiente.'
        });
      }
      const updateResult = await updateAsset(clientId, assetId, {
        code,
        name,
        brand,
        model,
        serial,
        invimaReg,
        siteId: currentPlacement.siteId,
        areaId: currentPlacement.areaId,
        locationId: currentPlacement.locationId,
        riskClass,
        requiresSanitaryClassification,
        requiresElectricalClassification,
        electricalProtectionClass,
        appliedPartType,
        isMobile: String(isMobile) === 'true',
        manufacturer,
        acquisitionType,
        contractText,
        acquisitionDate,
        usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : null,
        warrantyYears: requestedWarrantyYears,
        supplierName,
        supplierPhone,
        supplierEmail,
        powerType,
        voltage,
        tempMin: tempMin ? Number(tempMin) : null,
        tempMax: tempMax ? Number(tempMax) : null,
        humidityMin: humidityMin ? Number(humidityMin) : null,
        humidityMax: humidityMax ? Number(humidityMax) : null,
        maintenanceFrequency: requestedMaintenanceFrequency,
        requiresCalibration: String(requiresCalibration) === 'true',
        calibrationFrequency,
        assetCategory: currentCategory,
        hvEngineerUserId,
        catalogCreatedBy: req.user.sub
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
      const scheduleSyncResult = scheduleProgrammingPreview?.requiresConfirmation
        ? await applyAssetScheduleProgramming({
            clientId,
            schema: assetClient.schema_name,
            assetId,
            today: todayInBogota(),
            actorUserId: req.user.sub,
            selection: scheduleProgrammingSelection
          })
        : await syncAssetsIntoMaintenanceSchedules({
            clientId,
            schema: assetClient.schema_name,
            assetIds: [assetId],
            today: todayInBogota(),
            actorUserId: req.user.sub,
            replaceFuturePending: assetScheduleConfigurationChanged(beforeAsset, updatedAsset),
            replaceOpenCurrent: assetSchedulePlacementChanged(beforeAsset, updatedAsset)
          });
      const scheduleSync = scheduleSyncResult.assets[0] || null;
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
          },
          scheduleSync
        }
      });
      return res.json({ ok: true, catalogReview: updateResult.catalogReview, scheduleSync });
    } catch (error) {
      if (String(error?.code || '').startsWith('CATALOG_')) {
        return sendCatalogError(res, error, 'No se pudo registrar la propuesta en el catálogo de equipos.');
      }
      if (error?.code === 'INVALID_RISK_CLASSIFICATION') {
        return res.status(400).json({ message: error.message });
      }
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof ScheduleValidationError) {
        const status = error.code === 'SCHEDULE_EDIT_STATE_CHANGED' ? 409 : 400;
        return res.status(status).json({ message: error.message, code: error.code });
      }
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
      const scheduleSyncResult = await syncAssetsIntoMaintenanceSchedules({
        clientId,
        schema: client.schema_name,
        assetIds: [assetId],
        today: todayInBogota(),
        actorUserId: req.user.sub,
        replaceFuturePending: true,
        replaceOpenCurrent: true
      });
      const scheduleSync = scheduleSyncResult.assets[0] || null;
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
          pdfPath: publicPath,
          scheduleSync
        }
      });

      return res.status(201).json({
        ok: true,
        movementId: movement.id,
        pdfPath: publicPath,
        scheduleSync
      });
    } catch (error) {
      if (error instanceof ScheduleValidationError) {
        return res.status(400).json({ message: error.message });
      }
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
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const validDate = (value) => {
      if (!value) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
      return res.status(400).json({ message: 'El rango de fechas de trazabilidad no es válido.' });
    }
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const rows = await listAssetMovements(clientId, assetId, {
        from: from || null,
        to: to || null,
        order: req.query.order,
        limit,
        offset
      });
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo cargar la trazabilidad del equipo.' });
    }
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
    if (isAreaScopedOperationalUser(req.user)) {
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

app.get(
  '/biomed/:clientId/pending-historical-protocols',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const year = Number(req.query.year || todayInBogota().slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'La vigencia indicada no es válida.' });
    }
    try {
      const assetCategory = normalizeAssetCategory(req.query.category);
      const rows = await listPendingHistoricalMaintenanceEvidence(clientId, {
        year,
        assetCategory,
        readerUserId: isAreaScopedOperationalUser(req.user) ? req.user.sub : null
      });
      return res.json(rows);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar los protocolos pendientes.' });
    }
  }
);

app.get(
  '/biomed/:clientId/assets/:assetId/historical-maintenance-occurrences',
  requireAuth,
  requirePermission('asset_history:upload'),
  requireActiveTemporaryPermission('asset_history:upload'),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    let documentDate;
    try {
      documentDate = normalizeDateOnly(String(req.query.documentDate || ''), 'La fecha del documento');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (documentDate > todayInBogota()) {
      return res.status(400).json({ message: 'La fecha del documento no puede estar en el futuro.' });
    }
    const asset = await getAssetById(clientId, assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    try {
      const rows = await listHistoricalMaintenanceOccurrences(clientId, assetId, documentDate);
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron consultar las ocurrencias del cronograma.' });
    }
  }
);

app.post(
  '/biomed/:clientId/assets/:assetId/history-files',
  requireAuth,
  requirePermission('asset_history:upload'),
  requireActiveTemporaryPermission('asset_history:upload'),
  uploadHistoricalPdf,
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
    let documentDate;
    try {
      documentDate = normalizeDateOnly(String(req.body?.documentDate || ''), 'La fecha del documento');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (documentDate > todayInBogota()) {
      return res.status(400).json({ message: 'La fecha del documento no puede estar en el futuro.' });
    }
    const documentType = String(req.body?.documentType || 'other').trim();
    if (!ASSET_HISTORY_DOCUMENT_TYPES.has(documentType)) {
      return res.status(400).json({ message: 'El tipo de documento histórico no es válido.' });
    }
    const maintenanceScheduleItemId = String(req.body?.maintenanceScheduleItemId || '').trim() || null;
    if (maintenanceScheduleItemId && documentType !== 'maintenance_preventive') {
      return res.status(400).json({
        message: 'Solo un mantenimiento preventivo histórico puede conciliarse con el cronograma.'
      });
    }

    let fullPath = '';
    try {
      const asset = await getAssetById(clientId, assetId);
      if (!asset) {
        return res.status(404).json({ message: 'Equipo no encontrado.' });
      }
      if (documentType === 'maintenance_preventive' && !maintenanceScheduleItemId) {
        const occurrences = await listHistoricalMaintenanceOccurrences(clientId, assetId, documentDate);
        if (occurrences.some((occurrence) => occurrence.eligible)) {
          return res.status(400).json({
            message: 'Selecciona la ocurrencia del cronograma que corresponde a este mantenimiento.'
          });
        }
        if (occurrences.some((occurrence) => occurrence.status === 'done')) {
          return res.status(409).json({
            message: 'La ocurrencia de ese mes ya está registrada como realizada.'
          });
        }
        if (occurrences.length) {
          return res.status(409).json({
            message: occurrences[0].unavailable_reason || 'La ocurrencia de ese mes no admite conciliación.'
          });
        }
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
      fullPath = path.join(process.cwd(), filename);
      await fs.promises.writeFile(fullPath, req.file.buffer);
      const publicPath = `/${filename}`.replace(/\\/g, '/');

      const historyFile = await createAssetHistoryFile(clientId, {
        assetId,
        title:
          String(req.body?.title || '').trim() ||
          ASSET_HISTORY_DEFAULT_TITLES[documentType],
        description: String(req.body?.description || '').trim() || null,
        documentDate,
        documentType,
        maintenanceScheduleItemId,
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
          documentType,
          maintenanceScheduleItemId,
          reconciliation: historyFile.reconciliation,
          pdfPath: publicPath
        }
      });

      return res.status(201).json(historyFile);
    } catch (error) {
      if (fullPath && fs.existsSync(fullPath)) {
        await fs.promises.rm(fullPath, { force: true });
      }
      console.error(error);
      if (String(error?.code || '').startsWith('HISTORICAL_') || error?.code === '23505') {
        return res.status(409).json({ message: error.message });
      }
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
    if (isAreaScopedOperationalUser(req.user)) {
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
    const file = await getAssetHistoryFileById(clientId, fileId);
    if (!file) {
      return res.status(404).json({ message: 'PDF histórico no encontrado.' });
    }
    if (await isAssetHistoryFileReconciled(clientId, fileId)) {
      return res.status(409).json({
        message: 'Este PDF acredita una ocurrencia del cronograma y no puede eliminarse.'
      });
    }
    await deleteAssetHistoryFile(clientId, fileId);
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
    if (isAreaScopedOperationalUser(req.user)) {
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
    const deletion = await deleteAsset(clientId, assetId);
    if (!deletion.deleted) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    await logEquipmentAudit(req, {
      action: 'ASSET_DELETE',
      clientId,
      assetId,
      asset,
      description: `Eliminación del equipo ${assetLabel(asset)} y su hoja de vida.`,
      details: {
        eventType: 'hoja_vida_eliminada',
        deletedAsset: assetSnapshot(asset),
        maintenanceScheduleItemsRemoved: deletion.maintenanceScheduleItemsRemoved,
        calibrationScheduleItemsRemoved: deletion.calibrationScheduleItemsRemoved
      }
    });
    return res.json({
      ok: true,
      maintenanceScheduleItemsRemoved: deletion.maintenanceScheduleItemsRemoved,
      calibrationScheduleItemsRemoved: deletion.calibrationScheduleItemsRemoved
    });
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
    if (isAreaScopedOperationalUser(req.user)) {
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
  '/biomed/:clientId/assets/:assetId/full-pdf',
  requireAuth,
  requireAnyPermission(['hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId, assetId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }

    try {
      const client = await getClientById(clientId);
      let asset = await getAssetById(clientId, assetId);
      if (!client || !asset) {
        return res.status(404).json({ message: 'No encontrado.' });
      }
      asset = await backfillHvEngineerFromAudit(clientId, asset);
      const historyItems = [];
      const pageSize = 100;
      for (let offset = 0; ; offset += pageSize) {
        const rows = await listAssetHistory(clientId, assetId, {
          order: 'desc',
          limit: pageSize,
          offset
        });
        historyItems.push(...rows);
        if (rows.length < pageSize) break;
      }
      const pdfBuffer = await buildAssetFullHistoryPdfBuffer({
        client,
        asset,
        historyItems
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${pdfFilename(`hv-completa-${asset.code || asset.id}`)}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo generar la hoja de vida completa.' });
    }
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
    if (isAreaScopedOperationalUser(req.user)) {
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
  requireAnyPermission(['areas:manage', 'hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const sites = isAreaScopedOperationalUser(req.user)
        ? await listSitesForScopedUser(clientId, req.user.sub)
        : await listSites(clientId);
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
  requireAnyPermission(['areas:manage', 'hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const areas = isAreaScopedOperationalUser(req.user)
        ? await listAreasForScopedUser(clientId, req.user.sub)
        : await listAreas(clientId);
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
  requireAnyPermission(['areas:manage', 'hb:create', 'hb:view', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    const { areaId } = req.query;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const locations = isAreaScopedOperationalUser(req.user)
        ? await listLocationsForScopedUser(clientId, req.user.sub, areaId)
        : await listLocations(clientId, areaId);
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
  const { role } = req.body || {};
  if (!role) {
    return res.status(400).json({ message: 'Rol requerido.' });
  }

  try {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;
    if (isSuperuser(req.user)) {
      const targetRoles = target.roles || [];
      if (targetRoles.includes('superuser')) {
        return res.status(403).json({
          message: 'El superuser no se modifica desde Usuarios.'
        });
      }
      if (targetRoles.includes(CLIENT_ADMIN_ROLE) || role === CLIENT_ADMIN_ROLE) {
        return res.status(403).json({
          message: 'Los administradores del cliente se gestionan desde Clientes / cartera.'
        });
      }
      if (!isSuperuserAssignableRole(role)) {
        return res.status(403).json({
          message: 'Desde Usuarios solo se asignan roles SaaS actuales.'
        });
      }
    } else if (isClientAdmin(req.user) && !(await canClientUseRole(req.user.clientId, role))) {
      return res.status(403).json({
        message: 'Este rol no está habilitado para los softwares y módulos de tu cliente.'
      });
    }
    if (role === 'ingeniero_biomedico') {
      const targetUser = await getUserById(req.params.id);
      if (!targetUser?.document_type || !targetUser?.document_number || !targetUser?.invima_registration) {
        return res.status(400).json({
          message: 'Para asignar ingeniero biomédico, primero completa documento e INVIMA del usuario.'
        });
      }
    }
    if (!(await requireActionConfirmation(req, res, 'USER_ROLE_UPDATE'))) return;
    const { before } = await updateUserRole(req.params.id, role);
    if (!AREA_SCOPED_OPERATIONAL_ROLES.includes(role) && target.client_id) {
      await query('DELETE FROM reader_access WHERE user_id = $1 AND client_id = $2', [
        req.params.id,
        target.client_id
      ]);
    }
    await revokeUserActiveSessions(req.params.id);
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
  try {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;
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
    const { rows: duplicateEmailRows } = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [email, req.params.id]
    );
    if (duplicateEmailRows.length) {
      return res.status(400).json({ message: 'Ese correo ya está usado por otro usuario.' });
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
    if (!(await requireActionConfirmation(req, res, 'USER_UPDATE'))) return;
    const resolvedClientId = isSuperuser(req.user)
      ? (target.roles?.includes(CLIENT_ADMIN_ROLE) ? target.client_id : null)
      : req.user.clientId;
    await updateUserProfile(req.params.id, {
      displayName,
      email,
      clientId: resolvedClientId,
      documentType: cleanDocumentType,
      documentNumber: cleanDocumentNumber,
      invimaRegistration: isBiomedicalEngineer ? cleanInvimaRegistration : null
    });
    await revokeUserActiveSessions(req.params.id);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_UPDATE',
      targetUserId: req.params.id,
      details: {
        displayName,
        email,
        clientId: resolvedClientId ?? null,
        documentType: documentType ?? null,
        hasInvimaRegistration: Boolean(invimaRegistration)
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    const duplicateEmail = error?.code === '23505' && error?.constraint === 'users_email_key';
    return res.status(duplicateEmail ? 400 : 500).json({
      message: duplicateEmail
        ? 'Ese correo ya está usado por otro usuario.'
        : 'No se pudo actualizar el usuario.'
    });
  }
});

app.get('/admin/users/:id/reader-access', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const target = await ensureCanManageTargetUser(req, res, req.params.id);
  if (!target) return;
  const clientId = req.query.clientId;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ message: 'clientId requerido.' });
  }
  if (isClientAdmin(req.user) && clientId !== req.user.clientId) {
    return res.status(403).json({ message: 'Sin acceso al cliente.' });
  }
  if (target.client_id !== clientId || !target.roles?.some((role) => AREA_SCOPED_OPERATIONAL_ROLES.includes(role))) {
    return res.status(400).json({ message: 'El usuario no utiliza alcance por áreas o ubicaciones en este cliente.' });
  }
  const rows = await listReaderAccess(req.params.id, clientId);
  return res.json(rows);
});

app.post('/admin/users/:id/reader-access', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const target = await ensureCanManageTargetUser(req, res, req.params.id);
  if (!target) return;
  const { clientId, areaIds, locationIds } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ message: 'clientId requerido.' });
  }
  if (isClientAdmin(req.user) && clientId !== req.user.clientId) {
    return res.status(403).json({ message: 'Sin acceso al cliente.' });
  }
  if (target.client_id !== clientId || !target.roles?.some((role) => AREA_SCOPED_OPERATIONAL_ROLES.includes(role))) {
    return res.status(400).json({ message: 'El usuario no utiliza alcance por áreas o ubicaciones en este cliente.' });
  }
  const safeAreaIds = Array.isArray(areaIds) ? areaIds : [];
  const isAreaResponsible = target.roles.includes(AREA_RESPONSIBLE_ROLE);
  const safeLocationIds = Array.isArray(locationIds) ? locationIds : [];
  if (isAreaResponsible && !safeAreaIds.length && !safeLocationIds.length) {
    return res.status(400).json({ message: 'El responsable debe tener al menos un área o ubicación asignada.' });
  }
  try {
    await replaceReaderAccess(req.params.id, clientId, safeAreaIds, safeLocationIds);
  } catch (error) {
    if (String(error?.code || '').startsWith('INVALID_AREA_SCOPE')) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'No se pudo actualizar el alcance por áreas o ubicaciones.' });
  }
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'AREA_SCOPE_UPDATE',
    targetUserId: req.params.id,
    details: {
      clientId,
      role: target.roles[0] || null,
      areaIds: safeAreaIds,
      locationIds: safeLocationIds
    }
  });
  return res.json({ ok: true });
});

app.post(
  '/admin/users/:id/signature',
  requireAuth,
  requirePermission('users:manage'),
  upload.single('signature'),
  async (req, res) => {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;
    if (!req.file) {
      return res.status(400).json({ message: 'Firma requerida.' });
    }
    if (!isAllowedSignatureFile(req.file)) {
      return res.status(400).json({
        message: 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.'
      });
    }
    if (!isAllowedSignatureSize(req.file)) {
      return res.status(413).json({ message: signatureSizeMessage() });
    }
    try {
      const signaturePath = await saveUserSignature(req.params.id, req.file);
      await updateUserSignature(req.params.id, signaturePath);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'USER_SIGNATURE_UPDATE',
        targetUserId: req.params.id,
        targetUsername: target.username,
        details: { clientId: target.client_id ?? null, signaturePath }
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
  const target = await ensureCanManageTargetUser(req, res, req.params.id);
  if (!target) return;
  if (!(await requireActionConfirmation(req, res, 'USER_DELETE'))) return;
  await deleteUser(req.params.id);
  await logAudit({
    actorUserId: req.user.sub,
    actorUsername: req.user.username,
    action: 'USER_DELETE',
    targetUserId: req.params.id,
    targetUsername: target.username,
    details: { clientId: target.client_id ?? null }
  });
  return res.json({ ok: true });
});

app.patch(
  '/admin/users/:id/active',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Estado inválido.' });
    }
    if (!(await requireActionConfirmation(req, res, 'USER_ACTIVE_UPDATE'))) return;

    const { before } = await updateUserActive(req.params.id, isActive);
    await revokeUserActiveSessions(req.params.id);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_ACTIVE_UPDATE',
      targetUserId: req.params.id,
      targetUsername: before?.username,
      details: { clientId: target.client_id ?? null, isActive }
    });
    return res.json({ ok: true });
  }
);

app.patch(
  '/admin/users/:id/password',
  requireAuth,
  requirePermission('users:manage'),
  async (req, res) => {
    const target = await ensureCanManageTargetUser(req, res, req.params.id);
    if (!target) return;
    if (!target.email) {
      return res.status(400).json({ message: 'El usuario no tiene correo registrado.' });
    }
    if (!(await requireActionConfirmation(req, res, 'USER_PASSWORD_RESET'))) return;

    const client = target.client_id ? await getClientById(target.client_id) : null;
    const emailSent = await requestPasswordSetup(String(target.email).trim(), {
      clientName: client?.name
    });
    if (!emailSent) {
      return res.status(400).json({ message: 'No se pudo enviar el correo. Verifica que el usuario esté activo.' });
    }

    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'USER_PASSWORD_RESET',
      targetUserId: req.params.id,
      targetUsername: target.username,
      details: {
        clientId: target.client_id ?? null,
        deliveryEmail: target.email
      }
    });
    return res.json({ ok: true, email_sent: true });
  }
);

app.get('/admin/audit', requireAuth, requireAnyPermission(['users:manage', 'audit:client:view', 'saas:audit:view']), async (req, res) => {
  const canViewPlatformAudit = isSuperuser(req.user)
    || (!req.user.clientId && (
      req.user.permissions?.includes('saas:audit:view')
      || req.user.permissions?.includes('users:manage')
    ));
  const canViewOwnClientAudit = Boolean(
    req.user.clientId
    && req.user.permissions?.includes('audit:client:view')
  );
  if (!canViewPlatformAudit) {
    if (!canViewOwnClientAudit) {
      return res.status(403).json({ message: 'Sin acceso a auditoría.' });
    }
    const logs = await listAuditLogs(500, {
      clientId: req.user.clientId,
      actorClientId: req.user.clientId
    });
    return res.json(logs);
  }
  const logs = await listAuditLogs(500, {
    adminOnly: true
  });
  return res.json(logs);
});

app.get(
  '/maintenance/preventive-progress/:clientId',
  requireAuth,
  requireAnyPermissionOrRole(
    ['maintenance:report:create', 'maintenance:report:sign', 'read:all'],
    MAINTENANCE_REPORT_ACCESS_ROLES
  ),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Año inválido.' });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Mes inválido.' });
    }

    try {
      const assetCategory = normalizeAssetCategory(req.query.category);
      await syncDueScheduleRequests(clientId, req.user.sub);
      const progress = await getPreventiveMaintenanceProgress(clientId, {
        year,
        month,
        assetCategory,
        scopedUserId: isAreaScopedOperationalUser(req.user) ? req.user.sub : null
      });
      return res.json(progress);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo calcular el avance preventivo.' });
    }
  }
);

app.post(
  '/maintenance/preventive-progress/:clientId/late-execution',
  requireAuth,
  requirePermission(LATE_MAINTENANCE_EXECUTION_PERMISSION),
  requireActiveTemporaryPermission(LATE_MAINTENANCE_EXECUTION_PERMISSION),
  async (req, res) => {
    const { clientId } = req.params;
    if (
      !req.user.clientId
      || req.user.clientId !== clientId
      || !req.user.roles?.includes('ingeniero_biomedico')
    ) {
      return res.status(403).json({
        message: 'Solo el ingeniero biomédico del cliente puede abrir este periodo.'
      });
    }
    try {
      const normalized = normalizeLateMaintenanceOpening(req.body, todayInBogota());
      const result = await openLateMaintenancePeriod({
        clientId,
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        actorDisplayName: req.user.displayName ?? req.user.username,
        actorRoles: req.user.roles ?? [],
        temporaryPermissionId: req.temporaryPermission.id,
        permissionExpiresAt: req.temporaryPermission.expiresAt,
        permissionGrantedBy: req.temporaryPermission.grantedBy,
        permissionReason: req.temporaryPermission.reason,
        ...normalized
      });
      return res.json({
        ok: true,
        ...result,
        message: `${result.opened} preventivo(s) de ${result.period} quedaron habilitados temporalmente sin cambiar sus fechas programadas.`
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (
        /no es válid|mes inmediatamente anterior|justificación|permiso temporal/i.test(
          String(error?.message || '')
        )
      ) {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({
        message: 'No se pudo abrir excepcionalmente el periodo de mantenimiento.'
      });
    }
  }
);

app.post(
  '/maintenance/preventive-progress/:clientId/items/:itemId/warranty',
  requireAuth,
  requirePermission('maintenance:report:create'),
  async (req, res) => {
    const { clientId, itemId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['covered', 'perform'].includes(decision)) {
      return res.status(400).json({ message: 'La decisión de garantía no es válida.' });
    }

    const client = await getClientById(clientId);
    if (!client?.schema_name) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const today = todayInBogota();

    try {
      const result = await withTransaction(async (dbClient) => {
        const { rows } = await dbClient.query(
          `SELECT item.id,
                  item.schedule_id,
                  item.asset_id,
                  item.planned_date,
                  item.deadline_date,
                  item.status,
                  item.report_id,
                  item.completion_source,
                  item.legacy_history_file_id,
                  item.warranty_resolution,
                  schedule.status AS schedule_status,
                  asset.code AS asset_code,
                  asset.name AS asset_name,
                  asset.acquisition_date,
                  asset.warranty_years,
                  CASE
                    WHEN asset.acquisition_date IS NOT NULL AND asset.warranty_years IS NOT NULL
                      THEN (
                        asset.acquisition_date + make_interval(years => asset.warranty_years)
                      )::date
                    ELSE NULL
                  END AS warranty_release_date,
                  (
                    asset.warranty_years IS NOT NULL
                    AND (
                      asset.acquisition_date IS NULL
                      OR item.planned_date < (
                        asset.acquisition_date + make_interval(years => asset.warranty_years)
                      )::date
                    )
                  ) AS is_under_warranty,
                  item.planned_date <= $3::date AS window_started,
                  item.deadline_date < $3::date AS window_elapsed
           FROM maintenance_schedule_items item
           JOIN maintenance_schedules schedule ON schedule.id = item.schedule_id
           JOIN "${client.schema_name}".assets asset ON asset.id = item.asset_id
           WHERE item.id = $1
             AND schedule.client_id = $2
           FOR UPDATE OF item`,
          [itemId, clientId, today]
        );
        const item = rows[0];
        if (!item) {
          const error = new Error('Actividad preventiva no encontrada.');
          error.statusCode = 404;
          throw error;
        }
        if (item.schedule_status !== 'approved') {
          const error = new Error('La decisión solo está disponible en cronogramas aprobados.');
          error.statusCode = 409;
          throw error;
        }
        if (!item.is_under_warranty && item.warranty_resolution !== 'covered') {
          const error = new Error('Esta ventana ya no corresponde al periodo de garantía.');
          error.statusCode = 409;
          throw error;
        }

        const { rows: requestRows } = await dbClient.query(
          `SELECT request.id, request.status,
                  EXISTS (
                    SELECT 1 FROM maintenance_reports report WHERE report.request_id = request.id
                  ) AS has_report
           FROM maintenance_requests request
           WHERE request.schedule_item_id = $1
             AND request.type = 'preventivo'
           ORDER BY request.created_at DESC
           LIMIT 1`,
          [item.id]
        );
        const request = requestRows[0] || null;
        const operationalRequestStatuses = [
          'en_proceso',
          'espera_repuesto',
          'reportado',
          'firmado',
          'correccion'
        ];
        const hasOperationalEvidence = Boolean(
          item.report_id
          || item.completion_source
          || item.legacy_history_file_id
          || request?.has_report
          || operationalRequestStatuses.includes(request?.status)
        );
        if (hasOperationalEvidence) {
          const error = new Error(
            'La actividad ya tiene operación o evidencia registrada y no puede cambiarse a garantía.'
          );
          error.statusCode = 409;
          throw error;
        }
        if (decision === 'perform' && item.window_elapsed) {
          const error = new Error(
            'La ventana ya finalizó. Regístrala como garantía; no es válido crear ahora un protocolo operativo retroactivo.'
          );
          error.statusCode = 409;
          throw error;
        }

        const nextStatus = decision === 'covered'
          ? 'warranty'
          : item.window_started
            ? 'active'
            : 'pending';
        await dbClient.query(
          `UPDATE maintenance_schedule_items
           SET status = $2,
               warranty_resolution = $3,
               warranty_resolved_at = NOW(),
               warranty_resolved_by = $4
           WHERE id = $1`,
          [item.id, nextStatus, decision, req.user.sub]
        );

        if (request) {
          const requestStatus = decision === 'covered'
            ? 'garantia'
            : item.window_started
              ? 'abierto'
              : 'garantia';
          await dbClient.query(
            `UPDATE maintenance_requests
             SET status = $2,
                 assigned_to = CASE WHEN $2 = 'abierto' THEN NULL ELSE assigned_to END,
                 updated_at = NOW()
             WHERE id = $1`,
            [request.id, requestStatus]
          );
        }
        await dbClient.query(
          'UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = $1',
          [item.schedule_id]
        );

        return {
          itemId: item.id,
          scheduleId: item.schedule_id,
          assetId: item.asset_id,
          assetCode: item.asset_code,
          assetName: item.asset_name,
          decision,
          warrantyReleaseDate: item.warranty_release_date
        };
      });

      await syncDueScheduleRequests(clientId, req.user.sub);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: decision === 'covered'
          ? 'MAINTENANCE_WARRANTY_COVERAGE_REGISTERED'
          : 'MAINTENANCE_WARRANTY_PROTOCOL_AUTHORIZED',
        details: {
          clientId,
          scheduleId: result.scheduleId,
          scheduleItemId: result.itemId,
          assetId: result.assetId,
          assetCode: result.assetCode,
          assetName: result.assetName,
          warrantyReleaseDate: result.warrantyReleaseDate,
          decision
        }
      });
      return res.json({
        ok: true,
        decision,
        message: decision === 'covered'
          ? 'La ventana quedó registrada en garantía y no genera pendiente ni vencimiento.'
          : 'El protocolo normal quedó habilitado para esta ventana.'
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudo actualizar la decisión de garantía.' });
    }
  }
);

app.get(
  '/maintenance/requests/:clientId',
  requireAuth,
  requireAnyPermission(['maintenance:request:create', 'maintenance:report:create', 'read:all']),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const assetCategory = normalizeAssetCategory(req.query.category);
      await syncDueScheduleRequests(clientId, req.user.sub);
      await sendPreventiveReminders(clientId);
      const rows = isAreaScopedOperationalUser(req.user)
        ? await listMaintenanceRequestsForReader(clientId, req.user.sub, { assetCategory })
        : await listMaintenanceRequests(clientId, { assetCategory });
      return res.json(rows);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar las solicitudes de mantenimiento.' });
    }
  }
);

app.post(
  '/maintenance/requests',
  requireAuth,
  requirePermission('maintenance:request:create'),
  async (req, res) => {
    const {
      assetId,
      assetCategory: requestedCategory,
      type,
      description,
      clientId: bodyClientId
    } = req.body || {};
    const clientId = req.user.clientId ?? bodyClientId;
    if (!clientId || !assetId || !type) {
      return res.status(400).json({ message: 'Datos incompletos.' });
    }
    if (!['preventivo', 'correctivo'].includes(type)) {
      return res.status(400).json({ message: 'Tipo inválido.' });
    }
    const cleanDescription = normalizeMaintenanceRequestDescription(description);
    const descriptionError = maintenanceRequestDescriptionError(type, cleanDescription);
    if (descriptionError) {
      return res.status(400).json({ message: descriptionError });
    }
    if (type === 'preventivo' && (isAreaScopedOperationalUser(req.user) || req.user.roles?.includes('almacenista'))) {
      return res.status(403).json({ message: 'No puedes solicitar mantenimiento preventivo.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
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
    if (type === 'preventivo' && requestedAsset.warranty_years) {
      let warrantyReleaseDate;
      try {
        warrantyReleaseDate = assetWarrantyReleaseDate({
          acquisitionDate: requestedAsset.acquisition_date,
          warrantyYears: requestedAsset.warranty_years
        });
      } catch {
        return res.status(409).json({
          message: 'El equipo registra garantía, pero no tiene una fecha de adquisición válida. Corrige la hoja de vida antes de crear el preventivo.'
        });
      }
      if (warrantyReleaseDate && todayInBogota() < warrantyReleaseDate) {
        return res.status(409).json({
          message: `El equipo está en garantía hasta ${warrantyReleaseDate}. Usa la fase En garantía del cronograma para registrar la cobertura o habilitar excepcionalmente el protocolo.`
        });
      }
    }
    let assetCategory;
    try {
      assetCategory = normalizeAssetCategory(requestedCategory);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (normalizeAssetCategory(requestedAsset.asset_category) !== assetCategory) {
      return res.status(400).json({
        message: 'El equipo no pertenece a la categoría de mantenimiento seleccionada.'
      });
    }

    const result = await createMaintenanceRequest({
      clientId,
      assetId,
      type,
      description: cleanDescription,
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
        assetCategory,
        maintenanceType: type,
        requestDescription: cleanDescription || null
      }
    });

    const engineers = await listUsersByRoleAndClient('ingeniero_biomedico', clientId);
    for (const engineer of engineers) {
      const title = 'Nueva solicitud de mantenimiento';
      const message = `Se creó una solicitud ${type} para ${assetLabel(requestedAsset)}.${cleanDescription ? ` Descripción: ${cleanDescription}` : ''}`;
      await createNotification({
        userId: engineer.id,
        clientId,
        title,
        message,
        link: maintenanceRouteForAsset(requestedAsset),
        type: 'maintenance_request_created',
        priority: 'high',
        data: {
          requestId: result.id,
          assetId,
          maintenanceType: type
        }
      });
      if (type === 'correctivo' && engineer.email) {
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
    if (
      request.type === 'preventivo'
      && request.source === 'cronograma'
      && request.deadline_date
      && String(request.deadline_date).slice(0, 10) < todayInBogota()
      && !request.late_execution_authorization_active
    ) {
      await updateMaintenanceRequestStatus(request.id, 'vencido');
      return res.status(409).json({
        message: 'La ventana del preventivo ya cerró. Solicita una apertura excepcional temporal.'
      });
    }
    const assignment = await assignMaintenanceRequest(requestId, assignedTo, {
      allowedStatuses: MAINTENANCE_REQUEST_CLAIMABLE_STATUSES,
      force: isSuperuser(req.user)
    });
    if (!assignment) {
      const current = await getMaintenanceRequestById(requestId);
      if (!current || !MAINTENANCE_REQUEST_CLAIMABLE_STATUSES.includes(current.status)) {
        return res.status(409).json({ message: 'Esta solicitud ya no está disponible para ser tomada.' });
      }
      return res.status(409).json({
        message: current.assigned_name
          ? `La solicitud ya fue tomada por ${current.assigned_name}.`
          : 'La solicitud fue tomada por otro ingeniero.'
      });
    }
    return res.json({ ok: true, assignment });
  }
);

app.post(
  '/maintenance/protocols/blank-pdf',
  requireAuth,
  requirePermission(BLANK_MAINTENANCE_PROTOCOL_PERMISSION),
  requireActiveTemporaryPermission(BLANK_MAINTENANCE_PROTOCOL_PERMISSION),
  async (req, res) => {
    const clientId = req.user.clientId;
    if (!clientId || !req.user.roles?.includes('ingeniero_biomedico')) {
      return res.status(403).json({
        message: 'Solo un ingeniero biomédico asignado al cliente puede generar estos protocolos.'
      });
    }

    const normalized = normalizeBlankMaintenanceProtocolRequest(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }
    const { scope, reason, assetIds } = normalized.value;
    let assetCategory;
    try {
      assetCategory = normalizeAssetCategory(req.body?.assetCategory);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const engineer = await getUserById(req.user.sub);
      if (!engineer || engineer.client_id !== clientId || !engineer.roles?.includes('ingeniero_biomedico')) {
        return res.status(403).json({
          message: 'No se pudo validar al ingeniero biomédico que genera los protocolos.'
        });
      }
      if (!engineer.signature_path) {
        return res.status(409).json({
          message: 'Debes tener una firma digital configurada antes de generar protocolos físicos. Solicita al administrador actualizar tu firma.'
        });
      }
      const engineerSignaturePath = path.join(
        process.cwd(),
        String(engineer.signature_path).replace(/^\//, '')
      );
      if (!fs.existsSync(engineerSignaturePath)) {
        return res.status(409).json({
          message: 'Tu firma digital registrada no está disponible. Solicita al administrador volver a cargarla.'
        });
      }

      const assets = await listAssetsForBlankMaintenanceProtocols(clientId, {
        assetIds: scope === 'selected' ? assetIds : null,
        assetCategory,
        limit: MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH + 1
      });
      if (assets.length > MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH) {
        return res.status(413).json({
          message: `El cliente supera el máximo de ${MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH} equipos por lote. Genera varios lotes seleccionados.`
        });
      }
      if (scope === 'selected' && assets.length !== assetIds.length) {
        return res.status(400).json({
          message: 'Uno o más equipos seleccionados no pertenecen al cliente, no existen o están dados de baja.'
        });
      }
      if (!assets.length) {
        return res.status(404).json({ message: 'No hay equipos vigentes para generar protocolos.' });
      }

      const client = await getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }

      const batchCode = createBlankMaintenanceProtocolBatchCode();
      const pdfBuffer = await buildBlankMaintenanceProtocolBatchPdf({
        client,
        assets,
        engineer,
        batchCode
      });
      const batch = await createMaintenanceProtocolPrintBatch({
        batchCode,
        clientId,
        generatedBy: req.user.sub,
        temporaryPermissionId: req.temporaryPermission.id,
        permissionExpiresAt: req.temporaryPermission.expiresAt,
        selectionScope: scope,
        assetIds: assets.map((asset) => asset.id),
        reason
      });

      try {
        await logAudit({
          actorUserId: req.user.sub,
          actorUsername: req.user.username,
          action: 'MAINTENANCE_BLANK_PROTOCOL_PRINT',
          targetUserId: clientId,
          targetUsername: client.name,
          details: {
            category: 'equipment',
            description: `Generación de ${assets.length} protocolo(s) físico(s) de mantenimiento en blanco.`,
            actorDisplayName: req.user.displayName ?? req.user.username,
            actorUsername: req.user.username,
            actorRoles: req.user.roles ?? [],
            clientId,
            clientName: client.name,
            batchId: batch.id,
            batchCode,
            assetCount: assets.length,
            selectionScope: scope,
            reason,
            assetCategory,
            engineerSignatureApplied: true,
            temporaryPermissionExpiresAt: req.temporaryPermission.expiresAt
          }
        });
      } catch (auditError) {
        console.error('No se pudo registrar la auditoría del lote de protocolos', auditError);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${pdfFilename(`protocolos-mantenimiento-${batchCode}`)}.pdf"`
      );
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Protocol-Batch-Code', batchCode);
      res.setHeader('X-Protocol-Asset-Count', String(assets.length));
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Protocol-Batch-Code, X-Protocol-Asset-Count'
      );
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('No se pudieron generar los protocolos físicos', error);
      return res.status(500).json({ message: 'No se pudieron generar los protocolos físicos.' });
    }
  }
);

app.get(
  '/maintenance/reports/:clientId',
  requireAuth,
  requireAnyPermissionOrRole(
    ['maintenance:report:create', 'maintenance:report:sign', 'read:all'],
    MAINTENANCE_REPORT_ACCESS_ROLES
  ),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { assetId, from, to, order, limit, offset } = req.query;
    let assetCategory;
    try {
      assetCategory = normalizeAssetCategory(req.query.category);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const parsedLimit = limit ? Math.min(Number(limit) || 0, 100) : undefined;
    const parsedOffset = offset ? Math.max(Number(offset) || 0, 0) : undefined;
    if (isAreaScopedOperationalUser(req.user) && assetId) {
      const allowed = await readerCanAccessAsset(clientId, req.user.sub, assetId);
      if (!allowed) {
        return res.json([]);
      }
    }
    const rows = isAreaScopedOperationalUser(req.user)
      ? await listMaintenanceReportsForReader(clientId, req.user.sub, {
          assetId,
          assetCategory,
          from,
          to,
          order,
          limit: parsedLimit,
          offset: parsedOffset
        })
      : await listMaintenanceReports(clientId, {
          assetId,
          assetCategory,
          from,
          to,
          order,
          limit: parsedLimit,
          offset: parsedOffset
        });
    const signatures = await listReportSignaturesByReports(rows.map((r) => r.id));
    const byReport = new Map();
    for (const sig of signatures) {
      if (!byReport.has(sig.report_id)) byReport.set(sig.report_id, []);
      byReport.get(sig.report_id).push(sig);
    }
    const enriched = rows.map((report) => {
      const sigs = byReport.get(report.id) || [];
      const signedByMe = sigs.some((sig) => sig.user_id === req.user.sub);
      const isFullySigned = isMaintenanceReportFullySigned(report, sigs);
      const canReopenByMe = hasRole(req.user, 'ingeniero_biomedico')
        && req.user.permissions?.includes('maintenance:report:create')
        && !maintenanceReportEngineerReopenError(
          { ...report, is_fully_signed: isFullySigned },
          sigs,
          req.user.sub
        );
      return {
        ...report,
        signed_by_me: signedByMe,
        is_fully_signed: isFullySigned,
        can_reopen_by_me: canReopenByMe
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
      maintenanceChecks,
      maintenanceActivities,
      maintenanceTests,
      assetStatusAfter,
      assetStatusObservations,
      assetLifecycleAction,
      requiresSpareParts,
      sparePartsNeeded,
      sparePartsInstalledNow
    } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ message: 'Solicitud requerida.' });
    }
    const cleanAssetStatus = MAINTENANCE_ASSET_STATUSES.includes(assetStatusAfter)
      ? assetStatusAfter
      : 'operativo';
    const cleanLifecycleAction = assetLifecycleAction === 'retire' ? 'retire' : null;
    const cleanMaintenanceChecks = sanitizeList(maintenanceChecks, MAINTENANCE_CHECK_OPTIONS);
    const cleanMaintenanceActivities = sanitizeList(maintenanceActivities, MAINTENANCE_ACTIVITY_OPTIONS);
    const cleanMaintenanceTests = sanitizeList(maintenanceTests, MAINTENANCE_TEST_OPTIONS);
    let cleanRequiresSpareParts = Boolean(requiresSpareParts);
    let cleanSparePartsStatus = 'no_aplica';
    const cleanSummary = String(summary || '').trim();
    const cleanFindings = String(findings || '').trim();
    const cleanActionsTaken = String(actionsTaken || '').trim();
    const cleanAssetStatusObservations = cleanAssetStatus === 'operativo'
      ? ''
      : String(assetStatusObservations || '').replace(/\s+/g, ' ').trim();
    let cleanSparePartsNeeded = String(sparePartsNeeded || '').trim();
    const request = await getMaintenanceRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    if (req.user.clientId && req.user.clientId !== request.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (['reportado', 'firmado', 'vencido'].includes(request.status)) {
      return res.status(409).json({ message: 'Esta solicitud ya tiene reporte o no está disponible.' });
    }
    if (!MAINTENANCE_REQUEST_REPORTABLE_STATUSES.includes(request.status)) {
      return res.status(409).json({ message: 'Esta solicitud no está disponible para crear un reporte.' });
    }
    const platformSuperuser = isSuperuser(req.user);
    if (!canOperateAssignedMaintenanceRequest(request, req.user.sub, platformSuperuser)) {
      return res.status(409).json({
        message: request.assigned_name
          ? `La solicitud está asignada a ${request.assigned_name}.`
          : 'La solicitud está asignada a otro ingeniero.'
      });
    }
    if (!platformSuperuser) {
      const ownership = await assignMaintenanceRequest(requestId, req.user.sub, {
        allowedStatuses: MAINTENANCE_REQUEST_REPORTABLE_STATUSES
      });
      if (!ownership) {
        const current = await getMaintenanceRequestById(requestId);
        return res.status(409).json({
          message: current?.assigned_name
            ? `La solicitud fue tomada por ${current.assigned_name}. Actualiza el listado.`
            : 'La solicitud cambió de estado. Actualiza el listado antes de continuar.'
        });
      }
      request.assigned_to = ownership.assigned_to;
      request.status = ownership.status;
    }
    const correctionReport = request.status === 'correccion'
      ? await getMaintenanceReportWithOpenCorrectionByRequest(requestId)
      : null;
    if (correctionReport && !platformSuperuser && correctionReport.created_by !== req.user.sub) {
      return res.status(409).json({
        message: 'Solo el ingeniero que elaboró el reporte puede atender esta corrección.'
      });
    }
    const spareWorkflow = maintenanceSpareWorkflowForReport({
      requestStatus: request.status,
      requiresSpareParts: cleanRequiresSpareParts,
      lifecycleAction: cleanLifecycleAction,
      correctionSpareStatus: correctionReport?.spare_parts_status,
      installedDuringService: Boolean(sparePartsInstalledNow)
    });
    cleanRequiresSpareParts = spareWorkflow.requiresSpareParts;
    cleanSparePartsStatus = spareWorkflow.sparePartsStatus;
    if (request.status === 'espera_repuesto' && cleanLifecycleAction !== 'retire') {
      const waitingSpareReport = await getLatestWaitingSpareReportByRequest(requestId);
      cleanSparePartsNeeded = cleanSparePartsNeeded || waitingSpareReport?.spare_parts_needed || 'Repuesto instalado';
    }
    if (cleanRequiresSpareParts && !cleanSparePartsNeeded) {
      return res.status(400).json({ message: 'Describe el repuesto requerido.' });
    }
    if (
      cleanRequiresSpareParts
      && cleanSparePartsStatus === 'recibido'
      && !cleanMaintenanceActivities.includes('instalacion_repuesto')
    ) {
      return res.status(400).json({
        message: 'Para registrar un repuesto instalado debes incluir la actividad de instalación o reemplazo.'
      });
    }
    const assetStatusObservationError = maintenanceAssetStatusObservationError(
      cleanAssetStatus,
      cleanAssetStatusObservations
    );
    if (assetStatusObservationError) {
      return res.status(400).json({ message: assetStatusObservationError });
    }
    const requestStatusAfter = cleanRequiresSpareParts && cleanSparePartsStatus !== 'recibido'
      ? 'espera_repuesto'
      : 'reportado';
    if (!cleanSummary || !cleanFindings || !cleanActionsTaken) {
      return res.status(400).json({ message: 'Completa resumen, hallazgos y acciones realizadas.' });
    }
    if (!cleanMaintenanceChecks.length) {
      return res.status(400).json({ message: 'Selecciona al menos una revisión realizada.' });
    }
    if (!cleanMaintenanceActivities.length) {
      return res.status(400).json({ message: 'Selecciona al menos una actividad técnica realizada.' });
    }
    if (cleanAssetStatus !== 'fuera_de_servicio' && !cleanMaintenanceTests.length) {
      return res.status(400).json({ message: 'Selecciona al menos una prueba o verificación realizada.' });
    }
    const approvalAsset = await getAssetById(request.client_id, request.asset_id);
    if (!approvalAsset) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    const signingPlan = await buildMaintenanceReportSigningPlan(
      request.client_id,
      approvalAsset,
      request
    );
    const reportType = correctionReport?.type
      || (request.status === 'espera_repuesto' ? 'correctivo' : request.type);
    const reportPayload = {
      clientId: request.client_id,
      requestId,
      assetId: request.asset_id,
      type: reportType,
      summary: cleanSummary,
      findings: cleanFindings,
      actionsTaken: cleanActionsTaken,
      maintenanceChecks: cleanMaintenanceChecks,
      maintenanceActivities: cleanMaintenanceActivities,
      maintenanceTests: cleanMaintenanceTests,
      assetStatusAfter: cleanAssetStatus,
      assetStatusObservations: cleanAssetStatusObservations,
      areaResponsibleRequired: signingPlan.areaResponsibleRequired,
      requiresSpareParts: cleanRequiresSpareParts,
      sparePartsNeeded: cleanRequiresSpareParts ? cleanSparePartsNeeded : null,
      sparePartsStatus: cleanSparePartsStatus,
      requestStatusAfter,
      createdBy: req.user.sub
    };
    const result = correctionReport
      ? await updateMaintenanceReport(correctionReport.id, reportPayload)
      : await createMaintenanceReport(reportPayload);

    if (correctionReport) {
      await deleteReportSignatures(result.id);
      await resolveMaintenanceReportCorrections(result.id);
    }

    const assetStatusToPersist = cleanLifecycleAction === 'retire' ? 'dado_de_baja' : cleanAssetStatus;
    await updateAssetStatus(request.client_id, request.asset_id, assetStatusToPersist);

    const reportAsset = await getAssetById(request.client_id, request.asset_id);
    await logEquipmentAudit(req, {
      action: correctionReport ? 'MAINTENANCE_REPORT_CORRECTED' : 'MAINTENANCE_REPORT_CREATE',
      clientId: request.client_id,
      assetId: request.asset_id,
      asset: reportAsset,
      description: correctionReport
        ? `Reporte de mantenimiento ${reportType} corregido para ${assetLabel(reportAsset)}.`
        : `Reporte de mantenimiento ${reportType} creado para ${assetLabel(reportAsset)}.`,
      details: {
        eventType: correctionReport ? 'reporte_mantenimiento_corregido' : 'reporte_mantenimiento_creado',
        reportId: result.id,
        requestId,
        maintenanceType: reportType,
        requestType: request.type,
        summary: cleanSummary,
        findings: cleanFindings,
        actionsTaken: cleanActionsTaken,
        maintenanceChecks: cleanMaintenanceChecks,
        maintenanceActivities: cleanMaintenanceActivities,
        maintenanceTests: cleanMaintenanceTests,
        assetStatusAfter: cleanAssetStatus,
        assetStatusObservations: cleanAssetStatusObservations || null,
        areaResponsibleRequired: signingPlan.areaResponsibleRequired,
        assetLifecycleAction: cleanLifecycleAction,
        assetStatusPersisted: assetStatusToPersist,
        requiresSpareParts: cleanRequiresSpareParts,
        sparePartsNeeded: cleanRequiresSpareParts ? cleanSparePartsNeeded : null,
        sparePartsStatus: cleanSparePartsStatus,
        sparePartsInstalledDuringService: Boolean(
          sparePartsInstalledNow && request.status !== 'espera_repuesto'
        )
      }
    });

    const engineer = await getUserById(req.user.sub);
    if (engineer?.signature_path && resolveStoredFilePath(engineer.signature_path)) {
      await signMaintenanceReportWithSnapshot({
        reportId: result.id,
        clientId: request.client_id,
        user: engineer,
        role: req.user.roles?.includes('ingeniero_biomedico')
          ? 'ingeniero_biomedico'
          : (req.user.roles?.[0] ?? 'ingeniero_biomedico')
      });
    }

    await writeMaintenanceReportPdfFile(result.id);

    if (shouldCompletePreventiveScheduleItem({
      requestType: request.type,
      reportType
    })) {
      if (request.schedule_id && request.schedule_item_id) {
        await markScheduleItemDone(request.schedule_id, request.schedule_item_id, result.id);
        await setScheduleClosedIfDone(request.schedule_id);
      } else {
        const year = new Date().getFullYear();
        const schedules = await listSchedules(
          request.client_id,
          year,
          reportAsset?.asset_category || 'biomedical'
        );
        if (schedules.length) {
          const schedule = schedules[0];
          const item = await findScheduleItemForAsset(schedule.id, request.asset_id, new Date());
          if (item) {
            await markScheduleItemDone(schedule.id, item.id, result.id);
            await setScheduleClosedIfDone(schedule.id);
          }
        }
      }
    }

    for (const signer of signingPlan.users) {
      const title = reportType === 'preventivo'
        ? (signingPlan.areaResponsibleRequired
          ? 'Mantenimiento preventivo pendiente de aval'
          : 'Reporte preventivo pendiente de firma')
        : (signingPlan.areaResponsibleRequired
          ? 'Mantenimiento correctivo pendiente de aval'
          : 'Reporte correctivo pendiente de firma');
      const message = requestStatusAfter === 'espera_repuesto'
        ? `Se generó el reporte ${reportType} de ${assetLabel(reportAsset)} y requiere ${signingPlan.areaResponsibleRequired ? 'tu aval como responsable del área' : 'firma'} para finalizar el protocolo. El caso de repuesto continuará abierto en paralelo: ${cleanSparePartsNeeded}.`
        : `Se generó el reporte ${reportType} de ${assetLabel(reportAsset)}. Debe recibir ${signingPlan.areaResponsibleRequired ? 'el aval del responsable del área' : 'la firma de aceptación'} para quedar validado.`;
      await createNotification({
        userId: signer.id,
        clientId: request.client_id,
        title,
        message,
        link: maintenanceRouteForAsset(reportAsset),
        type: 'maintenance_report_ready',
        priority: 'high',
        data: {
          reportId: result.id,
          requestId,
          assetId: request.asset_id,
          maintenanceType: reportType
        }
      });
      if (signer.email) {
        try {
          await sendNotificationEmail({
            to: signer.email,
            subject: title,
            text: message
          });
        } catch (error) {
          console.error('Email notificación falló', error);
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
          link: maintenanceRouteForAsset(reportAsset),
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
    }

    return res.status(201).json(result);
  }
);

app.post(
  '/maintenance/reports/:id/reopen',
  requireAuth,
  requirePermission('maintenance:report:create'),
  async (req, res) => {
    const reason = String(req.body?.reason || '').replace(/\s+/g, ' ').trim();
    if (reason.length < 10) {
      return res.status(400).json({ message: 'Describe el motivo de la corrección con al menos 10 caracteres.' });
    }
    if (reason.length > 600) {
      return res.status(400).json({ message: 'El motivo de corrección admite máximo 600 caracteres.' });
    }
    if (!hasRole(req.user, 'ingeniero_biomedico')) {
      return res.status(403).json({ message: 'Solo el ingeniero biomédico autor puede reabrir este protocolo.' });
    }

    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }

    const result = await reopenMaintenanceReportForEngineer({
      reportId: report.id,
      userId: req.user.sub,
      reason
    });
    if (result.error) {
      const errors = {
        not_found: [404, 'Reporte no encontrado.'],
        not_preventive: [409, 'Solo se pueden reabrir protocolos preventivos desde este flujo.'],
        not_owner: [403, 'Solo el ingeniero que elaboró el protocolo puede corregirlo antes de la firma.'],
        already_in_correction: [409, 'Este protocolo ya se encuentra en corrección.'],
        accepted_signature_exists: [409, 'El protocolo ya recibió una firma o aval de otra persona y no puede reabrirse.'],
        already_finalized: [409, 'El protocolo ya fue firmado y finalizado.'],
        not_pending_signature: [409, 'El protocolo ya no se encuentra pendiente de firma.']
      };
      const [status, message] = errors[result.error] || [409, 'El protocolo no se puede reabrir en su estado actual.'];
      return res.status(status).json({ message });
    }

    if (result.previousPdfPath) {
      const uploadsRoot = path.resolve(process.cwd(), 'uploads');
      const previousPdf = path.resolve(
        process.cwd(),
        String(result.previousPdfPath).replace(/^[/\\]+/, '')
      );
      if (previousPdf.startsWith(`${uploadsRoot}${path.sep}`)) {
        try {
          await fs.promises.unlink(previousPdf);
        } catch (error) {
          if (error?.code !== 'ENOENT') {
            console.error('No se pudo retirar el PDF anterior del reporte', error);
          }
        }
      }
    }

    const reportAsset = await getAssetById(result.clientId, result.assetId);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REPORT_REOPENED_BY_ENGINEER',
      clientId: result.clientId,
      assetId: result.assetId,
      asset: reportAsset,
      description: `Protocolo preventivo reabierto antes de firma para ${assetLabel(reportAsset)}.`,
      details: {
        eventType: 'reporte_preventivo_reabierto_por_ingeniero',
        reportId: result.reportId,
        requestId: result.requestId,
        correctionId: result.id,
        reason,
        invalidatedSignatureCount: result.invalidatedSignatureCount
      }
    });

    return res.status(201).json(await getMaintenanceReportById(report.id));
  }
);

app.post(
  '/maintenance/reports/:id/sign',
  requireAuth,
  requireAnyPermissionOrRole(['maintenance:report:sign'], MAINTENANCE_ACCEPTANCE_SIGNER_ROLES),
  async (req, res) => {
    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (report.area_responsible_required && !hasRole(req.user, AREA_RESPONSIBLE_ROLE)) {
      return res.status(403).json({
        message: 'Este reporte requiere el aval de un responsable asignado al área.'
      });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(report.client_id, req.user.sub, report.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    if (report.correction_requested) {
      return res.status(409).json({ message: 'Este reporte tiene una corrección solicitada y no puede firmarse todavía.' });
    }
    const user = await getUserById(req.user.sub);
    if (!user?.signature_path) {
      return res.status(400).json({ message: 'Firma no registrada para este usuario.' });
    }
    if (!resolveStoredFilePath(user.signature_path)) {
      return res.status(400).json({
        message: 'La firma registrada no está disponible. Solicita al administrador volver a cargarla.'
      });
    }

    const existingSignatures = await listReportSignatures(report.id);
    if (existingSignatures.some((sig) => sig.user_id === req.user.sub)) {
      return res.status(409).json({ message: 'Ya firmaste este reporte.' });
    }

    const result = await signMaintenanceReportWithSnapshot({
      reportId: report.id,
      clientId: report.client_id,
      user,
      role: maintenanceAcceptanceRoleForUser(req.user)
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
        signerRole: maintenanceAcceptanceRoleForUser(req.user),
        signatureId: result?.id ?? null
      }
    });

    const signatures = await listReportSignatures(report.id);
    const hasEngineer = signatures.some((sig) => sig.role === 'ingeniero_biomedico');
    if (!hasEngineer) {
      const engineerUser = await getUserById(report.created_by);
      if (engineerUser?.signature_path && resolveStoredFilePath(engineerUser.signature_path)) {
        await signMaintenanceReportWithSnapshot({
          reportId: report.id,
          clientId: report.client_id,
          user: engineerUser,
          role: 'ingeniero_biomedico'
        });
      }
    }
    const signaturesAfter = await listReportSignatures(report.id);
    const isFullySigned = isMaintenanceReportFullySigned(report, signaturesAfter);
    const waitsForSpare = report.requires_spare_parts && report.spare_parts_status !== 'recibido';
    if (isFullySigned) {
      await markMaintenanceReportNotificationsResolved(report.id);
      if (!waitsForSpare) {
        await updateMaintenanceRequestStatus(report.request_id, 'firmado');
        await markMaintenanceRequestNotificationsResolved(report.request_id);
      }
      await logEquipmentAudit(req, {
        action: waitsForSpare ? 'MAINTENANCE_REPORT_SIGNED_WAITING_SPARE' : 'MAINTENANCE_REPORT_FINALIZED',
        clientId: report.client_id,
        assetId: report.asset_id,
        asset: signedAsset,
        description: waitsForSpare
          ? `Reporte de mantenimiento firmado y en espera de repuesto para ${assetLabel(signedAsset)}.`
          : `Reporte de mantenimiento finalizado para ${assetLabel(signedAsset)}.`,
        details: {
          eventType: waitsForSpare ? 'reporte_mantenimiento_firmado_espera_repuesto' : 'reporte_mantenimiento_finalizado',
          reportId: report.id,
          requestId: report.request_id
        }
      });
    }

    await writeMaintenanceReportPdfFile(report.id);

    if (report.created_by) {
      const title = 'Reporte firmado';
      const message = isFullySigned
        ? waitsForSpare
          ? 'El reporte fue firmado y validado. El caso continúa abierto en espera de repuesto.'
          : 'El reporte fue firmado y queda finalizado.'
        : 'El reporte recibió una firma, pero aún tiene firmas pendientes.';
      await createNotification({
        userId: report.created_by,
        clientId: report.client_id,
        title,
        message,
        link: maintenanceRouteForAsset(asset),
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

app.post(
  '/maintenance/reports/:id/correction',
  requireAuth,
  requireAnyPermissionOrRole(['maintenance:report:sign'], MAINTENANCE_ACCEPTANCE_SIGNER_ROLES),
  async (req, res) => {
    const reason = String(req.body?.reason || '').replace(/\s+/g, ' ').trim();
    if (reason.length < 10) {
      return res.status(400).json({ message: 'Describe la corrección con al menos 10 caracteres.' });
    }
    if (reason.length > 600) {
      return res.status(400).json({ message: 'El motivo de corrección admite máximo 600 caracteres.' });
    }

    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (report.area_responsible_required && !hasRole(req.user, AREA_RESPONSIBLE_ROLE)) {
      return res.status(403).json({
        message: 'Solo un responsable asignado al área puede solicitar corrección de este reporte.'
      });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(report.client_id, req.user.sub, report.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    if (report.correction_requested) {
      return res.status(409).json({ message: 'Este reporte ya tiene una corrección solicitada.' });
    }

    const signatures = await listReportSignatures(report.id);
    if (isMaintenanceReportFullySigned(report, signatures)) {
      return res.status(409).json({ message: 'Este reporte ya fue firmado y finalizado.' });
    }
    if (signatures.some((sig) => sig.user_id === req.user.sub)) {
      return res.status(409).json({ message: 'Ya firmaste este reporte; no puedes solicitar corrección después de firmar.' });
    }

    const result = await requestMaintenanceReportCorrection({
      reportId: report.id,
      userId: req.user.sub,
      reason
    });
    await updateMaintenanceRequestStatus(report.request_id, 'correccion');
    await markMaintenanceReportNotificationsResolved(report.id);

    const signedAsset = await getAssetById(report.client_id, report.asset_id);
    await logEquipmentAudit(req, {
      action: 'MAINTENANCE_REPORT_CORRECTION_REQUESTED',
      clientId: report.client_id,
      assetId: report.asset_id,
      asset: signedAsset,
      description: `Solicitud de corrección de reporte de mantenimiento para ${assetLabel(signedAsset)}.`,
      details: {
        eventType: 'reporte_mantenimiento_correccion_solicitada',
        reportId: report.id,
        requestId: report.request_id,
        correctionId: result.id,
        reason
      }
    });

    if (report.created_by) {
      const title = 'Corrección solicitada en reporte';
      const message = `Se solicitó corrección del reporte ${report.type} de ${assetLabel(signedAsset)}. Motivo: ${reason}`;
      await createNotification({
        userId: report.created_by,
        clientId: report.client_id,
        title,
        message,
        link: maintenanceRouteForAsset(signedAsset),
        type: 'maintenance_report_correction_requested',
        priority: 'high',
        data: {
          reportId: report.id,
          requestId: report.request_id,
          assetId: report.asset_id,
          correctionId: result.id
        }
      });
      const engineer = await getUserById(report.created_by);
      if (engineer?.email) {
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

async function writeMaintenanceReportPdfFile(reportId) {
  const report = await getMaintenanceReportById(reportId);
  if (!report) return null;
  const client = await getClientById(report.client_id);
  const asset = await getAssetById(report.client_id, report.asset_id);
  const request = await getMaintenanceRequestById(report.request_id);
  if (!client || !asset || !request) return null;
  const signaturesForPdf = await ensureMaintenanceReportSignatureSnapshots(report);

  const dir = path.join(process.cwd(), 'uploads', 'clients', report.client_id, 'maintenance');
  await fs.promises.mkdir(dir, { recursive: true });
  const reportPdfFilename = maintenanceReportPdfFilename(report.id);
  const filename = path.join(dir, reportPdfFilename);
  const publicPath = `/${path.join('uploads', 'clients', report.client_id, 'maintenance', reportPdfFilename)}`.replace(/\\/g, '/');
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
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
  requireAnyPermissionOrRole(
    ['maintenance:report:create', 'maintenance:report:sign', 'read:all'],
    MAINTENANCE_REPORT_ACCESS_ROLES
  ),
  async (req, res) => {
    const report = await getMaintenanceReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== report.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
      const allowed = await readerCanAccessAsset(report.client_id, req.user.sub, report.asset_id);
      if (!allowed) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
    }
    let reportPdfPath = report.pdf_path;
    let pdfPath = resolveStoredFilePath(reportPdfPath);
    if (
      !pdfPath ||
      !maintenanceReportPdfUsesCurrentTemplate(reportPdfPath, report.id)
    ) {
      reportPdfPath = await writeMaintenanceReportPdfFile(report.id);
      pdfPath = resolveStoredFilePath(reportPdfPath);
    }
    if (!pdfPath) {
      return res.status(404).json({ message: 'PDF no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reporte-${report.id}.pdf"`);
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

function todayInBogota() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

const dueScheduleSyncPromises = new Map();

async function syncDueScheduleRequests(clientId, fallbackUserId) {
  const existing = dueScheduleSyncPromises.get(clientId);
  if (existing) return existing;
  const operation = performDueScheduleRequestSync(clientId, fallbackUserId);
  dueScheduleSyncPromises.set(clientId, operation);
  try {
    return await operation;
  } finally {
    if (dueScheduleSyncPromises.get(clientId) === operation) {
      dueScheduleSyncPromises.delete(clientId);
    }
  }
}

async function performDueScheduleRequestSync(clientId, fallbackUserId) {
  const today = todayInBogota();
  const client = await getClientById(clientId);
  if (!client?.schema_name) return;

  await query(
    `WITH removed AS (
       DELETE FROM maintenance_schedule_items item
       USING maintenance_schedules schedule,
             "${client.schema_name}".assets asset
       WHERE item.schedule_id = schedule.id
         AND item.asset_id = asset.id
         AND schedule.client_id = $1
         AND schedule.status = 'approved'
         AND item.status = 'pending'
         AND item.planned_date > $2::date
         AND item.report_id IS NULL
         AND item.completion_source IS NULL
         AND item.legacy_history_file_id IS NULL
         AND item.warranty_resolution IS NULL
         AND asset.warranty_years IS NOT NULL
         AND (
           asset.acquisition_date IS NULL
           OR item.planned_date < (
             asset.acquisition_date + make_interval(years => asset.warranty_years)
           )::date
         )
         AND NOT EXISTS (
           SELECT 1
           FROM maintenance_requests request
           WHERE request.schedule_item_id = item.id
         )
       RETURNING item.schedule_id
     )
     UPDATE maintenance_schedules schedule
     SET pdf_path = NULL
     WHERE schedule.id IN (SELECT DISTINCT schedule_id FROM removed)`,
    [clientId, today]
  );

  await query(
    `UPDATE maintenance_requests request
     SET status = 'garantia', updated_at = NOW()
     FROM maintenance_schedule_items item,
          maintenance_schedules schedule,
          "${client.schema_name}".assets asset
     WHERE request.schedule_item_id = item.id
       AND item.schedule_id = schedule.id
       AND item.asset_id = asset.id
       AND schedule.client_id = $1
       AND schedule.status = 'approved'
       AND request.type = 'preventivo'
       AND request.source = 'cronograma'
       AND request.status IN ('abierto', 'vencido')
       AND item.report_id IS NULL
       AND item.completion_source IS NULL
       AND item.legacy_history_file_id IS NULL
       AND item.warranty_resolution IS DISTINCT FROM 'perform'
       AND asset.warranty_years IS NOT NULL
       AND (
         asset.acquisition_date IS NULL
         OR item.planned_date < (
           asset.acquisition_date + make_interval(years => asset.warranty_years)
         )::date
       )
       AND NOT EXISTS (
         SELECT 1
         FROM maintenance_reports report
         WHERE report.request_id = request.id
       )`,
    [clientId]
  );

  await query(
    `WITH protected AS (
       UPDATE maintenance_schedule_items item
       SET status = 'warranty'
       FROM maintenance_schedules schedule,
            "${client.schema_name}".assets asset
       WHERE item.schedule_id = schedule.id
         AND item.asset_id = asset.id
         AND schedule.client_id = $1
         AND schedule.status = 'approved'
         AND item.status IN ('pending', 'active', 'expired')
         AND item.report_id IS NULL
         AND item.completion_source IS NULL
         AND item.legacy_history_file_id IS NULL
         AND item.warranty_resolution IS DISTINCT FROM 'perform'
         AND asset.warranty_years IS NOT NULL
         AND (
           asset.acquisition_date IS NULL
           OR item.planned_date < (
             asset.acquisition_date + make_interval(years => asset.warranty_years)
           )::date
         )
         AND NOT EXISTS (
           SELECT 1
           FROM maintenance_requests request
           WHERE request.schedule_item_id = item.id
             AND request.status IN (
               'en_proceso', 'espera_repuesto', 'reportado', 'firmado', 'correccion'
             )
         )
       RETURNING item.schedule_id
     )
     UPDATE maintenance_schedules schedule
     SET pdf_path = NULL
     WHERE schedule.id IN (SELECT DISTINCT schedule_id FROM protected)`,
    [clientId]
  );

  await query(
    `WITH restored AS (
       UPDATE maintenance_schedule_items item
       SET status = CASE
         WHEN item.deadline_date < $2::date THEN 'expired'
         WHEN item.planned_date <= $2::date THEN 'active'
         ELSE 'pending'
       END
       FROM maintenance_schedules schedule,
            "${client.schema_name}".assets asset
       WHERE item.schedule_id = schedule.id
         AND item.asset_id = asset.id
         AND schedule.client_id = $1
         AND item.status = 'warranty'
         AND (
           item.warranty_resolution = 'perform'
           OR (
             item.warranty_resolution IS DISTINCT FROM 'covered'
             AND (
               asset.warranty_years IS NULL
               OR (
                 asset.acquisition_date IS NOT NULL
                 AND item.planned_date >= (
                   asset.acquisition_date + make_interval(years => asset.warranty_years)
                 )::date
               )
             )
           )
         )
       RETURNING item.schedule_id
     )
     UPDATE maintenance_schedules schedule
     SET pdf_path = NULL
     WHERE schedule.id IN (SELECT DISTINCT schedule_id FROM restored)`,
    [clientId, today]
  );

  await query(
    `UPDATE maintenance_requests request
     SET status = CASE
           WHEN item.deadline_date < $2::date THEN 'vencido'
           WHEN item.planned_date <= $2::date THEN 'abierto'
           ELSE 'garantia'
         END,
         assigned_to = CASE
           WHEN item.planned_date <= $2::date AND item.deadline_date >= $2::date THEN NULL
           ELSE assigned_to
         END,
         updated_at = NOW()
     FROM maintenance_schedule_items item,
          maintenance_schedules schedule,
          "${client.schema_name}".assets asset
     WHERE request.schedule_item_id = item.id
       AND item.schedule_id = schedule.id
       AND item.asset_id = asset.id
       AND schedule.client_id = $1
       AND request.status = 'garantia'
       AND (
         item.warranty_resolution = 'perform'
         OR (
           item.warranty_resolution IS DISTINCT FROM 'covered'
           AND (
             asset.warranty_years IS NULL
             OR (
               asset.acquisition_date IS NOT NULL
               AND item.planned_date >= (
                 asset.acquisition_date + make_interval(years => asset.warranty_years)
               )::date
             )
           )
         )
       )`,
    [clientId, today]
  );

  await query(
    `UPDATE maintenance_requests
     SET status = 'vencido', updated_at = NOW()
     WHERE client_id = $1
       AND type = 'preventivo'
       AND source = 'cronograma'
       AND status = 'abierto'
       AND NOT EXISTS (
         SELECT 1
         FROM maintenance_schedule_items item
         JOIN user_temporary_permissions permission
           ON permission.id = item.late_execution_temporary_permission_id
         WHERE item.id = maintenance_requests.schedule_item_id
           AND item.late_execution_authorized_until > NOW()
           AND permission.expires_at > NOW()
       )
       AND (
         deadline_date < $2
         OR schedule_id IN (
           SELECT id
           FROM maintenance_schedules
           WHERE client_id = $1
             AND year < EXTRACT(YEAR FROM $2::date)::int
         )
       )`,
    [clientId, today]
  );

  await query(
    `UPDATE maintenance_schedule_items i
     SET status = 'expired'
     FROM maintenance_schedules s
     WHERE s.id = i.schedule_id
       AND s.client_id = $1
       AND s.status = 'approved'
       AND i.status IN ('pending', 'active')
       AND NOT EXISTS (
         SELECT 1
         FROM user_temporary_permissions permission
         WHERE permission.id = i.late_execution_temporary_permission_id
           AND i.late_execution_authorized_until > NOW()
           AND permission.expires_at > NOW()
       )
       AND (
         i.deadline_date < $2
         OR s.year < EXTRACT(YEAR FROM $2::date)::int
       )
       AND NOT EXISTS (
         SELECT 1
         FROM maintenance_requests r
         WHERE r.schedule_item_id = i.id
           AND r.status IN ('en_proceso', 'espera_repuesto', 'reportado', 'firmado')
       )`,
    [clientId, today]
  );

  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.asset_id, i.planned_date, i.deadline_date, s.created_by
     FROM maintenance_schedule_items i
     JOIN maintenance_schedules s ON s.id = i.schedule_id
     JOIN "${client.schema_name}".assets a ON a.id = i.asset_id
     WHERE s.client_id = $1
       AND s.status = 'approved'
       AND s.year = EXTRACT(YEAR FROM $2::date)::int
       AND i.status IN ('pending', 'active')
       AND COALESCE(a.status, 'activo') <> 'dado_de_baja'
       AND (
         i.warranty_resolution = 'perform'
         OR a.warranty_years IS NULL
         OR (
           a.acquisition_date IS NOT NULL
           AND i.planned_date >= (a.acquisition_date + make_interval(years => a.warranty_years))::date
         )
       )
       AND (
         (i.planned_date <= $2 AND i.deadline_date >= $2)
         OR (
           i.late_execution_authorized_until > NOW()
           AND EXISTS (
             SELECT 1
             FROM user_temporary_permissions permission
             WHERE permission.id = i.late_execution_temporary_permission_id
               AND permission.expires_at > NOW()
           )
         )
       )`,
    [clientId, today]
  );

  if (!rows.length) return;

  for (const item of rows) {
    const exists = await query(
      `SELECT id, status
       FROM maintenance_requests
       WHERE client_id = $1
         AND asset_id = $2
         AND source = 'cronograma'
         AND (
           schedule_item_id = $3
           OR (schedule_item_id IS NULL AND planned_date = $4)
         )
       LIMIT 1`,
      [clientId, item.asset_id, item.id, item.planned_date]
    );
    if (exists.rows.length) {
      if (['garantia', 'vencido'].includes(exists.rows[0].status)) {
        await query(
          `UPDATE maintenance_requests
           SET status = 'abierto', assigned_to = NULL, updated_at = NOW()
           WHERE id = $1`,
          [exists.rows[0].id]
        );
      }
      await query(
        `UPDATE maintenance_requests
         SET schedule_id = $1, schedule_item_id = $2
         WHERE id = $3 AND schedule_item_id IS NULL`,
        [item.schedule_id, item.id, exists.rows[0].id]
      );
      await query(
        `UPDATE maintenance_schedule_items
         SET status = 'active'
         WHERE id = $1 AND status = 'pending'`,
        [item.id]
      );
      continue;
    }

    await createMaintenanceRequest({
      clientId,
      assetId: item.asset_id,
      type: 'preventivo',
      description: 'Mantenimiento preventivo programado',
      plannedDate: item.planned_date,
      deadlineDate: item.deadline_date,
      source: 'cronograma',
      scheduleId: item.schedule_id,
      scheduleItemId: item.id,
      requestedBy: item.created_by ?? fallbackUserId
    });

    await query(
      `UPDATE maintenance_schedule_items
       SET status = 'active'
       WHERE id = $1 AND status = 'pending'`,
      [item.id]
    );
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
  requireAnyPermission(SCHEDULE_READ_PERMISSIONS),
  async (req, res) => {
    const { clientId } = req.params;
    if (req.user.clientId && req.user.clientId !== clientId) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const assetCategory = normalizeAssetCategory(req.query.category);
      const rows = await listSchedules(clientId, year, assetCategory);
      return res.json(rows);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: 'No se pudieron cargar los cronogramas de mantenimiento.' });
    }
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
    let scheduleInput;
    let assetCategory;
    try {
      scheduleInput = normalizeScheduleStart(req.body || {});
      assetCategory = normalizeAssetCategory(req.body?.assetCategory);
    } catch (error) {
      if (error?.code === 'INVALID_ASSET_CATEGORY') {
        return res.status(400).json({ message: error.message });
      }
      return respondScheduleError(res, error, 'No se pudo validar el cronograma.');
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const schema = client.schema_name;
    const assetsResult = await query(
      `SELECT id, code, name, brand, model, serial, maintenance_frequency,
              acquisition_date, warranty_years
       FROM "${schema}".assets
       WHERE maintenance_frequency IS NOT NULL
         AND asset_category = $1
         AND COALESCE(status, 'activo') <> 'dado_de_baja'
       ORDER BY created_at ASC`,
      [assetCategory]
    );
    const assets = assetsResult.rows;
    if (!assets.length) {
      return res.status(400).json({
        message: `No hay equipos ${assetCategory === 'industrial' ? 'industriales' : 'biomédicos'} con periodicidad definida.`
      });
    }

    const items = [];
    const unsupportedFrequencies = new Set();
    for (const asset of assets) {
      const months = scheduleFrequencyToMonths(asset.maintenance_frequency);
      if (!months) {
        unsupportedFrequencies.add(String(asset.maintenance_frequency));
        continue;
      }
      let warrantyReleaseDate;
      try {
        warrantyReleaseDate = assetWarrantyReleaseDate({
          acquisitionDate: asset.acquisition_date,
          warrantyYears: asset.warranty_years
        });
      } catch (error) {
        return res.status(400).json({
          message: `Equipo ${asset.code || asset.name}: ${error.message}`
        });
      }
      const occurrences = buildAssetMaintenanceOccurrences({
        ...scheduleInput,
        frequency: asset.maintenance_frequency,
        notBeforeDate: warrantyReleaseDate
      });
      for (const occurrence of occurrences) {
        items.push({
          assetId: asset.id,
          frequency: asset.maintenance_frequency,
          ...occurrence
        });
      }
    }
    if (!items.length) {
      const detail = unsupportedFrequencies.size
        ? ` Revisa estas periodicidades: ${Array.from(unsupportedFrequencies).join(', ')}.`
        : ' Los equipos pueden continuar en garantía durante toda la vigencia seleccionada.';
      return res.status(400).json({
        message: `No se pudieron generar mantenimientos con las periodicidades registradas.${detail}`
      });
    }

    try {
      const schedule = await createScheduleWithItems({
        clientId,
        ...scheduleInput,
        createdBy: req.user.sub,
        assetCategory,
        items
      });
      if (!schedule) {
        return res.status(409).json({
          message: `Ya existe un cronograma de mantenimiento ${assetCategoryLabel(assetCategory)} para este año.`
        });
      }
      const scheduleItems = await listScheduleItemsWithSchema(schedule.id, schema);
      await writeSchedulePdf({ client, schedule, items: scheduleItems });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'MAINTENANCE_SCHEDULE_CREATE',
        targetUserId: clientId,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId,
          clientName: client.name,
          scheduleId: schedule.id,
          assetCategory,
          year: scheduleInput.year,
          itemCount: items.length
        }
      });
      return res.status(201).json({ id: schedule.id });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo generar el cronograma de mantenimiento.');
    }
  }
);

app.get(
  '/maintenance/schedules/:id/items',
  requireAuth,
  requireAnyPermission(SCHEDULE_READ_PERMISSIONS),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const client = await getClientById(schedule.client_id);
    await syncDueScheduleRequests(schedule.client_id, req.user.sub);
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
    if (!req.user.clientId || req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    const { items } = req.body || {};
    if (!canEditMaintenanceSchedule(schedule, req.user.roles || [])) {
      return res.status(403).json({ message: 'Cronograma bloqueado para edición.' });
    }

    try {
      const client = await getClientById(schedule.client_id);
      const currentItems = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
      const normalized = normalizeMaintenanceItemUpdates(items, currentItems, schedule.year);
      const approvedEdit = schedule.status === 'approved';
      const changedItems = changedMaintenanceItemUpdates(normalized, currentItems, {
        approved: approvedEdit
      });
      if (approvedEdit && !changedItems.length) {
        return res.json({ ok: true, updatedCount: 0, editAuthorizationConsumed: false });
      }
      const persistedItems = approvedEdit ? changedItems : normalized;
      await updateScheduleItems(schedule.id, persistedItems, {
        markEngineerEdited: hasRole(req.user, 'ingeniero_biomedico'),
        consumeEngineerEdit: approvedEdit,
        expectedStatus: schedule.status,
        confirmProgramming: !approvedEdit,
        programmedBy: req.user.sub
      });
      if (approvedEdit) {
        const scheduleItems = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
        await writeSchedulePdf({
          client,
          schedule: { ...schedule, engineer_edit_enabled: false },
          items: scheduleItems
        });
        await syncDueScheduleRequests(schedule.client_id, req.user.sub);
      } else {
        await setSchedulePdf(schedule.id, null);
      }
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'MAINTENANCE_SCHEDULE_UPDATE',
        targetUserId: schedule.client_id,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId: schedule.client_id,
          clientName: client.name,
          scheduleId: schedule.id,
          assetCategory: schedule.asset_category || 'biomedical',
          year: schedule.year,
          updatedItemCount: changedItems.length,
          programmedItemCount: approvedEdit ? 0 : normalized.length,
          approvedEditAuthorizationConsumed: approvedEdit
        }
      });
      return res.json({
        ok: true,
        updatedCount: changedItems.length,
        programmedCount: approvedEdit ? 0 : normalized.length,
        editAuthorizationConsumed: approvedEdit
      });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo actualizar el cronograma de mantenimiento.');
    }
  }
);

app.post(
  '/maintenance/schedules/:id/assets/:assetId/reschedule',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (!req.user.clientId || req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (schedule.status !== 'draft') {
      return res.status(409).json({
        message: 'Solo se puede reprogramar un equipo mientras el cronograma está en borrador.'
      });
    }

    try {
      const frequency = normalizePeriodicity(req.body?.frequency);
      const months = scheduleFrequencyToMonths(frequency);
      const client = await getClientById(schedule.client_id);
      if (!client?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const asset = await getAssetById(schedule.client_id, req.params.assetId);
      if (!asset) {
        return res.status(404).json({ message: 'Equipo no encontrado.' });
      }
      const scheduleCategory = normalizeAssetCategory(schedule.asset_category);
      if (normalizeAssetCategory(asset.asset_category) !== scheduleCategory) {
        return res.status(409).json({ message: 'El equipo no pertenece a este tipo de cronograma.' });
      }

      const recurringDates = buildRecurringDates({
        year: schedule.year,
        startDate: dateOnlyFromDatabase(schedule.start_date, 'La fecha inicial del cronograma'),
        months
      });
      const items = recurringDates.map((plannedDate) => ({
        plannedDate,
        deadlineDate: formatScheduleDate(endOfScheduleMonth(parseScheduleDate(plannedDate)))
      }));
      const result = await rescheduleDraftAsset({
        scheduleId: schedule.id,
        clientId: schedule.client_id,
        schema: client.schema_name,
        assetId: asset.id,
        assetCategory: scheduleCategory,
        frequency,
        items
      });
      const updatedAsset = await getAssetById(schedule.client_id, asset.id);
      await logEquipmentAudit(req, {
        action: 'ASSET_UPDATE',
        clientId: schedule.client_id,
        assetId: asset.id,
        asset: updatedAsset,
        description: `Actualización de periodicidad desde el cronograma para ${assetLabel(updatedAsset)}.`,
        details: {
          eventType: 'periodicidad_mantenimiento_actualizada_desde_cronograma',
          scheduleId: schedule.id,
          year: schedule.year,
          changes: changedAssetFields(asset, updatedAsset),
          previousFrequency: result.oldFrequency,
          maintenanceFrequency: result.frequency,
          previousScheduleItemCount: result.oldItemCount,
          scheduleItemCount: result.newItemCount
        }
      });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'MAINTENANCE_SCHEDULE_ASSET_RESCHEDULE',
        targetUserId: asset.id,
        targetUsername: assetLabel(updatedAsset),
        details: {
          category: 'schedule',
          clientId: schedule.client_id,
          clientName: client.name,
          scheduleId: schedule.id,
          assetId: asset.id,
          assetCode: asset.code,
          assetName: asset.name,
          assetCategory: scheduleCategory,
          year: schedule.year,
          previousFrequency: result.oldFrequency,
          frequency: result.frequency,
          previousItemCount: result.oldItemCount,
          itemCount: result.newItemCount
        }
      });
      return res.json(result);
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo reprogramar el equipo.');
    }
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
    if (schedule.status !== 'draft') {
      return res.status(409).json({ message: 'El cronograma ya fue aprobado o cerrado.' });
    }
    const client = await getClientById(schedule.client_id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const itemCount = await countScheduleItems(schedule.id);
    if (!itemCount) {
      return res.status(400).json({ message: 'No se puede aprobar un cronograma sin mantenimientos.' });
    }
    const unprogrammedCount = await countUnprogrammedScheduleItems(schedule.id);
    if (unprogrammedCount) {
      return res.status(409).json({
        message: unprogrammedCount === 1
          ? 'Falta 1 mantenimiento por programar antes de aprobar.'
          : `Faltan ${unprogrammedCount} mantenimientos por programar antes de aprobar.`
      });
    }
    const approved = await approveSchedule(schedule.id);
    if (!approved) {
      return res.status(409).json({ message: 'El cronograma cambió de estado. Actualiza la información.' });
    }
    const scheduleItems = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
    await writeSchedulePdf({ client, schedule: { ...schedule, status: 'approved' }, items: scheduleItems });
    await syncDueScheduleRequests(schedule.client_id, req.user.sub);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'MAINTENANCE_SCHEDULE_APPROVE',
      targetUserId: schedule.client_id,
      targetUsername: client.name,
      details: {
        category: 'schedule',
        clientId: schedule.client_id,
        clientName: client.name,
        scheduleId: schedule.id,
        assetCategory: schedule.asset_category || 'biomedical',
        year: schedule.year,
        itemCount
      }
    });
    return res.json({ ok: true });
  }
);

app.patch(
  '/maintenance/schedules/:id/engineer-edit-access',
  requireAuth,
  requirePermission(SCHEDULE_UNLOCK_PERMISSION),
  async (req, res) => {
    if (!isClientAdmin(req.user) || !req.user.clientId) {
      return res.status(403).json({ message: 'Solo el administrador del cliente puede habilitar esta edición.' });
    }
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (schedule.status !== 'approved') {
      return res.status(409).json({ message: 'Solo se puede habilitar la edición de un cronograma aprobado.' });
    }
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'Estado de autorización inválido.' });
    }
    try {
      if (enabled && !(await countPendingScheduleItems(schedule.id))) {
        return res.status(409).json({ message: 'El cronograma no tiene mantenimientos futuros pendientes para editar.' });
      }
      if (schedule.engineer_edit_enabled === enabled) {
        return res.json({ ok: true, enabled });
      }
      const updated = await setScheduleEngineerEditAccess(schedule.id, enabled, req.user.sub);
      if (!updated) {
        return res.status(409).json({ message: 'El cronograma cambió de estado. Actualiza la información.' });
      }
      const client = await getClientById(schedule.client_id);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: enabled
          ? 'MAINTENANCE_SCHEDULE_ENGINEER_EDIT_ENABLE'
          : 'MAINTENANCE_SCHEDULE_ENGINEER_EDIT_REVOKE',
        targetUserId: schedule.client_id,
        targetUsername: client?.name,
        details: {
          category: 'schedule',
          clientId: schedule.client_id,
          clientName: client?.name,
          scheduleId: schedule.id,
          assetCategory: schedule.asset_category || 'biomedical',
          year: schedule.year,
          enabled
        }
      });
      return res.json({ ok: true, enabled });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'No se pudo actualizar la autorización de edición.' });
    }
  }
);

app.get(
  '/maintenance/schedules/:id/pdf',
  requireAuth,
  requireAnyPermission(SCHEDULE_READ_PERMISSIONS),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (req.user.clientId && req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    let publicPath = schedule.pdf_path;
    let pdfPath = publicPath
      ? path.join(process.cwd(), publicPath.replace(/^\//, ''))
      : '';
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const client = await getClientById(schedule.client_id);
      if (!client?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const items = await listScheduleItemsWithSchema(schedule.id, client.schema_name);
      publicPath = await writeSchedulePdf({ client, schedule, items });
      pdfPath = path.join(process.cwd(), publicPath.replace(/^\//, ''));
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cronograma-${schedule.id}.pdf"`);
    return fs.createReadStream(pdfPath).pipe(res);
  }
);

app.delete(
  '/maintenance/schedules/:id',
  requireAuth,
  requirePermission('schedules:manage'),
  async (req, res) => {
    const schedule = await getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (!req.user.clientId || req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (schedule.status !== 'draft') {
      return res.status(409).json({ message: 'Solo se puede eliminar un cronograma que aún está en borrador.' });
    }
    const deleted = await deleteDraftSchedule(schedule.id);
    if (!deleted) {
      return res.status(409).json({ message: 'El cronograma cambió de estado. Actualiza la información.' });
    }
    if (deleted.pdf_path) {
      const pdfPath = path.join(process.cwd(), deleted.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    }
    const client = await getClientById(schedule.client_id);
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'MAINTENANCE_SCHEDULE_DELETE',
      targetUserId: schedule.client_id,
      targetUsername: client?.name,
      details: {
        category: 'schedule',
        clientId: schedule.client_id,
        clientName: client?.name,
        scheduleId: schedule.id,
        assetCategory: schedule.asset_category || 'biomedical',
        year: schedule.year
      }
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
    let publicPath = schedule.pdf_path;
    let pdfPath = publicPath
      ? path.join(process.cwd(), publicPath.replace(/^\//, ''))
      : '';
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const client = await getClientById(schedule.client_id);
      if (!client?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const items = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
      publicPath = await writeTrainingSchedulePdf({ client, schedule, items });
      pdfPath = path.join(process.cwd(), publicPath.replace(/^\//, ''));
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
    let scheduleInput;
    let periodicity;
    let areaIds;
    try {
      scheduleInput = normalizeScheduleStart(req.body || {});
      periodicity = normalizePeriodicity(req.body?.periodicity);
      areaIds = normalizeUuidList(req.body?.areaIds, 'Las áreas');
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo validar el cronograma de capacitaciones.');
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const areaCheck = await query(
      `SELECT id FROM "${client.schema_name}".areas WHERE id = ANY($1::uuid[])`,
      [areaIds]
    );
    if (areaCheck.rows.length !== areaIds.length) {
      return res.status(400).json({ message: 'Una o más áreas no pertenecen al cliente seleccionado.' });
    }

    const months = scheduleFrequencyToMonths(periodicity);
    const dates = buildRecurringDates({ ...scheduleInput, months });
    const items = areaIds.flatMap((areaId) =>
      dates.map((plannedDate) => ({ areaId, plannedDate }))
    );

    try {
      const schedule = await createTrainingScheduleWithItems({
        clientId,
        ...scheduleInput,
        periodicity,
        createdBy: req.user.sub,
        items
      });
      if (!schedule) {
        return res.status(409).json({ message: 'Ya existe un cronograma de capacitaciones para este año.' });
      }
      const scheduleItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
      await writeTrainingSchedulePdf({ client, schedule, items: scheduleItems });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'TRAINING_SCHEDULE_CREATE',
        targetUserId: clientId,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId,
          clientName: client.name,
          scheduleId: schedule.id,
          year: scheduleInput.year,
          periodicity,
          areaCount: areaIds.length,
          itemCount: items.length
        }
      });
      return res.status(201).json({ id: schedule.id });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo generar el cronograma de capacitaciones.');
    }
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
    const today = todayInBogota();
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
    const today = todayInBogota();
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
    if (schedule.status !== 'draft') {
      return res.status(409).json({ message: 'El cronograma ya fue aprobado o cerrado.' });
    }
    const client = await getClientById(schedule.client_id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const itemCount = await countTrainingItems(schedule.id);
    if (!itemCount) {
      return res.status(400).json({ message: 'No se puede aprobar un cronograma sin capacitaciones.' });
    }
    const unprogrammedCount = await countUnprogrammedTrainingItems(schedule.id);
    if (unprogrammedCount) {
      return res.status(409).json({
        message: unprogrammedCount === 1
          ? 'Falta 1 capacitación por programar antes de aprobar.'
          : `Faltan ${unprogrammedCount} capacitaciones por programar antes de aprobar.`
      });
    }
    const approved = await approveTrainingSchedule(schedule.id);
    if (!approved) {
      return res.status(409).json({ message: 'El cronograma cambió de estado. Actualiza la información.' });
    }
    const scheduleItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
    await writeTrainingSchedulePdf({ client, schedule: { ...schedule, status: 'approved' }, items: scheduleItems });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'TRAINING_SCHEDULE_APPROVE',
      targetUserId: schedule.client_id,
      targetUsername: client.name,
      details: {
        category: 'schedule',
        clientId: schedule.client_id,
        clientName: client.name,
        scheduleId: schedule.id,
        year: schedule.year,
        itemCount
      }
    });
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
    if (!req.user.clientId || req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (schedule.status !== 'draft') {
      return res.status(403).json({ message: 'Cronograma bloqueado para edición.' });
    }
    try {
      const client = await getClientById(schedule.client_id);
      if (!client) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const currentItems = await listTrainingItemsWithSchema(schedule.id, client.schema_name);
      const normalized = normalizeTrainingItemUpdates(req.body?.items, currentItems, schedule.year);
      await updateTrainingItems(schedule.id, normalized, req.user.sub);
      await setTrainingSchedulePdf(schedule.id, null);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'TRAINING_SCHEDULE_UPDATE',
        targetUserId: schedule.client_id,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId: schedule.client_id,
          clientName: client.name,
          scheduleId: schedule.id,
          year: schedule.year,
          updatedItemCount: normalized.length,
          programmedItemCount: normalized.length
        }
      });
      return res.json({ ok: true, programmedCount: normalized.length });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo actualizar el cronograma de capacitaciones.');
    }
  }
);

app.post(
  '/training/items/:id/upload',
  requireAuth,
  requirePermission('schedules:manage'),
  uploadSchedulePdf,
  async (req, res) => {
    const itemId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo requerido.' });
    }
    if (!isPdfFile(req.file)) {
      return res.status(400).json({ message: 'El archivo no contiene un PDF válido.' });
    }
    const { rows } = await query(
      `SELECT i.id, i.schedule_id, i.area_id, i.planned_date, i.pdf_path,
              s.client_id, s.status AS schedule_status
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
    if (item.schedule_status !== 'approved') {
      return res.status(409).json({ message: 'Aprueba el cronograma antes de cargar el acta.' });
    }
    if (item.pdf_path) {
      return res.status(409).json({ message: 'Esta capacitación ya tiene un acta cargada.' });
    }
    if (dateOnlyFromDatabase(item.planned_date) > todayInBogota()) {
      return res.status(409).json({ message: 'El acta se habilita a partir de la fecha programada.' });
    }
    if (isAreaScopedOperationalUser(req.user)) {
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
    await refreshTrainingScheduleStatus(item.schedule_id);
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
    if (isAreaScopedOperationalUser(req.user)) {
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
      `SELECT i.id, i.schedule_id, i.pdf_path, s.client_id
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
    await refreshTrainingScheduleStatus(item.schedule_id);
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
    let publicPath = schedule.pdf_path;
    let pdfPath = publicPath
      ? path.join(process.cwd(), publicPath.replace(/^\//, ''))
      : '';
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const client = await getClientById(schedule.client_id);
      if (!client?.schema_name) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const items = await listCalibrationItemsWithSchema(schedule.id, client.schema_name);
      publicPath = await writeCalibrationSchedulePdf({ client, schedule, items });
      pdfPath = path.join(process.cwd(), publicPath.replace(/^\//, ''));
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
    let scheduleInput;
    try {
      scheduleInput = normalizeScheduleStart(req.body || {});
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo validar el cronograma de calibración.');
    }

    const client = await getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const schema = client.schema_name;
    const assetsResult = await query(
      `SELECT id, code, name, brand, model, serial, calibration_frequency, requires_calibration
       FROM "${schema}".assets
       WHERE requires_calibration = TRUE
         AND calibration_frequency IS NOT NULL
         AND COALESCE(status, 'activo') <> 'dado_de_baja'
       ORDER BY created_at ASC`
    );
    const assets = assetsResult.rows;
    if (!assets.length) {
      return res.status(400).json({ message: 'No hay equipos con calibración definida.' });
    }

    const items = [];
    const datesByFrequency = new Map();
    const unsupportedFrequencies = new Set();
    for (const asset of assets) {
      const months = scheduleFrequencyToMonths(asset.calibration_frequency);
      if (!months) {
        unsupportedFrequencies.add(String(asset.calibration_frequency));
        continue;
      }
      if (!datesByFrequency.has(months)) {
        datesByFrequency.set(months, buildRecurringDates({ ...scheduleInput, months }));
      }
      for (const plannedDate of datesByFrequency.get(months)) {
        const deadlineDate = formatScheduleDate(
          capScheduleDateAtYearEnd(
            addScheduleMonths(parseScheduleDate(plannedDate), 1),
            scheduleInput.year
          )
        );
        items.push({
          assetId: asset.id,
          frequency: asset.calibration_frequency,
          plannedDate,
          deadlineDate
        });
      }
    }
    if (!items.length) {
      const detail = unsupportedFrequencies.size
        ? ` Revisa estas periodicidades: ${Array.from(unsupportedFrequencies).join(', ')}.`
        : '';
      return res.status(400).json({
        message: `No se pudieron generar calibraciones con las periodicidades registradas.${detail}`
      });
    }

    try {
      const schedule = await createCalibrationScheduleWithItems({
        clientId,
        ...scheduleInput,
        createdBy: req.user.sub,
        items
      });
      if (!schedule) {
        return res.status(409).json({ message: 'Ya existe un cronograma de calibración para este año.' });
      }
      const scheduleItems = await listCalibrationItemsWithSchema(schedule.id, schema);
      await writeCalibrationSchedulePdf({ client, schedule, items: scheduleItems });
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'CALIBRATION_SCHEDULE_CREATE',
        targetUserId: clientId,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId,
          clientName: client.name,
          scheduleId: schedule.id,
          year: scheduleInput.year,
          itemCount: items.length
        }
      });
      return res.status(201).json({ id: schedule.id });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo generar el cronograma de calibración.');
    }
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
    const today = todayInBogota();
    const normalized = items.map((item) => {
      const planned = toLocalISODate(item.planned_date);
      const deadline = toLocalISODate(item.deadline_date);
      return {
        ...item,
        display_status: item.pdf_path
          ? 'done'
          : planned && deadline && planned <= today && today <= deadline
            ? 'active'
            : deadline && deadline < today
              ? 'expired'
              : 'pending'
      };
    });
    return res.json(normalized);
  }
);

app.patch(
  '/calibration/schedules/:id/items',
  requireAuth,
  requirePermission('calibration:schedule:manage'),
  async (req, res) => {
    const schedule = await getCalibrationScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Cronograma no encontrado.' });
    }
    if (!req.user.clientId || req.user.clientId !== schedule.client_id) {
      return res.status(403).json({ message: 'Sin acceso al cliente.' });
    }
    if (schedule.status !== 'draft') {
      return res.status(403).json({ message: 'Cronograma bloqueado para edición.' });
    }
    try {
      const client = await getClientById(schedule.client_id);
      if (!client) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
      }
      const currentItems = await listCalibrationItemsWithSchema(schedule.id, client.schema_name);
      const normalized = normalizeCalibrationItemUpdates(req.body?.items, currentItems, schedule.year);
      await updateCalibrationItems(schedule.id, normalized, req.user.sub);
      await setCalibrationSchedulePdf(schedule.id, null);
      await logAudit({
        actorUserId: req.user.sub,
        actorUsername: req.user.username,
        action: 'CALIBRATION_SCHEDULE_UPDATE',
        targetUserId: schedule.client_id,
        targetUsername: client.name,
        details: {
          category: 'schedule',
          clientId: schedule.client_id,
          clientName: client.name,
          scheduleId: schedule.id,
          year: schedule.year,
          updatedItemCount: normalized.length,
          programmedItemCount: normalized.length
        }
      });
      return res.json({ ok: true, programmedCount: normalized.length });
    } catch (error) {
      return respondScheduleError(res, error, 'No se pudo actualizar el cronograma de calibración.');
    }
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
    if (schedule.status !== 'draft') {
      return res.status(409).json({ message: 'El cronograma ya fue aprobado o cerrado.' });
    }
    const client = await getClientById(schedule.client_id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    const itemCount = await countCalibrationItems(schedule.id);
    if (!itemCount) {
      return res.status(400).json({ message: 'No se puede aprobar un cronograma sin calibraciones.' });
    }
    const unprogrammedCount = await countUnprogrammedCalibrationItems(schedule.id);
    if (unprogrammedCount) {
      return res.status(409).json({
        message: unprogrammedCount === 1
          ? 'Falta 1 calibración por programar antes de aprobar.'
          : `Faltan ${unprogrammedCount} calibraciones por programar antes de aprobar.`
      });
    }
    const approved = await approveCalibrationSchedule(schedule.id);
    if (!approved) {
      return res.status(409).json({ message: 'El cronograma cambió de estado. Actualiza la información.' });
    }
    const scheduleItems = await listCalibrationItemsWithSchema(schedule.id, client.schema_name);
    await writeCalibrationSchedulePdf({ client, schedule: { ...schedule, status: 'approved' }, items: scheduleItems });
    await logAudit({
      actorUserId: req.user.sub,
      actorUsername: req.user.username,
      action: 'CALIBRATION_SCHEDULE_APPROVE',
      targetUserId: schedule.client_id,
      targetUsername: client.name,
      details: {
        category: 'schedule',
        clientId: schedule.client_id,
        clientName: client.name,
        scheduleId: schedule.id,
        year: schedule.year,
        itemCount
      }
    });
    return res.json({ ok: true });
  }
);

app.post(
  '/calibration/items/:id/upload',
  requireAuth,
  requirePermission('calibration:report:upload'),
  uploadSchedulePdf,
  async (req, res) => {
    const itemId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo requerido.' });
    }
    if (!isPdfFile(req.file)) {
      return res.status(400).json({ message: 'El archivo no contiene un PDF válido.' });
    }
    const { rows } = await query(
      `SELECT i.id, i.schedule_id, i.asset_id, i.planned_date, i.pdf_path,
              s.client_id, s.status AS schedule_status
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
    if (item.schedule_status !== 'approved') {
      return res.status(409).json({ message: 'Aprueba el cronograma antes de cargar el certificado.' });
    }
    if (item.pdf_path) {
      return res.status(409).json({ message: 'Esta calibración ya tiene un certificado cargado.' });
    }
    if (dateOnlyFromDatabase(item.planned_date) > todayInBogota()) {
      return res.status(409).json({ message: 'El certificado se habilita a partir de la fecha programada.' });
    }

    const dir = path.join(process.cwd(), 'uploads', 'clients', item.client_id, 'calibrations');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = path.join(dir, `calibracion-${item.id}.pdf`);
    await fs.promises.writeFile(filename, req.file.buffer);
    const publicPath = `/${path.join('uploads', 'clients', item.client_id, 'calibrations', `calibracion-${item.id}.pdf`)}`.replace(/\\/g, '/');
    await setCalibrationItemPdf(item.id, publicPath);
    await refreshCalibrationScheduleStatus(item.schedule_id);
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
      `SELECT i.id, i.schedule_id, i.pdf_path, s.client_id
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
      `SELECT i.id, i.schedule_id, i.pdf_path, s.client_id
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
    await refreshCalibrationScheduleStatus(item.schedule_id);
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

function startOdontologyReminderScheduler() {
  if (String(process.env.ODONTOLOGY_REMINDERS_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Recordatorios odontologicos automaticos desactivados.');
    return;
  }

  const intervalMinutes = Math.max(Number(process.env.ODONTOLOGY_REMINDERS_INTERVAL_MINUTES || 30), 5);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const stats = await sendOdontologyAppointmentRemindersForAllClients();
      if (stats.sent || stats.failed) {
        console.log(
          `Recordatorios odontologicos: ${stats.sent} enviados, ${stats.failed} fallidos, ${stats.scanned} revisados.`
        );
      }
    } catch (error) {
      console.error('No se pudieron procesar recordatorios odontologicos automaticos.', error);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 15000);
  setInterval(run, intervalMinutes * 60 * 1000);
}

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
  startOdontologyReminderScheduler();
});
