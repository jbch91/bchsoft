import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { Role } from '../../auth/models';

interface UserView {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isActive: boolean;
  roles: Role[];
  clientName?: string | null;
  clientId?: string | null;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  roles: Role[] = [];
  roleIds = new Map<Role, number>();
  permissions: string[] = [];
  rolePermissions: Record<number, string[]> = {};
  users: UserView[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  clients: { id: string; name: string }[] = [];
  searchTerm = '';
  openClientId: string | null = null;
  editingUserId: string | null = null;
  editUser = { displayName: '', email: '', clientId: '' };
  editSignatureFile: File | null = null;
  rolesOpen = false;
  readerAreas: { id: string; name: string }[] = [];
  readerLocations: { id: string; name: string; area_id: string | null }[] = [];
  readerAreaIds = new Set<string>();
  readerLocationIds = new Set<string>();
  readerAccessUserId: string | null = null;

  username = '';
  displayName = '';
  email = '';
  password = '';
  role: Role = 'viewer';
  clientId = '';
  signatureFile: File | null = null;

  private readonly clientScopedRoles: Role[] = [
    'almacenista',
    'ingeniero_biomedico',
    'calibracion',
    'lector'
  ];
  private readonly signatureRoles: Role[] = ['almacenista', 'ingeniero_biomedico', 'lector'];

  constructor(
    private readonly admin: AdminService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const [roles, users, permissions] = await Promise.all([
        this.admin.listRoles(),
        this.admin.listUsers(),
        this.admin.listPermissions()
      ]);
      this.roles = roles.map((item) => item.name);
      this.roleIds = new Map(roles.map((item) => [item.name, item.id]));
      this.permissions = permissions.map((item) => item.name);
      this.users = users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        isActive: user.is_active,
        roles: user.roles,
        clientName: user.client_name ?? null,
        clientId: user.client_id ?? null
      }));
      await this.loadRolePermissions();
      try {
        const clients = await this.admin.listClients();
        this.clients = clients.map((client) => ({ id: client.id, name: client.name }));
        if (!this.clientId) {
          this.clientId = this.clients[0]?.id ?? '';
        }
      } catch {
        this.clients = [];
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los usuarios.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadRolePermissions(): Promise<void> {
    const entries = await Promise.all(
      Array.from(this.roleIds.entries()).map(async ([roleName, roleId]) => {
        const permissions = await this.admin.getRolePermissions(roleId);
        return [roleId, permissions] as const;
      })
    );

    this.rolePermissions = Object.fromEntries(entries);
  }

  async onCreateUser(): Promise<void> {
    if (!this.username || !this.displayName || !this.email || !this.password) {
      this.errorMessage = 'Completa todos los campos.';
      return;
    }
    if (this.isClientScopedRole(this.role) && !this.clientId) {
      this.errorMessage = 'Selecciona un cliente para este rol.';
      return;
    }
    if (this.requiresSignature(this.role) && !this.signatureFile) {
      this.errorMessage = 'Debes cargar la firma digital para este rol.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.createUser({
        username: this.username.trim(),
        displayName: this.displayName.trim(),
        email: this.email.trim(),
        password: this.password,
        role: this.role,
        clientId: this.isClientScopedRole(this.role) ? this.clientId : undefined,
        signatureFile: this.signatureFile
      });
      this.username = '';
      this.displayName = '';
      this.email = '';
      this.password = '';
      this.role = this.roles[0] ?? 'viewer';
      this.clientId = this.clients[0]?.id ?? '';
      this.signatureFile = null;
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage =
        error?.error?.message ?? 'No se pudo crear el usuario.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  get groupedUsers(): { id: string; name: string; users: UserView[] }[] {
    const term = this.searchTerm.toLowerCase().trim();
    const map = new Map<string, { id: string; name: string; users: UserView[] }>();
    for (const user of this.users) {
      const groupId = user.clientId || 'admin-users';
      const groupName = user.clientId ? (user.clientName ?? 'Sin cliente') : 'Usuarios admin';
      if (!map.has(groupId)) {
        map.set(groupId, { id: groupId, name: groupName, users: [] });
      }
      const hay = `${user.displayName} ${user.username} ${user.email}`.toLowerCase();
      if (!term || hay.includes(term)) {
        map.get(groupId)!.users.push(user);
      }
    }
    return Array.from(map.values()).filter((g) => g.users.length);
  }

  toggleClientOpen(clientId: string): void {
    this.openClientId = this.openClientId === clientId ? null : clientId;
  }

  trackByGroup(_index: number, group: { id: string }): string {
    return group.id;
  }

  trackByUser(_index: number, user: UserView): string {
    return user.id;
  }

  startEditUser(user: UserView): void {
    this.editingUserId = user.id;
    this.editUser = {
      displayName: user.displayName,
      email: user.email,
      clientId: user.clientId ?? ''
    };
    this.editSignatureFile = null;
    const targetClientId = user.clientId ?? this.editUser.clientId;
    if (this.isReader(user) && targetClientId) {
      void this.loadReaderAccess(user.id, targetClientId);
    } else {
      this.readerAccessUserId = null;
      this.readerAreas = [];
      this.readerLocations = [];
      this.readerAreaIds.clear();
      this.readerLocationIds.clear();
    }
  }

  cancelEditUser(): void {
    this.editingUserId = null;
    this.readerAccessUserId = null;
    this.editSignatureFile = null;
  }

  async saveUser(user: UserView): Promise<void> {
    await this.admin.updateUserProfile(user.id, {
      displayName: this.editUser.displayName.trim(),
      email: this.editUser.email.trim(),
      clientId: this.editUser.clientId || null
    });
    if (this.editSignatureFile && this.requiresSignature(user.roles[0] || 'viewer')) {
      await this.admin.updateUserSignature(user.id, this.editSignatureFile);
    }
    if (this.isReader(user) && user.clientId) {
      await this.saveReaderAccess(user.id, user.clientId);
    }
    this.editingUserId = null;
    this.editSignatureFile = null;
    await this.load();
  }

  async removeUser(user: UserView): Promise<void> {
    if (!confirm('¿Eliminar usuario?')) return;
    await this.admin.deleteUser(user.id);
    await this.load();
  }

  isClientScopedRole(role: Role): boolean {
    return this.clientScopedRoles.includes(role);
  }

  isReader(user: UserView): boolean {
    return user.roles.includes('lector');
  }

  requiresSignature(role: Role): boolean {
    return this.signatureRoles.includes(role);
  }

  onSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.signatureFile = input.files?.[0] ?? null;
  }

  onEditSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editSignatureFile = input.files?.[0] ?? null;
  }

  async loadReaderAccess(userId: string, clientId: string): Promise<void> {
    if (!clientId) return;
    this.readerAccessUserId = userId;
    this.readerAreas = [];
    this.readerLocations = [];
    this.readerAreaIds.clear();
    this.readerLocationIds.clear();
    try {
      const [areas, locations, access] = await Promise.all([
        this.admin.listClientAreas(clientId),
        this.admin.listClientLocations(clientId),
        this.admin.getReaderAccess(userId, clientId)
      ]);
      this.readerAreas = areas;
      this.readerLocations = locations;
      this.readerAreaIds = new Set(access.filter((row) => row.area_id).map((row) => row.area_id!));
      this.readerLocationIds = new Set(
        access.filter((row) => row.location_id).map((row) => row.location_id!)
      );
      this.cdr.detectChanges();
    } catch (error) {
      console.error(error);
      this.readerAreas = [];
      this.readerLocations = [];
      this.readerAreaIds.clear();
      this.readerLocationIds.clear();
      this.errorMessage = 'No se pudieron cargar áreas o ubicaciones para este cliente.';
      this.cdr.detectChanges();
    }
  }

  toggleReaderArea(areaId: string): void {
    if (this.readerAreaIds.has(areaId)) {
      this.readerAreaIds.delete(areaId);
      return;
    }
    this.readerAreaIds.add(areaId);
  }

  toggleReaderLocation(locationId: string): void {
    if (this.readerLocationIds.has(locationId)) {
      this.readerLocationIds.delete(locationId);
      return;
    }
    this.readerLocationIds.add(locationId);
  }

  async saveReaderAccess(userId: string, clientId: string): Promise<void> {
    await this.admin.updateReaderAccess(
      userId,
      clientId,
      Array.from(this.readerAreaIds),
      Array.from(this.readerLocationIds)
    );
  }

  async onToggleActive(user: UserView): Promise<void> {
    try {
      await this.admin.updateUserActive(user.id, !user.isActive);
      user.isActive = !user.isActive;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el estado.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onChangeRole(user: UserView, role: Role): Promise<void> {
    try {
      await this.admin.updateUserRole(user.id, role);
      user.roles = [role];
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el rol.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onChangePassword(user: UserView, password: string): Promise<void> {
    if (!password) {
      this.errorMessage = 'Ingresa una contraseña nueva.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateUserPassword(user.id, password);
      this.successMessage = 'Contraseña actualizada.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar la contraseña.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  togglePermission(roleId: number, permission: string): void {
    const current = new Set(this.rolePermissions[roleId] ?? []);
    if (current.has(permission)) {
      current.delete(permission);
    } else {
      current.add(permission);
    }
    this.rolePermissions[roleId] = Array.from(current);
  }

  async saveRolePermissions(roleId: number): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateRolePermissions(roleId, this.rolePermissions[roleId] ?? []);
      this.successMessage = 'Permisos guardados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron guardar los permisos.';
    } finally {
      this.cdr.detectChanges();
    }
  }
}
