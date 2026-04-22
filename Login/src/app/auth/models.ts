export type Role =
  | 'superuser'
  | 'admin'
  | 'viewer'
  | 'almacenista'
  | 'ingeniero_biomedico'
  | 'calibracion'
  | 'lector';

export type Permission =
  | 'clients:create'
  | 'clients:manage'
  | 'clients:view'
  | 'reports:view'
  | 'users:manage'
  | 'hb:create'
  | 'hb:import'
  | 'hb:view'
  | 'asset_history:upload'
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
  | 'read:all'
  | 'areas:manage';

export interface User {
  id: string;
  username: string;
  displayName: string;
  clientId?: string | null;
  role: Role;
  permissions: Permission[];
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}
