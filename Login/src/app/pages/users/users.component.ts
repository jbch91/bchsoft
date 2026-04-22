import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { Role } from '../../auth/models';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

type UserDocumentType = 'cedula_ciudadania' | 'cedula_extranjeria' | 'pasaporte';
type UserTab = 'list' | 'create' | 'roles';

interface TemporaryPermissionView {
  permission: string;
  description?: string | null;
  expiresAt: string;
  reason?: string | null;
}

interface UserView {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isActive: boolean;
  roles: Role[];
  clientName?: string | null;
  clientId?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  invimaRegistration?: string | null;
  temporaryPermissions: TemporaryPermissionView[];
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  roles: Role[] = [];
  roleIds = new Map<Role, number>();
  permissions: string[] = [];
  rolePermissions: Record<number, string[]> = {};
  editingRoleId: number | null = null;
  permissionDraft = new Set<string>();
  users: UserView[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  clients: { id: string; name: string }[] = [];
  searchTerm = '';
  activeUserTab: UserTab = 'list';
  openClientId: string | null = null;
  editingUserId: string | null = null;
  temporaryPanelUserId: string | null = null;
  editUser = {
    displayName: '',
    email: '',
    clientId: '',
    documentType: 'cedula_ciudadania' as UserDocumentType,
    documentNumber: '',
    invimaRegistration: ''
  };
  editSignatureFile: File | null = null;
  readerAreas: { id: string; name: string }[] = [];
  readerLocations: { id: string; name: string; area_id: string | null }[] = [];
  readerAreaIds = new Set<string>();
  readerLocationIds = new Set<string>();
  readerAccessUserId: string | null = null;
  temporaryPermissionLoading = false;
  temporaryPermissionForm = {
    expiresAt: '',
    reason: 'Periodo temporal de creación/migración inicial del cliente'
  };
  selectedTemporaryPermissions = new Set<string>();

  username = '';
  displayName = '';
  email = '';
  password = '';
  role: Role = 'viewer';
  clientId = '';
  signatureFile: File | null = null;
  private readonly signatureAllowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  documentType: UserDocumentType = 'cedula_ciudadania';
  documentNumber = '';
  invimaRegistration = '';
  documentTypes: { value: UserDocumentType; label: string }[] = [
    { value: 'cedula_ciudadania', label: 'Cédula ciudadanía' },
    { value: 'cedula_extranjeria', label: 'Cédula extranjería' },
    { value: 'pasaporte', label: 'Pasaporte' }
  ];
  readonly permissionLabels: Record<string, string> = {
    'hb:create': 'Crear hojas de vida',
    'hb:import': 'Importar hojas de vida masivamente',
    'hb:view': 'Ver hojas de vida',
    'asset_history:upload': 'Migrar PDFs históricos de equipos',
    'areas:manage': 'Gestionar sedes, áreas y ubicaciones',
    'clients:manage': 'Gestionar clientes',
    'clients:view': 'Ver clientes',
    'users:manage': 'Gestionar usuarios',
    'schedules:manage': 'Gestionar cronogramas de mantenimiento',
    'calibration:schedule:manage': 'Gestionar cronogramas de calibración',
    'maintenance:request:create': 'Crear solicitudes de mantenimiento',
    'maintenance:report:create': 'Crear reportes de mantenimiento',
    'maintenance:report:sign': 'Firmar reportes de mantenimiento',
    'calibration:report:upload': 'Subir reportes de calibración',
    'inventory:move': 'Mover equipos y generar reportes de movimiento',
    'inventory:request': 'Solicitudes de inventario',
    'read:all': 'Lectura general'
  };
  readonly temporaryPermissionOptions = [
    {
      value: 'hb:import',
      label: 'Importación masiva de hojas de vida',
      description: 'Permite cargar muchos equipos desde una plantilla Excel.'
    },
    {
      value: 'asset_history:upload',
      label: 'Migración de PDFs históricos',
      description: 'Permite subir reportes físicos antiguos al historial del equipo.'
    }
  ];
  private readonly temporaryOnlyPermissions = new Set(
    this.temporaryPermissionOptions.map((option) => option.value)
  );

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
        clientId: user.client_id ?? null,
        documentType: user.document_type ?? null,
        documentNumber: user.document_number ?? null,
        invimaRegistration: user.invima_registration ?? null,
        temporaryPermissions: (user.temporary_permissions ?? []).map((permission) => ({
          permission: permission.permission,
          description: permission.description ?? null,
          expiresAt: permission.expiresAt,
          reason: permission.reason ?? null
        }))
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
    if (!this.documentType || !this.documentNumber.trim()) {
      this.errorMessage = 'Completa tipo de documento y número de documento.';
      return;
    }
    if (this.requiresBiomedicalCredentials(this.role) && !this.invimaRegistration.trim()) {
      this.errorMessage = 'Completa el registro INVIMA para el ingeniero biomédico.';
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
        signatureFile: this.signatureFile,
        documentType: this.documentType,
        documentNumber: this.documentNumber.trim(),
        invimaRegistration: this.requiresBiomedicalCredentials(this.role) ? this.invimaRegistration.trim() : null
      });
      this.username = '';
      this.displayName = '';
      this.email = '';
      this.password = '';
      this.role = this.roles[0] ?? 'viewer';
      this.clientId = this.clients[0]?.id ?? '';
      this.signatureFile = null;
      this.documentType = 'cedula_ciudadania';
      this.documentNumber = '';
      this.invimaRegistration = '';
      this.successMessage = 'Usuario creado.';
      this.activeUserTab = 'list';
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

  get filteredUsersCount(): number {
    return this.groupedUsers.reduce((total, group) => total + group.users.length, 0);
  }

  setUserTab(tab: UserTab): void {
    this.activeUserTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    this.cancelEditUser();
    this.cancelTemporaryAccess();
    this.cancelRolePermissionsEdit();
  }

  clearSearch(): void {
    this.searchTerm = '';
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
    this.temporaryPanelUserId = null;
    this.editUser = {
      displayName: user.displayName,
      email: user.email,
      clientId: user.clientId ?? '',
      documentType: this.toDocumentType(user.documentType),
      documentNumber: user.documentNumber ?? '',
      invimaRegistration: user.invimaRegistration ?? ''
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
    this.temporaryPermissionLoading = false;
  }

  toggleTemporaryAccess(user: UserView): void {
    if (this.temporaryPanelUserId === user.id) {
      this.cancelTemporaryAccess();
      return;
    }
    this.cancelEditUser();
    this.temporaryPanelUserId = user.id;
    this.resetTemporaryPermissionForm();
    this.selectedTemporaryPermissions.clear();
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelTemporaryAccess(): void {
    this.temporaryPanelUserId = null;
    this.selectedTemporaryPermissions.clear();
    this.temporaryPermissionLoading = false;
  }

  async saveUser(user: UserView): Promise<void> {
    if (!this.editUser.documentType || !this.editUser.documentNumber.trim()) {
      this.errorMessage = 'Completa tipo de documento y número de documento.';
      return;
    }
    if (this.requiresBiomedicalCredentials(user.roles[0] || 'viewer') && !this.editUser.invimaRegistration.trim()) {
      this.errorMessage = 'Completa el registro INVIMA para el ingeniero biomédico.';
      return;
    }

    await this.admin.updateUserProfile(user.id, {
      displayName: this.editUser.displayName.trim(),
      email: this.editUser.email.trim(),
      clientId: this.editUser.clientId || null,
      documentType: this.editUser.documentType,
      documentNumber: this.editUser.documentNumber.trim(),
      invimaRegistration: this.requiresBiomedicalCredentials(user.roles[0] || 'viewer')
        ? this.editUser.invimaRegistration.trim()
        : null
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

  requiresBiomedicalCredentials(role: Role): boolean {
    return role === 'ingeniero_biomedico';
  }

  documentTypeLabel(value?: string | null): string {
    return this.documentTypes.find((item) => item.value === value)?.label ?? 'Sin tipo';
  }

  temporaryPermissionLabel(permission: string): string {
    return this.temporaryPermissionOptions.find((item) => item.value === permission)?.label
      ?? this.permissionLabel(permission);
  }

  temporaryPermissionDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  activeTemporaryPermissions(user: UserView): TemporaryPermissionView[] {
    return (user.temporaryPermissions || []).filter((permission) => {
      const expiresAt = new Date(permission.expiresAt).getTime();
      return !Number.isNaN(expiresAt) && expiresAt > Date.now();
    });
  }

  hasActiveTemporaryPermission(user: UserView, permission: string): boolean {
    return this.activeTemporaryPermissions(user).some((item) => item.permission === permission);
  }

  isTemporaryPermissionSelected(permission: string): boolean {
    return this.selectedTemporaryPermissions.has(permission);
  }

  selectedTemporaryPermissionCount(user: UserView): number {
    return Array.from(this.selectedTemporaryPermissions).filter(
      (permission) => !this.hasActiveTemporaryPermission(user, permission)
    ).length;
  }

  toggleTemporaryPermissionSelection(user: UserView, permission: string): void {
    if (this.hasActiveTemporaryPermission(user, permission) || this.temporaryPermissionLoading) return;
    if (this.selectedTemporaryPermissions.has(permission)) {
      this.selectedTemporaryPermissions.delete(permission);
      return;
    }
    this.selectedTemporaryPermissions.add(permission);
  }

  async grantTemporaryPermission(user: UserView): Promise<void> {
    const permissionsToGrant = Array.from(this.selectedTemporaryPermissions).filter(
      (permission) => !this.hasActiveTemporaryPermission(user, permission)
    );

    if (permissionsToGrant.length === 0 || !this.temporaryPermissionForm.expiresAt) {
      this.errorMessage = 'Selecciona al menos un permiso y la fecha de vencimiento.';
      return;
    }

    const expiresAt = new Date(this.temporaryPermissionForm.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      this.errorMessage = 'La fecha de vencimiento debe ser futura.';
      return;
    }

    this.temporaryPermissionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await Promise.all(
        permissionsToGrant.map((permission) =>
          this.admin.grantTemporaryPermission(user.id, {
            permission,
            expiresAt: expiresAt.toISOString(),
            reason: this.temporaryPermissionForm.reason.trim() || null
          })
        )
      );
      this.successMessage = permissionsToGrant.length === 1
        ? 'Permiso temporal activado. Si el usuario está conectado, debe volver a iniciar sesión para verlo.'
        : 'Permisos temporales activados. Si el usuario está conectado, debe volver a iniciar sesión para verlos.';
      await this.load();
      this.temporaryPanelUserId = user.id;
      this.selectedTemporaryPermissions.clear();
      this.resetTemporaryPermissionForm();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo activar el permiso temporal.';
    } finally {
      this.temporaryPermissionLoading = false;
      this.cdr.detectChanges();
    }
  }

  async revokeTemporaryPermission(user: UserView, permission: string): Promise<void> {
    if (!confirm('¿Revocar este permiso temporal?')) return;
    this.temporaryPermissionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.revokeTemporaryPermission(user.id, permission);
      this.successMessage = 'Permiso temporal revocado. Si el usuario está conectado, debe volver a iniciar sesión para actualizar sus accesos.';
      this.selectedTemporaryPermissions.delete(permission);
      await this.load();
      this.temporaryPanelUserId = user.id;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo revocar el permiso temporal.';
    } finally {
      this.temporaryPermissionLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toDocumentType(value?: string | null): UserDocumentType {
    return this.documentTypes.some((item) => item.value === value)
      ? (value as UserDocumentType)
      : 'cedula_ciudadania';
  }

  private resetTemporaryPermissionForm(): void {
    this.temporaryPermissionForm = {
      expiresAt: this.toDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      reason: 'Periodo temporal de creación/migración inicial del cliente'
    };
  }

  private toDatetimeLocal(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes())
    ].join('');
  }

  private isValidSignatureFile(file: File): boolean {
    const extension = file.name.toLowerCase().split('.').pop();
    return this.signatureAllowedTypes.includes(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(extension || '');
  }

  onSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.isValidSignatureFile(file)) {
      this.signatureFile = null;
      input.value = '';
      this.errorMessage = 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.';
      return;
    }
    this.errorMessage = '';
    this.signatureFile = file;
  }

  onEditSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.isValidSignatureFile(file)) {
      this.editSignatureFile = null;
      input.value = '';
      this.errorMessage = 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.';
      return;
    }
    this.errorMessage = '';
    this.editSignatureFile = file;
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
    if (!user.documentType || !user.documentNumber) {
      this.errorMessage = 'Antes de cambiar el rol, edita el usuario y completa su documento de identidad.';
      this.cdr.detectChanges();
      return;
    }
    if (this.requiresBiomedicalCredentials(role) && !user.invimaRegistration) {
      this.errorMessage = 'Antes de asignar el rol ingeniero biomédico, edita el usuario y completa su registro INVIMA.';
      this.cdr.detectChanges();
      return;
    }

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

  permissionCount(role: Role): number {
    const roleId = this.roleIds.get(role);
    return roleId ? this.rolePermissions[roleId]?.length ?? 0 : 0;
  }

  permissionLabel(permission: string): string {
    return this.permissionLabels[permission] ?? permission;
  }

  roleAssignablePermissions(role: Role): string[] {
    if (role === 'superuser') return this.permissions;
    return this.permissions.filter((permission) => !this.temporaryOnlyPermissions.has(permission));
  }

  isEditingRole(role: Role): boolean {
    const roleId = this.roleIds.get(role);
    return !!roleId && this.editingRoleId === roleId;
  }

  startEditRolePermissions(role: Role): void {
    const roleId = this.roleIds.get(role);
    if (!roleId) return;
    this.editingRoleId = roleId;
    this.permissionDraft = new Set(this.rolePermissions[roleId] ?? []);
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelRolePermissionsEdit(): void {
    this.editingRoleId = null;
    this.permissionDraft.clear();
  }

  togglePermission(roleId: number, permission: string): void {
    if (this.editingRoleId !== roleId) return;
    if (this.permissionDraft.has(permission)) {
      this.permissionDraft.delete(permission);
    } else {
      this.permissionDraft.add(permission);
    }
  }

  async saveRolePermissions(roleId: number): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const role = this.roles.find((roleOption) => this.roleIds.get(roleOption) === roleId);
      const permissions = Array.from(this.permissionDraft).filter((permission) =>
        role === 'superuser' || !this.temporaryOnlyPermissions.has(permission)
      );
      await this.admin.updateRolePermissions(roleId, permissions);
      this.rolePermissions[roleId] = permissions;
      this.cancelRolePermissionsEdit();
      this.successMessage = 'Permisos guardados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron guardar los permisos.';
    } finally {
      this.cdr.detectChanges();
    }
  }
}
