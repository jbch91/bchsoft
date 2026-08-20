export type Role =
  | 'superuser'
  | 'admin'
  | 'saas_admin'
  | 'saas_billing'
  | 'saas_clients'
  | 'saas_support'
  | 'saas_auditor'
  | 'client_admin'
  | 'viewer'
  | 'almacenista'
  | 'ingeniero_biomedico'
  | 'calibracion'
  | 'lector'
  | 'odontologo'
  | 'auxiliar_odontologia'
  | 'recepcion_odontologia'
  | 'admin_odontologia'
  | 'auditor_odontologia'
  | 'bacteriologo'
  | 'auxiliar_laboratorio';

export type Permission =
  | 'clients:create'
  | 'clients:manage'
  | 'clients:view'
  | 'reports:view'
  | 'users:manage'
  | 'audit:client:view'
  | 'saas:access'
  | 'saas:clients:view'
  | 'saas:clients:update'
  | 'saas:subscriptions:manage'
  | 'saas:plans:manage'
  | 'saas:client_admins:reset_password'
  | 'saas:audit:view'
  | 'platform:templates:manage'
  | 'platform:biomedical_catalog:manage'
  | 'audit:odontology:view'
  | 'hb:create'
  | 'hb:import'
  | 'hb:view'
  | 'asset_history:upload'
  | 'software:biomedico:access'
  | 'software:odontologico:access'
  | 'software:laboratorio:access'
  | 'odontology:access'
  | 'odontology:settings:manage'
  | 'odontology:patients:import'
  | 'odontology:appointments:manage'
  | 'odontology:odontogram:manage'
  | 'odontology:periodontogram:manage'
  | 'odontology:consents:manage'
  | 'odontology:attachments:manage'
  | 'odontology:inventory:manage'
  | 'odontology:sterilization:manage'
  | 'odontology:treatment_plans:manage'
  | 'odontology:payments:manage'
  | 'odontology:financial:view'
  | 'odontology:prescriptions:manage'
  | 'odontology:documents:manage'
  | 'odontology:reports:view'
  | 'quick_guides:view'
  | 'quick_guides:create'
  | 'quick_guides:edit'
  | 'quick_guides:approve'
  | 'quick_guides:delete'
  | 'schedules:manage'
  | 'calibration:schedule:manage'
  | 'inventory:move'
  | 'inventory:request'
  | 'maintenance:order:create'
  | 'maintenance:order:close'
  | 'service:order:create'
  | 'maintenance:report:create'
  | 'maintenance:request:create'
  | 'maintenance:report:sign'
  | 'spareparts:order:create'
  | 'calibration:report:upload'
  | 'odontology:patients:manage'
  | 'odontology:clinical_records:manage'
  | 'laboratory:orders:manage'
  | 'laboratory:results:manage'
  | 'read:all'
  | 'areas:manage';

export interface User {
  id: string;
  username: string;
  displayName: string;
  clientId?: string | null;
  subscription?: {
    status: string;
    accessMode: string;
    billingCycle?: string;
    currentPeriodEndsAt?: string | null;
    graceEndsAt?: string | null;
    daysRemaining?: number | null;
    isReadOnly?: boolean;
    isBlocked?: boolean;
  } | null;
  role: Role;
  roles?: Role[];
  permissions: Permission[];
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}
