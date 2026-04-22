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
}

interface ModuleDto {
  key: string;
  name: string;
  description: string | null;
  enabled?: boolean;
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

  async listRoles(): Promise<RoleDto[]> {
    return firstValueFrom(this.http.get<RoleDto[]>(`${this.apiBase}/admin/roles`));
  }

  async listUsers(): Promise<UserDto[]> {
    return firstValueFrom(this.http.get<UserDto[]>(`${this.apiBase}/admin/users`));
  }

  async listPermissions(): Promise<PermissionDto[]> {
    return firstValueFrom(this.http.get<PermissionDto[]>(`${this.apiBase}/admin/permissions`));
  }

  async getRolePermissions(roleId: number): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.apiBase}/admin/roles/${roleId}/permissions`));
  }

  async updateRolePermissions(roleId: number, permissions: string[]): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiBase}/admin/roles/${roleId}/permissions`, { permissions })
    );
  }

  async grantTemporaryPermission(userId: string, payload: {
    permission: string;
    expiresAt: string;
    reason?: string | null;
  }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/admin/users/${userId}/temporary-permissions`, payload)
    );
  }

  async revokeTemporaryPermission(userId: string, permission: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiBase}/admin/users/${userId}/temporary-permissions`, {
        params: { permission }
      })
    );
  }

  async createUser(payload: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    role: Role;
    clientId?: string;
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
      form.append('password', payload.password);
      form.append('role', payload.role);
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

  async updateUserRole(userId: string, role: Role): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/users/${userId}/role`, { role }));
  }

  async updateUserActive(userId: string, isActive: boolean): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/users/${userId}/active`, { isActive }));
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/admin/users/${userId}/password`, { password })
    );
  }

  async updateUserProfile(userId: string, payload: {
    displayName: string;
    email: string;
    clientId?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    invimaRegistration?: string | null;
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

  async deleteUser(userId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/admin/users/${userId}`));
  }

  async listAuditLogs(): Promise<AuditLogDto[]> {
    return firstValueFrom(this.http.get<AuditLogDto[]>(`${this.apiBase}/admin/audit`));
  }

  async listClients(): Promise<ClientDto[]> {
    return firstValueFrom(this.http.get<ClientDto[]>(`${this.apiBase}/admin/clients`));
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

  async listClientModules(clientId: string): Promise<ModuleDto[]> {
    return firstValueFrom(this.http.get<ModuleDto[]>(`${this.apiBase}/admin/clients/${clientId}/modules`));
  }

  async updateClientModules(clientId: string, modules: string[]): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/admin/clients/${clientId}/modules`, { modules }));
  }

  async createClient(payload: {
    name: string;
    nit: string;
    city: string;
    address: string;
    habilitationCode?: string;
    email: string;
    logoFile?: File | null;
  }): Promise<{ id: string; schema_name: string }> {
    if (payload.logoFile) {
      const form = new FormData();
      form.append('name', payload.name);
      form.append('nit', payload.nit);
      form.append('city', payload.city);
      form.append('address', payload.address);
      form.append('email', payload.email);
      if (payload.habilitationCode) {
        form.append('habilitationCode', payload.habilitationCode);
      }
      form.append('logo', payload.logoFile);
      return firstValueFrom(
        this.http.post<{ id: string; schema_name: string }>(`${this.apiBase}/admin/clients`, form)
      );
    }
    const { logoFile, ...body } = payload;
    return firstValueFrom(this.http.post<{ id: string; schema_name: string }>(`${this.apiBase}/admin/clients`, body));
  }

  async uploadClientLogo(clientId: string, file: File): Promise<ClientDto> {
    const form = new FormData();
    form.append('logo', file);
    return firstValueFrom(this.http.post<ClientDto>(`${this.apiBase}/admin/clients/${clientId}/logo`, form));
  }

  async updateClient(clientId: string, payload: {
    name: string;
    nit: string;
    city: string;
    address: string;
    habilitationCode?: string;
    email: string;
  }): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/admin/clients/${clientId}`, payload));
  }

  async deleteClient(clientId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/admin/clients/${clientId}`));
  }
}
