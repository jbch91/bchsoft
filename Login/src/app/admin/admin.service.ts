import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Role } from '../auth/models';
import { getApiBase } from '../core/api-base';

interface RoleDto {
  id: number;
  name: Role;
  description: string | null;
}

interface PermissionDto {
  id: number;
  name: string;
  description: string | null;
}

interface TemporaryPermissionDto {
  id: string;
  permission: string;
  description: string | null;
  expiresAt: string;
  reason: string | null;
  createdAt?: string;
}

interface AuditLogDto {
  id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  target_user_id: string | null;
  target_username: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

interface ClientDto {
  id: string;
  name: string;
  nit: string;
  city: string;
  address: string | null;
  habilitation_code: string | null;
  email: string;
  logo_path: string | null;
  schema_name: string;
  client_admin_count?: number;
}

interface SubscriptionPaymentDto {
  id: string;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
  amount: number | null;
  currency: string;
  reference: string | null;
  notes: string | null;
  created_at?: string;
}

interface SubscriptionEventDto {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  actor_username: string | null;
  created_at: string;
}

interface SubscriptionPlanDto {
  key: string;
  name: string;
  client_type: string;
  description: string | null;
  included_suites: string[];
  included_modules: string[];
  monthly_price: number | null;
  annual_price: number | null;
  currency: string;
  grace_days: number;
  expiration_access_mode: 'read_only' | 'blocked';
  display_order: number;
  is_active: boolean;
  clients_count?: number;
}

interface ClientSubscriptionDto {
  client_id: string | null;
  plan_key: string | null;
  plan_name: string | null;
  plan_client_type: string | null;
  plan_description: string | null;
  plan_included_suites: string[];
  plan_included_modules: string[];
  plan_monthly_price: number | null;
  plan_annual_price: number | null;
  plan_grace_days: number;
  plan_expiration_access_mode: 'read_only' | 'blocked';
  billing_cycle: 'monthly' | 'annual';
  status: 'active' | 'grace' | 'read_only' | 'suspended' | 'cancelled';
  access_mode: 'full' | 'read_only' | 'blocked';
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  grace_ends_at: string | null;
  amount: number | null;
  currency: string;
  notes: string | null;
  effective_status: string;
  effective_access_mode: string;
  days_remaining: number | null;
  is_read_only: boolean;
  is_blocked: boolean;
  payments?: SubscriptionPaymentDto[];
  events?: SubscriptionEventDto[];
}

interface ModuleDto {
  key: string;
  name: string;
  description: string | null;
  suite_key?: string | null;
  enabled?: boolean;
}

interface SoftwareSuiteDto {
  key: string;
  name: string;
  description: string | null;
  display_order?: number;
  enabled?: boolean;
  client_enabled?: boolean;
  can_access?: boolean;
  license_status?: 'trial' | 'active' | 'suspended' | 'expired';
  plan_name?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

interface UserDto {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
  roles: Role[];
  client_name?: string | null;
  client_id?: string | null;
  signature_path?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  invima_registration?: string | null;
  temporary_permissions?: TemporaryPermissionDto[];
}

interface ClientAdminUserDto {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
  client_id: string;
  document_type?: string | null;
  document_number?: string | null;
  roles: Role[];
}

interface ClientUserDto {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
  client_id: string;
  client_name: string;
  client_nit: string;
  client_city: string;
  document_type?: string | null;
  document_number?: string | null;
  roles: Role[];
}

interface ActionConfirmationDto {
  expiresAt: string;
  deliveryEmail: string;
}

interface ReaderAccessDto {
  area_id: string | null;
  location_id: string | null;
}

interface AreaDto {
  id: string;
  name: string;
}

interface LocationDto {
  id: string;
  name: string;
  area_id: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async requestActionConfirmation(payload: { action: string; summary: string }): Promise<ActionConfirmationDto> {
    return firstValueFrom(
      this.http.post<ActionConfirmationDto>(`${this.apiBase}/admin/security/action-confirmation`, payload)
    );
  }

  async listRoles(): Promise<RoleDto[]> {
    return firstValueFrom(this.http.get<RoleDto[]>(`${this.apiBase}/admin/roles`));
  }

  async listUsers(): Promise<UserDto[]> {
    return firstValueFrom(this.http.get<UserDto[]>(`${this.apiBase}/admin/users`));
  }

  async listClientUsers(): Promise<ClientUserDto[]> {
    return firstValueFrom(this.http.get<ClientUserDto[]>(`${this.apiBase}/admin/client-users`));
  }

  async listPermissions(): Promise<PermissionDto[]> {
    return firstValueFrom(this.http.get<PermissionDto[]>(`${this.apiBase}/admin/permissions`));
  }

  async getRolePermissions(roleId: number): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.apiBase}/admin/roles/${roleId}/permissions`));
  }

  async updateRolePermissions(roleId: number, permissions: string[], securityCode?: string): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiBase}/admin/roles/${roleId}/permissions`, { permissions, securityCode })
    );
  }

  async grantTemporaryPermission(userId: string, payload: {
    permission: string;
    expiresAt: string;
    reason?: string | null;
    securityCode?: string;
  }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/admin/users/${userId}/temporary-permissions`, payload)
    );
  }

  async revokeTemporaryPermission(userId: string, permission: string, securityCode?: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiBase}/admin/users/${userId}/temporary-permissions`, {
        params: { permission },
        body: { permission, securityCode }
      })
    );
  }

  async createUser(payload: {
    username: string;
    displayName: string;
    email: string;
    role: Role;
    clientId?: string;
    securityCode?: string;
    signatureFile?: File | null;
    documentType?: string | null;
    documentNumber?: string | null;
    invimaRegistration?: string | null;
  }): Promise<void> {
    if (payload.signatureFile) {
      const form = new FormData();
      form.append('username', payload.username);
      form.append('displayName', payload.displayName);
      form.append('email', payload.email);
      form.append('role', payload.role);
      if (payload.securityCode) {
        form.append('securityCode', payload.securityCode);
      }
      if (payload.clientId) {
        form.append('clientId', payload.clientId);
      }
      if (payload.documentType) {
        form.append('documentType', payload.documentType);
      }
      if (payload.documentNumber) {
        form.append('documentNumber', payload.documentNumber);
      }
      if (payload.invimaRegistration) {
        form.append('invimaRegistration', payload.invimaRegistration);
      }
      form.append('signature', payload.signatureFile);
      await firstValueFrom(this.http.post(`${this.apiBase}/admin/users`, form));
      return;
    }
    const { signatureFile, ...rest } = payload;
    await firstValueFrom(this.http.post(`${this.apiBase}/admin/users`, rest));
  }

  async updateUserRole(userId: string, role: Role, securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/users/${userId}/role`, { role, securityCode }));
  }

  async updateUserActive(userId: string, isActive: boolean, securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/users/${userId}/active`, { isActive, securityCode }));
  }

  async sendUserPasswordSetup(userId: string, securityCode?: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/admin/users/${userId}/password`, { securityCode })
    );
  }

  async updateUserProfile(userId: string, payload: {
    displayName: string;
    email: string;
    clientId?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    invimaRegistration?: string | null;
    securityCode?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/users/${userId}`, payload));
  }

  async updateUserSignature(userId: string, signatureFile: File): Promise<void> {
    const form = new FormData();
    form.append('signature', signatureFile);
    await firstValueFrom(this.http.post(`${this.apiBase}/admin/users/${userId}/signature`, form));
  }

  async getReaderAccess(userId: string, clientId: string): Promise<ReaderAccessDto[]> {
    return firstValueFrom(
      this.http.get<ReaderAccessDto[]>(
        `${this.apiBase}/admin/users/${userId}/reader-access?clientId=${clientId}`
      )
    );
  }

  async updateReaderAccess(userId: string, clientId: string, areaIds: string[], locationIds: string[]): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/admin/users/${userId}/reader-access`, {
        clientId,
        areaIds,
        locationIds
      })
    );
  }

  async deleteUser(userId: string, securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/admin/users/${userId}`, { body: { securityCode } }));
  }

  async listAuditLogs(): Promise<AuditLogDto[]> {
    return firstValueFrom(this.http.get<AuditLogDto[]>(`${this.apiBase}/admin/audit`));
  }

  async listClients(): Promise<ClientDto[]> {
    return firstValueFrom(this.http.get<ClientDto[]>(`${this.apiBase}/admin/clients`));
  }

  async getClientSubscription(clientId: string): Promise<ClientSubscriptionDto> {
    return firstValueFrom(
      this.http.get<ClientSubscriptionDto>(`${this.apiBase}/admin/clients/${clientId}/subscription`)
    );
  }

  async updateClientSubscription(clientId: string, payload: {
    planKey?: string | null;
    billingCycle: 'monthly' | 'annual';
    status: 'active' | 'grace' | 'read_only' | 'suspended' | 'cancelled';
    accessMode: 'full' | 'read_only' | 'blocked';
    currentPeriodStartsAt?: string | null;
    currentPeriodEndsAt?: string | null;
    graceEndsAt?: string | null;
    amount?: number | null;
    currency?: string;
    notes?: string | null;
    securityCode?: string;
  }): Promise<ClientSubscriptionDto> {
    return firstValueFrom(
      this.http.put<ClientSubscriptionDto>(`${this.apiBase}/admin/clients/${clientId}/subscription`, payload)
    );
  }

  async registerSubscriptionPayment(clientId: string, payload: {
    planKey?: string | null;
    paidAt?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    amount?: number | null;
    currency?: string;
    reference?: string | null;
    notes?: string | null;
    billingCycle?: 'monthly' | 'annual';
    securityCode?: string;
  }): Promise<SubscriptionPaymentDto> {
    return firstValueFrom(
      this.http.post<SubscriptionPaymentDto>(
        `${this.apiBase}/admin/clients/${clientId}/subscription/payments`,
        payload
      )
    );
  }

  async listClientAdmins(clientId: string): Promise<ClientAdminUserDto[]> {
    return firstValueFrom(
      this.http.get<ClientAdminUserDto[]>(`${this.apiBase}/admin/clients/${clientId}/admin-users`)
    );
  }

  async createClientAdminUser(clientId: string, payload: {
    username: string;
    displayName: string;
    email: string;
    securityCode?: string;
    signatureFile?: File | null;
    documentType: string;
    documentNumber: string;
  }): Promise<void> {
    const form = new FormData();
    form.append('username', payload.username);
    form.append('displayName', payload.displayName);
    form.append('email', payload.email);
    form.append('documentType', payload.documentType);
    form.append('documentNumber', payload.documentNumber);
    if (payload.securityCode) {
      form.append('securityCode', payload.securityCode);
    }
    if (payload.signatureFile) {
      form.append('signature', payload.signatureFile);
    }
    await firstValueFrom(
      this.http.post(`${this.apiBase}/admin/clients/${clientId}/admin-users`, form)
    );
  }

  async sendClientAdminPasswordSetup(clientId: string, userId: string, securityCode?: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/admin/clients/${clientId}/admin-users/${userId}/password`, {
        delivery: 'email',
        securityCode
      })
    );
  }

  async listClientAreas(clientId: string): Promise<AreaDto[]> {
    return firstValueFrom(this.http.get<AreaDto[]>(`${this.apiBase}/admin/clients/${clientId}/areas`));
  }

  async listClientLocations(clientId: string): Promise<LocationDto[]> {
    return firstValueFrom(
      this.http.get<LocationDto[]>(`${this.apiBase}/admin/clients/${clientId}/locations`)
    );
  }

  async listModules(): Promise<ModuleDto[]> {
    return firstValueFrom(this.http.get<ModuleDto[]>(`${this.apiBase}/admin/modules`));
  }

  async listSoftwareSuites(): Promise<SoftwareSuiteDto[]> {
    return firstValueFrom(this.http.get<SoftwareSuiteDto[]>(`${this.apiBase}/admin/software-suites`));
  }

  async listSubscriptionPlans(includeInactive = false): Promise<SubscriptionPlanDto[]> {
    const suffix = includeInactive ? '?includeInactive=true' : '';
    return firstValueFrom(this.http.get<SubscriptionPlanDto[]>(`${this.apiBase}/admin/subscription-plans${suffix}`));
  }

  async createSubscriptionPlan(payload: {
    key?: string;
    name: string;
    clientType: string;
    description?: string | null;
    includedSuites: string[];
    includedModules: string[];
    monthlyPrice?: number | null;
    annualPrice?: number | null;
    currency?: string;
    graceDays?: number;
    expirationAccessMode?: 'read_only' | 'blocked';
    displayOrder?: number;
    isActive?: boolean;
    securityCode?: string;
  }): Promise<SubscriptionPlanDto> {
    return firstValueFrom(
      this.http.post<SubscriptionPlanDto>(`${this.apiBase}/admin/subscription-plans`, payload)
    );
  }

  async updateSubscriptionPlan(planKey: string, payload: {
    name: string;
    clientType: string;
    description?: string | null;
    includedSuites: string[];
    includedModules: string[];
    monthlyPrice?: number | null;
    annualPrice?: number | null;
    currency?: string;
    graceDays?: number;
    expirationAccessMode?: 'read_only' | 'blocked';
    displayOrder?: number;
    isActive?: boolean;
    securityCode?: string;
  }): Promise<SubscriptionPlanDto> {
    return firstValueFrom(
      this.http.put<SubscriptionPlanDto>(`${this.apiBase}/admin/subscription-plans/${planKey}`, payload)
    );
  }

  async applySubscriptionPlanToClients(planKey: string, securityCode?: string): Promise<{ affected_clients: number }> {
    return firstValueFrom(
      this.http.post<{ affected_clients: number }>(
        `${this.apiBase}/admin/subscription-plans/${planKey}/apply`,
        { securityCode }
      )
    );
  }

  async listClientSoftwareSuites(clientId: string): Promise<SoftwareSuiteDto[]> {
    return firstValueFrom(this.http.get<SoftwareSuiteDto[]>(`${this.apiBase}/admin/clients/${clientId}/software-suites`));
  }

  async updateClientSoftwareSuites(clientId: string, suites: Array<{
    key: string;
    enabled: boolean;
    licenseStatus?: 'trial' | 'active' | 'suspended' | 'expired';
    planName?: string | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
  }>, securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/admin/clients/${clientId}/software-suites`, { suites, securityCode }));
  }

  async listClientModules(clientId: string): Promise<ModuleDto[]> {
    return firstValueFrom(this.http.get<ModuleDto[]>(`${this.apiBase}/admin/clients/${clientId}/modules`));
  }

  async updateClientModules(clientId: string, modules: string[], securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/admin/clients/${clientId}/modules`, { modules, securityCode }));
  }

  async createClient(payload: {
    name: string;
    nit: string;
    city: string;
    address: string;
    habilitationCode?: string;
    email: string;
    logoFile?: File | null;
    adminUsername: string;
    adminDisplayName: string;
    adminEmail: string;
    adminDocumentType: string;
    adminDocumentNumber: string;
    adminSignatureFile?: File | null;
    planKey?: string | null;
    billingCycle?: 'monthly' | 'annual';
    securityCode?: string;
  }): Promise<{ id: string; schema_name: string; initial_admin_invitation_sent?: boolean }> {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('nit', payload.nit);
    form.append('city', payload.city);
    form.append('address', payload.address);
    form.append('email', payload.email);
    if (payload.habilitationCode) {
      form.append('habilitationCode', payload.habilitationCode);
    }
    form.append('adminUsername', payload.adminUsername);
    form.append('adminDisplayName', payload.adminDisplayName);
    form.append('adminEmail', payload.adminEmail);
    form.append('adminDocumentType', payload.adminDocumentType);
    form.append('adminDocumentNumber', payload.adminDocumentNumber);
    form.append('planKey', payload.planKey || 'biomedico_ips');
    form.append('billingCycle', payload.billingCycle || 'monthly');
    if (payload.securityCode) {
      form.append('securityCode', payload.securityCode);
    }
    if (payload.logoFile) {
      form.append('logo', payload.logoFile);
    }
    if (payload.adminSignatureFile) {
      form.append('adminSignature', payload.adminSignatureFile);
    }
    return firstValueFrom(
      this.http.post<{ id: string; schema_name: string; initial_admin_invitation_sent?: boolean }>(
        `${this.apiBase}/admin/clients`,
        form
      )
    );
  }

  async uploadClientLogo(clientId: string, file: File, securityCode?: string): Promise<ClientDto> {
    const form = new FormData();
    form.append('logo', file);
    if (securityCode) {
      form.append('securityCode', securityCode);
    }
    return firstValueFrom(this.http.post<ClientDto>(`${this.apiBase}/admin/clients/${clientId}/logo`, form));
  }

  async updateClient(clientId: string, payload: {
    name: string;
    nit: string;
    city: string;
    address: string;
    habilitationCode?: string;
    email: string;
    securityCode?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/clients/${clientId}`, payload));
  }

  async deleteClient(clientId: string, securityCode?: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/admin/clients/${clientId}`, { body: { securityCode } }));
  }
}
