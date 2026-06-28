import { pool, query } from './db.js';

const ODONTOLOGY_ACCESS_PERMISSIONS = [
  'software:odontologico:access',
  'odontology:access',
  'odontology:patients:manage',
  'odontology:patients:import',
  'odontology:clinical_records:manage',
  'odontology:appointments:manage',
  'odontology:settings:manage',
  'odontology:treatment_plans:manage',
  'odontology:attachments:manage',
  'odontology:inventory:manage',
  'odontology:sterilization:manage',
  'odontology:payments:manage',
  'odontology:prescriptions:manage',
  'odontology:documents:manage',
  'odontology:periodontogram:manage',
  'odontology:reports:view'
];

const ODONTOLOGY_DOCUMENT_TYPES = new Set([
  'cedula_ciudadania',
  'cedula_extranjeria',
  'tarjeta_identidad',
  'registro_civil',
  'pasaporte',
  'permiso_especial',
  'otro'
]);

const ODONTOLOGY_SEX_OPTIONS = new Set(['femenino', 'masculino', 'otro', 'no_especifica']);
const ODONTOLOGY_PATIENT_TYPES = new Set(['particular', 'eps', 'aseguradora', 'convenio', 'otro']);
const ODONTOLOGY_PATIENT_REQUIRED_FIELDS = [
  'documentType',
  'documentNumber',
  'fullName',
  'birthDate',
  'sex',
  'phone',
  'email',
  'address',
  'emergencyContactName',
  'emergencyContactPhone'
];
const ODONTOLOGY_PATIENT_CORE_REQUIRED_FIELDS = new Set([
  'documentType',
  'documentNumber',
  'fullName',
  'birthDate',
  'sex'
]);
const ODONTOLOGY_PATIENT_FIELD_LABELS = {
  documentType: 'tipo de documento',
  documentNumber: 'numero de documento',
  fullName: 'nombre completo',
  birthDate: 'fecha de nacimiento',
  sex: 'sexo',
  phone: 'telefono',
  email: 'correo',
  address: 'direccion',
  emergencyContactName: 'contacto de emergencia',
  emergencyContactPhone: 'telefono de emergencia'
};
const ODONTOLOGY_CATALOG_TYPES = new Set([
  'patient_status',
  'appointment_status',
  'tooth_condition',
  'photo_category',
  'allergy',
  'medical_condition',
  'medication',
  'task_type'
]);

export function hasOdontologyRoleAccess(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return ODONTOLOGY_ACCESS_PERMISSIONS.some((permission) => permissions.has(permission));
}

export function canManageOdontologyPatients(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:patients:manage');
}

export function canImportOdontologyPatients(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:patients:import');
}

export function canManageOdontologyAppointments(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:appointments:manage');
}

export function canManageOdontologyClinicalRecords(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:clinical_records:manage');
}

export function canManageOdontologyOdontogram(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:odontogram:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyPeriodontogram(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:periodontogram:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyConsents(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:consents:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyTreatmentPlans(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:treatment_plans:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyAttachments(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:attachments:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyInventory(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:inventory:manage');
}

export function canManageOdontologySterilization(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:sterilization:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyPayments(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:payments:manage');
}

export function canViewOdontologyFinancialValues(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:financial:view') || permissions.has('odontology:settings:manage');
}

export function canManageOdontologyPrescriptions(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:prescriptions:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologyClinicalDocuments(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:documents:manage') || permissions.has('odontology:clinical_records:manage');
}

export function canViewOdontologyReports(user) {
  if (user?.roles?.includes('superuser')) return true;
  const permissions = new Set(user?.permissions || []);
  return permissions.has('odontology:reports:view') ||
    permissions.has('odontology:settings:manage') ||
    permissions.has('odontology:payments:manage') ||
    permissions.has('odontology:clinical_records:manage');
}

export function canManageOdontologySettings(user) {
  if (user?.roles?.includes('superuser')) return true;
  return (user?.permissions || []).includes('odontology:settings:manage');
}

export async function getClientOdontologyAccess(clientId) {
  const { rows } = await query(
    `SELECT csa.enabled,
            csa.license_status,
            csa.expires_at
     FROM client_software_access csa
     WHERE csa.client_id = $1
       AND csa.suite_key = 'odontologico'`,
    [clientId]
  );
  const row = rows[0];
  if (!row) {
    return { enabled: false, license_status: 'trial', expires_at: null };
  }
  return row;
}

export async function canAccessOdontology({ user, clientId }) {
  if (!clientId) return false;
  if (user?.clientId && user.clientId !== clientId) return false;
  if (!hasOdontologyRoleAccess(user)) return false;
  if (user?.roles?.includes('superuser') && !user.clientId) return true;
  const access = await getClientOdontologyAccess(clientId);
  return Boolean(access.enabled) && !['suspended', 'expired'].includes(access.license_status);
}

export async function ensureOdontologyDefaults(clientId) {
  await query('INSERT INTO odontology_settings (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING', [clientId]);
  await query(
    `INSERT INTO odontology_consent_templates (client_id, title, body, version, is_active)
     SELECT $1,
            'Consentimiento informado odontológico general',
            'Yo, {{signer_name}}, identificado(a) con documento {{signer_document}}, autorizo la atención odontológica del paciente {{patient_name}} identificado con documento {{patient_document}}. Declaro que he recibido información clara sobre el procedimiento {{procedure_name}}, sus beneficios, riesgos, alternativas y posibles complicaciones. Entiendo que puedo realizar preguntas y que debo informar antecedentes, medicamentos, alergias o condiciones relevantes. Autorizo el registro clínico y el manejo de la información conforme a la política de tratamiento de datos del prestador.',
            1,
            TRUE
     WHERE NOT EXISTS (
       SELECT 1 FROM odontology_consent_templates
       WHERE client_id = $1
         AND LOWER(title) = LOWER('Consentimiento informado odontológico general')
     )`,
    [clientId]
  );
  await query(
    `INSERT INTO odontology_consent_templates (client_id, title, body, version, is_active)
     SELECT $1,
            'Autorización tratamiento de datos personales',
            'Yo, {{signer_name}}, identificado(a) con documento {{signer_document}}, autorizo de manera previa, expresa e informada el tratamiento de mis datos personales y datos sensibles en salud, así como los del paciente {{patient_name}} identificado con documento {{patient_document}}, cuando actúo como acudiente o representante. Esta autorización permite recolectar, almacenar, consultar, actualizar, usar, transmitir y conservar la información necesaria para la prestación de servicios odontológicos, gestión de citas, historia clínica, consentimientos, reportes, facturación interna, comunicaciones asistenciales y cumplimiento de obligaciones legales. Declaro que fui informado(a) sobre mis derechos a conocer, actualizar, rectificar, solicitar prueba de autorización, revocar la autorización cuando sea procedente y presentar consultas o reclamos ante el responsable del tratamiento. Entiendo que la información clínica será manejada bajo reserva y medidas de seguridad.',
            1,
            TRUE
     WHERE NOT EXISTS (
       SELECT 1 FROM odontology_consent_templates
       WHERE client_id = $1
         AND LOWER(title) = LOWER('Autorización tratamiento de datos personales')
     )`,
    [clientId]
  );
}

export async function getOdontologySettings(clientId) {
  await ensureOdontologyDefaults(clientId);
  const { rows } = await query('SELECT * FROM odontology_settings WHERE client_id = $1', [clientId]);
  return rows[0];
}

function normalizeOdontologyPatientRequiredFields(value) {
  let rawFields = value;
  if (typeof rawFields === 'string') {
    try {
      rawFields = JSON.parse(rawFields);
    } catch {
      rawFields = [];
    }
  }
  const incomingFields = Array.isArray(rawFields) ? rawFields : ODONTOLOGY_PATIENT_REQUIRED_FIELDS;
  const validFields = new Set(ODONTOLOGY_PATIENT_REQUIRED_FIELDS);
  const fields = new Set(ODONTOLOGY_PATIENT_CORE_REQUIRED_FIELDS);
  incomingFields.forEach((field) => {
    if (validFields.has(field)) fields.add(field);
  });
  return ODONTOLOGY_PATIENT_REQUIRED_FIELDS.filter((field) => fields.has(field));
}

export async function updateOdontologySettings({ clientId, payload }) {
  await ensureOdontologyDefaults(clientId);
  const currentSettings = await getOdontologySettings(clientId);
  const landingPage = requiredText(payload.defaultLandingPage || payload.default_landing_page || 'dashboard');
  const allowedLandingPages = new Set(['dashboard', 'agenda', 'pacientes', 'reportes']);
  if (!allowedLandingPages.has(landingPage)) {
    return { error: 'VALIDATION', message: 'Página inicial odontológica inválida.' };
  }

  const data = {
    allowAllPatientsForDentists: booleanValue(payload.allowAllPatientsForDentists ?? payload.allow_all_patients_for_dentists),
    assistantCanPrefillClinical: booleanValue(payload.assistantCanPrefillClinical ?? payload.assistant_can_prefill_clinical),
    requireDiagnosisBeforeSign: booleanValue(payload.requireDiagnosisBeforeSign ?? payload.require_diagnosis_before_sign),
    requirePlanBeforeSign: booleanValue(payload.requirePlanBeforeSign ?? payload.require_plan_before_sign),
    requireTreatmentPlanSignature: booleanValue(payload.requireTreatmentPlanSignature ?? payload.require_treatment_plan_signature),
    requireAuthorizationByDefault: booleanValue(payload.requireAuthorizationByDefault ?? payload.require_authorization_by_default),
    autoGenerateVisitPdf: booleanValue(payload.autoGenerateVisitPdf ?? payload.auto_generate_visit_pdf),
    blockBiomedUnitsOutOfService: booleanValue(payload.blockBiomedUnitsOutOfService ?? payload.block_biomed_units_out_of_service),
    enforceDentistSchedule: booleanValue(payload.enforceDentistSchedule ?? payload.enforce_dentist_schedule),
    enableTeleconsultation: booleanValue(payload.enableTeleconsultation ?? payload.enable_teleconsultation),
    enablePatientPortal: booleanValue(payload.enablePatientPortal ?? payload.enable_patient_portal),
    enableClinicalTasks: booleanValue(payload.enableClinicalTasks ?? payload.enable_clinical_tasks),
    enableAdminTasks: booleanValue(payload.enableAdminTasks ?? payload.enable_admin_tasks),
    enablePurchaseOrders: booleanValue(payload.enablePurchaseOrders ?? payload.enable_purchase_orders),
    enableWhatsappReminders: booleanValue(payload.enableWhatsappReminders ?? payload.enable_whatsapp_reminders),
    whatsappProvider: sanitizeText(payload.whatsappProvider ?? payload.whatsapp_provider ?? ''),
    whatsappBusinessPhone: sanitizeText(payload.whatsappBusinessPhone ?? payload.whatsapp_business_phone ?? ''),
    whatsappDayBeforeTemplate: sanitizeText(payload.whatsappDayBeforeTemplate ?? payload.whatsapp_day_before_template ?? ''),
    whatsappSameDayTemplate: sanitizeText(payload.whatsappSameDayTemplate ?? payload.whatsapp_same_day_template ?? ''),
    requiredPatientFields: normalizeOdontologyPatientRequiredFields(
      payload.requiredPatientFields ?? payload.required_patient_fields ?? currentSettings?.required_patient_fields
    ),
    defaultLandingPage: landingPage
  };

  if (data.enableWhatsappReminders && (!data.whatsappProvider || !data.whatsappBusinessPhone)) {
    return {
      error: 'VALIDATION',
      message: 'Para activar WhatsApp debes configurar proveedor y número empresarial.'
    };
  }

  const { rows } = await query(
    `UPDATE odontology_settings
     SET allow_all_patients_for_dentists = $2,
         assistant_can_prefill_clinical = $3,
         require_diagnosis_before_sign = $4,
         require_plan_before_sign = $5,
         require_treatment_plan_signature = $6,
         require_authorization_by_default = $7,
         auto_generate_visit_pdf = $8,
         block_biomed_units_out_of_service = $9,
         enforce_dentist_schedule = $10,
         enable_teleconsultation = $11,
         enable_patient_portal = $12,
         enable_clinical_tasks = $13,
         enable_admin_tasks = $14,
         enable_purchase_orders = $15,
         enable_whatsapp_reminders = $16,
         whatsapp_provider = $17,
         whatsapp_business_phone = $18,
         whatsapp_day_before_template = $19,
         whatsapp_same_day_template = $20,
         required_patient_fields = $21::jsonb,
         default_landing_page = $22
     WHERE client_id = $1
     RETURNING *`,
    [
      clientId,
      data.allowAllPatientsForDentists,
      data.assistantCanPrefillClinical,
      data.requireDiagnosisBeforeSign,
      data.requirePlanBeforeSign,
      data.requireTreatmentPlanSignature,
      data.requireAuthorizationByDefault,
      data.autoGenerateVisitPdf,
      data.blockBiomedUnitsOutOfService,
      data.enforceDentistSchedule,
      data.enableTeleconsultation,
      data.enablePatientPortal,
      data.enableClinicalTasks,
      data.enableAdminTasks,
      data.enablePurchaseOrders,
      data.enableWhatsappReminders,
      data.whatsappProvider,
      data.whatsappBusinessPhone,
      data.whatsappDayBeforeTemplate,
      data.whatsappSameDayTemplate,
      JSON.stringify(data.requiredPatientFields),
      data.defaultLandingPage
    ]
  );
  return { settings: rows[0] };
}

export async function listOdontologySites(clientId) {
  const { rows } = await query(
    `SELECT id, client_id, name, address, phone, is_active, created_at, updated_at
     FROM odontology_sites
     WHERE client_id = $1
     ORDER BY is_active DESC, name`,
    [clientId]
  );
  return rows;
}

export async function listOdontologyChairs(clientId) {
  const { rows } = await query(
    `SELECT ch.id,
            ch.client_id,
            ch.site_id,
            s.name AS site_name,
            ch.name,
            ch.code,
            ch.linked_asset_id,
            ch.is_active,
            ch.created_at,
            ch.updated_at
     FROM odontology_chairs ch
     LEFT JOIN odontology_sites s ON s.id = ch.site_id
     WHERE ch.client_id = $1
     ORDER BY ch.is_active DESC, s.name NULLS FIRST, ch.name`,
    [clientId]
  );
  return rows;
}

export async function createOdontologySite({ clientId, payload }) {
  const name = requiredText(payload.name);
  const address = sanitizeText(payload.address);
  const phone = sanitizeText(payload.phone);
  const isActive = payload.isActive === undefined && payload.is_active === undefined
    ? true
    : booleanValue(payload.isActive ?? payload.is_active);

  if (!name) return { error: 'VALIDATION', message: 'Nombre de sede obligatorio.' };
  try {
    const { rows } = await query(
      `INSERT INTO odontology_sites (client_id, name, address, phone, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, name, address, phone, isActive]
    );
    return { site: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe una sede odontológica con ese nombre.' };
    }
    throw error;
  }
}

export async function updateOdontologySite({ clientId, siteId, payload }) {
  const name = requiredText(payload.name);
  const address = sanitizeText(payload.address);
  const phone = sanitizeText(payload.phone);
  const isActive = payload.isActive === undefined && payload.is_active === undefined
    ? true
    : booleanValue(payload.isActive ?? payload.is_active);

  if (!name) return { error: 'VALIDATION', message: 'Nombre de sede obligatorio.' };
  try {
    const { rows } = await query(
      `UPDATE odontology_sites
       SET name = $3,
           address = $4,
           phone = $5,
           is_active = $6
       WHERE client_id = $1
         AND id = $2
       RETURNING *`,
      [clientId, siteId, name, address, phone, isActive]
    );
    if (!rows[0]) return { error: 'NOT_FOUND', message: 'Sede odontológica no encontrada.' };
    return { site: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe una sede odontológica con ese nombre.' };
    }
    throw error;
  }
}

export async function createOdontologyChair({ clientId, payload }) {
  const name = requiredText(payload.name);
  const code = sanitizeText(payload.code);
  const siteId = sanitizeText(payload.siteId || payload.site_id);
  const isActive = payload.isActive === undefined && payload.is_active === undefined
    ? true
    : booleanValue(payload.isActive ?? payload.is_active);

  if (!name) return { error: 'VALIDATION', message: 'Nombre de unidad obligatorio.' };
  if (siteId) {
    const { rows } = await query(
      'SELECT 1 FROM odontology_sites WHERE id = $1 AND client_id = $2 LIMIT 1',
      [siteId, clientId]
    );
    if (!rows.length) return { error: 'VALIDATION', message: 'Sede odontológica no válida.' };
  }

  try {
    const { rows } = await query(
      `INSERT INTO odontology_chairs (client_id, site_id, name, code, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, siteId, name, code, isActive]
    );
    return { chair: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe una unidad odontológica con ese nombre en la sede seleccionada.' };
    }
    throw error;
  }
}

export async function updateOdontologyChair({ clientId, chairId, payload }) {
  const name = requiredText(payload.name);
  const code = sanitizeText(payload.code);
  const siteId = sanitizeText(payload.siteId || payload.site_id);
  const isActive = payload.isActive === undefined && payload.is_active === undefined
    ? true
    : booleanValue(payload.isActive ?? payload.is_active);

  if (!name) return { error: 'VALIDATION', message: 'Nombre de unidad obligatorio.' };
  if (siteId) {
    const { rows } = await query(
      'SELECT 1 FROM odontology_sites WHERE id = $1 AND client_id = $2 LIMIT 1',
      [siteId, clientId]
    );
    if (!rows.length) return { error: 'VALIDATION', message: 'Sede odontológica no válida.' };
  }

  try {
    const { rows } = await query(
      `UPDATE odontology_chairs
       SET site_id = $3,
           name = $4,
           code = $5,
           is_active = $6
       WHERE client_id = $1
         AND id = $2
       RETURNING *`,
      [clientId, chairId, siteId, name, code, isActive]
    );
    if (!rows[0]) return { error: 'NOT_FOUND', message: 'Unidad odontológica no encontrada.' };
    return { chair: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe una unidad odontológica con ese nombre en la sede seleccionada.' };
    }
    throw error;
  }
}

export async function listOdontologyProcedureTypes(clientId) {
  const { rows } = await query(
    `SELECT pt.id,
            pt.client_id,
            COALESCE(po.custom_name, pt.name) AS name,
            COALESCE(po.custom_code, pt.code) AS code,
            COALESCE(po.custom_category, pt.category) AS category,
            COALESCE(po.custom_default_duration_minutes, pt.default_duration_minutes) AS default_duration_minutes,
            COALESCE(po.custom_default_price, pt.default_price) AS default_price,
            COALESCE(po.custom_color, pt.color) AS color,
            COALESCE(po.custom_requires_consent, pt.requires_consent) AS requires_consent,
            pt.is_system,
            CASE
              WHEN pt.client_id IS NULL THEN COALESCE(po.is_active, pt.is_active)
              ELSE pt.is_active
            END AS is_active
     FROM odontology_procedure_types pt
     LEFT JOIN odontology_procedure_type_overrides po
       ON po.procedure_type_id = pt.id
      AND po.client_id = $1
     WHERE pt.client_id IS NULL OR pt.client_id = $1
     ORDER BY is_system DESC, category NULLS LAST, name`,
    [clientId]
  );
  return rows;
}

function decimalOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function validateOdontologyProcedurePayload(payload) {
  const clean = {
    name: requiredText(payload.name),
    code: sanitizeText(payload.code),
    category: sanitizeText(payload.category),
    defaultDurationMinutes: Number(payload.defaultDurationMinutes ?? payload.default_duration_minutes ?? 30),
    defaultPrice: decimalOrNull(payload.defaultPrice ?? payload.default_price),
    color: sanitizeText(payload.color) || '#a64045',
    requiresConsent: booleanValue(payload.requiresConsent ?? payload.requires_consent),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active)
  };
  if (!clean.name) return { ok: false, message: 'Nombre del procedimiento obligatorio.' };
  if (!Number.isFinite(clean.defaultDurationMinutes) || clean.defaultDurationMinutes <= 0) {
    return { ok: false, message: 'La duración debe ser mayor a cero.' };
  }
  clean.defaultDurationMinutes = Math.trunc(clean.defaultDurationMinutes);
  if (clean.defaultDurationMinutes > 720) {
    return { ok: false, message: 'La duración máxima permitida es de 720 minutos.' };
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(clean.color)) {
    return { ok: false, message: 'Color inválido. Usa formato hexadecimal, por ejemplo #a64045.' };
  }
  return { ok: true, data: clean };
}

async function ensureProcedureNameAvailable({ clientId, name, excludeId = null }) {
  const params = [clientId, name.toLowerCase()];
  let exclude = '';
  if (excludeId) {
    params.push(excludeId);
    exclude = `AND pt.id <> $${params.length}`;
  }
  const { rows } = await query(
    `SELECT 1
     FROM odontology_procedure_types pt
     LEFT JOIN odontology_procedure_type_overrides po
       ON po.procedure_type_id = pt.id
      AND po.client_id = $1
     WHERE (pt.client_id IS NULL OR pt.client_id = $1)
       AND LOWER(COALESCE(po.custom_name, pt.name)) = $2
       ${exclude}
     LIMIT 1`,
    params
  );
  return rows.length === 0;
}

export async function createOdontologyProcedureType({ clientId, payload }) {
  const validation = validateOdontologyProcedurePayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const nameAvailable = await ensureProcedureNameAvailable({ clientId, name: data.name });
  if (!nameAvailable) return { error: 'DUPLICATE', message: 'Ya existe un procedimiento con ese nombre.' };

  const { rows } = await query(
    `INSERT INTO odontology_procedure_types (
       client_id, name, code, category, default_duration_minutes, default_price,
       color, requires_consent, is_system, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)
     RETURNING id`,
    [
      clientId,
      data.name,
      data.code,
      data.category,
      data.defaultDurationMinutes,
      data.defaultPrice,
      data.color,
      data.requiresConsent,
      data.isActive
    ]
  );
  const procedures = await listOdontologyProcedureTypes(clientId);
  return { procedure: procedures.find((item) => item.id === rows[0].id) || null };
}

export async function updateOdontologyProcedureType({ clientId, procedureTypeId, payload }) {
  const { rows: currentRows } = await query(
    `SELECT id, client_id, is_system
     FROM odontology_procedure_types
     WHERE id = $1
       AND (client_id IS NULL OR client_id = $2)
     LIMIT 1`,
    [procedureTypeId, clientId]
  );
  const current = currentRows[0];
  if (!current) return { error: 'NOT_FOUND', message: 'Procedimiento odontológico no encontrado.' };

  const validation = validateOdontologyProcedurePayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const nameAvailable = await ensureProcedureNameAvailable({
    clientId,
    name: data.name,
    excludeId: procedureTypeId
  });
  if (!nameAvailable) return { error: 'DUPLICATE', message: 'Ya existe un procedimiento con ese nombre.' };

  if (current.client_id) {
    await query(
      `UPDATE odontology_procedure_types
       SET name = $3,
           code = $4,
           category = $5,
           default_duration_minutes = $6,
           default_price = $7,
           color = $8,
           requires_consent = $9,
           is_active = $10
       WHERE id = $1
         AND client_id = $2`,
      [
        procedureTypeId,
        clientId,
        data.name,
        data.code,
        data.category,
        data.defaultDurationMinutes,
        data.defaultPrice,
        data.color,
        data.requiresConsent,
        data.isActive
      ]
    );
  } else {
    await query(
      `INSERT INTO odontology_procedure_type_overrides (
         client_id, procedure_type_id, custom_name, custom_code, custom_category,
         custom_default_duration_minutes, custom_default_price, custom_color,
         custom_requires_consent, is_active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (client_id, procedure_type_id)
       DO UPDATE SET custom_name = EXCLUDED.custom_name,
                     custom_code = EXCLUDED.custom_code,
                     custom_category = EXCLUDED.custom_category,
                     custom_default_duration_minutes = EXCLUDED.custom_default_duration_minutes,
                     custom_default_price = EXCLUDED.custom_default_price,
                     custom_color = EXCLUDED.custom_color,
                     custom_requires_consent = EXCLUDED.custom_requires_consent,
                     is_active = EXCLUDED.is_active`,
      [
        clientId,
        procedureTypeId,
        data.name,
        data.code,
        data.category,
        data.defaultDurationMinutes,
        data.defaultPrice,
        data.color,
        data.requiresConsent,
        data.isActive
      ]
    );
  }

  const procedures = await listOdontologyProcedureTypes(clientId);
  return { procedure: procedures.find((item) => item.id === procedureTypeId) || null };
}

export async function listOdontologyCatalog(clientId, catalogType = null) {
  const params = [clientId];
  let filter = '';
  if (catalogType) {
    if (!ODONTOLOGY_CATALOG_TYPES.has(catalogType)) return [];
    params.push(catalogType);
    filter = 'AND catalog_type = $2';
  }
  const { rows } = await query(
    `SELECT ci.id,
            ci.client_id,
            ci.catalog_type,
            COALESCE(co.custom_name, ci.name) AS name,
            COALESCE(co.custom_description, ci.description) AS description,
            COALESCE(co.custom_color, ci.color) AS color,
            ci.is_system,
            CASE
              WHEN ci.client_id IS NULL THEN COALESCE(co.is_active, ci.is_active)
              ELSE ci.is_active
            END AS is_active
     FROM odontology_catalog_items ci
     LEFT JOIN odontology_catalog_overrides co
       ON co.catalog_item_id = ci.id
      AND co.client_id = $1
     WHERE (ci.client_id IS NULL OR ci.client_id = $1)
       ${filter}
     ORDER BY ci.catalog_type, ci.is_system DESC, name`,
    params
  );
  return rows;
}

function validateOdontologyCatalogPayload(payload, existingType = null) {
  const clean = {
    catalogType: requiredText(payload.catalogType || payload.catalog_type || existingType),
    name: requiredText(payload.name),
    description: sanitizeText(payload.description),
    color: sanitizeText(payload.color) || '#a64045',
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active)
  };
  if (!clean.catalogType) return { ok: false, message: 'Tipo de catálogo obligatorio.' };
  if (!ODONTOLOGY_CATALOG_TYPES.has(clean.catalogType)) return { ok: false, message: 'Tipo de catálogo inválido.' };
  if (!clean.name) return { ok: false, message: 'Nombre obligatorio.' };
  if (!/^#[0-9a-fA-F]{6}$/.test(clean.color)) {
    return { ok: false, message: 'Color inválido. Usa formato hexadecimal, por ejemplo #a64045.' };
  }
  return { ok: true, data: clean };
}

async function ensureCatalogNameAvailable({ clientId, catalogType, name, excludeId = null }) {
  const params = [clientId, catalogType, name.toLowerCase()];
  let exclude = '';
  if (excludeId) {
    params.push(excludeId);
    exclude = `AND ci.id <> $${params.length}`;
  }
  const { rows } = await query(
    `SELECT 1
     FROM odontology_catalog_items ci
     LEFT JOIN odontology_catalog_overrides co
       ON co.catalog_item_id = ci.id
      AND co.client_id = $1
     WHERE (ci.client_id IS NULL OR ci.client_id = $1)
       AND ci.catalog_type = $2
       AND LOWER(COALESCE(co.custom_name, ci.name)) = $3
       ${exclude}
     LIMIT 1`,
    params
  );
  return rows.length === 0;
}

export async function createOdontologyCatalogItem({ clientId, payload }) {
  const validation = validateOdontologyCatalogPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const nameAvailable = await ensureCatalogNameAvailable({
    clientId,
    catalogType: data.catalogType,
    name: data.name
  });
  if (!nameAvailable) return { error: 'DUPLICATE', message: 'Ya existe un elemento con ese nombre en el catálogo.' };

  const { rows } = await query(
    `INSERT INTO odontology_catalog_items (client_id, catalog_type, name, description, color, is_system, is_active)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6)
     RETURNING id`,
    [clientId, data.catalogType, data.name, data.description, data.color, data.isActive]
  );
  const catalog = await listOdontologyCatalog(clientId, data.catalogType);
  return { item: catalog.find((item) => item.id === rows[0].id) || null };
}

export async function updateOdontologyCatalogItem({ clientId, itemId, payload }) {
  const { rows: currentRows } = await query(
    `SELECT id, client_id, catalog_type, is_system
     FROM odontology_catalog_items
     WHERE id = $1
       AND (client_id IS NULL OR client_id = $2)
     LIMIT 1`,
    [itemId, clientId]
  );
  const current = currentRows[0];
  if (!current) return { error: 'NOT_FOUND', message: 'Elemento de catálogo no encontrado.' };

  const validation = validateOdontologyCatalogPayload(payload, current.catalog_type);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  if (data.catalogType !== current.catalog_type) {
    return { error: 'VALIDATION', message: 'No se puede cambiar el tipo del catálogo.' };
  }

  const nameAvailable = await ensureCatalogNameAvailable({
    clientId,
    catalogType: data.catalogType,
    name: data.name,
    excludeId: itemId
  });
  if (!nameAvailable) return { error: 'DUPLICATE', message: 'Ya existe un elemento con ese nombre en el catálogo.' };

  if (current.client_id) {
    await query(
      `UPDATE odontology_catalog_items
       SET name = $3,
           description = $4,
           color = $5,
           is_active = $6
       WHERE id = $1
         AND client_id = $2`,
      [itemId, clientId, data.name, data.description, data.color, data.isActive]
    );
  } else {
    await query(
      `INSERT INTO odontology_catalog_overrides (
         client_id, catalog_item_id, custom_name, custom_description, custom_color, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id, catalog_item_id)
       DO UPDATE SET custom_name = EXCLUDED.custom_name,
                     custom_description = EXCLUDED.custom_description,
                     custom_color = EXCLUDED.custom_color,
                     is_active = EXCLUDED.is_active`,
      [clientId, itemId, data.name, data.description, data.color, data.isActive]
    );
  }

  const catalog = await listOdontologyCatalog(clientId, current.catalog_type);
  return { item: catalog.find((item) => item.id === itemId) || null };
}

function sanitizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function requiredText(value) {
  return String(value ?? '').trim();
}

function booleanValue(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function normalizeTime(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function addMinutesToTime(time, minutesToAdd) {
  const normalized = normalizeTime(time);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  const total = hours * 60 + minutes + Number(minutesToAdd || 0);
  if (total <= 0 || total >= 24 * 60) return null;
  const endHours = Math.floor(total / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;
}

function calculateAge(birthDate) {
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

export function validateOdontologyPatientPayload(payload, options = {}) {
  const requiredFields = normalizeOdontologyPatientRequiredFields(options.requiredFields);
  const clean = {
    documentType: requiredText(payload.documentType || payload.document_type),
    documentNumber: requiredText(payload.documentNumber || payload.document_number),
    fullName: requiredText(payload.fullName || payload.full_name),
    birthDate: requiredText(payload.birthDate || payload.birth_date),
    sex: requiredText(payload.sex),
    phone: requiredText(payload.phone),
    email: requiredText(payload.email),
    address: requiredText(payload.address),
    emergencyContactName: requiredText(payload.emergencyContactName || payload.emergency_contact_name),
    emergencyContactPhone: requiredText(payload.emergencyContactPhone || payload.emergency_contact_phone),
    patientType: requiredText(payload.patientType || payload.patient_type || 'particular'),
    payerName: sanitizeText(payload.payerName || payload.payer_name),
    authorizationRequired: booleanValue(payload.authorizationRequired || payload.authorization_required),
    status: requiredText(payload.status || 'Activo'),
    guardianName: sanitizeText(payload.guardianName || payload.guardian_name),
    guardianDocumentType: sanitizeText(payload.guardianDocumentType || payload.guardian_document_type),
    guardianDocumentNumber: sanitizeText(payload.guardianDocumentNumber || payload.guardian_document_number),
    guardianPhone: sanitizeText(payload.guardianPhone || payload.guardian_phone),
    guardianRelationship: sanitizeText(payload.guardianRelationship || payload.guardian_relationship),
    allergies: sanitizeText(payload.allergies),
    medicalConditions: sanitizeText(payload.medicalConditions || payload.medical_conditions),
    currentMedications: sanitizeText(payload.currentMedications || payload.current_medications),
    pregnancy: booleanValue(payload.pregnancy),
    bleedingRisk: booleanValue(payload.bleedingRisk || payload.bleeding_risk),
    diabetes: booleanValue(payload.diabetes),
    hypertension: booleanValue(payload.hypertension),
    pacemaker: booleanValue(payload.pacemaker),
    importantObservation: sanitizeText(payload.importantObservation || payload.important_observation)
  };

  const missing = [];
  requiredFields.forEach((field) => {
    if (!clean[field]) missing.push(ODONTOLOGY_PATIENT_FIELD_LABELS[field] || field);
  });
  if (missing.length) {
    return { ok: false, message: `Campos obligatorios: ${missing.join(', ')}.` };
  }

  if (!ODONTOLOGY_DOCUMENT_TYPES.has(clean.documentType)) {
    return { ok: false, message: 'Tipo de documento inválido.' };
  }
  if (clean.guardianDocumentType && !ODONTOLOGY_DOCUMENT_TYPES.has(clean.guardianDocumentType)) {
    return { ok: false, message: 'Tipo de documento del acudiente inválido.' };
  }
  if (!ODONTOLOGY_SEX_OPTIONS.has(clean.sex)) {
    return { ok: false, message: 'Sexo inválido.' };
  }
  if (!ODONTOLOGY_PATIENT_TYPES.has(clean.patientType)) {
    return { ok: false, message: 'Tipo de paciente inválido.' };
  }
  if (clean.email && !clean.email.includes('@')) {
    return { ok: false, message: 'Correo inválido.' };
  }

  const age = calculateAge(clean.birthDate);
  if (age === null || age < 0) {
    return { ok: false, message: 'Fecha de nacimiento inválida.' };
  }
  if (age < 18 && (!clean.guardianName || !clean.guardianPhone || !clean.guardianRelationship)) {
    return { ok: false, message: 'El acudiente es obligatorio para pacientes menores de edad.' };
  }

  return { ok: true, data: clean };
}

async function nextOdontologyPatientCode(clientId) {
  await query(
    `INSERT INTO odontology_patient_counters (client_id, next_number)
     VALUES ($1, 1)
     ON CONFLICT (client_id) DO NOTHING`,
    [clientId]
  );
  const { rows } = await query(
    `UPDATE odontology_patient_counters
     SET next_number = next_number + 1
     WHERE client_id = $1
     RETURNING next_number - 1 AS number`,
    [clientId]
  );
  return `ODO-${String(rows[0].number).padStart(5, '0')}`;
}

function patientSelectSql() {
  return `SELECT p.*,
                 EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date))::int AS age,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_patients p
          LEFT JOIN users cu ON cu.id = p.created_by
          LEFT JOIN users uu ON uu.id = p.updated_by`;
}

export async function listOdontologyPatients({ clientId, search = '', status = '' }) {
  const params = [clientId];
  const filters = ['p.client_id = $1'];
  const cleanSearch = String(search || '').trim().toLowerCase();
  const cleanStatus = String(status || '').trim();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(p.internal_code) LIKE $${params.length}
      OR LOWER(COALESCE(p.phone, '')) LIKE $${params.length}
      OR LOWER(COALESCE(p.email, '')) LIKE $${params.length}
    )`);
  }
  if (cleanStatus) {
    params.push(cleanStatus);
    filters.push(`p.status = $${params.length}`);
  }
  const { rows } = await query(
    `${patientSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY p.created_at DESC, p.full_name
     LIMIT 250`,
    params
  );
  return rows;
}

export async function getOdontologyPatientById({ clientId, patientId }) {
  const { rows } = await query(
    `${patientSelectSql()}
     WHERE p.client_id = $1
       AND p.id = $2
     LIMIT 1`,
    [clientId, patientId]
  );
  return rows[0] || null;
}

export async function createOdontologyPatient({ clientId, payload, actorUserId, requiredFields = null }) {
  const settings = requiredFields ? null : await getOdontologySettings(clientId);
  const validation = validateOdontologyPatientPayload(payload, {
    requiredFields: requiredFields || settings?.required_patient_fields
  });
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const internalCode = await nextOdontologyPatientCode(clientId);
  try {
    const { rows } = await query(
      `INSERT INTO odontology_patients (
         client_id, internal_code, document_type, document_number, full_name, birth_date, sex,
         phone, email, address, emergency_contact_name, emergency_contact_phone, patient_type,
         payer_name, authorization_required, status, guardian_name, guardian_document_type,
         guardian_document_number, guardian_phone, guardian_relationship, allergies,
         medical_conditions, current_medications, pregnancy, bleeding_risk, diabetes,
         hypertension, pacemaker, important_observation, created_by, updated_by
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$31
       )
       RETURNING *`,
      [
        clientId,
        internalCode,
        data.documentType,
        data.documentNumber,
        data.fullName,
        data.birthDate,
        data.sex,
        data.phone,
        data.email,
        data.address,
        data.emergencyContactName,
        data.emergencyContactPhone,
        data.patientType,
        data.payerName,
        data.authorizationRequired,
        data.status,
        data.guardianName,
        data.guardianDocumentType,
        data.guardianDocumentNumber,
        data.guardianPhone,
        data.guardianRelationship,
        data.allergies,
        data.medicalConditions,
        data.currentMedications,
        data.pregnancy,
        data.bleedingRisk,
        data.diabetes,
        data.hypertension,
        data.pacemaker,
        data.importantObservation,
        actorUserId
      ]
    );
    return { patient: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un paciente con este documento.' };
    }
    throw error;
  }
}

export async function updateOdontologyPatient({ clientId, patientId, payload, actorUserId }) {
  const settings = await getOdontologySettings(clientId);
  const validation = validateOdontologyPatientPayload(payload, {
    requiredFields: settings?.required_patient_fields
  });
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  try {
    const { rows } = await query(
      `UPDATE odontology_patients
       SET document_type = $3,
           document_number = $4,
           full_name = $5,
           birth_date = $6,
           sex = $7,
           phone = $8,
           email = $9,
           address = $10,
           emergency_contact_name = $11,
           emergency_contact_phone = $12,
           patient_type = $13,
           payer_name = $14,
           authorization_required = $15,
           status = $16,
           guardian_name = $17,
           guardian_document_type = $18,
           guardian_document_number = $19,
           guardian_phone = $20,
           guardian_relationship = $21,
           allergies = $22,
           medical_conditions = $23,
           current_medications = $24,
           pregnancy = $25,
           bleeding_risk = $26,
           diabetes = $27,
           hypertension = $28,
           pacemaker = $29,
           important_observation = $30,
           updated_by = $31
       WHERE client_id = $1
         AND id = $2
       RETURNING *`,
      [
        clientId,
        patientId,
        data.documentType,
        data.documentNumber,
        data.fullName,
        data.birthDate,
        data.sex,
        data.phone,
        data.email,
        data.address,
        data.emergencyContactName,
        data.emergencyContactPhone,
        data.patientType,
        data.payerName,
        data.authorizationRequired,
        data.status,
        data.guardianName,
        data.guardianDocumentType,
        data.guardianDocumentNumber,
        data.guardianPhone,
        data.guardianRelationship,
        data.allergies,
        data.medicalConditions,
        data.currentMedications,
        data.pregnancy,
        data.bleedingRisk,
        data.diabetes,
        data.hypertension,
        data.pacemaker,
        data.importantObservation,
        actorUserId
      ]
    );
    if (!rows[0]) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
    return { patient: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un paciente con este documento.' };
    }
    throw error;
  }
}

export async function listOdontologyDentists(clientId) {
  const { rows } = await query(
    `SELECT DISTINCT u.id,
            u.display_name,
            u.email,
            u.is_active
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.client_id = $1
       AND u.is_active = TRUE
       AND r.name IN ('odontologo', 'admin_odontologia')
     ORDER BY u.display_name`,
    [clientId]
  );
  return rows;
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function dayOfWeekFromDate(value) {
  const cleanDate = requiredText(value);
  const date = new Date(`${cleanDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCDay();
}

async function validateDentistForClient(clientId, dentistUserId) {
  const { rows } = await query(
    `SELECT 1
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND u.client_id = $2
       AND u.is_active = TRUE
       AND r.name IN ('odontologo', 'admin_odontologia')
     LIMIT 1`,
    [dentistUserId, clientId]
  );
  return Boolean(rows.length);
}

export async function listOdontologyDentistSchedules({ clientId, dentistUserId = '' }) {
  const params = [clientId];
  const filters = ['ds.client_id = $1'];
  const cleanDentistUserId = String(dentistUserId || '').trim();
  if (cleanDentistUserId) {
    params.push(cleanDentistUserId);
    filters.push(`ds.dentist_user_id = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT ds.*,
            u.display_name AS dentist_name
     FROM odontology_dentist_schedules ds
     JOIN users u ON u.id = ds.dentist_user_id
     WHERE ${filters.join(' AND ')}
     ORDER BY u.display_name, ds.day_of_week, ds.start_time`,
    params
  );
  return rows;
}

function validateDentistSchedulesPayload(payload) {
  const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];
  const cleanSchedules = [];

  for (const [index, item] of schedules.entries()) {
    const dayOfWeek = Number(item.dayOfWeek ?? item.day_of_week);
    const startTime = normalizeTime(item.startTime ?? item.start_time);
    const endTime = normalizeTime(item.endTime ?? item.end_time);
    const isActive = item.isActive ?? item.is_active ?? true;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, message: `Día inválido en horario ${index + 1}.` };
    }
    if (!startTime || !endTime) {
      return { ok: false, message: `Hora inválida en horario ${index + 1}.` };
    }
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return { ok: false, message: `La hora final debe ser mayor que la inicial en horario ${index + 1}.` };
    }
    cleanSchedules.push({
      dayOfWeek,
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      isActive: booleanValue(isActive)
    });
  }

  const activeByDay = new Map();
  for (const schedule of cleanSchedules.filter((item) => item.isActive)) {
    const rows = activeByDay.get(schedule.dayOfWeek) || [];
    for (const existing of rows) {
      if (schedule.startMinutes < existing.endMinutes && schedule.endMinutes > existing.startMinutes) {
        return { ok: false, message: 'Hay horarios cruzados para el mismo odontólogo y día.' };
      }
    }
    rows.push(schedule);
    activeByDay.set(schedule.dayOfWeek, rows);
  }

  return { ok: true, schedules: cleanSchedules };
}

export async function replaceOdontologyDentistSchedules({ clientId, dentistUserId, payload, actorUserId }) {
  const cleanDentistUserId = requiredText(dentistUserId);
  if (!cleanDentistUserId) return { error: 'VALIDATION', message: 'Odontólogo obligatorio.' };
  if (!(await validateDentistForClient(clientId, cleanDentistUserId))) {
    return { error: 'VALIDATION', message: 'Odontólogo no válido para este cliente.' };
  }
  const validation = validateDentistSchedulesPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM odontology_dentist_schedules WHERE client_id = $1 AND dentist_user_id = $2',
      [clientId, cleanDentistUserId]
    );
    const inserted = [];
    for (const schedule of validation.schedules) {
      const { rows } = await client.query(
        `INSERT INTO odontology_dentist_schedules (
           client_id, dentist_user_id, day_of_week, start_time, end_time,
           is_active, created_by, updated_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
         RETURNING *`,
        [
          clientId,
          cleanDentistUserId,
          schedule.dayOfWeek,
          schedule.startTime,
          schedule.endTime,
          schedule.isActive,
          actorUserId
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
    return { schedules: inserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateOdontologyAppointmentPayload(payload) {
  const clean = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    dentistUserId: requiredText(payload.dentistUserId || payload.dentist_user_id),
    procedureTypeId: sanitizeText(payload.procedureTypeId || payload.procedure_type_id),
    treatmentPlanId: sanitizeText(payload.treatmentPlanId || payload.treatment_plan_id),
    treatmentPlanItemId: sanitizeText(payload.treatmentPlanItemId || payload.treatment_plan_item_id),
    siteId: sanitizeText(payload.siteId || payload.site_id),
    chairId: sanitizeText(payload.chairId || payload.chair_id),
    scheduledDate: requiredText(payload.scheduledDate || payload.scheduled_date),
    startTime: normalizeTime(payload.startTime || payload.start_time),
    durationMinutes: Number(payload.durationMinutes || payload.duration_minutes || 30),
    status: requiredText(payload.status || 'Programada'),
    notes: sanitizeText(payload.notes),
    cancellationReason: sanitizeText(payload.cancellationReason || payload.cancellation_reason)
  };

  const missing = [];
  if (!clean.patientId) missing.push('paciente');
  if (!clean.dentistUserId) missing.push('odontólogo');
  if (!clean.scheduledDate) missing.push('fecha');
  if (!clean.startTime) missing.push('hora inicial');
  if (missing.length) {
    return { ok: false, message: `Campos obligatorios: ${missing.join(', ')}.` };
  }

  const date = new Date(`${clean.scheduledDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: 'Fecha de cita inválida.' };
  }
  if (!Number.isFinite(clean.durationMinutes) || clean.durationMinutes < 5 || clean.durationMinutes > 600) {
    return { ok: false, message: 'La duración debe estar entre 5 y 600 minutos.' };
  }
  clean.endTime = addMinutesToTime(clean.startTime, clean.durationMinutes);
  if (!clean.endTime) {
    return { ok: false, message: 'La hora final debe quedar dentro del mismo día.' };
  }
  return { ok: true, data: clean };
}

async function validateAppointmentRelations(clientId, data) {
  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return 'Paciente no encontrado para este cliente.';

  if (!(await validateDentistForClient(clientId, data.dentistUserId))) return 'Odontólogo no válido para este cliente.';

  if (data.siteId) {
    const { rows } = await query(
      'SELECT 1 FROM odontology_sites WHERE id = $1 AND client_id = $2 AND is_active = TRUE LIMIT 1',
      [data.siteId, clientId]
    );
    if (!rows.length) return 'Sede odontológica no válida.';
  }

  if (data.chairId) {
    const { rows } = await query(
      `SELECT 1
       FROM odontology_chairs
       WHERE id = $1
         AND client_id = $2
         AND is_active = TRUE
         AND ($3::uuid IS NULL OR site_id = $3)
       LIMIT 1`,
      [data.chairId, clientId, data.siteId]
    );
    if (!rows.length) return 'Unidad odontológica no válida para la sede seleccionada.';
  }

  if (data.procedureTypeId) {
    const { rows } = await query(
      `SELECT 1
       FROM odontology_procedure_types
       WHERE id = $1
         AND (client_id IS NULL OR client_id = $2)
         AND is_active = TRUE
       LIMIT 1`,
      [data.procedureTypeId, clientId]
    );
    if (!rows.length) return 'Procedimiento no válido.';
  }

  if (data.treatmentPlanId) {
    const settings = await getOdontologySettings(clientId);
    const { rows: planRows } = await query(
      `SELECT id, status, accepted_signature_path
       FROM odontology_treatment_plans
       WHERE id = $1
         AND client_id = $2
         AND patient_id = $3
       LIMIT 1`,
      [data.treatmentPlanId, clientId, data.patientId]
    );
    const plan = planRows[0];
    if (!plan) return 'El plan de tratamiento no corresponde al paciente.';
    if (!['accepted', 'in_progress'].includes(plan.status)) {
      return 'Solo se pueden programar citas desde planes aceptados.';
    }
    if (settings?.require_treatment_plan_signature && !plan.accepted_signature_path) {
      return 'El plan requiere firma de aceptación antes de programar citas.';
    }
  }

  if (data.treatmentPlanItemId) {
    if (!data.treatmentPlanId) return 'Selecciona primero el plan de tratamiento.';
    const { rows: itemRows } = await query(
      `SELECT 1
       FROM odontology_treatment_plan_items
       WHERE id = $1
         AND client_id = $2
         AND treatment_plan_id = $3
       LIMIT 1`,
      [data.treatmentPlanItemId, clientId, data.treatmentPlanId]
    );
    if (!itemRows.length) return 'El procedimiento no pertenece al plan seleccionado.';
  }

  return null;
}

async function validateAppointmentWithinDentistSchedule(clientId, data) {
  const settings = await getOdontologySettings(clientId);
  if (!settings?.enforce_dentist_schedule) return null;

  const dayOfWeek = dayOfWeekFromDate(data.scheduledDate);
  if (dayOfWeek === null) return 'Fecha de cita inválida.';

  const { rows: coveringRows } = await query(
    `SELECT 1
     FROM odontology_dentist_schedules
     WHERE client_id = $1
       AND dentist_user_id = $2
       AND day_of_week = $3
       AND is_active = TRUE
       AND start_time <= $4::time
       AND end_time >= $5::time
     LIMIT 1`,
    [clientId, data.dentistUserId, dayOfWeek, data.startTime, data.endTime]
  );
  if (coveringRows.length) return null;

  const { rows: dayRows } = await query(
    `SELECT start_time, end_time
     FROM odontology_dentist_schedules
     WHERE client_id = $1
       AND dentist_user_id = $2
       AND day_of_week = $3
       AND is_active = TRUE
     ORDER BY start_time`,
    [clientId, data.dentistUserId, dayOfWeek]
  );
  if (!dayRows.length) {
    return 'El odontólogo no tiene horario activo para la fecha seleccionada.';
  }
  const available = dayRows.map((row) => `${String(row.start_time).slice(0, 5)}-${String(row.end_time).slice(0, 5)}`).join(', ');
  return `La cita está fuera del horario del odontólogo para ese día. Horarios disponibles: ${available}.`;
}

async function findAppointmentConflict(clientId, data, ignoreAppointmentId = null) {
  const params = [
    clientId,
    data.scheduledDate,
    data.startTime,
    data.endTime,
    ignoreAppointmentId,
    data.dentistUserId
  ];
  const { rows: dentistRows } = await query(
    `SELECT a.id, p.full_name AS patient_name
     FROM odontology_appointments a
     JOIN odontology_patients p ON p.id = a.patient_id
     WHERE a.client_id = $1
       AND a.scheduled_date = $2
       AND a.start_time < $4::time
       AND a.end_time > $3::time
       AND ($5::uuid IS NULL OR a.id <> $5::uuid)
       AND a.status NOT IN ('Cancelada', 'No asistió')
       AND a.dentist_user_id = $6
     LIMIT 1`,
    params
  );
  if (dentistRows.length) {
    return `El odontólogo ya tiene una cita cruzada con ${dentistRows[0].patient_name}.`;
  }

  if (!data.chairId) return null;
  const { rows: chairRows } = await query(
    `SELECT a.id, p.full_name AS patient_name
     FROM odontology_appointments a
     JOIN odontology_patients p ON p.id = a.patient_id
     WHERE a.client_id = $1
       AND a.scheduled_date = $2
       AND a.start_time < $4::time
       AND a.end_time > $3::time
       AND ($5::uuid IS NULL OR a.id <> $5::uuid)
       AND a.status NOT IN ('Cancelada', 'No asistió')
       AND a.chair_id = $6
     LIMIT 1`,
    [clientId, data.scheduledDate, data.startTime, data.endTime, ignoreAppointmentId, data.chairId]
  );
  if (chairRows.length) {
    return `La unidad odontológica ya está ocupada con ${chairRows[0].patient_name}.`;
  }

  return null;
}

async function consumeAppointmentInventoryTx(client, { clientId, appointment, actorUserId }) {
  if (appointment.status !== 'Atendida' || !appointment.procedure_type_id) return [];

  const { rows: existingRows } = await client.query(
    `SELECT 1
     FROM odontology_appointment_inventory_consumptions
     WHERE client_id = $1
       AND appointment_id = $2
     LIMIT 1`,
    [clientId, appointment.id]
  );
  if (existingRows.length) return [];

  const { rows: kitRows } = await client.query(
    `SELECT pki.id,
            pki.item_id,
            pki.quantity,
            ii.name AS item_name,
            ii.unit
     FROM odontology_procedure_inventory_items pki
     JOIN odontology_inventory_items ii ON ii.id = pki.item_id
     WHERE pki.client_id = $1
       AND pki.procedure_type_id = $2
       AND pki.is_active = TRUE
       AND ii.is_active = TRUE
     ORDER BY ii.name`,
    [clientId, appointment.procedure_type_id]
  );
  if (!kitRows.length) return [];

  const consumptions = [];
  for (const kitItem of kitRows) {
    const quantity = Number(kitItem.quantity || 0);
    const { rows: itemRows } = await client.query(
      `SELECT id, name, current_stock, unit
       FROM odontology_inventory_items
       WHERE client_id = $1
         AND id = $2
       FOR UPDATE`,
      [clientId, kitItem.item_id]
    );
    const item = itemRows[0];
    if (!item) {
      const error = new Error(`Insumo no encontrado para consumo automático: ${kitItem.item_name}.`);
      error.code = 'ODONTOLOGY_STOCK_ERROR';
      throw error;
    }
    const currentStock = Number(item.current_stock || 0);
    const nextStock = currentStock - quantity;
    if (nextStock < 0) {
      const error = new Error(`Stock insuficiente para ${item.name}. Disponible: ${currentStock} ${item.unit || ''}. Requiere: ${quantity} ${item.unit || ''}.`);
      error.code = 'ODONTOLOGY_STOCK_ERROR';
      throw error;
    }

    const { rows: movementRows } = await client.query(
      `INSERT INTO odontology_inventory_movements (
         client_id, item_id, movement_type, quantity, movement_date, reason,
         reference, unit_cost, stock_after, created_by
       )
       VALUES ($1,$2,'exit',$3,$4,$5,$6,NULL,$7,$8)
       RETURNING id`,
      [
        clientId,
        item.id,
        quantity,
        appointment.scheduled_date,
        'Consumo automático por cita odontológica atendida',
        `Cita ${appointment.id}`,
        nextStock,
        actorUserId
      ]
    );

    await client.query(
      `UPDATE odontology_inventory_items
       SET current_stock = $3,
           updated_by = $4
       WHERE client_id = $1
         AND id = $2`,
      [clientId, item.id, nextStock, actorUserId]
    );

    const { rows: consumptionRows } = await client.query(
      `INSERT INTO odontology_appointment_inventory_consumptions (
         client_id, appointment_id, procedure_inventory_item_id, item_id,
         movement_id, quantity, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        clientId,
        appointment.id,
        kitItem.id,
        item.id,
        movementRows[0].id,
        quantity,
        actorUserId
      ]
    );
    consumptions.push({
      id: consumptionRows[0].id,
      item_id: item.id,
      item_name: item.name,
      quantity,
      stock_after: nextStock,
      movement_id: movementRows[0].id
    });
  }
  return consumptions;
}

async function recalculateTreatmentPlanProgressTx(client, { clientId, treatmentPlanId, treatmentPlanItemId, actorUserId }) {
  if (!treatmentPlanId) return null;

  let updatedItem = null;
  if (treatmentPlanItemId) {
    const { rows: itemRows } = await client.query(
      `SELECT id, treatment_plan_id, estimated_sessions, status
       FROM odontology_treatment_plan_items
       WHERE client_id = $1
         AND treatment_plan_id = $2
         AND id = $3
       FOR UPDATE`,
      [clientId, treatmentPlanId, treatmentPlanItemId]
    );
    const item = itemRows[0];
    if (item && item.status !== 'cancelled') {
      const { rows: attendedRows } = await client.query(
        `SELECT COUNT(*)::int AS attended_sessions
         FROM odontology_appointments
         WHERE client_id = $1
           AND treatment_plan_id = $2
           AND treatment_plan_item_id = $3
           AND status = 'Atendida'`,
        [clientId, treatmentPlanId, treatmentPlanItemId]
      );
      const attendedSessions = Number(attendedRows[0]?.attended_sessions || 0);
      const estimatedSessions = Math.max(1, Number(item.estimated_sessions || 1));
      const nextItemStatus = attendedSessions <= 0
        ? 'pending'
        : attendedSessions >= estimatedSessions
          ? 'completed'
          : 'in_progress';

      const { rows: updatedItemRows } = await client.query(
        `UPDATE odontology_treatment_plan_items
         SET status = $4
         WHERE client_id = $1
           AND treatment_plan_id = $2
           AND id = $3
           AND status <> 'cancelled'
         RETURNING id, status`,
        [clientId, treatmentPlanId, treatmentPlanItemId, nextItemStatus]
      );
      updatedItem = {
        id: updatedItemRows[0]?.id || treatmentPlanItemId,
        status: updatedItemRows[0]?.status || nextItemStatus,
        attendedSessions,
        estimatedSessions
      };
    }
  }

  const { rows: planRows } = await client.query(
    `SELECT status
     FROM odontology_treatment_plans
     WHERE client_id = $1
       AND id = $2
     FOR UPDATE`,
    [clientId, treatmentPlanId]
  );
  const plan = planRows[0];
  if (!plan || ['draft', 'proposed', 'cancelled'].includes(plan.status)) {
    return { updatedItem, planStatus: plan?.status || null };
  }

  const { rows: summaryRows } = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS active_total,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_total,
       COUNT(*) FILTER (WHERE status IN ('in_progress', 'completed'))::int AS started_total
     FROM odontology_treatment_plan_items
     WHERE client_id = $1
       AND treatment_plan_id = $2`,
    [clientId, treatmentPlanId]
  );
  const summary = summaryRows[0] || {};
  const activeTotal = Number(summary.active_total || 0);
  const completedTotal = Number(summary.completed_total || 0);
  const startedTotal = Number(summary.started_total || 0);
  const nextPlanStatus = activeTotal > 0 && completedTotal === activeTotal
    ? 'completed'
    : startedTotal > 0
      ? 'in_progress'
      : ['in_progress', 'completed'].includes(plan.status)
        ? 'accepted'
        : plan.status;

  if (nextPlanStatus !== plan.status) {
    await client.query(
      `UPDATE odontology_treatment_plans
       SET status = $3,
           updated_by = $4
       WHERE client_id = $1
         AND id = $2`,
      [clientId, treatmentPlanId, nextPlanStatus, actorUserId]
    );
  }

  return {
    updatedItem,
    planStatus: nextPlanStatus,
    activeTotal,
    completedTotal,
    startedTotal
  };
}

function appointmentSelectSql() {
  return `SELECT a.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 p.phone AS patient_phone,
                 p.email AS patient_email,
                 u.display_name AS dentist_name,
                 s.name AS site_name,
                 ch.name AS chair_name,
                 ch.code AS chair_code,
                 pt.name AS procedure_name,
                 pt.color AS procedure_color,
                 tpl.title AS treatment_plan_title,
                 tpli.procedure_name AS treatment_plan_item_name,
                 tpli.tooth_number AS treatment_plan_item_tooth_number,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_appointments a
          JOIN odontology_patients p ON p.id = a.patient_id
          JOIN users u ON u.id = a.dentist_user_id
          LEFT JOIN odontology_sites s ON s.id = a.site_id
          LEFT JOIN odontology_chairs ch ON ch.id = a.chair_id
          LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
          LEFT JOIN odontology_treatment_plans tpl ON tpl.id = a.treatment_plan_id
          LEFT JOIN odontology_treatment_plan_items tpli ON tpli.id = a.treatment_plan_item_id
          LEFT JOIN users cu ON cu.id = a.created_by
          LEFT JOIN users uu ON uu.id = a.updated_by`;
}

export async function listOdontologyAppointments({
  clientId,
  date = '',
  dateFrom = '',
  dateTo = '',
  status = '',
  dentistId = '',
  patientId = '',
  siteId = '',
  chairId = '',
  search = ''
}) {
  const params = [clientId];
  const filters = ['a.client_id = $1'];
  const cleanDate = String(date || '').trim();
  const cleanDateFrom = String(dateFrom || '').trim();
  const cleanDateTo = String(dateTo || '').trim();
  const cleanStatus = String(status || '').trim();
  const cleanDentistId = String(dentistId || '').trim();
  const cleanPatientId = String(patientId || '').trim();
  const cleanSiteId = String(siteId || '').trim();
  const cleanChairId = String(chairId || '').trim();
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanDate) {
    params.push(cleanDate);
    filters.push(`a.scheduled_date = $${params.length}`);
  } else {
    if (cleanDateFrom) {
      params.push(cleanDateFrom);
      filters.push(`a.scheduled_date >= $${params.length}::date`);
    }
    if (cleanDateTo) {
      params.push(cleanDateTo);
      filters.push(`a.scheduled_date <= $${params.length}::date`);
    }
  }
  if (cleanStatus) {
    params.push(cleanStatus);
    filters.push(`a.status = $${params.length}`);
  }
  if (cleanDentistId) {
    params.push(cleanDentistId);
    filters.push(`a.dentist_user_id = $${params.length}`);
  }
  if (cleanPatientId) {
    params.push(cleanPatientId);
    filters.push(`a.patient_id = $${params.length}`);
  }
  if (cleanSiteId) {
    params.push(cleanSiteId);
    filters.push(`a.site_id = $${params.length}`);
  }
  if (cleanChairId) {
    params.push(cleanChairId);
    filters.push(`a.chair_id = $${params.length}`);
  }
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(p.internal_code) LIKE $${params.length}
      OR LOWER(COALESCE(pt.name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(tpl.title, '')) LIKE $${params.length}
      OR LOWER(COALESCE(tpli.procedure_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${appointmentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY a.scheduled_date DESC, a.start_time DESC
     LIMIT 300`,
    params
  );
  return rows;
}

export async function getOdontologyAppointmentById({ clientId, appointmentId }) {
  const { rows } = await query(
    `${appointmentSelectSql()}
     WHERE a.client_id = $1
       AND a.id = $2
     LIMIT 1`,
    [clientId, appointmentId]
  );
  return rows[0] || null;
}

export async function createOdontologyAppointmentReminderLog({
  clientId,
  appointmentId,
  channel,
  recipientName = '',
  recipientEmail = '',
  recipientPhone = '',
  subject = '',
  message,
  status = 'sent',
  reminderKind = 'manual',
  errorMessage = '',
  actorUserId = null
}) {
  const { rows } = await query(
    `INSERT INTO odontology_appointment_reminders (
       client_id, appointment_id, channel, recipient_name, recipient_email,
       recipient_phone, subject, message, status, reminder_kind, error_message, sent_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      clientId,
      appointmentId,
      channel,
      sanitizeText(recipientName),
      sanitizeText(recipientEmail),
      sanitizeText(recipientPhone),
      sanitizeText(subject),
      requiredText(message),
      status,
      sanitizeText(reminderKind) || 'manual',
      sanitizeText(errorMessage),
      actorUserId
    ]
  );
  return rows[0];
}

export async function listOdontologyAppointmentReminders({
  clientId,
  date = '',
  dateFrom = '',
  dateTo = '',
  status = '',
  channel = '',
  reminderKind = '',
  search = ''
}) {
  const params = [clientId];
  const filters = ['r.client_id = $1'];
  const cleanDate = String(date || '').trim();
  const cleanDateFrom = String(dateFrom || '').trim();
  const cleanDateTo = String(dateTo || '').trim();
  const cleanStatus = String(status || '').trim();
  const cleanChannel = String(channel || '').trim();
  const cleanReminderKind = String(reminderKind || '').trim();
  const cleanSearch = String(search || '').trim().toLowerCase();

  if (cleanDate) {
    params.push(cleanDate);
    filters.push(`a.scheduled_date = $${params.length}::date`);
  } else {
    if (cleanDateFrom) {
      params.push(cleanDateFrom);
      filters.push(`a.scheduled_date >= $${params.length}::date`);
    }
    if (cleanDateTo) {
      params.push(cleanDateTo);
      filters.push(`a.scheduled_date <= $${params.length}::date`);
    }
  }
  if (cleanStatus) {
    params.push(cleanStatus);
    filters.push(`r.status = $${params.length}`);
  }
  if (cleanChannel) {
    params.push(cleanChannel);
    filters.push(`r.channel = $${params.length}`);
  }
  if (cleanReminderKind) {
    params.push(cleanReminderKind);
    filters.push(`r.reminder_kind = $${params.length}`);
  }
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(COALESCE(p.full_name, r.recipient_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(p.document_number, '')) LIKE $${params.length}
      OR LOWER(COALESCE(r.recipient_email, '')) LIKE $${params.length}
      OR LOWER(COALESCE(pt.name, '')) LIKE $${params.length}
    )`);
  }

  const { rows } = await query(
    `SELECT r.*,
            a.scheduled_date::text AS appointment_date,
            a.start_time::text AS appointment_start_time,
            a.end_time::text AS appointment_end_time,
            a.status AS appointment_status,
            p.full_name AS patient_name,
            p.document_number AS patient_document_number,
            u.display_name AS dentist_name,
            pt.name AS procedure_name
     FROM odontology_appointment_reminders r
     JOIN odontology_appointments a ON a.id = r.appointment_id
     LEFT JOIN odontology_patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = a.dentist_user_id
     LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
     WHERE ${filters.join(' AND ')}
     ORDER BY r.sent_at DESC, r.created_at DESC
     LIMIT 300`,
    params
  );
  return rows;
}

export async function createOdontologyAppointment({ clientId, payload, actorUserId }) {
  const validation = validateOdontologyAppointmentPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const relationError = await validateAppointmentRelations(clientId, data);
  if (relationError) return { error: 'VALIDATION', message: relationError };
  const scheduleError = await validateAppointmentWithinDentistSchedule(clientId, data);
  if (scheduleError) return { error: 'VALIDATION', message: scheduleError };
  const conflict = await findAppointmentConflict(clientId, data);
  if (conflict) return { error: 'CONFLICT', message: conflict };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO odontology_appointments (
         client_id, patient_id, site_id, chair_id, dentist_user_id, procedure_type_id,
         treatment_plan_id, treatment_plan_item_id,
         scheduled_date, start_time, end_time, duration_minutes, status, notes,
         cancellation_reason, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
       RETURNING *`,
      [
        clientId,
        data.patientId,
        data.siteId,
        data.chairId,
        data.dentistUserId,
        data.procedureTypeId,
        data.treatmentPlanId,
        data.treatmentPlanItemId,
        data.scheduledDate,
        data.startTime,
        data.endTime,
        data.durationMinutes,
        data.status,
        data.notes,
        data.cancellationReason,
        actorUserId
      ]
    );
    const appointment = rows[0];
    const inventoryConsumptions = appointment.status === 'Atendida'
      ? await consumeAppointmentInventoryTx(client, { clientId, appointment, actorUserId })
      : [];
    const treatmentProgress = await recalculateTreatmentPlanProgressTx(client, {
      clientId,
      treatmentPlanId: appointment.treatment_plan_id,
      treatmentPlanItemId: appointment.treatment_plan_item_id,
      actorUserId
    });
    await client.query('COMMIT');
    return { appointment, inventoryConsumptions, treatmentProgress };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === 'ODONTOLOGY_STOCK_ERROR') {
      return { error: 'VALIDATION', message: error.message };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOdontologyAppointment({ clientId, appointmentId, payload, actorUserId }) {
  const validation = validateOdontologyAppointmentPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const relationError = await validateAppointmentRelations(clientId, data);
  if (relationError) return { error: 'VALIDATION', message: relationError };
  const scheduleError = await validateAppointmentWithinDentistSchedule(clientId, data);
  if (scheduleError) return { error: 'VALIDATION', message: scheduleError };
  const conflict = await findAppointmentConflict(clientId, data, appointmentId);
  if (conflict) return { error: 'CONFLICT', message: conflict };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: previousRows } = await client.query(
      `SELECT status, treatment_plan_id, treatment_plan_item_id
       FROM odontology_appointments
       WHERE client_id = $1
         AND id = $2
       FOR UPDATE`,
      [clientId, appointmentId]
    );
    if (!previousRows[0]) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Cita no encontrada.' };
    }
    const { rows } = await client.query(
      `UPDATE odontology_appointments
       SET patient_id = $3,
           site_id = $4,
           chair_id = $5,
           dentist_user_id = $6,
           procedure_type_id = $7,
           treatment_plan_id = $8,
           treatment_plan_item_id = $9,
           scheduled_date = $10,
           start_time = $11,
           end_time = $12,
           duration_minutes = $13,
           status = $14,
           notes = $15,
           cancellation_reason = $16,
           updated_by = $17
       WHERE client_id = $1
         AND id = $2
       RETURNING *`,
      [
        clientId,
        appointmentId,
        data.patientId,
        data.siteId,
        data.chairId,
        data.dentistUserId,
        data.procedureTypeId,
        data.treatmentPlanId,
        data.treatmentPlanItemId,
        data.scheduledDate,
        data.startTime,
        data.endTime,
        data.durationMinutes,
        data.status,
        data.notes,
        data.cancellationReason,
        actorUserId
      ]
    );
    const inventoryConsumptions = previousRows[0].status !== 'Atendida' && rows[0].status === 'Atendida'
      ? await consumeAppointmentInventoryTx(client, {
        clientId,
        appointment: rows[0],
        actorUserId
      })
      : [];
    const progressTargets = new Map();
    for (const target of [
      { planId: previousRows[0].treatment_plan_id, itemId: previousRows[0].treatment_plan_item_id },
      { planId: rows[0].treatment_plan_id, itemId: rows[0].treatment_plan_item_id }
    ]) {
      if (target.planId) progressTargets.set(`${target.planId}:${target.itemId || ''}`, target);
    }
    const treatmentProgress = [];
    for (const target of progressTargets.values()) {
      const progress = await recalculateTreatmentPlanProgressTx(client, {
        clientId,
        treatmentPlanId: target.planId,
        treatmentPlanItemId: target.itemId,
        actorUserId
      });
      if (progress) treatmentProgress.push(progress);
    }
    await client.query('COMMIT');
    return { appointment: rows[0], inventoryConsumptions, treatmentProgress };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === 'ODONTOLOGY_STOCK_ERROR') {
      return { error: 'VALIDATION', message: error.message };
    }
    throw error;
  } finally {
    client.release();
  }
}

function validateOdontologyClinicalRecordPayload(payload) {
  const clean = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    appointmentId: sanitizeText(payload.appointmentId || payload.appointment_id),
    chiefComplaint: requiredText(payload.chiefComplaint || payload.chief_complaint),
    currentIllness: sanitizeText(payload.currentIllness || payload.current_illness),
    medicalHistory: sanitizeText(payload.medicalHistory || payload.medical_history),
    dentalHistory: sanitizeText(payload.dentalHistory || payload.dental_history),
    familyHistory: sanitizeText(payload.familyHistory || payload.family_history),
    currentMedications: sanitizeText(payload.currentMedications || payload.current_medications),
    allergies: sanitizeText(payload.allergies),
    habits: sanitizeText(payload.habits),
    extraoralExam: sanitizeText(payload.extraoralExam || payload.extraoral_exam),
    intraoralExam: sanitizeText(payload.intraoralExam || payload.intraoral_exam),
    diagnosisCode: sanitizeText(payload.diagnosisCode || payload.diagnosis_code),
    diagnosisText: sanitizeText(payload.diagnosisText || payload.diagnosis_text),
    treatmentPlan: sanitizeText(payload.treatmentPlan || payload.treatment_plan),
    clinicalNotes: sanitizeText(payload.clinicalNotes || payload.clinical_notes)
  };

  const missing = [];
  if (!clean.patientId) missing.push('paciente');
  if (!clean.chiefComplaint) missing.push('motivo de consulta');
  if (missing.length) {
    return { ok: false, message: `Campos obligatorios: ${missing.join(', ')}.` };
  }
  return { ok: true, data: clean };
}

async function validateClinicalRecordRelations(clientId, data) {
  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return 'Paciente no encontrado para este cliente.';
  if (data.appointmentId) {
    const { rows } = await query(
      `SELECT 1
       FROM odontology_appointments
       WHERE id = $1
         AND client_id = $2
         AND patient_id = $3
       LIMIT 1`,
      [data.appointmentId, clientId, data.patientId]
    );
    if (!rows.length) return 'La cita seleccionada no corresponde al paciente.';
  }
  return null;
}

function clinicalRecordSelectSql() {
  return `SELECT cr.*,
                 p.internal_code AS patient_code,
                 p.document_type AS patient_document_type,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 p.birth_date AS patient_birth_date,
                 p.sex AS patient_sex,
                 p.phone AS patient_phone,
                 p.email AS patient_email,
                 p.address AS patient_address,
                 a.scheduled_date AS appointment_date,
                 a.start_time AS appointment_start_time,
                 du.display_name AS dentist_name,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name,
                 su.display_name AS signed_by_name,
                 su.signature_path AS signed_by_signature_path,
                 su.document_type AS signed_by_document_type,
                 su.document_number AS signed_by_document_number,
                 su.invima_registration AS signed_by_invima_registration,
                 COALESCE((
                   SELECT json_agg(
                     json_build_object(
                       'id', sc.id,
                       'cycle_code', sc.cycle_code,
                       'method', sc.method,
                       'cycle_date', sc.cycle_date,
                       'start_time', sc.start_time,
                       'end_time', sc.end_time,
                       'result', sc.result,
                       'operator_name', COALESCE(operator.display_name, creator.display_name),
                       'item_count', (
                         SELECT COUNT(*)::int
                         FROM odontology_sterilization_cycle_items sci
                         WHERE sci.cycle_id = sc.id
                       ),
                       'pdf_path', sc.pdf_path
                     )
                     ORDER BY sc.cycle_date DESC, sc.created_at DESC
                   )
                   FROM odontology_sterilization_cycles sc
                   LEFT JOIN users operator ON operator.id = sc.operator_user_id
                   LEFT JOIN users creator ON creator.id = sc.created_by
                   WHERE sc.client_id = cr.client_id
                     AND sc.appointment_id = cr.appointment_id
                 ), '[]'::json) AS sterilization_cycles
          FROM odontology_clinical_records cr
          JOIN odontology_patients p ON p.id = cr.patient_id
          LEFT JOIN odontology_appointments a ON a.id = cr.appointment_id
          LEFT JOIN users du ON du.id = a.dentist_user_id
          LEFT JOIN users cu ON cu.id = cr.created_by
          LEFT JOIN users uu ON uu.id = cr.updated_by
          LEFT JOIN users su ON su.id = cr.signed_by`;
}

export async function listOdontologyClinicalRecords({ clientId, patientId = '', status = '', search = '' }) {
  const params = [clientId];
  const filters = ['cr.client_id = $1'];
  const cleanPatientId = String(patientId || '').trim();
  const cleanStatus = String(status || '').trim();
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanPatientId) {
    params.push(cleanPatientId);
    filters.push(`cr.patient_id = $${params.length}`);
  }
  if (cleanStatus) {
    params.push(cleanStatus);
    filters.push(`cr.status = $${params.length}`);
  }
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(p.internal_code) LIKE $${params.length}
      OR LOWER(cr.chief_complaint) LIKE $${params.length}
      OR LOWER(COALESCE(cr.diagnosis_text, '')) LIKE $${params.length}
    )`);
  }

  const { rows } = await query(
    `${clinicalRecordSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY cr.created_at DESC
     LIMIT 250`,
    params
  );
  return rows;
}

export async function getOdontologyClinicalRecordById({ clientId, clinicalRecordId }) {
  const { rows } = await query(
    `${clinicalRecordSelectSql()}
     WHERE cr.client_id = $1
       AND cr.id = $2
     LIMIT 1`,
    [clientId, clinicalRecordId]
  );
  return rows[0] || null;
}

export async function createOdontologyClinicalRecord({ clientId, payload, actorUserId }) {
  const validation = validateOdontologyClinicalRecordPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const relationError = await validateClinicalRecordRelations(clientId, data);
  if (relationError) return { error: 'VALIDATION', message: relationError };

  const { rows } = await query(
    `INSERT INTO odontology_clinical_records (
       client_id, patient_id, appointment_id, chief_complaint, current_illness,
       medical_history, dental_history, family_history, current_medications,
       allergies, habits, extraoral_exam, intraoral_exam, diagnosis_code,
       diagnosis_text, treatment_plan, clinical_notes, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
     RETURNING *`,
    [
      clientId,
      data.patientId,
      data.appointmentId,
      data.chiefComplaint,
      data.currentIllness,
      data.medicalHistory,
      data.dentalHistory,
      data.familyHistory,
      data.currentMedications,
      data.allergies,
      data.habits,
      data.extraoralExam,
      data.intraoralExam,
      data.diagnosisCode,
      data.diagnosisText,
      data.treatmentPlan,
      data.clinicalNotes,
      actorUserId
    ]
  );
  return { clinicalRecord: rows[0] };
}

export async function updateOdontologyClinicalRecord({ clientId, clinicalRecordId, payload, actorUserId }) {
  const { rows: currentRows } = await query(
    'SELECT status FROM odontology_clinical_records WHERE client_id = $1 AND id = $2 LIMIT 1',
    [clientId, clinicalRecordId]
  );
  if (!currentRows.length) return { error: 'NOT_FOUND', message: 'Historia clínica no encontrada.' };
  if (currentRows[0].status === 'signed') {
    return { error: 'SIGNED', message: 'La historia clínica ya está firmada y no se puede modificar.' };
  }

  const validation = validateOdontologyClinicalRecordPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const relationError = await validateClinicalRecordRelations(clientId, data);
  if (relationError) return { error: 'VALIDATION', message: relationError };

  const { rows } = await query(
    `UPDATE odontology_clinical_records
     SET patient_id = $3,
         appointment_id = $4,
         chief_complaint = $5,
         current_illness = $6,
         medical_history = $7,
         dental_history = $8,
         family_history = $9,
         current_medications = $10,
         allergies = $11,
         habits = $12,
         extraoral_exam = $13,
         intraoral_exam = $14,
         diagnosis_code = $15,
         diagnosis_text = $16,
         treatment_plan = $17,
         clinical_notes = $18,
         updated_by = $19
     WHERE client_id = $1
       AND id = $2
     RETURNING *`,
    [
      clientId,
      clinicalRecordId,
      data.patientId,
      data.appointmentId,
      data.chiefComplaint,
      data.currentIllness,
      data.medicalHistory,
      data.dentalHistory,
      data.familyHistory,
      data.currentMedications,
      data.allergies,
      data.habits,
      data.extraoralExam,
      data.intraoralExam,
      data.diagnosisCode,
      data.diagnosisText,
      data.treatmentPlan,
      data.clinicalNotes,
      actorUserId
    ]
  );
  return { clinicalRecord: rows[0] };
}

export async function signOdontologyClinicalRecord({
  clientId,
  clinicalRecordId,
  actorUserId,
  patientSignaturePath = null,
  patientSignerName = '',
  patientSignerDocumentType = '',
  patientSignerDocumentNumber = '',
  patientSignerRelationship = ''
}) {
  const cleanSignerName = requiredText(patientSignerName);
  const cleanSignerDocumentType = requiredText(patientSignerDocumentType);
  const cleanSignerDocumentNumber = requiredText(patientSignerDocumentNumber);
  const cleanSignerRelationship = sanitizeText(patientSignerRelationship);
  const missing = [];
  if (!cleanSignerName) missing.push('nombre del paciente o acudiente');
  if (!cleanSignerDocumentType) missing.push('tipo de documento del firmante');
  if (!cleanSignerDocumentNumber) missing.push('documento del firmante');
  if (!patientSignaturePath) missing.push('firma del paciente o acudiente');
  if (missing.length) {
    return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  }
  if (!ODONTOLOGY_DOCUMENT_TYPES.has(cleanSignerDocumentType)) {
    return { error: 'VALIDATION', message: 'Tipo de documento del firmante inválido.' };
  }

  await ensureOdontologyDefaults(clientId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT cr.*, os.require_diagnosis_before_sign, os.require_plan_before_sign
       FROM odontology_clinical_records cr
       JOIN odontology_settings os ON os.client_id = cr.client_id
       WHERE cr.client_id = $1
         AND cr.id = $2
       LIMIT 1
       FOR UPDATE OF cr`,
      [clientId, clinicalRecordId]
    );
    const current = rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Historia clínica no encontrada.' };
    }
    if (current.status === 'signed') {
      await client.query('ROLLBACK');
      return { error: 'SIGNED', message: 'La historia clínica ya está firmada.' };
    }
    if (current.require_diagnosis_before_sign && !current.diagnosis_text) {
      await client.query('ROLLBACK');
      return { error: 'VALIDATION', message: 'Diagnóstico obligatorio antes de firmar.' };
    }
    if (current.require_plan_before_sign && !current.treatment_plan) {
      await client.query('ROLLBACK');
      return { error: 'VALIDATION', message: 'Plan de manejo obligatorio antes de firmar.' };
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE odontology_clinical_records
       SET status = 'signed',
           signed_by = $3,
           signed_at = NOW(),
           patient_signer_name = $4,
           patient_signer_document_type = $5,
           patient_signer_document_number = $6,
           patient_signer_relationship = $7,
           patient_signature_path = $8,
           patient_signed_at = NOW(),
           updated_by = $3
       WHERE client_id = $1
         AND id = $2
       RETURNING *`,
      [
        clientId,
        clinicalRecordId,
        actorUserId,
        cleanSignerName,
        cleanSignerDocumentType,
        cleanSignerDocumentNumber,
        cleanSignerRelationship,
        patientSignaturePath
      ]
    );

    let attendedAppointment = null;
    let inventoryConsumptions = [];
    let treatmentProgress = null;
    if (updatedRows[0]?.appointment_id) {
      const { rows: appointmentRows } = await client.query(
        `SELECT *
         FROM odontology_appointments
         WHERE client_id = $1
           AND id = $2
         FOR UPDATE`,
        [clientId, updatedRows[0].appointment_id]
      );
      const appointment = appointmentRows[0];
      if (appointment && !['Atendida', 'Cancelada', 'No asistió'].includes(appointment.status)) {
        const { rows: attendedRows } = await client.query(
          `UPDATE odontology_appointments
           SET status = 'Atendida',
               updated_by = $3
           WHERE client_id = $1
             AND id = $2
           RETURNING *`,
          [clientId, appointment.id, actorUserId]
        );
        attendedAppointment = attendedRows[0];
        inventoryConsumptions = await consumeAppointmentInventoryTx(client, {
          clientId,
          appointment: attendedAppointment,
          actorUserId
        });
        treatmentProgress = await recalculateTreatmentPlanProgressTx(client, {
          clientId,
          treatmentPlanId: attendedAppointment.treatment_plan_id,
          treatmentPlanItemId: attendedAppointment.treatment_plan_item_id,
          actorUserId
        });
      }
    }

    await client.query('COMMIT');
    return { clinicalRecord: updatedRows[0], attendedAppointment, inventoryConsumptions, treatmentProgress };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === 'ODONTOLOGY_STOCK_ERROR') {
      return { error: 'VALIDATION', message: error.message };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function setOdontologyClinicalRecordPdf({ clientId, clinicalRecordId, pdfPath }) {
  await query(
    `UPDATE odontology_clinical_records
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2`,
    [clientId, clinicalRecordId, pdfPath]
  );
  return getOdontologyClinicalRecordById({ clientId, clinicalRecordId });
}

function clinicalRecordNoteSelectSql() {
  return `SELECT n.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 cr.chief_complaint AS clinical_record_chief_complaint,
                 cr.signed_at AS clinical_record_signed_at,
                 u.display_name AS created_by_name
          FROM odontology_clinical_record_notes n
          JOIN odontology_patients p ON p.id = n.patient_id
          JOIN odontology_clinical_records cr ON cr.id = n.clinical_record_id
          LEFT JOIN users u ON u.id = n.created_by`;
}

export async function listOdontologyClinicalRecordNotes({ clientId, clinicalRecordId = '', patientId = '' }) {
  const params = [clientId];
  const filters = ['n.client_id = $1'];
  const cleanClinicalRecordId = String(clinicalRecordId || '').trim();
  const cleanPatientId = String(patientId || '').trim();
  if (cleanClinicalRecordId) {
    params.push(cleanClinicalRecordId);
    filters.push(`n.clinical_record_id = $${params.length}`);
  }
  if (cleanPatientId) {
    params.push(cleanPatientId);
    filters.push(`n.patient_id = $${params.length}`);
  }

  const { rows } = await query(
    `${clinicalRecordNoteSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY n.created_at DESC
     LIMIT 250`,
    params
  );
  return rows;
}

export async function createOdontologyClinicalRecordNote({ clientId, clinicalRecordId, payload, actorUserId }) {
  const noteText = requiredText(payload.noteText || payload.note_text);
  const reason = sanitizeText(payload.reason);
  if (!noteText) return { error: 'VALIDATION', message: 'La nota aclaratoria es obligatoria.' };

  const { rows: recordRows } = await query(
    `SELECT id, patient_id, status
     FROM odontology_clinical_records
     WHERE client_id = $1
       AND id = $2
     LIMIT 1`,
    [clientId, clinicalRecordId]
  );
  const record = recordRows[0];
  if (!record) return { error: 'NOT_FOUND', message: 'Historia clínica no encontrada.' };
  if (record.status !== 'signed') {
    return { error: 'VALIDATION', message: 'La historia clínica debe estar firmada para agregar una nota aclaratoria.' };
  }

  const { rows } = await query(
    `INSERT INTO odontology_clinical_record_notes (
       client_id, clinical_record_id, patient_id, reason, note_text, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [clientId, clinicalRecordId, record.patient_id, reason, noteText, actorUserId]
  );

  const notes = await listOdontologyClinicalRecordNotes({ clientId, clinicalRecordId });
  return { note: notes.find((note) => note.id === rows[0].id) || rows[0] };
}

const ODONTOLOGY_DENTITIONS = new Set(['permanent', 'temporary', 'mixed']);
const ODONTOLOGY_SURFACES = new Set(['whole', 'occlusal', 'mesial', 'distal', 'vestibular', 'lingual', 'palatal']);

function validateOdontogramPayload(payload) {
  const clean = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    dentition: requiredText(payload.dentition || 'permanent'),
    toothNumber: requiredText(payload.toothNumber || payload.tooth_number),
    surface: requiredText(payload.surface || 'whole'),
    conditionItemId: sanitizeText(payload.conditionItemId || payload.condition_item_id),
    notes: sanitizeText(payload.notes),
    recordDate: requiredText(payload.recordDate || payload.record_date || new Date().toISOString().slice(0, 10))
  };

  const missing = [];
  if (!clean.patientId) missing.push('paciente');
  if (!clean.toothNumber) missing.push('diente');
  if (!clean.conditionItemId) missing.push('condición');
  if (missing.length) return { ok: false, message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!ODONTOLOGY_DENTITIONS.has(clean.dentition)) return { ok: false, message: 'Dentición inválida.' };
  if (!ODONTOLOGY_SURFACES.has(clean.surface)) return { ok: false, message: 'Superficie inválida.' };
  const date = new Date(`${clean.recordDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { ok: false, message: 'Fecha de registro inválida.' };
  return { ok: true, data: clean };
}

export async function getOdontologyOdontogram({ clientId, patientId }) {
  const patient = await getOdontologyPatientById({ clientId, patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };

  const { rows: latest } = await query(
    `SELECT DISTINCT ON (oe.tooth_number, oe.surface)
            oe.*,
            u.display_name AS created_by_name
     FROM odontology_odontogram_entries oe
     LEFT JOIN users u ON u.id = oe.created_by
     WHERE oe.client_id = $1
       AND oe.patient_id = $2
     ORDER BY oe.tooth_number, oe.surface, oe.created_at DESC`,
    [clientId, patientId]
  );

  const { rows: history } = await query(
    `SELECT oe.*,
            u.display_name AS created_by_name
     FROM odontology_odontogram_entries oe
     LEFT JOIN users u ON u.id = oe.created_by
     WHERE oe.client_id = $1
       AND oe.patient_id = $2
     ORDER BY oe.record_date DESC, oe.created_at DESC
     LIMIT 200`,
    [clientId, patientId]
  );

  return { patient, latest, history };
}

export async function createOdontologyOdontogramEntry({ clientId, payload, actorUserId }) {
  const validation = validateOdontogramPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };

  const { rows: conditionRows } = await query(
    `SELECT id, name, color
     FROM odontology_catalog_items
     WHERE id = $1
       AND catalog_type = 'tooth_condition'
       AND is_active = TRUE
       AND (client_id IS NULL OR client_id = $2)
     LIMIT 1`,
    [data.conditionItemId, clientId]
  );
  const condition = conditionRows[0];
  if (!condition) return { error: 'VALIDATION', message: 'Condición de odontograma inválida.' };

  const { rows } = await query(
    `INSERT INTO odontology_odontogram_entries (
       client_id, patient_id, dentition, tooth_number, surface, condition_item_id,
       condition_name, condition_color, notes, record_date, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      clientId,
      data.patientId,
      data.dentition,
      data.toothNumber,
      data.surface,
      condition.id,
      condition.name,
      condition.color,
      data.notes,
      data.recordDate,
      actorUserId
    ]
  );
  return { entry: rows[0] };
}

function intOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.trunc(number);
}

function periodontogramSelectSql() {
  return `SELECT pg.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 cr.status AS clinical_record_status,
                 u.display_name AS created_by_name,
                 COUNT(pm.id)::int AS measurement_count
          FROM odontology_periodontograms pg
          JOIN odontology_patients p ON p.id = pg.patient_id
          LEFT JOIN odontology_clinical_records cr ON cr.id = pg.clinical_record_id
          LEFT JOIN users u ON u.id = pg.created_by
          LEFT JOIN odontology_periodontal_measurements pm ON pm.chart_id = pg.id`;
}

function periodontogramGroupBySql() {
  return `GROUP BY pg.id, p.internal_code, p.full_name, p.document_number, cr.status, u.display_name`;
}

export async function listOdontologyPeriodontograms({ clientId, patientId = '', search = '' }) {
  const params = [clientId];
  const filters = ['pg.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`pg.patient_id = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(COALESCE(pg.notes, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.display_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${periodontogramSelectSql()}
     WHERE ${filters.join(' AND ')}
     ${periodontogramGroupBySql()}
     ORDER BY pg.chart_date DESC, pg.created_at DESC
     LIMIT 120`,
    params
  );
  return rows;
}

export async function getOdontologyPeriodontogramById({ clientId, chartId }) {
  const { rows } = await query(
    `${periodontogramSelectSql()}
     WHERE pg.client_id = $1
       AND pg.id = $2
     ${periodontogramGroupBySql()}
     LIMIT 1`,
    [clientId, chartId]
  );
  const chart = rows[0];
  if (!chart) return null;
  const measurements = await query(
    `SELECT *
     FROM odontology_periodontal_measurements
     WHERE chart_id = $1
     ORDER BY sort_order, tooth_number`,
    [chart.id]
  );
  chart.measurements = measurements.rows;
  return chart;
}

function cleanPeriodontalMeasurement(item, index) {
  return {
    toothNumber: requiredText(item.toothNumber || item.tooth_number),
    probingMb: intOrNull(item.probingMb ?? item.probing_mb),
    probingB: intOrNull(item.probingB ?? item.probing_b),
    probingDb: intOrNull(item.probingDb ?? item.probing_db),
    probingMl: intOrNull(item.probingMl ?? item.probing_ml),
    probingL: intOrNull(item.probingL ?? item.probing_l),
    probingDl: intOrNull(item.probingDl ?? item.probing_dl),
    recessionMb: intOrNull(item.recessionMb ?? item.recession_mb),
    recessionB: intOrNull(item.recessionB ?? item.recession_b),
    recessionDb: intOrNull(item.recessionDb ?? item.recession_db),
    recessionMl: intOrNull(item.recessionMl ?? item.recession_ml),
    recessionL: intOrNull(item.recessionL ?? item.recession_l),
    recessionDl: intOrNull(item.recessionDl ?? item.recession_dl),
    bleedingMb: booleanValue(item.bleedingMb ?? item.bleeding_mb),
    bleedingB: booleanValue(item.bleedingB ?? item.bleeding_b),
    bleedingDb: booleanValue(item.bleedingDb ?? item.bleeding_db),
    bleedingMl: booleanValue(item.bleedingMl ?? item.bleeding_ml),
    bleedingL: booleanValue(item.bleedingL ?? item.bleeding_l),
    bleedingDl: booleanValue(item.bleedingDl ?? item.bleeding_dl),
    plaque: booleanValue(item.plaque),
    calculus: booleanValue(item.calculus),
    mobility: sanitizeText(item.mobility),
    furcation: sanitizeText(item.furcation),
    notes: sanitizeText(item.notes),
    sortOrder: index + 1
  };
}

export async function createOdontologyPeriodontogram({ clientId, payload, actorUserId }) {
  const data = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    clinicalRecordId: sanitizeText(payload.clinicalRecordId || payload.clinical_record_id),
    chartDate: requiredText(payload.chartDate || payload.chart_date),
    dentition: requiredText(payload.dentition || 'permanent'),
    notes: sanitizeText(payload.notes),
    measurements: Array.isArray(payload.measurements) ? payload.measurements : []
  };
  const missing = [];
  if (!data.patientId) missing.push('paciente');
  if (!data.chartDate) missing.push('fecha');
  if (!data.measurements.length) missing.push('mediciones');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!['permanent', 'temporary', 'mixed'].includes(data.dentition)) {
    return { error: 'VALIDATION', message: 'Dentición inválida.' };
  }

  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
  if (data.clinicalRecordId && !(await validateAttachmentReference({ clientId, tableName: 'odontology_clinical_records', id: data.clinicalRecordId, patientId: data.patientId }))) {
    return { error: 'VALIDATION', message: 'La historia clínica no corresponde al paciente.' };
  }

  const measurements = data.measurements
    .map(cleanPeriodontalMeasurement)
    .filter((item) => item.toothNumber);
  if (!measurements.length) return { error: 'VALIDATION', message: 'Agrega al menos una medición válida.' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO odontology_periodontograms (
         client_id, patient_id, clinical_record_id, chart_date, dentition,
         notes, status, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$7)
       RETURNING id`,
      [clientId, data.patientId, data.clinicalRecordId, data.chartDate, data.dentition, data.notes, actorUserId]
    );
    const chartId = rows[0].id;
    for (const item of measurements) {
      await client.query(
        `INSERT INTO odontology_periodontal_measurements (
           chart_id, tooth_number, probing_mb, probing_b, probing_db, probing_ml, probing_l, probing_dl,
           recession_mb, recession_b, recession_db, recession_ml, recession_l, recession_dl,
           bleeding_mb, bleeding_b, bleeding_db, bleeding_ml, bleeding_l, bleeding_dl,
           plaque, calculus, mobility, furcation, notes, sort_order
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          chartId,
          item.toothNumber,
          item.probingMb,
          item.probingB,
          item.probingDb,
          item.probingMl,
          item.probingL,
          item.probingDl,
          item.recessionMb,
          item.recessionB,
          item.recessionDb,
          item.recessionMl,
          item.recessionL,
          item.recessionDl,
          item.bleedingMb,
          item.bleedingB,
          item.bleedingDb,
          item.bleedingMl,
          item.bleedingL,
          item.bleedingDl,
          item.plaque,
          item.calculus,
          item.mobility,
          item.furcation,
          item.notes,
          item.sortOrder
        ]
      );
    }
    await client.query('COMMIT');
    return { chart: await getOdontologyPeriodontogramById({ clientId, chartId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function consentTemplateSelectSql() {
  return `SELECT ct.*,
                 pt.name AS procedure_name,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_consent_templates ct
          LEFT JOIN odontology_procedure_types pt ON pt.id = ct.procedure_type_id
          LEFT JOIN users cu ON cu.id = ct.created_by
          LEFT JOIN users uu ON uu.id = ct.updated_by`;
}

export async function listOdontologyConsentTemplates({ clientId, activeOnly = false }) {
  const filters = ['ct.client_id = $1'];
  if (activeOnly) filters.push('ct.is_active = TRUE');
  const { rows } = await query(
    `${consentTemplateSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY ct.is_active DESC, ct.title, ct.version DESC`,
    [clientId]
  );
  return rows;
}

function validateConsentTemplatePayload(payload) {
  const clean = {
    title: requiredText(payload.title),
    body: requiredText(payload.body),
    procedureTypeId: sanitizeText(payload.procedureTypeId || payload.procedure_type_id),
    version: Number(payload.version || 1),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active)
  };
  if (!clean.title) return { ok: false, message: 'Título obligatorio.' };
  if (!clean.body) return { ok: false, message: 'Texto de consentimiento obligatorio.' };
  if (!Number.isFinite(clean.version) || clean.version < 1) {
    return { ok: false, message: 'Versión inválida.' };
  }
  return { ok: true, data: clean };
}

async function validateProcedureForClient(clientId, procedureTypeId) {
  if (!procedureTypeId) return null;
  const { rows } = await query(
    `SELECT 1
     FROM odontology_procedure_types
     WHERE id = $1
       AND (client_id IS NULL OR client_id = $2)
       AND is_active = TRUE
     LIMIT 1`,
    [procedureTypeId, clientId]
  );
  return rows.length ? null : 'Procedimiento no válido para el consentimiento.';
}

export async function createOdontologyConsentTemplate({ clientId, payload, actorUserId }) {
  const validation = validateConsentTemplatePayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const procedureError = await validateProcedureForClient(clientId, data.procedureTypeId);
  if (procedureError) return { error: 'VALIDATION', message: procedureError };
  const { rows } = await query(
    `INSERT INTO odontology_consent_templates (
       client_id, procedure_type_id, title, body, version, is_active, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     RETURNING *`,
    [clientId, data.procedureTypeId, data.title, data.body, data.version, data.isActive, actorUserId]
  );
  return { template: rows[0] };
}

export async function updateOdontologyConsentTemplate({ clientId, templateId, payload, actorUserId }) {
  const validation = validateConsentTemplatePayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const procedureError = await validateProcedureForClient(clientId, data.procedureTypeId);
  if (procedureError) return { error: 'VALIDATION', message: procedureError };
  const { rows } = await query(
    `UPDATE odontology_consent_templates
     SET procedure_type_id = $3,
         title = $4,
         body = $5,
         version = $6,
         is_active = $7,
         updated_by = $8
     WHERE client_id = $1
       AND id = $2
     RETURNING *`,
    [clientId, templateId, data.procedureTypeId, data.title, data.body, data.version, data.isActive, actorUserId]
  );
  if (!rows[0]) return { error: 'NOT_FOUND', message: 'Plantilla no encontrada.' };
  return { template: rows[0] };
}

function consentSelectSql() {
  return `SELECT pc.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_type AS patient_document_type,
                 p.document_number AS patient_document_number,
                 a.scheduled_date AS appointment_date,
                 a.start_time AS appointment_start_time,
                 pt.name AS procedure_name,
                 su.display_name AS signed_by_name,
                 su.signature_path AS signed_by_signature_path,
                 su.document_type AS signed_by_document_type,
                 su.document_number AS signed_by_document_number,
                 su.invima_registration AS signed_by_invima_registration,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_patient_consents pc
          JOIN odontology_patients p ON p.id = pc.patient_id
          LEFT JOIN odontology_appointments a ON a.id = pc.appointment_id
          LEFT JOIN odontology_procedure_types pt ON pt.id = pc.procedure_type_id
          LEFT JOIN users su ON su.id = pc.signed_by
          LEFT JOIN users cu ON cu.id = pc.created_by
          LEFT JOIN users uu ON uu.id = pc.updated_by`;
}

function renderConsentBody(templateBody, values) {
  return String(templateBody || '')
    .replaceAll('{{patient_name}}', values.patientName || '')
    .replaceAll('{{patient_document}}', values.patientDocument || '')
    .replaceAll('{{signer_name}}', values.signerName || '')
    .replaceAll('{{signer_document}}', values.signerDocument || '')
    .replaceAll('{{procedure_name}}', values.procedureName || 'procedimiento odontológico')
    .replaceAll('{{date}}', values.date || new Date().toISOString().slice(0, 10));
}

export async function listOdontologyPatientConsents({ clientId, patientId = '', status = '', search = '' }) {
  const params = [clientId];
  const filters = ['pc.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`pc.patient_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`pc.status = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(pc.template_title) LIKE $${params.length}
      OR LOWER(COALESCE(pt.name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${consentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY pc.created_at DESC
     LIMIT 250`,
    params
  );
  return rows;
}

export async function createOdontologyPatientConsent({ clientId, payload, actorUserId }) {
  const patientId = requiredText(payload.patientId || payload.patient_id);
  const templateId = requiredText(payload.templateId || payload.template_id);
  const appointmentId = sanitizeText(payload.appointmentId || payload.appointment_id);
  const signerName = requiredText(payload.signerName || payload.signer_name);
  const signerDocumentType = requiredText(payload.signerDocumentType || payload.signer_document_type);
  const signerDocumentNumber = requiredText(payload.signerDocumentNumber || payload.signer_document_number);
  const signerRelationship = sanitizeText(payload.signerRelationship || payload.signer_relationship);

  const missing = [];
  if (!patientId) missing.push('paciente');
  if (!templateId) missing.push('plantilla');
  if (!signerName) missing.push('firmante');
  if (!signerDocumentType) missing.push('tipo de documento del firmante');
  if (!signerDocumentNumber) missing.push('documento del firmante');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };

  const patient = await getOdontologyPatientById({ clientId, patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
  const { rows: templateRows } = await query(
    `${consentTemplateSelectSql()}
     WHERE ct.client_id = $1
       AND ct.id = $2
       AND ct.is_active = TRUE
     LIMIT 1`,
    [clientId, templateId]
  );
  const template = templateRows[0];
  if (!template) return { error: 'NOT_FOUND', message: 'Plantilla no encontrada o inactiva.' };

  let procedureName = template.procedure_name || 'procedimiento odontológico';
  if (appointmentId) {
    const { rows: appointmentRows } = await query(
      `SELECT a.id, pt.name AS procedure_name
       FROM odontology_appointments a
       LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
       WHERE a.client_id = $1
         AND a.id = $2
         AND a.patient_id = $3
       LIMIT 1`,
      [clientId, appointmentId, patientId]
    );
    if (!appointmentRows.length) return { error: 'VALIDATION', message: 'La cita no corresponde al paciente.' };
    procedureName = appointmentRows[0].procedure_name || procedureName;
  }

  const renderedBody = renderConsentBody(template.body, {
    patientName: patient.full_name,
    patientDocument: patient.document_number,
    signerName,
    signerDocument: signerDocumentNumber,
    procedureName,
    date: new Date().toISOString().slice(0, 10)
  });

  const { rows } = await query(
    `INSERT INTO odontology_patient_consents (
       client_id, patient_id, appointment_id, template_id, procedure_type_id,
       template_title, template_version, rendered_body, signer_name,
       signer_document_type, signer_document_number, signer_relationship,
       created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
     RETURNING *`,
    [
      clientId,
      patientId,
      appointmentId,
      template.id,
      template.procedure_type_id,
      template.title,
      template.version,
      renderedBody,
      signerName,
      signerDocumentType,
      signerDocumentNumber,
      signerRelationship,
      actorUserId
    ]
  );
  return { consent: rows[0] };
}

export async function signOdontologyPatientConsent({ clientId, consentId, actorUserId, signerSignaturePath = null }) {
  const { rows } = await query(
    `UPDATE odontology_patient_consents
     SET status = 'signed',
         signed_by = $3,
         signed_at = NOW(),
         signer_signature_path = COALESCE($4, signer_signature_path),
         updated_by = $3
     WHERE client_id = $1
       AND id = $2
       AND status = 'draft'
     RETURNING *`,
    [clientId, consentId, actorUserId, signerSignaturePath]
  );
  if (!rows[0]) return { error: 'NOT_FOUND', message: 'Consentimiento no encontrado o ya firmado.' };
  return { consent: rows[0] };
}

export async function setOdontologyConsentPdf({ clientId, consentId, pdfPath }) {
  const { rows } = await query(
    `UPDATE odontology_patient_consents
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2
     RETURNING *`,
    [clientId, consentId, pdfPath]
  );
  return rows[0] || null;
}

export async function getOdontologyConsentForPdf({ clientId, consentId }) {
  const { rows } = await query(
    `${consentSelectSql()}
     WHERE pc.client_id = $1
       AND pc.id = $2
     LIMIT 1`,
    [clientId, consentId]
  );
  return rows[0] || null;
}

const TREATMENT_PLAN_STATUSES = new Set(['draft', 'proposed', 'accepted', 'in_progress', 'completed', 'cancelled']);
const TREATMENT_ITEM_STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled']);

function treatmentPlanSelectSql() {
  return `SELECT tp.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 cr.status AS clinical_record_status,
                 cu.display_name AS created_by_name,
                 cu.signature_path AS created_by_signature_path,
                 uu.display_name AS updated_by_name,
                 au.display_name AS accepted_by_name,
                 COALESCE(payments.paid_amount, 0) AS paid_amount,
                 GREATEST(tp.total_amount - COALESCE(payments.paid_amount, 0), 0) AS balance_amount,
                 COALESCE(
                   json_agg(
                     json_build_object(
                       'id', tpi.id,
                       'procedure_type_id', tpi.procedure_type_id,
                       'procedure_name', tpi.procedure_name,
                       'tooth_number', tpi.tooth_number,
                       'description', tpi.description,
                       'quantity', tpi.quantity,
                       'unit_price', tpi.unit_price,
                       'estimated_sessions', tpi.estimated_sessions,
                       'status', tpi.status,
                       'sort_order', tpi.sort_order
                     )
                     ORDER BY tpi.sort_order, tpi.created_at
                   ) FILTER (WHERE tpi.id IS NOT NULL),
                   '[]'::json
                 ) AS items
          FROM odontology_treatment_plans tp
          JOIN odontology_patients p ON p.id = tp.patient_id
          LEFT JOIN odontology_clinical_records cr ON cr.id = tp.clinical_record_id
          LEFT JOIN users cu ON cu.id = tp.created_by
          LEFT JOIN users uu ON uu.id = tp.updated_by
          LEFT JOIN users au ON au.id = tp.accepted_by
          LEFT JOIN (
            SELECT treatment_plan_id, SUM(amount) AS paid_amount
            FROM odontology_payments
            WHERE status = 'registered'
              AND treatment_plan_id IS NOT NULL
            GROUP BY treatment_plan_id
          ) payments ON payments.treatment_plan_id = tp.id
          LEFT JOIN odontology_treatment_plan_items tpi ON tpi.treatment_plan_id = tp.id`;
}

function treatmentPlanGroupBySql() {
  return `GROUP BY tp.id, p.internal_code, p.full_name, p.document_number, cr.status, cu.display_name, cu.signature_path, uu.display_name, au.display_name, payments.paid_amount`;
}

function numberOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function validateTreatmentProcedure(client, clientId, procedureTypeId) {
  if (!procedureTypeId) return null;
  const { rows } = await client.query(
    `SELECT id, name, default_price
     FROM odontology_procedure_types
     WHERE id = $1
       AND (client_id IS NULL OR client_id = $2)
       AND is_active = TRUE
     LIMIT 1`,
    [procedureTypeId, clientId]
  );
  return rows[0] || null;
}

function validateTreatmentPlanPayload(payload) {
  const clean = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    clinicalRecordId: sanitizeText(payload.clinicalRecordId || payload.clinical_record_id),
    title: requiredText(payload.title),
    diagnosisText: sanitizeText(payload.diagnosisText || payload.diagnosis_text),
    objective: sanitizeText(payload.objective),
    notes: sanitizeText(payload.notes),
    status: requiredText(payload.status || 'draft'),
    items: Array.isArray(payload.items) ? payload.items : []
  };
  const missing = [];
  if (!clean.patientId) missing.push('paciente');
  if (!clean.title) missing.push('titulo');
  if (!TREATMENT_PLAN_STATUSES.has(clean.status)) missing.push('estado valido');
  if (!clean.items.length) missing.push('al menos un procedimiento');
  if (missing.length) return { ok: false, message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (clean.items.length > 60) return { ok: false, message: 'Maximo 60 procedimientos por plan.' };
  return { ok: true, data: clean };
}

async function normalizeTreatmentPlanItems(client, clientId, rawItems) {
  const items = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const raw = rawItems[index] || {};
    const procedureTypeId = sanitizeText(raw.procedureTypeId || raw.procedure_type_id);
    const procedure = await validateTreatmentProcedure(client, clientId, procedureTypeId);
    if (procedureTypeId && !procedure) {
      return { error: `Procedimiento no valido en la linea ${index + 1}.` };
    }
    const procedureName = requiredText(raw.procedureName || raw.procedure_name || procedure?.name);
    if (!procedureName) return { error: `Nombre de procedimiento obligatorio en la linea ${index + 1}.` };
    const quantity = numberOrDefault(raw.quantity, 1);
    const unitPrice = numberOrDefault(raw.unitPrice ?? raw.unit_price ?? procedure?.default_price, 0);
    const estimatedSessions = Math.round(numberOrDefault(raw.estimatedSessions ?? raw.estimated_sessions, 1));
    const status = requiredText(raw.status || 'pending');
    if (quantity <= 0) return { error: `Cantidad invalida en la linea ${index + 1}.` };
    if (unitPrice < 0) return { error: `Valor invalido en la linea ${index + 1}.` };
    if (estimatedSessions <= 0) return { error: `Sesiones invalidas en la linea ${index + 1}.` };
    if (!TREATMENT_ITEM_STATUSES.has(status)) return { error: `Estado invalido en la linea ${index + 1}.` };
    items.push({
      procedureTypeId,
      procedureName,
      toothNumber: sanitizeText(raw.toothNumber || raw.tooth_number),
      description: sanitizeText(raw.description),
      quantity,
      unitPrice,
      estimatedSessions,
      status,
      sortOrder: index
    });
  }
  return { items };
}

export async function listOdontologyTreatmentPlans({ clientId, patientId = '', status = '', search = '' }) {
  const params = [clientId];
  const filters = ['tp.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`tp.patient_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`tp.status = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(tp.title) LIKE $${params.length}
      OR LOWER(COALESCE(tp.diagnosis_text, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${treatmentPlanSelectSql()}
     WHERE ${filters.join(' AND ')}
     ${treatmentPlanGroupBySql()}
     ORDER BY tp.created_at DESC
     LIMIT 200`,
    params
  );
  return rows;
}

export async function getOdontologyTreatmentPlan({ clientId, treatmentPlanId }) {
  const { rows } = await query(
    `${treatmentPlanSelectSql()}
     WHERE tp.client_id = $1
       AND tp.id = $2
     ${treatmentPlanGroupBySql()}
     LIMIT 1`,
    [clientId, treatmentPlanId]
  );
  return rows[0] || null;
}

export async function createOdontologyTreatmentPlan({ clientId, payload, actorUserId }) {
  const validation = validateTreatmentPlanPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const settings = await getOdontologySettings(clientId);
  if (settings?.require_treatment_plan_signature && data.status === 'accepted') {
    return { error: 'VALIDATION', message: 'Usa el boton Aceptar para firmar y aceptar el plan de tratamiento.' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
    if (!patient) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
    }
    if (data.clinicalRecordId) {
      const { rows: clinicalRows } = await client.query(
        `SELECT 1 FROM odontology_clinical_records WHERE client_id = $1 AND id = $2 AND patient_id = $3 LIMIT 1`,
        [clientId, data.clinicalRecordId, data.patientId]
      );
      if (!clinicalRows.length) {
        await client.query('ROLLBACK');
        return { error: 'VALIDATION', message: 'La historia clinica no corresponde al paciente.' };
      }
    }
    const normalized = await normalizeTreatmentPlanItems(client, clientId, data.items);
    if (normalized.error) {
      await client.query('ROLLBACK');
      return { error: 'VALIDATION', message: normalized.error };
    }
    const totalAmount = normalized.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const { rows } = await client.query(
      `INSERT INTO odontology_treatment_plans (
         client_id, patient_id, clinical_record_id, title, diagnosis_text, objective,
         notes, status, total_amount, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       RETURNING id`,
      [
        clientId,
        data.patientId,
        data.clinicalRecordId,
        data.title,
        data.diagnosisText,
        data.objective,
        data.notes,
        data.status,
        totalAmount,
        actorUserId
      ]
    );
    const planId = rows[0].id;
    for (const item of normalized.items) {
      await client.query(
        `INSERT INTO odontology_treatment_plan_items (
           treatment_plan_id, client_id, procedure_type_id, procedure_name, tooth_number,
           description, quantity, unit_price, estimated_sessions, status, sort_order
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          planId,
          clientId,
          item.procedureTypeId,
          item.procedureName,
          item.toothNumber,
          item.description,
          item.quantity,
          item.unitPrice,
          item.estimatedSessions,
          item.status,
          item.sortOrder
        ]
      );
    }
    await client.query('COMMIT');
    return { treatmentPlan: await getOdontologyTreatmentPlan({ clientId, treatmentPlanId: planId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOdontologyTreatmentPlan({ clientId, treatmentPlanId, payload, actorUserId }) {
  const validation = validateTreatmentPlanPayload(payload);
  if (!validation.ok) return { error: 'VALIDATION', message: validation.message };
  const data = validation.data;
  const settings = await getOdontologySettings(clientId);
  if (settings?.require_treatment_plan_signature && data.status === 'accepted') {
    return { error: 'VALIDATION', message: 'Usa el boton Aceptar para firmar y aceptar el plan de tratamiento.' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existingRows } = await client.query(
      `SELECT id, accepted_signature_path FROM odontology_treatment_plans WHERE client_id = $1 AND id = $2 LIMIT 1`,
      [clientId, treatmentPlanId]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Plan de tratamiento no encontrado.' };
    }
    if (existingRows[0].accepted_signature_path) {
      await client.query('ROLLBACK');
      return { error: 'ACCEPTED', message: 'El plan ya fue aceptado y no se puede modificar.' };
    }
    const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
    if (!patient) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
    }
    const normalized = await normalizeTreatmentPlanItems(client, clientId, data.items);
    if (normalized.error) {
      await client.query('ROLLBACK');
      return { error: 'VALIDATION', message: normalized.error };
    }
    const totalAmount = normalized.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    await client.query(
      `UPDATE odontology_treatment_plans
       SET patient_id = $3,
           clinical_record_id = $4,
           title = $5,
           diagnosis_text = $6,
           objective = $7,
           notes = $8,
           status = $9,
           total_amount = $10,
           updated_by = $11
       WHERE client_id = $1
         AND id = $2`,
      [
        clientId,
        treatmentPlanId,
        data.patientId,
        data.clinicalRecordId,
        data.title,
        data.diagnosisText,
        data.objective,
        data.notes,
        data.status,
        totalAmount,
        actorUserId
      ]
    );
    await client.query('DELETE FROM odontology_treatment_plan_items WHERE treatment_plan_id = $1', [treatmentPlanId]);
    for (const item of normalized.items) {
      await client.query(
        `INSERT INTO odontology_treatment_plan_items (
           treatment_plan_id, client_id, procedure_type_id, procedure_name, tooth_number,
           description, quantity, unit_price, estimated_sessions, status, sort_order
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          treatmentPlanId,
          clientId,
          item.procedureTypeId,
          item.procedureName,
          item.toothNumber,
          item.description,
          item.quantity,
          item.unitPrice,
          item.estimatedSessions,
          item.status,
          item.sortOrder
        ]
      );
    }
    await client.query('COMMIT');
    return { treatmentPlan: await getOdontologyTreatmentPlan({ clientId, treatmentPlanId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function acceptOdontologyTreatmentPlan({
  clientId,
  treatmentPlanId,
  actorUserId,
  signerName = '',
  signerDocumentType = '',
  signerDocumentNumber = '',
  signerRelationship = '',
  signaturePath = null
}) {
  const cleanSignerName = requiredText(signerName);
  const cleanSignerDocumentType = requiredText(signerDocumentType);
  const cleanSignerDocumentNumber = requiredText(signerDocumentNumber);
  const cleanSignerRelationship = sanitizeText(signerRelationship);
  const missing = [];
  if (!cleanSignerName) missing.push('nombre del firmante');
  if (!cleanSignerDocumentType) missing.push('tipo de documento del firmante');
  if (!cleanSignerDocumentNumber) missing.push('documento del firmante');
  if (!signaturePath) missing.push('firma del paciente o acudiente');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!ODONTOLOGY_DOCUMENT_TYPES.has(cleanSignerDocumentType)) {
    return { error: 'VALIDATION', message: 'Tipo de documento del firmante inválido.' };
  }

  const { rows } = await query(
    `UPDATE odontology_treatment_plans
     SET status = 'accepted',
         accepted_signer_name = $3,
         accepted_signer_document_type = $4,
         accepted_signer_document_number = $5,
         accepted_signer_relationship = $6,
         accepted_signature_path = $7,
         accepted_at = NOW(),
         accepted_by = $8,
         updated_by = $8
     WHERE client_id = $1
       AND id = $2
       AND status NOT IN ('accepted', 'in_progress', 'completed', 'cancelled')
       AND accepted_signature_path IS NULL
     RETURNING id`,
    [
      clientId,
      treatmentPlanId,
      cleanSignerName,
      cleanSignerDocumentType,
      cleanSignerDocumentNumber,
      cleanSignerRelationship,
      signaturePath,
      actorUserId
    ]
  );
  if (!rows[0]) {
    return { error: 'NOT_FOUND', message: 'Plan no encontrado o ya no está disponible para aceptación.' };
  }
  return { treatmentPlan: await getOdontologyTreatmentPlan({ clientId, treatmentPlanId }) };
}

const ODONTOLOGY_ATTACHMENT_CATEGORIES = new Set([
  'radiografia',
  'autorizacion',
  'remision',
  'laboratorio',
  'formula',
  'foto_clinica',
  'documento_externo',
  'otro'
]);

function attachmentSelectSql() {
  return `SELECT oa.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 cr.status AS clinical_record_status,
                 tp.title AS treatment_plan_title,
                 u.display_name AS uploaded_by_name
          FROM odontology_attachments oa
          JOIN odontology_patients p ON p.id = oa.patient_id
          LEFT JOIN odontology_clinical_records cr ON cr.id = oa.clinical_record_id
          LEFT JOIN odontology_treatment_plans tp ON tp.id = oa.treatment_plan_id
          LEFT JOIN users u ON u.id = oa.uploaded_by`;
}

export async function listOdontologyAttachments({ clientId, patientId = '', category = '', search = '' }) {
  const params = [clientId];
  const filters = ['oa.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`oa.patient_id = $${params.length}`);
  }
  if (category) {
    params.push(category);
    filters.push(`oa.category = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(oa.title) LIKE $${params.length}
      OR LOWER(COALESCE(oa.description, '')) LIKE $${params.length}
      OR LOWER(COALESCE(oa.original_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${attachmentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY oa.document_date DESC, oa.created_at DESC
     LIMIT 250`,
    params
  );
  return rows;
}

export async function getOdontologyAttachmentById({ clientId, attachmentId }) {
  const { rows } = await query(
    `${attachmentSelectSql()}
     WHERE oa.client_id = $1
       AND oa.id = $2
     LIMIT 1`,
    [clientId, attachmentId]
  );
  return rows[0] || null;
}

async function validateAttachmentReference({ clientId, tableName, id, patientId }) {
  if (!id) return true;
  const patientFilter = patientId ? 'AND patient_id = $3' : '';
  const params = patientId ? [clientId, id, patientId] : [clientId, id];
  const { rows } = await query(
    `SELECT 1 FROM ${tableName} WHERE client_id = $1 AND id = $2 ${patientFilter} LIMIT 1`,
    params
  );
  return rows.length > 0;
}

export async function createOdontologyAttachment({ clientId, payload, actorUserId }) {
  const data = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    clinicalRecordId: sanitizeText(payload.clinicalRecordId || payload.clinical_record_id),
    appointmentId: sanitizeText(payload.appointmentId || payload.appointment_id),
    treatmentPlanId: sanitizeText(payload.treatmentPlanId || payload.treatment_plan_id),
    category: requiredText(payload.category || 'otro'),
    title: requiredText(payload.title),
    description: sanitizeText(payload.description),
    documentDate: requiredText(payload.documentDate || payload.document_date),
    filePath: requiredText(payload.filePath || payload.file_path),
    originalName: sanitizeText(payload.originalName || payload.original_name),
    mimeType: sanitizeText(payload.mimeType || payload.mime_type),
    sizeBytes: Number(payload.sizeBytes || payload.size_bytes || 0)
  };
  const missing = [];
  if (!data.patientId) missing.push('paciente');
  if (!data.title) missing.push('titulo');
  if (!data.documentDate) missing.push('fecha del documento');
  if (!data.filePath) missing.push('archivo');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!ODONTOLOGY_ATTACHMENT_CATEGORIES.has(data.category)) {
    return { error: 'VALIDATION', message: 'Categoría de adjunto inválida.' };
  }
  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
  if (!(await validateAttachmentReference({ clientId, tableName: 'odontology_clinical_records', id: data.clinicalRecordId, patientId: data.patientId }))) {
    return { error: 'VALIDATION', message: 'La historia clínica no corresponde al paciente.' };
  }
  if (!(await validateAttachmentReference({ clientId, tableName: 'odontology_appointments', id: data.appointmentId, patientId: data.patientId }))) {
    return { error: 'VALIDATION', message: 'La cita no corresponde al paciente.' };
  }
  if (!(await validateAttachmentReference({ clientId, tableName: 'odontology_treatment_plans', id: data.treatmentPlanId, patientId: data.patientId }))) {
    return { error: 'VALIDATION', message: 'El plan de tratamiento no corresponde al paciente.' };
  }

  const { rows } = await query(
    `INSERT INTO odontology_attachments (
       client_id, patient_id, clinical_record_id, appointment_id, treatment_plan_id,
       category, title, description, document_date, file_path, original_name,
       mime_type, size_bytes, uploaded_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      clientId,
      data.patientId,
      data.clinicalRecordId,
      data.appointmentId,
      data.treatmentPlanId,
      data.category,
      data.title,
      data.description,
      data.documentDate,
      data.filePath,
      data.originalName,
      data.mimeType,
      data.sizeBytes,
      actorUserId
    ]
  );
  return { attachment: await getOdontologyAttachmentById({ clientId, attachmentId: rows[0].id }) };
}

export async function deleteOdontologyAttachment({ clientId, attachmentId }) {
  const { rows } = await query(
    `DELETE FROM odontology_attachments
     WHERE client_id = $1
       AND id = $2
     RETURNING *`,
    [clientId, attachmentId]
  );
  return rows[0] || null;
}

function inventoryItemSelectSql() {
  return `SELECT oi.*,
                 (oi.current_stock <= oi.min_stock) AS low_stock,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_inventory_items oi
          LEFT JOIN users cu ON cu.id = oi.created_by
          LEFT JOIN users uu ON uu.id = oi.updated_by`;
}

function normalizeInventoryItem(row) {
  if (!row) return null;
  return {
    ...row,
    min_stock: Number(row.min_stock || 0),
    current_stock: Number(row.current_stock || 0),
    unit_cost: row.unit_cost === null ? null : Number(row.unit_cost)
  };
}

export async function listOdontologyInventoryItems({ clientId, status = '', lowStockOnly = false, search = '' }) {
  const params = [clientId];
  const filters = ['oi.client_id = $1'];
  if (status === 'active') filters.push('oi.is_active = TRUE');
  if (status === 'inactive') filters.push('oi.is_active = FALSE');
  if (lowStockOnly) filters.push('oi.current_stock <= oi.min_stock');
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(oi.name) LIKE $${params.length}
      OR LOWER(COALESCE(oi.code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(oi.category, '')) LIKE $${params.length}
      OR LOWER(COALESCE(oi.brand, '')) LIKE $${params.length}
      OR LOWER(COALESCE(oi.supplier, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${inventoryItemSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY low_stock DESC, oi.is_active DESC, oi.name
     LIMIT 400`,
    params
  );
  return rows.map(normalizeInventoryItem);
}

export async function getOdontologyInventoryItemById({ clientId, itemId }) {
  const { rows } = await query(
    `${inventoryItemSelectSql()}
     WHERE oi.client_id = $1
       AND oi.id = $2
     LIMIT 1`,
    [clientId, itemId]
  );
  return normalizeInventoryItem(rows[0]);
}

export async function createOdontologyInventoryItem({ clientId, payload, actorUserId }) {
  const data = {
    code: sanitizeText(payload.code),
    name: requiredText(payload.name),
    category: sanitizeText(payload.category),
    presentation: sanitizeText(payload.presentation),
    unit: requiredText(payload.unit || 'unidad'),
    brand: sanitizeText(payload.brand),
    supplier: sanitizeText(payload.supplier),
    minStock: numberOrDefault(payload.minStock ?? payload.min_stock, 0),
    currentStock: numberOrDefault(payload.currentStock ?? payload.current_stock, 0),
    unitCost: payload.unitCost === '' || payload.unitCost === null || payload.unitCost === undefined
      ? null
      : numberOrDefault(payload.unitCost ?? payload.unit_cost, 0),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active),
    notes: sanitizeText(payload.notes)
  };
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del insumo obligatorio.' };
  if (!data.unit) return { error: 'VALIDATION', message: 'Unidad obligatoria.' };
  if (data.minStock < 0 || data.currentStock < 0) {
    return { error: 'VALIDATION', message: 'Las cantidades no pueden ser negativas.' };
  }
  try {
    const { rows } = await query(
      `INSERT INTO odontology_inventory_items (
         client_id, code, name, category, presentation, unit, brand, supplier,
         min_stock, current_stock, unit_cost, is_active, notes, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       RETURNING id`,
      [
        clientId,
        data.code,
        data.name,
        data.category,
        data.presentation,
        data.unit,
        data.brand,
        data.supplier,
        data.minStock,
        data.currentStock,
        data.unitCost,
        data.isActive,
        data.notes,
        actorUserId
      ]
    );
    return { item: await getOdontologyInventoryItemById({ clientId, itemId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un insumo con ese código.' };
    }
    throw error;
  }
}

export async function updateOdontologyInventoryItem({ clientId, itemId, payload, actorUserId }) {
  const existing = await getOdontologyInventoryItemById({ clientId, itemId });
  if (!existing) return { error: 'NOT_FOUND', message: 'Insumo no encontrado.' };
  const data = {
    code: sanitizeText(payload.code),
    name: requiredText(payload.name),
    category: sanitizeText(payload.category),
    presentation: sanitizeText(payload.presentation),
    unit: requiredText(payload.unit || 'unidad'),
    brand: sanitizeText(payload.brand),
    supplier: sanitizeText(payload.supplier),
    minStock: numberOrDefault(payload.minStock ?? payload.min_stock, 0),
    unitCost: payload.unitCost === '' || payload.unitCost === null || payload.unitCost === undefined
      ? null
      : numberOrDefault(payload.unitCost ?? payload.unit_cost, 0),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active),
    notes: sanitizeText(payload.notes)
  };
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del insumo obligatorio.' };
  if (!data.unit) return { error: 'VALIDATION', message: 'Unidad obligatoria.' };
  if (data.minStock < 0) return { error: 'VALIDATION', message: 'El stock mínimo no puede ser negativo.' };
  try {
    const { rows } = await query(
      `UPDATE odontology_inventory_items
       SET code = $3,
           name = $4,
           category = $5,
           presentation = $6,
           unit = $7,
           brand = $8,
           supplier = $9,
           min_stock = $10,
           unit_cost = $11,
           is_active = $12,
           notes = $13,
           updated_by = $14
       WHERE client_id = $1
         AND id = $2
       RETURNING id`,
      [
        clientId,
        itemId,
        data.code,
        data.name,
        data.category,
        data.presentation,
        data.unit,
        data.brand,
        data.supplier,
        data.minStock,
        data.unitCost,
        data.isActive,
        data.notes,
        actorUserId
      ]
    );
    return { item: await getOdontologyInventoryItemById({ clientId, itemId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un insumo con ese código.' };
    }
    throw error;
  }
}

function normalizeInventoryMovement(row) {
  if (!row) return null;
  return {
    ...row,
    quantity: Number(row.quantity || 0),
    unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
    stock_after: Number(row.stock_after || 0)
  };
}

export async function listOdontologyInventoryMovements({ clientId, itemId = '', movementType = '', search = '' }) {
  const params = [clientId];
  const filters = ['im.client_id = $1'];
  if (itemId) {
    params.push(itemId);
    filters.push(`im.item_id = $${params.length}`);
  }
  if (movementType) {
    params.push(movementType);
    filters.push(`im.movement_type = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(ii.name) LIKE $${params.length}
      OR LOWER(COALESCE(ii.code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(im.reason, '')) LIKE $${params.length}
      OR LOWER(COALESCE(im.reference, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `SELECT im.*,
            ii.name AS item_name,
            ii.code AS item_code,
            ii.unit AS item_unit,
            u.display_name AS created_by_name
     FROM odontology_inventory_movements im
     JOIN odontology_inventory_items ii ON ii.id = im.item_id
     LEFT JOIN users u ON u.id = im.created_by
     WHERE ${filters.join(' AND ')}
     ORDER BY im.movement_date DESC, im.created_at DESC
     LIMIT 300`,
    params
  );
  return rows.map(normalizeInventoryMovement);
}

export async function createOdontologyInventoryMovement({ clientId, payload, actorUserId }) {
  const data = {
    itemId: requiredText(payload.itemId || payload.item_id),
    movementType: requiredText(payload.movementType || payload.movement_type),
    quantity: numberOrDefault(payload.quantity, 0),
    movementDate: requiredText(payload.movementDate || payload.movement_date),
    reason: sanitizeText(payload.reason),
    reference: sanitizeText(payload.reference),
    unitCost: payload.unitCost === '' || payload.unitCost === null || payload.unitCost === undefined
      ? null
      : numberOrDefault(payload.unitCost ?? payload.unit_cost, 0)
  };
  if (!data.itemId) return { error: 'VALIDATION', message: 'Selecciona un insumo.' };
  if (!['entry', 'exit', 'adjustment'].includes(data.movementType)) {
    return { error: 'VALIDATION', message: 'Tipo de movimiento inválido.' };
  }
  if (!data.movementDate) return { error: 'VALIDATION', message: 'Fecha del movimiento obligatoria.' };
  if (data.movementType !== 'adjustment' && data.quantity <= 0) {
    return { error: 'VALIDATION', message: 'La cantidad debe ser mayor a cero.' };
  }
  if (data.movementType === 'adjustment' && data.quantity < 0) {
    return { error: 'VALIDATION', message: 'El stock físico no puede ser negativo.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: itemRows } = await client.query(
      `SELECT *
       FROM odontology_inventory_items
       WHERE client_id = $1
         AND id = $2
       FOR UPDATE`,
      [clientId, data.itemId]
    );
    const item = itemRows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return { error: 'NOT_FOUND', message: 'Insumo no encontrado.' };
    }
    const currentStock = Number(item.current_stock || 0);
    let nextStock = currentStock;
    if (data.movementType === 'entry') nextStock = currentStock + data.quantity;
    if (data.movementType === 'exit') nextStock = currentStock - data.quantity;
    if (data.movementType === 'adjustment') nextStock = data.quantity;
    if (nextStock < 0) {
      await client.query('ROLLBACK');
      return { error: 'VALIDATION', message: 'No hay stock suficiente para realizar la salida.' };
    }

    const { rows: movementRows } = await client.query(
      `INSERT INTO odontology_inventory_movements (
         client_id, item_id, movement_type, quantity, movement_date, reason,
         reference, unit_cost, stock_after, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        clientId,
        data.itemId,
        data.movementType,
        data.quantity,
        data.movementDate,
        data.reason,
        data.reference,
        data.unitCost,
        nextStock,
        actorUserId
      ]
    );
    await client.query(
      `UPDATE odontology_inventory_items
       SET current_stock = $3,
           unit_cost = COALESCE($4, unit_cost),
           updated_by = $5
       WHERE client_id = $1
         AND id = $2`,
      [clientId, data.itemId, nextStock, data.movementType === 'entry' ? data.unitCost : null, actorUserId]
    );
    await client.query('COMMIT');
    const movements = await listOdontologyInventoryMovements({ clientId, itemId: data.itemId });
    return {
      movement: movements.find((row) => row.id === movementRows[0].id) || null,
      item: await getOdontologyInventoryItemById({ clientId, itemId: data.itemId })
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function normalizeSupplier(row) {
  return row || null;
}

export async function listOdontologySuppliers({ clientId, status = 'active', search = '' }) {
  const params = [clientId];
  const filters = ['os.client_id = $1'];
  if (status === 'active') filters.push('os.is_active = TRUE');
  if (status === 'inactive') filters.push('os.is_active = FALSE');
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(os.name) LIKE $${params.length}
      OR LOWER(COALESCE(os.nit, '')) LIKE $${params.length}
      OR LOWER(COALESCE(os.contact_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(os.phone, '')) LIKE $${params.length}
      OR LOWER(COALESCE(os.email, '')) LIKE $${params.length}
      OR LOWER(COALESCE(os.category, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `SELECT os.*,
            cu.display_name AS created_by_name,
            uu.display_name AS updated_by_name
     FROM odontology_suppliers os
     LEFT JOIN users cu ON cu.id = os.created_by
     LEFT JOIN users uu ON uu.id = os.updated_by
     WHERE ${filters.join(' AND ')}
     ORDER BY os.is_active DESC, os.name
     LIMIT 300`,
    params
  );
  return rows.map(normalizeSupplier);
}

export async function getOdontologySupplierById({ clientId, supplierId }) {
  const { rows } = await query(
    `SELECT os.*,
            cu.display_name AS created_by_name,
            uu.display_name AS updated_by_name
     FROM odontology_suppliers os
     LEFT JOIN users cu ON cu.id = os.created_by
     LEFT JOIN users uu ON uu.id = os.updated_by
     WHERE os.client_id = $1
       AND os.id = $2
     LIMIT 1`,
    [clientId, supplierId]
  );
  return normalizeSupplier(rows[0]);
}

function normalizeSupplierPayload(payload) {
  return {
    name: requiredText(payload.name),
    nit: sanitizeText(payload.nit),
    contactName: sanitizeText(payload.contactName || payload.contact_name),
    phone: sanitizeText(payload.phone),
    email: sanitizeText(payload.email),
    address: sanitizeText(payload.address),
    category: sanitizeText(payload.category),
    notes: sanitizeText(payload.notes),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active)
  };
}

export async function createOdontologySupplier({ clientId, payload, actorUserId }) {
  const data = normalizeSupplierPayload(payload || {});
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del proveedor obligatorio.' };
  try {
    const { rows } = await query(
      `INSERT INTO odontology_suppliers (
         client_id, name, nit, contact_name, phone, email, address, category,
         notes, is_active, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       RETURNING id`,
      [
        clientId,
        data.name,
        data.nit,
        data.contactName,
        data.phone,
        data.email,
        data.address,
        data.category,
        data.notes,
        data.isActive,
        actorUserId
      ]
    );
    return { supplier: await getOdontologySupplierById({ clientId, supplierId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un proveedor con ese nombre.' };
    }
    throw error;
  }
}

export async function updateOdontologySupplier({ clientId, supplierId, payload, actorUserId }) {
  const existing = await getOdontologySupplierById({ clientId, supplierId });
  if (!existing) return { error: 'NOT_FOUND', message: 'Proveedor no encontrado.' };
  const data = normalizeSupplierPayload(payload || {});
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del proveedor obligatorio.' };
  try {
    const { rows } = await query(
      `UPDATE odontology_suppliers
       SET name = $3,
           nit = $4,
           contact_name = $5,
           phone = $6,
           email = $7,
           address = $8,
           category = $9,
           notes = $10,
           is_active = $11,
           updated_by = $12
       WHERE client_id = $1
         AND id = $2
       RETURNING id`,
      [
        clientId,
        supplierId,
        data.name,
        data.nit,
        data.contactName,
        data.phone,
        data.email,
        data.address,
        data.category,
        data.notes,
        data.isActive,
        actorUserId
      ]
    );
    return { supplier: await getOdontologySupplierById({ clientId, supplierId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un proveedor con ese nombre.' };
    }
    throw error;
  }
}

function normalizePurchaseRequest(row) {
  if (!row) return null;
  return {
    ...row,
    quantity: Number(row.quantity || 0),
    current_stock: Number(row.current_stock || 0),
    min_stock: Number(row.min_stock || 0)
  };
}

async function getOdontologyPurchaseRequestById({ clientId, requestId }) {
  const { rows } = await query(
    `SELECT opr.*,
            ii.name AS item_name,
            ii.code AS item_code,
            ii.unit AS item_unit,
            ii.current_stock,
            ii.min_stock,
            cu.display_name AS created_by_name,
            uu.display_name AS updated_by_name
     FROM odontology_purchase_requests opr
     JOIN odontology_inventory_items ii ON ii.id = opr.item_id
     LEFT JOIN users cu ON cu.id = opr.created_by
     LEFT JOIN users uu ON uu.id = opr.updated_by
     WHERE opr.client_id = $1
       AND opr.id = $2
     LIMIT 1`,
    [clientId, requestId]
  );
  return normalizePurchaseRequest(rows[0]);
}

export async function listOdontologyPurchaseRequests({ clientId, status = '', search = '' }) {
  const params = [clientId];
  const filters = ['opr.client_id = $1'];
  if (status) {
    params.push(status);
    filters.push(`opr.status = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(ii.name) LIKE $${params.length}
      OR LOWER(COALESCE(ii.code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(ii.category, '')) LIKE $${params.length}
      OR LOWER(COALESCE(opr.preferred_supplier, '')) LIKE $${params.length}
      OR LOWER(COALESCE(opr.reason, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `SELECT opr.*,
            ii.name AS item_name,
            ii.code AS item_code,
            ii.unit AS item_unit,
            ii.current_stock,
            ii.min_stock,
            cu.display_name AS created_by_name,
            uu.display_name AS updated_by_name
     FROM odontology_purchase_requests opr
     JOIN odontology_inventory_items ii ON ii.id = opr.item_id
     LEFT JOIN users cu ON cu.id = opr.created_by
     LEFT JOIN users uu ON uu.id = opr.updated_by
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE opr.status
         WHEN 'requested' THEN 1
         WHEN 'quoted' THEN 2
         WHEN 'ordered' THEN 3
         WHEN 'received' THEN 4
         ELSE 5
       END,
       opr.created_at DESC
     LIMIT 300`,
    params
  );
  return rows.map(normalizePurchaseRequest);
}

export async function createOdontologyPurchaseRequest({ clientId, payload, actorUserId }) {
  const data = {
    itemId: requiredText(payload.itemId || payload.item_id),
    quantity: numberOrDefault(payload.quantity, 0),
    neededByDate: sanitizeText(payload.neededByDate || payload.needed_by_date),
    preferredSupplier: sanitizeText(payload.preferredSupplier || payload.preferred_supplier),
    reason: sanitizeText(payload.reason)
  };
  if (!data.itemId) return { error: 'VALIDATION', message: 'Selecciona un insumo.' };
  if (data.quantity <= 0) return { error: 'VALIDATION', message: 'La cantidad solicitada debe ser mayor a cero.' };
  const item = await getOdontologyInventoryItemById({ clientId, itemId: data.itemId });
  if (!item) return { error: 'NOT_FOUND', message: 'Insumo no encontrado.' };

  const { rows } = await query(
    `INSERT INTO odontology_purchase_requests (
       client_id, item_id, quantity, needed_by_date, preferred_supplier, reason,
       status, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,'requested',$7,$7)
     RETURNING id`,
    [
      clientId,
      data.itemId,
      data.quantity,
      data.neededByDate || null,
      data.preferredSupplier,
      data.reason,
      actorUserId
    ]
  );
  return { request: await getOdontologyPurchaseRequestById({ clientId, requestId: rows[0].id }) };
}

export async function updateOdontologyPurchaseRequestStatus({ clientId, requestId, status, actorUserId }) {
  const cleanStatus = requiredText(status);
  if (!['requested', 'quoted', 'ordered', 'received', 'cancelled'].includes(cleanStatus)) {
    return { error: 'VALIDATION', message: 'Estado de solicitud inválido.' };
  }
  const { rows } = await query(
    `UPDATE odontology_purchase_requests
     SET status = $3,
         updated_by = $4
     WHERE client_id = $1
       AND id = $2
     RETURNING id`,
    [clientId, requestId, cleanStatus, actorUserId]
  );
  if (!rows[0]) return { error: 'NOT_FOUND', message: 'Solicitud de compra no encontrada.' };
  return { request: await getOdontologyPurchaseRequestById({ clientId, requestId: rows[0].id }) };
}

export async function listOdontologyProcedureInventoryKit({ clientId, procedureTypeId = '' }) {
  const params = [clientId];
  const filters = ['pki.client_id = $1'];
  if (procedureTypeId) {
    params.push(procedureTypeId);
    filters.push(`pki.procedure_type_id = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT pki.*,
            pt.name AS procedure_name,
            pt.code AS procedure_code,
            ii.name AS item_name,
            ii.code AS item_code,
            ii.unit AS item_unit,
            ii.current_stock,
            ii.min_stock,
            ii.is_active AS item_is_active
     FROM odontology_procedure_inventory_items pki
     JOIN odontology_procedure_types pt ON pt.id = pki.procedure_type_id
     JOIN odontology_inventory_items ii ON ii.id = pki.item_id
     WHERE ${filters.join(' AND ')}
     ORDER BY pt.name, pki.is_active DESC, ii.name
     LIMIT 500`,
    params
  );
  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity || 0),
    current_stock: Number(row.current_stock || 0),
    min_stock: Number(row.min_stock || 0)
  }));
}

export async function replaceOdontologyProcedureInventoryKit({ clientId, procedureTypeId, items = [], actorUserId }) {
  const cleanProcedureTypeId = requiredText(procedureTypeId);
  if (!cleanProcedureTypeId) return { error: 'VALIDATION', message: 'Selecciona un procedimiento.' };
  const { rows: procedureRows } = await query(
    `SELECT id
     FROM odontology_procedure_types
     WHERE id = $1
       AND (client_id IS NULL OR client_id = $2)
       AND is_active = TRUE
     LIMIT 1`,
    [cleanProcedureTypeId, clientId]
  );
  if (!procedureRows.length) return { error: 'NOT_FOUND', message: 'Procedimiento no encontrado.' };

  const cleanItems = (Array.isArray(items) ? items : []).map((item, index) => ({
    itemId: requiredText(item.itemId || item.item_id),
    quantity: numberOrDefault(item.quantity, 0),
    isActive: item.isActive === undefined && item.is_active === undefined
      ? true
      : booleanValue(item.isActive ?? item.is_active),
    notes: sanitizeText(item.notes),
    index
  })).filter((item) => item.itemId);

  const seen = new Set();
  for (const item of cleanItems) {
    if (seen.has(item.itemId)) {
      return { error: 'VALIDATION', message: 'No repitas el mismo insumo en el kit.' };
    }
    seen.add(item.itemId);
    if (item.quantity <= 0) {
      return { error: 'VALIDATION', message: `La cantidad del insumo ${item.index + 1} debe ser mayor a cero.` };
    }
    const inventoryItem = await getOdontologyInventoryItemById({ clientId, itemId: item.itemId });
    if (!inventoryItem) {
      return { error: 'VALIDATION', message: `El insumo ${item.index + 1} no existe o no pertenece al cliente.` };
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM odontology_procedure_inventory_items
       WHERE client_id = $1
         AND procedure_type_id = $2`,
      [clientId, cleanProcedureTypeId]
    );
    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO odontology_procedure_inventory_items (
           client_id, procedure_type_id, item_id, quantity, is_active,
           notes, created_by, updated_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [
          clientId,
          cleanProcedureTypeId,
          item.itemId,
          item.quantity,
          item.isActive,
          item.notes,
          actorUserId
        ]
      );
    }
    await client.query('COMMIT');
    return {
      kit: await listOdontologyProcedureInventoryKit({ clientId, procedureTypeId: cleanProcedureTypeId })
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function instrumentSelectSql() {
  return `SELECT oi.*,
                 cu.display_name AS created_by_name,
                 uu.display_name AS updated_by_name
          FROM odontology_instruments oi
          LEFT JOIN users cu ON cu.id = oi.created_by
          LEFT JOIN users uu ON uu.id = oi.updated_by`;
}

export async function listOdontologyInstruments({ clientId, status = 'active', search = '' }) {
  const params = [clientId];
  const filters = ['oi.client_id = $1'];
  if (status === 'active') filters.push('oi.is_active = TRUE');
  if (status === 'inactive') filters.push('oi.is_active = FALSE');
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(oi.name) LIKE $${params.length}
      OR LOWER(COALESCE(oi.code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(oi.category, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${instrumentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY oi.is_active DESC, oi.name
     LIMIT 400`,
    params
  );
  return rows;
}

export async function getOdontologyInstrumentById({ clientId, instrumentId }) {
  const { rows } = await query(
    `${instrumentSelectSql()}
     WHERE oi.client_id = $1
       AND oi.id = $2
     LIMIT 1`,
    [clientId, instrumentId]
  );
  return rows[0] || null;
}

export async function createOdontologyInstrument({ clientId, payload, actorUserId }) {
  const data = {
    code: sanitizeText(payload.code),
    name: requiredText(payload.name),
    category: sanitizeText(payload.category),
    totalQuantity: numberOrDefault(payload.totalQuantity ?? payload.total_quantity, 1),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active),
    notes: sanitizeText(payload.notes)
  };
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del instrumental obligatorio.' };
  if (data.totalQuantity < 0) return { error: 'VALIDATION', message: 'La cantidad no puede ser negativa.' };
  try {
    const { rows } = await query(
      `INSERT INTO odontology_instruments (
         client_id, code, name, category, total_quantity, is_active,
         notes, created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       RETURNING id`,
      [clientId, data.code, data.name, data.category, data.totalQuantity, data.isActive, data.notes, actorUserId]
    );
    return { instrument: await getOdontologyInstrumentById({ clientId, instrumentId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') return { error: 'DUPLICATE', message: 'Ya existe instrumental con ese código.' };
    throw error;
  }
}

export async function updateOdontologyInstrument({ clientId, instrumentId, payload, actorUserId }) {
  const existing = await getOdontologyInstrumentById({ clientId, instrumentId });
  if (!existing) return { error: 'NOT_FOUND', message: 'Instrumental no encontrado.' };
  const data = {
    code: sanitizeText(payload.code),
    name: requiredText(payload.name),
    category: sanitizeText(payload.category),
    totalQuantity: numberOrDefault(payload.totalQuantity ?? payload.total_quantity, 1),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active),
    notes: sanitizeText(payload.notes)
  };
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del instrumental obligatorio.' };
  if (data.totalQuantity < 0) return { error: 'VALIDATION', message: 'La cantidad no puede ser negativa.' };
  try {
    const { rows } = await query(
      `UPDATE odontology_instruments
       SET code = $3,
           name = $4,
           category = $5,
           total_quantity = $6,
           is_active = $7,
           notes = $8,
           updated_by = $9
       WHERE client_id = $1
         AND id = $2
       RETURNING id`,
      [clientId, instrumentId, data.code, data.name, data.category, data.totalQuantity, data.isActive, data.notes, actorUserId]
    );
    return { instrument: await getOdontologyInstrumentById({ clientId, instrumentId: rows[0].id }) };
  } catch (error) {
    if (error?.code === '23505') return { error: 'DUPLICATE', message: 'Ya existe instrumental con ese código.' };
    throw error;
  }
}

function sterilizationCycleSelectSql() {
  return `SELECT sc.*,
                 operator.display_name AS operator_name,
                 creator.display_name AS created_by_name,
                 a.scheduled_date AS appointment_date,
                 a.start_time AS appointment_start_time,
                 p.full_name AS patient_name,
                 pt.name AS procedure_name,
                 COUNT(sci.id)::int AS item_count
          FROM odontology_sterilization_cycles sc
          LEFT JOIN users operator ON operator.id = sc.operator_user_id
          LEFT JOIN users creator ON creator.id = sc.created_by
          LEFT JOIN odontology_appointments a ON a.id = sc.appointment_id
          LEFT JOIN odontology_patients p ON p.id = a.patient_id
          LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id`;
}

function sterilizationCycleGroupBySql() {
  return `GROUP BY sc.id, operator.display_name, creator.display_name, a.scheduled_date, a.start_time, p.full_name, pt.name`;
}

async function attachSterilizationCycleItems(cycles) {
  const list = Array.isArray(cycles) ? cycles : [cycles];
  const ids = list.map((cycle) => cycle?.id).filter(Boolean);
  if (!ids.length) return cycles;
  const { rows } = await query(
    `SELECT sci.*,
            oi.name AS instrument_name,
            oi.code AS instrument_code,
            oi.category AS instrument_category
     FROM odontology_sterilization_cycle_items sci
     JOIN odontology_instruments oi ON oi.id = sci.instrument_id
     WHERE sci.cycle_id = ANY($1::uuid[])
     ORDER BY oi.name`,
    [ids]
  );
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.cycle_id)) grouped.set(row.cycle_id, []);
    grouped.get(row.cycle_id).push(row);
  }
  for (const cycle of list) {
    cycle.items = grouped.get(cycle.id) || [];
  }
  return cycles;
}

export async function listOdontologySterilizationCycles({
  clientId,
  result = '',
  method = '',
  search = '',
  startDate = '',
  endDate = '',
  responsible = ''
}) {
  const params = [clientId];
  const filters = ['sc.client_id = $1'];
  if (result) {
    params.push(result);
    filters.push(`sc.result = $${params.length}`);
  }
  if (method) {
    params.push(method);
    filters.push(`sc.method = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    filters.push(`sc.cycle_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    filters.push(`sc.cycle_date <= $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(COALESCE(sc.cycle_code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(sc.observations, '')) LIKE $${params.length}
      OR LOWER(COALESCE(operator.display_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(p.full_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(pt.name, '')) LIKE $${params.length}
    )`);
  }
  const cleanResponsible = String(responsible || '').trim().toLowerCase();
  if (cleanResponsible) {
    params.push(`%${cleanResponsible}%`);
    filters.push(`(
      LOWER(COALESCE(operator.display_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(creator.display_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${sterilizationCycleSelectSql()}
     WHERE ${filters.join(' AND ')}
     ${sterilizationCycleGroupBySql()}
     ORDER BY sc.cycle_date DESC, sc.created_at DESC
     LIMIT 250`,
    params
  );
  await attachSterilizationCycleItems(rows);
  return rows;
}

export async function getOdontologySterilizationCycleById({ clientId, cycleId }) {
  const { rows } = await query(
    `${sterilizationCycleSelectSql()}
     WHERE sc.client_id = $1
       AND sc.id = $2
     ${sterilizationCycleGroupBySql()}
     LIMIT 1`,
    [clientId, cycleId]
  );
  if (!rows[0]) return null;
  await attachSterilizationCycleItems(rows[0]);
  return rows[0];
}

export async function setOdontologySterilizationCyclePdf({ clientId, cycleId, pdfPath }) {
  const { rows } = await query(
    `UPDATE odontology_sterilization_cycles
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2
     RETURNING id`,
    [clientId, cycleId, pdfPath]
  );
  if (!rows[0]) return null;
  return getOdontologySterilizationCycleById({ clientId, cycleId });
}

export async function createOdontologySterilizationCycle({ clientId, payload, actorUserId }) {
  const data = {
    cycleCode: sanitizeText(payload.cycleCode || payload.cycle_code),
    method: requiredText(payload.method || 'autoclave'),
    cycleDate: requiredText(payload.cycleDate || payload.cycle_date),
    startTime: normalizeTime(payload.startTime || payload.start_time),
    endTime: normalizeTime(payload.endTime || payload.end_time),
    temperature: sanitizeText(payload.temperature),
    pressure: sanitizeText(payload.pressure),
    operatorUserId: sanitizeText(payload.operatorUserId || payload.operator_user_id),
    appointmentId: sanitizeText(payload.appointmentId || payload.appointment_id),
    biologicalIndicator: sanitizeText(payload.biologicalIndicator || payload.biological_indicator),
    chemicalIndicator: sanitizeText(payload.chemicalIndicator || payload.chemical_indicator),
    result: requiredText(payload.result || 'successful'),
    observations: sanitizeText(payload.observations),
    items: Array.isArray(payload.items) ? payload.items : []
  };
  if (!['autoclave', 'chemical', 'dry_heat', 'other'].includes(data.method)) {
    return { error: 'VALIDATION', message: 'Método de esterilización inválido.' };
  }
  if (!['successful', 'failed', 'pending'].includes(data.result)) {
    return { error: 'VALIDATION', message: 'Resultado de esterilización inválido.' };
  }
  if (!data.cycleDate) return { error: 'VALIDATION', message: 'Fecha del ciclo obligatoria.' };
  if (!data.items.length) return { error: 'VALIDATION', message: 'Agrega al menos un instrumental al ciclo.' };

  const cleanItems = data.items.map((item, index) => ({
    instrumentId: requiredText(item.instrumentId || item.instrument_id),
    quantity: Number(item.quantity || 0),
    notes: sanitizeText(item.notes),
    index
  }));
  for (const item of cleanItems) {
    if (!item.instrumentId) return { error: 'VALIDATION', message: `Selecciona el instrumental ${item.index + 1}.` };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { error: 'VALIDATION', message: `La cantidad del instrumental ${item.index + 1} debe ser mayor a cero.` };
    }
    const instrument = await getOdontologyInstrumentById({ clientId, instrumentId: item.instrumentId });
    if (!instrument || !instrument.is_active) {
      return { error: 'VALIDATION', message: `El instrumental ${item.index + 1} no existe o está inactivo.` };
    }
  }
  if (data.operatorUserId) {
    const { rows } = await query(
      `SELECT 1 FROM users WHERE id = $1 AND client_id = $2 AND is_active = TRUE LIMIT 1`,
      [data.operatorUserId, clientId]
    );
    if (!rows.length) return { error: 'VALIDATION', message: 'Responsable no válido para este cliente.' };
  }
  if (data.appointmentId) {
    const { rows } = await query(
      `SELECT 1 FROM odontology_appointments WHERE id = $1 AND client_id = $2 LIMIT 1`,
      [data.appointmentId, clientId]
    );
    if (!rows.length) return { error: 'VALIDATION', message: 'La cita asociada no pertenece al cliente.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO odontology_sterilization_cycles (
         client_id, cycle_code, method, cycle_date, start_time, end_time,
         temperature, pressure, operator_user_id, appointment_id,
         biological_indicator, chemical_indicator, result, observations, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        clientId,
        data.cycleCode,
        data.method,
        data.cycleDate,
        data.startTime,
        data.endTime,
        data.temperature,
        data.pressure,
        data.operatorUserId || actorUserId,
        data.appointmentId,
        data.biologicalIndicator,
        data.chemicalIndicator,
        data.result,
        data.observations,
        actorUserId
      ]
    );
    const cycleId = rows[0].id;
    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO odontology_sterilization_cycle_items (
           cycle_id, instrument_id, quantity, notes
         )
         VALUES ($1,$2,$3,$4)`,
        [cycleId, item.instrumentId, item.quantity, item.notes]
      );
    }
    await client.query('COMMIT');
    return { cycle: await getOdontologySterilizationCycleById({ clientId, cycleId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un ciclo con ese código.' };
    }
    throw error;
  } finally {
    client.release();
  }
}

const ODONTOLOGY_PAYMENT_METHODS = new Set([
  'efectivo',
  'transferencia',
  'tarjeta_credito',
  'tarjeta_debito',
  'nequi',
  'daviplata',
  'cheque',
  'otro'
]);

function paymentSelectSql() {
  return `SELECT op.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_number AS patient_document_number,
                 tp.title AS treatment_plan_title,
                 tp.total_amount AS treatment_plan_total,
                 creator.display_name AS created_by_name,
                 voider.display_name AS voided_by_name
          FROM odontology_payments op
          JOIN odontology_patients p ON p.id = op.patient_id
          LEFT JOIN odontology_treatment_plans tp ON tp.id = op.treatment_plan_id
          LEFT JOIN users creator ON creator.id = op.created_by
          LEFT JOIN users voider ON voider.id = op.voided_by`;
}

export async function listOdontologyPayments({
  clientId,
  patientId = '',
  treatmentPlanId = '',
  status = '',
  search = '',
  startDate = '',
  endDate = '',
  cashier = '',
  limit = 250
}) {
  const params = [clientId];
  const filters = ['op.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`op.patient_id = $${params.length}`);
  }
  if (treatmentPlanId) {
    params.push(treatmentPlanId);
    filters.push(`op.treatment_plan_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`op.status = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    filters.push(`op.payment_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    filters.push(`op.payment_date <= $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(op.concept) LIKE $${params.length}
      OR LOWER(COALESCE(op.reference, '')) LIKE $${params.length}
      OR LOWER(COALESCE(tp.title, '')) LIKE $${params.length}
    )`);
  }
  const cleanCashier = String(cashier || '').trim().toLowerCase();
  if (cleanCashier) {
    params.push(`%${cleanCashier}%`);
    filters.push(`LOWER(COALESCE(creator.display_name, '')) LIKE $${params.length}`);
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 5000);
  params.push(safeLimit);
  const { rows } = await query(
    `${paymentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY op.payment_date DESC, op.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function getOdontologyPaymentById({ clientId, paymentId }) {
  const { rows } = await query(
    `${paymentSelectSql()}
     WHERE op.client_id = $1
       AND op.id = $2
     LIMIT 1`,
    [clientId, paymentId]
  );
  return rows[0] || null;
}

export async function createOdontologyPayment({ clientId, payload, actorUserId }) {
  const data = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    treatmentPlanId: sanitizeText(payload.treatmentPlanId || payload.treatment_plan_id),
    concept: requiredText(payload.concept || 'Abono odontológico'),
    amount: numberOrDefault(payload.amount, 0),
    paymentMethod: requiredText(payload.paymentMethod || payload.payment_method || 'efectivo'),
    paymentDate: requiredText(payload.paymentDate || payload.payment_date),
    reference: sanitizeText(payload.reference),
    notes: sanitizeText(payload.notes)
  };

  const missing = [];
  if (!data.patientId) missing.push('paciente');
  if (!data.concept) missing.push('concepto');
  if (!data.paymentDate) missing.push('fecha de pago');
  if (data.amount <= 0) missing.push('valor mayor a cero');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!ODONTOLOGY_PAYMENT_METHODS.has(data.paymentMethod)) {
    return { error: 'VALIDATION', message: 'Método de pago inválido.' };
  }

  const patient = await getOdontologyPatientById({ clientId, patientId: data.patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };

  if (data.treatmentPlanId) {
    const plan = await getOdontologyTreatmentPlan({ clientId, treatmentPlanId: data.treatmentPlanId });
    if (!plan || plan.patient_id !== data.patientId) {
      return { error: 'VALIDATION', message: 'El plan de tratamiento no corresponde al paciente.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO odontology_payments (
       client_id, patient_id, treatment_plan_id, concept, amount, payment_method,
       payment_date, reference, notes, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     RETURNING id`,
    [
      clientId,
      data.patientId,
      data.treatmentPlanId,
      data.concept,
      data.amount,
      data.paymentMethod,
      data.paymentDate,
      data.reference,
      data.notes,
      actorUserId
    ]
  );
  return { payment: await getOdontologyPaymentById({ clientId, paymentId: rows[0].id }) };
}

export async function voidOdontologyPayment({ clientId, paymentId, reason, actorUserId }) {
  const cleanReason = requiredText(reason);
  if (!cleanReason) return { error: 'VALIDATION', message: 'Motivo de anulación obligatorio.' };
  const { rows } = await query(
    `UPDATE odontology_payments
     SET status = 'voided',
         void_reason = $3,
         voided_by = $4,
         voided_at = NOW(),
         updated_by = $4
     WHERE client_id = $1
       AND id = $2
       AND status = 'registered'
     RETURNING id`,
    [clientId, paymentId, cleanReason, actorUserId]
  );
  if (!rows[0]) return { error: 'NOT_FOUND', message: 'Pago no encontrado o ya anulado.' };
  return { payment: await getOdontologyPaymentById({ clientId, paymentId }) };
}

function cashClosureSelectSql() {
  return `SELECT occ.*,
                 creator.display_name AS created_by_name
          FROM odontology_cash_closures occ
          LEFT JOIN users creator ON creator.id = occ.created_by`;
}

export async function listOdontologyCashClosures({
  clientId,
  startDate = '',
  endDate = '',
  cashier = ''
}) {
  const params = [clientId];
  const filters = ['occ.client_id = $1'];
  if (startDate) {
    params.push(startDate);
    filters.push(`occ.date_to >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    filters.push(`occ.date_from <= $${params.length}`);
  }
  const cleanCashier = String(cashier || '').trim().toLowerCase();
  if (cleanCashier) {
    params.push(`%${cleanCashier}%`);
    filters.push(`LOWER(COALESCE(occ.cashier_filter, '')) LIKE $${params.length}`);
  }
  const { rows } = await query(
    `${cashClosureSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY occ.created_at DESC
     LIMIT 80`,
    params
  );
  return rows;
}

export async function getOdontologyCashClosureById({ clientId, closureId }) {
  const { rows } = await query(
    `${cashClosureSelectSql()}
     WHERE occ.client_id = $1
       AND occ.id = $2
     LIMIT 1`,
    [clientId, closureId]
  );
  return rows[0] || null;
}

export async function setOdontologyCashClosurePdf({ clientId, closureId, pdfPath }) {
  const { rows } = await query(
    `UPDATE odontology_cash_closures
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2
     RETURNING id`,
    [clientId, closureId, pdfPath]
  );
  return rows[0] || null;
}

export async function createOdontologyCashClosure({ clientId, payload, actorUserId }) {
  const data = {
    dateFrom: requiredText(payload.dateFrom || payload.date_from || payload.startDate || payload.start_date),
    dateTo: requiredText(payload.dateTo || payload.date_to || payload.endDate || payload.end_date),
    cashier: sanitizeText(payload.cashier || payload.cashier_filter),
    notes: sanitizeText(payload.notes)
  };

  const missing = [];
  if (!data.dateFrom) missing.push('fecha inicial');
  if (!data.dateTo) missing.push('fecha final');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (data.dateTo < data.dateFrom) {
    return { error: 'VALIDATION', message: 'La fecha final no puede ser menor que la fecha inicial.' };
  }

  const payments = await listOdontologyPayments({
    clientId,
    startDate: data.dateFrom,
    endDate: data.dateTo,
    cashier: data.cashier || '',
    limit: 5000
  });
  const registered = payments.filter((payment) => payment.status === 'registered');
  const voided = payments.filter((payment) => payment.status === 'voided');
  const totalRegistered = registered.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalVoided = voided.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const { rows } = await query(
    `INSERT INTO odontology_cash_closures (
       client_id, date_from, date_to, cashier_filter, total_registered, total_voided,
       registered_count, voided_count, notes, created_by, updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     RETURNING id`,
    [
      clientId,
      data.dateFrom,
      data.dateTo,
      data.cashier,
      totalRegistered,
      totalVoided,
      registered.length,
      voided.length,
      data.notes,
      actorUserId
    ]
  );

  return {
    closure: await getOdontologyCashClosureById({ clientId, closureId: rows[0].id }),
    payments
  };
}

export async function listOdontologyMedications({ clientId, activeOnly = false, search = '' }) {
  const params = [clientId];
  const filters = ['(client_id IS NULL OR client_id = $1)'];
  if (activeOnly) filters.push('is_active = TRUE');
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(name) LIKE $${params.length}
      OR LOWER(COALESCE(concentration, '')) LIKE $${params.length}
      OR LOWER(COALESCE(pharmaceutical_form, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `SELECT id,
            client_id,
            name,
            concentration,
            pharmaceutical_form,
            default_dose,
            default_frequency,
            default_duration,
            default_instructions,
            is_active,
            is_system
     FROM odontology_medications
     WHERE ${filters.join(' AND ')}
     ORDER BY is_system DESC, is_active DESC, name, concentration NULLS LAST
     LIMIT 300`,
    params
  );
  return rows;
}

export async function createOdontologyMedication({ clientId, payload, actorUserId }) {
  const data = {
    name: requiredText(payload.name),
    concentration: sanitizeText(payload.concentration),
    pharmaceuticalForm: sanitizeText(payload.pharmaceuticalForm || payload.pharmaceutical_form),
    defaultDose: sanitizeText(payload.defaultDose || payload.default_dose),
    defaultFrequency: sanitizeText(payload.defaultFrequency || payload.default_frequency),
    defaultDuration: sanitizeText(payload.defaultDuration || payload.default_duration),
    defaultInstructions: sanitizeText(payload.defaultInstructions || payload.default_instructions),
    isActive: payload.isActive === undefined && payload.is_active === undefined
      ? true
      : booleanValue(payload.isActive ?? payload.is_active)
  };
  if (!data.name) return { error: 'VALIDATION', message: 'Nombre del medicamento obligatorio.' };
  try {
    const { rows } = await query(
      `INSERT INTO odontology_medications (
         client_id, name, concentration, pharmaceutical_form, default_dose,
         default_frequency, default_duration, default_instructions, is_active,
         created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       RETURNING *`,
      [
        clientId,
        data.name,
        data.concentration,
        data.pharmaceuticalForm,
        data.defaultDose,
        data.defaultFrequency,
        data.defaultDuration,
        data.defaultInstructions,
        data.isActive,
        actorUserId
      ]
    );
    return { medication: rows[0] };
  } catch (error) {
    if (error?.code === '23505') {
      return { error: 'DUPLICATE', message: 'Ya existe un medicamento con ese nombre, concentración y forma.' };
    }
    throw error;
  }
}

function prescriptionSelectSql() {
  return `SELECT pr.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_type AS patient_document_type,
                 p.document_number AS patient_document_number,
                 p.birth_date AS patient_birth_date,
                 p.phone AS patient_phone,
                 cr.status AS clinical_record_status,
                 a.scheduled_date AS appointment_date,
                 a.start_time AS appointment_start_time,
                 u.display_name AS issued_by_name,
                 u.document_type AS issued_by_document_type,
                 u.document_number AS issued_by_document_number,
                 u.invima_registration AS issued_by_invima_registration
          FROM odontology_prescriptions pr
          JOIN odontology_patients p ON p.id = pr.patient_id
          LEFT JOIN odontology_clinical_records cr ON cr.id = pr.clinical_record_id
          LEFT JOIN odontology_appointments a ON a.id = pr.appointment_id
          LEFT JOIN users u ON u.id = pr.issued_by`;
}

async function attachPrescriptionItems(prescriptions) {
  const list = Array.isArray(prescriptions) ? prescriptions : [prescriptions];
  const ids = list.map((item) => item?.id).filter(Boolean);
  if (!ids.length) return prescriptions;
  const { rows } = await query(
    `SELECT *
     FROM odontology_prescription_items
     WHERE prescription_id = ANY($1::uuid[])
     ORDER BY prescription_id, sort_order, created_at`,
    [ids]
  );
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.prescription_id)) grouped.set(row.prescription_id, []);
    grouped.get(row.prescription_id).push(row);
  }
  for (const prescription of list) {
    prescription.items = grouped.get(prescription.id) || [];
  }
  return prescriptions;
}

export async function listOdontologyPrescriptions({ clientId, patientId = '', status = '', search = '' }) {
  const params = [clientId];
  const filters = ['pr.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`pr.patient_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`pr.status = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(COALESCE(pr.diagnosis, '')) LIKE $${params.length}
      OR LOWER(COALESCE(pr.general_instructions, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.display_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${prescriptionSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY pr.prescription_date DESC, pr.created_at DESC
     LIMIT 250`,
    params
  );
  await attachPrescriptionItems(rows);
  return rows;
}

export async function getOdontologyPrescriptionById({ clientId, prescriptionId }) {
  const { rows } = await query(
    `${prescriptionSelectSql()}
     WHERE pr.client_id = $1
       AND pr.id = $2
     LIMIT 1`,
    [clientId, prescriptionId]
  );
  if (!rows[0]) return null;
  await attachPrescriptionItems(rows[0]);
  return rows[0];
}

async function validatePrescriptionReferences({ clientId, patientId, clinicalRecordId, appointmentId }) {
  const patient = await getOdontologyPatientById({ clientId, patientId });
  if (!patient) return { error: 'NOT_FOUND', message: 'Paciente no encontrado.' };
  if (clinicalRecordId && !(await validateAttachmentReference({ clientId, tableName: 'odontology_clinical_records', id: clinicalRecordId, patientId }))) {
    return { error: 'VALIDATION', message: 'La historia clínica no corresponde al paciente.' };
  }
  if (appointmentId && !(await validateAttachmentReference({ clientId, tableName: 'odontology_appointments', id: appointmentId, patientId }))) {
    return { error: 'VALIDATION', message: 'La cita no corresponde al paciente.' };
  }
  return { ok: true };
}

export async function createOdontologyPrescription({ clientId, payload, actorUserId }) {
  const data = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    clinicalRecordId: sanitizeText(payload.clinicalRecordId || payload.clinical_record_id),
    appointmentId: sanitizeText(payload.appointmentId || payload.appointment_id),
    prescriptionDate: requiredText(payload.prescriptionDate || payload.prescription_date),
    diagnosis: sanitizeText(payload.diagnosis),
    generalInstructions: sanitizeText(payload.generalInstructions || payload.general_instructions),
    items: Array.isArray(payload.items) ? payload.items : []
  };
  const missing = [];
  if (!data.patientId) missing.push('paciente');
  if (!data.prescriptionDate) missing.push('fecha');
  if (!data.items.length) missing.push('al menos un medicamento');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };

  const cleanItems = data.items.map((item, index) => ({
    medicationId: sanitizeText(item.medicationId || item.medication_id),
    medicationName: requiredText(item.medicationName || item.medication_name || item.name),
    concentration: sanitizeText(item.concentration),
    pharmaceuticalForm: sanitizeText(item.pharmaceuticalForm || item.pharmaceutical_form),
    dose: requiredText(item.dose),
    frequency: requiredText(item.frequency),
    duration: requiredText(item.duration),
    quantity: sanitizeText(item.quantity),
    instructions: sanitizeText(item.instructions),
    sortOrder: index + 1
  }));
  const invalidIndex = cleanItems.findIndex((item) => !item.medicationName || !item.dose || !item.frequency || !item.duration);
  if (invalidIndex >= 0) {
    return { error: 'VALIDATION', message: `Revisa el medicamento ${invalidIndex + 1}: nombre, dosis, frecuencia y duración son obligatorios.` };
  }

  const references = await validatePrescriptionReferences({
    clientId,
    patientId: data.patientId,
    clinicalRecordId: data.clinicalRecordId,
    appointmentId: data.appointmentId
  });
  if (!references.ok) return references;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO odontology_prescriptions (
         client_id, patient_id, clinical_record_id, appointment_id, prescription_date,
         diagnosis, general_instructions, status, issued_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,'issued',$8)
       RETURNING id`,
      [
        clientId,
        data.patientId,
        data.clinicalRecordId,
        data.appointmentId,
        data.prescriptionDate,
        data.diagnosis,
        data.generalInstructions,
        actorUserId
      ]
    );
    const prescriptionId = rows[0].id;
    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO odontology_prescription_items (
           prescription_id, medication_id, medication_name, concentration,
           pharmaceutical_form, dose, frequency, duration, quantity,
           instructions, sort_order
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          prescriptionId,
          item.medicationId,
          item.medicationName,
          item.concentration,
          item.pharmaceuticalForm,
          item.dose,
          item.frequency,
          item.duration,
          item.quantity,
          item.instructions,
          item.sortOrder
        ]
      );
    }
    await client.query('COMMIT');
    return { prescription: await getOdontologyPrescriptionById({ clientId, prescriptionId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setOdontologyPrescriptionPdf({ clientId, prescriptionId, pdfPath }) {
  const { rows } = await query(
    `UPDATE odontology_prescriptions
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2
     RETURNING id`,
    [clientId, prescriptionId, pdfPath]
  );
  if (!rows[0]) return null;
  return getOdontologyPrescriptionById({ clientId, prescriptionId });
}

const ODONTOLOGY_CLINICAL_DOCUMENT_TYPES = new Set(['certificado', 'incapacidad', 'constancia', 'remision', 'otro']);

function clinicalDocumentSelectSql() {
  return `SELECT od.*,
                 p.internal_code AS patient_code,
                 p.full_name AS patient_name,
                 p.document_type AS patient_document_type,
                 p.document_number AS patient_document_number,
                 p.birth_date AS patient_birth_date,
                 p.phone AS patient_phone,
                 cr.status AS clinical_record_status,
                 a.scheduled_date AS appointment_date,
                 a.start_time AS appointment_start_time,
                 u.display_name AS issued_by_name,
                 u.document_type AS issued_by_document_type,
                 u.document_number AS issued_by_document_number,
                 u.invima_registration AS issued_by_invima_registration
          FROM odontology_clinical_documents od
          JOIN odontology_patients p ON p.id = od.patient_id
          LEFT JOIN odontology_clinical_records cr ON cr.id = od.clinical_record_id
          LEFT JOIN odontology_appointments a ON a.id = od.appointment_id
          LEFT JOIN users u ON u.id = od.issued_by`;
}

export async function listOdontologyClinicalDocuments({ clientId, patientId = '', documentType = '', status = '', search = '' }) {
  const params = [clientId];
  const filters = ['od.client_id = $1'];
  if (patientId) {
    params.push(patientId);
    filters.push(`od.patient_id = $${params.length}`);
  }
  if (documentType) {
    params.push(documentType);
    filters.push(`od.document_type = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`od.status = $${params.length}`);
  }
  const cleanSearch = String(search || '').trim().toLowerCase();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    filters.push(`(
      LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(p.document_number) LIKE $${params.length}
      OR LOWER(od.title) LIKE $${params.length}
      OR LOWER(od.body) LIKE $${params.length}
      OR LOWER(COALESCE(od.recommendations, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.display_name, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${clinicalDocumentSelectSql()}
     WHERE ${filters.join(' AND ')}
     ORDER BY od.document_date DESC, od.created_at DESC
     LIMIT 250`,
    params
  );
  return rows;
}

export async function getOdontologyClinicalDocumentById({ clientId, documentId }) {
  const { rows } = await query(
    `${clinicalDocumentSelectSql()}
     WHERE od.client_id = $1
       AND od.id = $2
     LIMIT 1`,
    [clientId, documentId]
  );
  return rows[0] || null;
}

export async function createOdontologyClinicalDocument({ clientId, payload, actorUserId }) {
  const data = {
    patientId: requiredText(payload.patientId || payload.patient_id),
    clinicalRecordId: sanitizeText(payload.clinicalRecordId || payload.clinical_record_id),
    appointmentId: sanitizeText(payload.appointmentId || payload.appointment_id),
    documentType: requiredText(payload.documentType || payload.document_type || 'certificado'),
    title: requiredText(payload.title),
    documentDate: requiredText(payload.documentDate || payload.document_date),
    startDate: sanitizeText(payload.startDate || payload.start_date),
    endDate: sanitizeText(payload.endDate || payload.end_date),
    days: payload.days === '' || payload.days === null || payload.days === undefined ? null : numberOrDefault(payload.days, 0),
    body: requiredText(payload.body),
    recommendations: sanitizeText(payload.recommendations)
  };

  const missing = [];
  if (!data.patientId) missing.push('paciente');
  if (!data.documentType) missing.push('tipo');
  if (!data.title) missing.push('titulo');
  if (!data.documentDate) missing.push('fecha');
  if (!data.body) missing.push('contenido');
  if (missing.length) return { error: 'VALIDATION', message: `Campos obligatorios: ${missing.join(', ')}.` };
  if (!ODONTOLOGY_CLINICAL_DOCUMENT_TYPES.has(data.documentType)) {
    return { error: 'VALIDATION', message: 'Tipo de documento clínico inválido.' };
  }
  if (data.days !== null && data.days < 0) {
    return { error: 'VALIDATION', message: 'Los días no pueden ser negativos.' };
  }

  const references = await validatePrescriptionReferences({
    clientId,
    patientId: data.patientId,
    clinicalRecordId: data.clinicalRecordId,
    appointmentId: data.appointmentId
  });
  if (!references.ok) return references;

  const { rows } = await query(
    `INSERT INTO odontology_clinical_documents (
       client_id, patient_id, clinical_record_id, appointment_id, document_type,
       title, document_date, start_date, end_date, days, body, recommendations,
       status, issued_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'issued',$13)
     RETURNING id`,
    [
      clientId,
      data.patientId,
      data.clinicalRecordId,
      data.appointmentId,
      data.documentType,
      data.title,
      data.documentDate,
      data.startDate,
      data.endDate,
      data.days,
      data.body,
      data.recommendations,
      actorUserId
    ]
  );
  return { document: await getOdontologyClinicalDocumentById({ clientId, documentId: rows[0].id }) };
}

export async function setOdontologyClinicalDocumentPdf({ clientId, documentId, pdfPath }) {
  const { rows } = await query(
    `UPDATE odontology_clinical_documents
     SET pdf_path = $3
     WHERE client_id = $1
       AND id = $2
     RETURNING id`,
    [clientId, documentId, pdfPath]
  );
  if (!rows[0]) return null;
  return getOdontologyClinicalDocumentById({ clientId, documentId });
}

function normalizeReportDate(value, fallback) {
  const text = String(value || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T00:00:00`).getTime())) {
    return text;
  }
  return fallback;
}

export async function getOdontologyReports({ clientId, startDate = '', endDate = '' }) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const from = normalizeReportDate(startDate, monthStart);
  const to = normalizeReportDate(endDate, current);
  const params = [clientId, from, to];

  const [
    patients,
    appointments,
    clinicalRecords,
    treatmentPlans,
    payments,
    consents,
    attachments,
    procedures,
    paymentMethods,
    planStatuses,
    productionByDentist,
    cancellationsAndNoShows,
    treatmentPlanValuesByStatus,
    treatmentPlanFinancialSummary,
    revenueByPeriod,
    inventoryConsumptionByProcedureDentist
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_patients
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date`,
      params
    ),
    query(
      `SELECT status, COUNT(*)::int AS total
       FROM odontology_appointments
       WHERE client_id = $1
         AND scheduled_date BETWEEN $2::date AND $3::date
       GROUP BY status
       ORDER BY total DESC, status`,
      params
    ),
    query(
      `SELECT status, COUNT(*)::int AS total
       FROM odontology_clinical_records
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY status`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(total_amount), 0)::numeric AS total_amount
       FROM odontology_treatment_plans
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(amount), 0)::numeric AS total_amount
       FROM odontology_payments
       WHERE client_id = $1
         AND payment_date BETWEEN $2::date AND $3::date
         AND status = 'registered'`,
      params
    ),
    query(
      `SELECT status, COUNT(*)::int AS total
       FROM odontology_patient_consents
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY status`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_attachments
       WHERE client_id = $1
         AND document_date BETWEEN $2::date AND $3::date`,
      params
    ),
    query(
      `SELECT COALESCE(pt.name, 'Sin procedimiento') AS name,
              COUNT(*)::int AS total
       FROM odontology_appointments a
       LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
       WHERE a.client_id = $1
         AND a.scheduled_date BETWEEN $2::date AND $3::date
       GROUP BY COALESCE(pt.name, 'Sin procedimiento')
       ORDER BY total DESC, name
       LIMIT 10`,
      params
    ),
    query(
      `SELECT payment_method AS method,
              COUNT(*)::int AS total,
              COALESCE(SUM(amount), 0)::numeric AS total_amount
       FROM odontology_payments
       WHERE client_id = $1
         AND payment_date BETWEEN $2::date AND $3::date
         AND status = 'registered'
       GROUP BY payment_method
       ORDER BY total_amount DESC, method`,
      params
    ),
    query(
      `SELECT status, COUNT(*)::int AS total
       FROM odontology_treatment_plans
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY status
       ORDER BY total DESC, status`,
      params
    ),
    query(
      `SELECT COALESCE(u.display_name, 'Sin odontólogo asignado') AS dentist_name,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.status IN ('Atendida', 'En atención'))::int AS attended,
              COUNT(*) FILTER (WHERE a.status IN ('Cancelada', 'No asistió'))::int AS cancelled_or_missed
       FROM odontology_appointments a
       LEFT JOIN users u ON u.id = a.dentist_user_id
       WHERE a.client_id = $1
         AND a.scheduled_date BETWEEN $2::date AND $3::date
       GROUP BY COALESCE(u.display_name, 'Sin odontólogo asignado')
       ORDER BY attended DESC, total DESC, dentist_name
       LIMIT 100`,
      params
    ),
    query(
      `SELECT a.scheduled_date::text AS scheduled_date,
              a.start_time::text AS start_time,
              a.status,
              a.cancellation_reason,
              p.full_name AS patient_name,
              p.document_number AS patient_document_number,
              p.phone AS patient_phone,
              COALESCE(u.display_name, 'Sin odontólogo asignado') AS dentist_name,
              COALESCE(pt.name, 'Sin procedimiento') AS procedure_name
       FROM odontology_appointments a
       JOIN odontology_patients p ON p.id = a.patient_id
       LEFT JOIN users u ON u.id = a.dentist_user_id
       LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
       WHERE a.client_id = $1
         AND a.scheduled_date BETWEEN $2::date AND $3::date
         AND a.status IN ('Cancelada', 'No asistió')
       ORDER BY a.scheduled_date DESC, a.start_time DESC
       LIMIT 300`,
      params
    ),
    query(
      `SELECT status,
              COUNT(*)::int AS total,
              COALESCE(SUM(total_amount), 0)::numeric AS total_amount
       FROM odontology_treatment_plans
       WHERE client_id = $1
         AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY status
       ORDER BY total_amount DESC, total DESC, status`,
      params
    ),
    query(
      `WITH plan_payments AS (
         SELECT treatment_plan_id,
                COALESCE(SUM(amount), 0)::numeric AS paid_amount
         FROM odontology_payments
         WHERE client_id = $1
           AND status = 'registered'
           AND treatment_plan_id IS NOT NULL
         GROUP BY treatment_plan_id
       )
       SELECT CASE
                WHEN COALESCE(tp.total_amount, 0) <= 0 THEN 'no-value'
                WHEN GREATEST(COALESCE(tp.total_amount, 0) - COALESCE(pp.paid_amount, 0), 0) <= 0 THEN 'paid'
                WHEN COALESCE(pp.paid_amount, 0) > 0 THEN 'partial'
                ELSE 'unpaid'
              END AS financial_status,
              COUNT(*)::int AS total,
              COALESCE(SUM(tp.total_amount), 0)::numeric AS total_amount,
              COALESCE(SUM(COALESCE(pp.paid_amount, 0)), 0)::numeric AS paid_amount,
              COALESCE(SUM(GREATEST(COALESCE(tp.total_amount, 0) - COALESCE(pp.paid_amount, 0), 0)), 0)::numeric AS balance_amount
       FROM odontology_treatment_plans tp
       LEFT JOIN plan_payments pp ON pp.treatment_plan_id = tp.id
       WHERE tp.client_id = $1
         AND tp.created_at::date BETWEEN $2::date AND $3::date
       GROUP BY financial_status
       ORDER BY balance_amount DESC, total_amount DESC, financial_status`,
      params
    ),
    query(
      `SELECT payment_date::text AS period_date,
              COUNT(*)::int AS total,
              COALESCE(SUM(amount), 0)::numeric AS total_amount
       FROM odontology_payments
       WHERE client_id = $1
         AND payment_date BETWEEN $2::date AND $3::date
         AND status = 'registered'
       GROUP BY payment_date
       ORDER BY payment_date ASC
       LIMIT 370`,
      params
    ),
    query(
      `SELECT COALESCE(pt.name, 'Sin procedimiento') AS procedure_name,
              COALESCE(u.display_name, 'Sin odontólogo asignado') AS dentist_name,
              ii.name AS item_name,
              ii.unit AS item_unit,
              COUNT(DISTINCT a.id)::int AS appointments,
              COALESCE(SUM(aic.quantity), 0)::numeric AS total_quantity,
              COALESCE(SUM(aic.quantity * COALESCE(im.unit_cost, ii.unit_cost, 0)), 0)::numeric AS estimated_total_cost
       FROM odontology_appointment_inventory_consumptions aic
       JOIN odontology_appointments a ON a.id = aic.appointment_id
       LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
       LEFT JOIN users u ON u.id = a.dentist_user_id
       JOIN odontology_inventory_items ii ON ii.id = aic.item_id
       LEFT JOIN odontology_inventory_movements im ON im.id = aic.movement_id
       WHERE aic.client_id = $1
         AND a.scheduled_date BETWEEN $2::date AND $3::date
       GROUP BY COALESCE(pt.name, 'Sin procedimiento'),
                COALESCE(u.display_name, 'Sin odontólogo asignado'),
                ii.name,
                ii.unit
       ORDER BY estimated_total_cost DESC, total_quantity DESC, procedure_name, dentist_name, item_name
       LIMIT 300`,
      params
    )
  ]);

  const appointmentRows = appointments.rows || [];
  const clinicalRows = clinicalRecords.rows || [];
  const consentRows = consents.rows || [];
  const appointmentTotal = appointmentRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const attendedTotal = appointmentRows
    .filter((row) => ['Atendida', 'En atención'].includes(row.status))
    .reduce((sum, row) => sum + Number(row.total || 0), 0);
  const cancelledTotal = appointmentRows
    .filter((row) => ['Cancelada', 'No asistió'].includes(row.status))
    .reduce((sum, row) => sum + Number(row.total || 0), 0);

  return {
    range: { startDate: from, endDate: to },
    counters: {
      newPatients: patients.rows[0]?.total ?? 0,
      appointments: appointmentTotal,
      attendedAppointments: attendedTotal,
      cancelledOrMissedAppointments: cancelledTotal,
      clinicalDrafts: clinicalRows.find((row) => row.status === 'draft')?.total ?? 0,
      clinicalSigned: clinicalRows.find((row) => row.status === 'signed')?.total ?? 0,
      treatmentPlans: treatmentPlans.rows[0]?.total ?? 0,
      treatmentPlanAmount: Number(treatmentPlans.rows[0]?.total_amount ?? 0),
      payments: payments.rows[0]?.total ?? 0,
      paymentAmount: Number(payments.rows[0]?.total_amount ?? 0),
      consentsDraft: consentRows.find((row) => row.status === 'draft')?.total ?? 0,
      consentsSigned: consentRows.find((row) => row.status === 'signed')?.total ?? 0,
      attachments: attachments.rows[0]?.total ?? 0
    },
    appointmentsByStatus: appointmentRows,
    clinicalByStatus: clinicalRows,
    consentsByStatus: consentRows,
    topProcedures: procedures.rows,
    paymentsByMethod: paymentMethods.rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0)
    })),
    treatmentPlansByStatus: planStatuses.rows,
    productionByDentist: productionByDentist.rows,
    cancellationsAndNoShows: cancellationsAndNoShows.rows,
    treatmentPlanValuesByStatus: treatmentPlanValuesByStatus.rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0)
    })),
    treatmentPlanFinancialSummary: treatmentPlanFinancialSummary.rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0),
      paid_amount: Number(row.paid_amount || 0),
      balance_amount: Number(row.balance_amount || 0)
    })),
    revenueByPeriod: revenueByPeriod.rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0)
    })),
    inventoryConsumptionByProcedureDentist: inventoryConsumptionByProcedureDentist.rows.map((row) => ({
      ...row,
      total_quantity: Number(row.total_quantity || 0),
      estimated_total_cost: Number(row.estimated_total_cost || 0)
    }))
  };
}

export async function getOdontologyReportDetails({ clientId, startDate = '', endDate = '' }) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const from = normalizeReportDate(startDate, monthStart);
  const to = normalizeReportDate(endDate, current);
  const params = [clientId, from, to];

  const [appointments, patients, payments, reminders] = await Promise.all([
    query(
      `${appointmentSelectSql()}
       WHERE a.client_id = $1
         AND a.scheduled_date BETWEEN $2::date AND $3::date
       ORDER BY a.scheduled_date ASC, a.start_time ASC
       LIMIT 1000`,
      params
    ),
    query(
      `${patientSelectSql()}
       WHERE p.client_id = $1
         AND p.created_at::date BETWEEN $2::date AND $3::date
       ORDER BY p.created_at ASC, p.full_name ASC
       LIMIT 1000`,
      params
    ),
    query(
      `${paymentSelectSql()}
       WHERE op.client_id = $1
         AND op.payment_date BETWEEN $2::date AND $3::date
       ORDER BY op.payment_date ASC, op.created_at ASC
       LIMIT 1000`,
      params
    ),
    query(
      `SELECT r.*,
              a.scheduled_date::text AS appointment_date,
              a.start_time::text AS appointment_start_time,
              a.end_time::text AS appointment_end_time,
              a.status AS appointment_status,
              p.full_name AS patient_name,
              p.document_number AS patient_document_number,
              u.display_name AS dentist_name,
              pt.name AS procedure_name
       FROM odontology_appointment_reminders r
       JOIN odontology_appointments a ON a.id = r.appointment_id
       LEFT JOIN odontology_patients p ON p.id = a.patient_id
       LEFT JOIN users u ON u.id = a.dentist_user_id
       LEFT JOIN odontology_procedure_types pt ON pt.id = a.procedure_type_id
       WHERE r.client_id = $1
         AND r.sent_at::date BETWEEN $2::date AND $3::date
       ORDER BY r.sent_at ASC, r.created_at ASC
       LIMIT 1000`,
      params
    )
  ]);

  return {
    range: { startDate: from, endDate: to },
    appointments: appointments.rows,
    patients: patients.rows,
    payments: payments.rows,
    reminders: reminders.rows
  };
}

export async function getOdontologyDashboard(clientId) {
  await ensureOdontologyDefaults(clientId);
  const [
    settings,
    sites,
    chairs,
    procedures,
    appointmentStatuses,
    patientStatuses,
    toothConditions,
    patientCount,
    appointmentsTodayCount,
    pendingClinicalSignatures,
    activeTreatmentPlans,
    paymentsToday,
    lowStockItems,
    sterilizationToday
  ] = await Promise.all([
    getOdontologySettings(clientId),
    listOdontologySites(clientId),
    listOdontologyChairs(clientId),
    listOdontologyProcedureTypes(clientId),
    listOdontologyCatalog(clientId, 'appointment_status'),
    listOdontologyCatalog(clientId, 'patient_status'),
    listOdontologyCatalog(clientId, 'tooth_condition'),
    query('SELECT COUNT(*)::int AS total FROM odontology_patients WHERE client_id = $1', [clientId]),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_appointments
       WHERE client_id = $1
         AND scheduled_date = CURRENT_DATE
         AND status NOT IN ('Cancelada', 'No asistió')`,
      [clientId]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_clinical_records
       WHERE client_id = $1
         AND status = 'draft'`,
      [clientId]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_treatment_plans
       WHERE client_id = $1
         AND status NOT IN ('completed', 'cancelled')`,
      [clientId]
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM odontology_payments
       WHERE client_id = $1
         AND payment_date = CURRENT_DATE
         AND status = 'registered'`,
      [clientId]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_inventory_items
       WHERE client_id = $1
         AND is_active = TRUE
         AND current_stock <= min_stock`,
      [clientId]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM odontology_sterilization_cycles
       WHERE client_id = $1
         AND cycle_date = CURRENT_DATE`,
      [clientId]
    )
  ]);

  return {
    counters: {
      patients: patientCount.rows[0]?.total ?? 0,
      appointmentsToday: appointmentsTodayCount.rows[0]?.total ?? 0,
      pendingSignatures: pendingClinicalSignatures.rows[0]?.total ?? 0,
      pendingConsents: 0,
      activeTreatmentPlans: activeTreatmentPlans.rows[0]?.total ?? 0,
      paymentsToday: Number(paymentsToday.rows[0]?.total ?? 0),
      lowStockItems: lowStockItems.rows[0]?.total ?? 0,
      sterilizationToday: sterilizationToday.rows[0]?.total ?? 0
    },
    settings,
    sites,
    chairs,
    procedures,
    appointmentStatuses,
    patientStatuses,
    toothConditions
  };
}
