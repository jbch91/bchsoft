import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { Role } from '../../auth/models';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

type UserDocumentType = 'cedula_ciudadania' | 'cedula_extranjeria' | 'pasaporte';
type UserTab = 'list' | 'roles';

interface PermissionGroupView {
  key: string;
  label: string;
  description: string;
  permissions: string[];
}

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
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
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
  createUserModalOpen = false;
  creatingUser = false;
  editingUserId: string | null = null;
  savingUser = false;
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
  role: Role = 'saas_admin';
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
    'clients:create': 'Crear clientes',
    'clients:manage': 'Administrar clientes',
    'clients:view': 'Ver clientes',
    'reports:view': 'Ver reportes administrativos',
    'users:manage': 'Gestionar usuarios',
    'audit:client:view': 'Ver auditoría administrativa',
    'platform:templates:manage': 'Gestionar plantillas globales',
    'saas:access': 'Acceder a administración SaaS',
    'saas:clients:view': 'Ver cartera de clientes SaaS',
    'saas:clients:update': 'Editar datos y configuración de clientes SaaS',
    'saas:subscriptions:manage': 'Gestionar suscripciones y pagos SaaS',
    'saas:plans:manage': 'Gestionar planes SaaS generales',
    'saas:client_admins:reset_password': 'Enviar acceso a administradores de cliente',
    'saas:audit:view': 'Ver auditoría SaaS',
    'hb:create': 'Crear hojas de vida',
    'hb:import': 'Importar hojas de vida masivamente',
    'hb:view': 'Ver hojas de vida',
    'asset_history:upload': 'Migrar PDFs históricos de equipos',
    'areas:manage': 'Gestionar sedes, áreas y ubicaciones',
    'schedules:manage': 'Gestionar cronogramas de mantenimiento',
    'calibration:schedule:manage': 'Gestionar cronogramas de calibración',
    'maintenance:request:create': 'Crear solicitudes de mantenimiento',
    'maintenance:report:create': 'Crear reportes de mantenimiento',
    'maintenance:report:sign': 'Firmar reportes de mantenimiento',
    'calibration:report:upload': 'Subir reportes de calibración',
    'inventory:move': 'Mover equipos y generar reportes de movimiento',
    'inventory:request': 'Solicitudes de inventario',
    'software:biomedico:access': 'Acceder a mantenimiento biomédico',
    'software:odontologico:access': 'Acceder al software odontológico',
    'software:laboratorio:access': 'Acceder al software de laboratorio',
    'quick_guides:view': 'Ver guías rápidas de uso',
    'quick_guides:create': 'Crear guías rápidas de uso',
    'quick_guides:edit': 'Editar guías rápidas de uso',
    'quick_guides:approve': 'Aprobar guías rápidas de uso',
    'quick_guides:delete': 'Eliminar guías rápidas de uso',
    'odontology:access': 'Acceder al módulo odontológico',
    'odontology:settings:manage': 'Gestionar configuración odontológica',
    'odontology:patients:manage': 'Gestionar pacientes odontológicos',
    'odontology:patients:import': 'Importar pacientes odontológicos',
    'odontology:clinical_records:manage': 'Gestionar historias odontológicas',
    'odontology:appointments:manage': 'Gestionar agenda odontológica',
    'odontology:odontogram:manage': 'Gestionar odontograma',
    'odontology:periodontogram:manage': 'Gestionar periodontograma',
    'odontology:consents:manage': 'Gestionar consentimientos odontológicos',
    'odontology:attachments:manage': 'Gestionar adjuntos odontológicos',
    'odontology:inventory:manage': 'Gestionar inventario odontológico',
    'odontology:sterilization:manage': 'Gestionar esterilización odontológica',
    'odontology:treatment_plans:manage': 'Gestionar planes de tratamiento',
    'odontology:payments:manage': 'Gestionar pagos odontológicos',
    'odontology:financial:view': 'Ver valores financieros odontológicos',
    'odontology:prescriptions:manage': 'Gestionar recetas odontológicas',
    'odontology:documents:manage': 'Gestionar certificados e incapacidades odontológicas',
    'odontology:reports:view': 'Ver reportes odontológicos',
    'maintenance:order:create': 'Crear órdenes de mantenimiento',
    'maintenance:order:close': 'Cerrar órdenes de mantenimiento',
    'service:order:create': 'Crear órdenes de servicio',
    'spareparts:order:create': 'Crear solicitudes de repuestos',
    'laboratory:orders:manage': 'Gestionar órdenes de laboratorio',
    'laboratory:results:manage': 'Gestionar resultados de laboratorio',
    'read:all': 'Lectura general'
  };
  readonly roleLabels: Record<string, string> = {
    superuser: 'Superadmin',
    admin: 'Administrador plataforma',
    saas_admin: 'Administrador SaaS',
    saas_billing: 'Facturación SaaS',
    saas_clients: 'Gestor de clientes SaaS',
    saas_support: 'Soporte SaaS',
    saas_auditor: 'Auditor SaaS',
    client_admin: 'Administrador del cliente',
    viewer: 'Visor plataforma (legado)',
    almacenista: 'Almacenista',
    ingeniero_biomedico: 'Ingeniero biomédico',
    calibracion: 'Calibración',
    lector: 'Lector',
    odontologo: 'Odontólogo',
    auxiliar_odontologia: 'Auxiliar odontología',
    recepcion_odontologia: 'Recepción odontología',
    admin_odontologia: 'Admin odontología',
    auditor_odontologia: 'Auditor odontología',
    bacteriologo: 'Bacteriólogo',
    auxiliar_laboratorio: 'Auxiliar laboratorio'
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
  private readonly legacyPlatformRoles = new Set<Role>(['viewer']);

  readonly permissionGroupOrder = [
    'saas',
    'users_audit',
    'software',
    'biomed',
    'maintenance',
    'calibration',
    'odontology',
    'laboratory',
    'reading',
    'other'
  ];
  readonly permissionGroupLabels: Record<string, { label: string; description: string }> = {
    saas: {
      label: 'Administración SaaS',
      description: 'Clientes, planes, cartera, suscripciones y soporte de plataforma.'
    },
    users_audit: {
      label: 'Usuarios, auditoría y seguridad',
      description: 'Gestión de usuarios, auditoría y trazabilidad administrativa.'
    },
    software: {
      label: 'Software principal',
      description: 'Acceso base a los productos contratados por el cliente.'
    },
    biomed: {
      label: 'Biomédico, inventario y hojas de vida',
      description: 'Hojas de vida, inventario, guías rápidas, sedes, áreas y movimientos.'
    },
    maintenance: {
      label: 'Mantenimiento y repuestos',
      description: 'Solicitudes, reportes, firmas, órdenes, repuestos y cronogramas.'
    },
    calibration: {
      label: 'Calibración',
      description: 'Cronogramas y carga documental de certificados de calibración.'
    },
    odontology: {
      label: 'Odontología',
      description: 'Pacientes, agenda, historia clínica, tratamientos, pagos y reportes.'
    },
    laboratory: {
      label: 'Laboratorio',
      description: 'Órdenes, resultados y flujo operativo de laboratorio.'
    },
    reading: {
      label: 'Lectura general',
      description: 'Consulta amplia sin edición operativa.'
    },
    other: {
      label: 'Otros permisos',
      description: 'Permisos pendientes de categorizar o de uso especial.'
    }
  };

  readonly recommendedRolePermissions: Partial<Record<Role, string[]>> = {
    admin: [
      'saas:access',
      'saas:clients:view',
      'saas:clients:update',
      'saas:subscriptions:manage',
      'saas:plans:manage',
      'saas:client_admins:reset_password',
      'saas:audit:view',
      'audit:client:view',
      'clients:view',
      'reports:view'
    ],
    viewer: ['clients:view', 'reports:view'],
    saas_admin: [
      'saas:access',
      'saas:clients:view',
      'saas:clients:update',
      'saas:subscriptions:manage',
      'saas:plans:manage',
      'saas:client_admins:reset_password',
      'saas:audit:view',
      'audit:client:view',
      'clients:view',
      'reports:view'
    ],
    saas_billing: [
      'saas:access',
      'saas:clients:view',
      'saas:subscriptions:manage',
      'clients:view'
    ],
    saas_clients: [
      'saas:access',
      'saas:clients:view',
      'saas:clients:update',
      'clients:view'
    ],
    saas_support: [
      'saas:access',
      'saas:clients:view',
      'saas:client_admins:reset_password',
      'clients:view'
    ],
    saas_auditor: [
      'saas:access',
      'saas:clients:view',
      'saas:audit:view',
      'audit:client:view',
      'clients:view',
      'reports:view'
    ],
    client_admin: ['users:manage', 'clients:view', 'audit:client:view', 'areas:manage'],
    almacenista: [
      'software:biomedico:access',
      'hb:view',
      'maintenance:request:create',
      'maintenance:report:sign',
      'inventory:move',
      'inventory:request',
      'quick_guides:view'
    ],
    ingeniero_biomedico: [
      'software:biomedico:access',
      'hb:create',
      'hb:view',
      'areas:manage',
      'maintenance:report:create',
      'maintenance:report:sign',
      'schedules:manage',
      'calibration:schedule:manage',
      'inventory:move',
      'quick_guides:view',
      'quick_guides:create',
      'quick_guides:edit',
      'quick_guides:approve'
    ],
    calibracion: [
      'software:biomedico:access',
      'hb:view',
      'calibration:report:upload',
      'quick_guides:view'
    ],
    lector: [
      'software:biomedico:access',
      'hb:view',
      'maintenance:request:create',
      'maintenance:report:sign',
      'quick_guides:view'
    ],
    admin_odontologia: [
      'software:odontologico:access',
      'odontology:access',
      'odontology:settings:manage',
      'odontology:patients:manage',
      'odontology:patients:import',
      'odontology:clinical_records:manage',
      'odontology:appointments:manage',
      'odontology:odontogram:manage',
      'odontology:periodontogram:manage',
      'odontology:consents:manage',
      'odontology:attachments:manage',
      'odontology:inventory:manage',
      'odontology:sterilization:manage',
      'odontology:treatment_plans:manage',
      'odontology:payments:manage',
      'odontology:financial:view',
      'odontology:prescriptions:manage',
      'odontology:documents:manage',
      'odontology:reports:view',
      'audit:odontology:view'
    ],
    odontologo: [
      'software:odontologico:access',
      'odontology:access',
      'odontology:patients:manage',
      'odontology:clinical_records:manage',
      'odontology:appointments:manage',
      'odontology:odontogram:manage',
      'odontology:periodontogram:manage',
      'odontology:consents:manage',
      'odontology:treatment_plans:manage',
      'odontology:prescriptions:manage',
      'odontology:documents:manage'
    ],
    auxiliar_odontologia: [
      'software:odontologico:access',
      'odontology:access',
      'odontology:patients:manage',
      'odontology:appointments:manage',
      'odontology:attachments:manage',
      'odontology:inventory:manage',
      'odontology:sterilization:manage'
    ],
    recepcion_odontologia: [
      'software:odontologico:access',
      'odontology:access',
      'odontology:patients:manage',
      'odontology:appointments:manage',
      'odontology:payments:manage'
    ],
    auditor_odontologia: [
      'software:odontologico:access',
      'odontology:access',
      'odontology:reports:view',
      'audit:odontology:view'
    ],
    bacteriologo: [
      'software:laboratorio:access',
      'laboratory:orders:manage',
      'laboratory:results:manage'
    ],
    auxiliar_laboratorio: [
      'software:laboratorio:access',
      'laboratory:orders:manage'
    ]
  };

  private readonly clientScopedRoles: Role[] = [
    'client_admin',
    'almacenista',
    'ingeniero_biomedico',
    'calibracion',
    'lector',
    'odontologo',
    'auxiliar_odontologia',
    'recepcion_odontologia',
    'admin_odontologia',
    'auditor_odontologia',
    'bacteriologo',
    'auxiliar_laboratorio'
  ];
  private readonly platformCreatableRoles: Role[] = [
    'saas_admin',
    'saas_billing',
    'saas_clients',
    'saas_support',
    'saas_auditor'
  ];
  private readonly platformAssignablePermissions = new Set<string>([
    'clients:create',
    'clients:manage',
    'clients:view',
    'reports:view',
    'users:manage',
    'audit:client:view',
    'platform:templates:manage',
    'saas:access',
    'saas:clients:view',
    'saas:clients:update',
    'saas:subscriptions:manage',
    'saas:plans:manage',
    'saas:client_admins:reset_password',
    'saas:audit:view'
  ]);
  private readonly signatureRoles: Role[] = ['almacenista', 'ingeniero_biomedico', 'lector'];

  constructor(
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    this.activeUserTab = this.isRolePermissionsRoute() ? 'roles' : 'list';
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const [roles, users, permissions] = await Promise.all([
        this.admin.listRoles(),
        this.admin.listUsers(),
        this.canViewRolesAndPermissions() ? this.admin.listPermissions() : Promise.resolve([])
      ]);
      this.roles = this.visibleRolesForContext(roles.map((item) => item.name));
      if (!this.creatableRoles.includes(this.role)) {
        this.role = this.creatableRoles[0] ?? this.assignableRoles[0] ?? 'saas_admin';
      }
      const visibleRoleSet = new Set(this.roles);
      this.roleIds = new Map(
        roles
          .filter((item) => visibleRoleSet.has(item.name))
          .map((item) => [item.name, item.id])
      );
      this.permissions = permissions
        .map((item) => item.name)
        .filter((permission) =>
          this.isKnownSoftwarePermission(permission) && this.isVisiblePermissionForContext(permission)
        );
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
      if (this.canViewRolesAndPermissions()) {
        await this.loadRolePermissions();
      }
      if (this.isPlatformAdmin()) {
        try {
          const clients = await this.admin.listClients();
          this.clients = clients.map((client) => ({ id: client.id, name: client.name }));
          if (!this.clientId) {
            this.clientId = this.clients[0]?.id ?? '';
          }
        } catch {
          this.clients = [];
        }
      } else {
        this.clients = [];
        this.clientId = this.auth.currentUser()?.clientId ?? '';
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
        const permissions = (await this.admin.getRolePermissions(roleId))
          .filter((permission) => this.isKnownSoftwarePermission(permission));
        return [roleId, permissions] as const;
      })
    );

    this.rolePermissions = Object.fromEntries(entries);
  }

  async onCreateUser(): Promise<void> {
    if (this.creatingUser) return;
    if (!this.username || !this.displayName || !this.email || !this.role) {
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

    this.creatingUser = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const securityCode = await this.requestSecurityCode(
        'USER_CREATE',
        `Crear usuario ${this.username.trim()} con rol ${this.roleLabel(this.role)} y enviar correo de acceso`
      );
      if (!securityCode) return;
      await this.admin.createUser({
        username: this.username.trim(),
        displayName: this.displayName.trim(),
        email: this.email.trim(),
        role: this.role,
        clientId: this.isClientScopedRole(this.role) ? this.clientId : undefined,
        signatureFile: this.signatureFile,
        securityCode,
        documentType: this.documentType,
        documentNumber: this.documentNumber.trim(),
        invimaRegistration: this.requiresBiomedicalCredentials(this.role) ? this.invimaRegistration.trim() : null
      });
      this.username = '';
      this.displayName = '';
      this.email = '';
      this.role = this.creatableRoles[0] ?? this.assignableRoles[0] ?? 'saas_admin';
      this.clientId = this.clients[0]?.id ?? '';
      this.signatureFile = null;
      this.documentType = 'cedula_ciudadania';
      this.documentNumber = '';
      this.invimaRegistration = '';
      this.successMessage = 'Usuario creado. Se envió correo para definir contraseña.';
      this.createUserModalOpen = false;
      this.activeUserTab = 'list';
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = this.readApiError(error, 'No se pudo crear el usuario.');
    } finally {
      this.creatingUser = false;
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

  get filteredUsers(): UserView[] {
    return this.groupedUsers.flatMap((group) => group.users);
  }

  get editingUser(): UserView | null {
    return this.users.find((user) => user.id === this.editingUserId) ?? null;
  }

  get temporaryUser(): UserView | null {
    const user = this.users.find((item) => item.id === this.temporaryPanelUserId) ?? null;
    return user && this.canManageTemporaryAccess(user) ? user : null;
  }

  setUserTab(tab: UserTab): void {
    if (tab === 'roles' && !this.canViewRolesAndPermissions()) {
      tab = 'list';
    }
    this.activeUserTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    this.createUserModalOpen = false;
    this.cancelEditUser();
    this.cancelTemporaryAccess();
    this.cancelRolePermissionsEdit();
  }

  openCreateUserModal(): void {
    this.createUserModalOpen = true;
    this.creatingUser = false;
    this.activeUserTab = 'list';
    this.errorMessage = '';
    this.successMessage = '';
    this.cancelEditUser();
    this.cancelTemporaryAccess();
    this.cancelRolePermissionsEdit();
  }

  closeCreateUserModal(): void {
    this.createUserModalOpen = false;
    this.creatingUser = false;
    this.resetCreateUserForm();
  }

  openUsersList(): void {
    if (this.isRolePermissionsRoute()) {
      void this.router.navigateByUrl('/usuarios');
      return;
    }
    this.setUserTab('list');
  }

  clearSearch(): void {
    this.searchTerm = '';
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
    this.errorMessage = '';
    this.successMessage = '';
    this.savingUser = false;
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
    this.savingUser = false;
    this.temporaryPermissionLoading = false;
  }

  toggleTemporaryAccess(user: UserView): void {
    if (!this.canManageTemporaryAccess(user)) {
      this.errorMessage = 'Los permisos temporales solo aplican a ingenieros biomédicos de un cliente.';
      this.successMessage = '';
      return;
    }
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
    if (this.savingUser) return;
    if (!this.editUser.documentType || !this.editUser.documentNumber.trim()) {
      this.errorMessage = 'Completa tipo de documento y número de documento.';
      return;
    }
    if (this.requiresBiomedicalCredentials(user.roles[0] || 'viewer') && !this.editUser.invimaRegistration.trim()) {
      this.errorMessage = 'Completa el registro INVIMA para el ingeniero biomédico.';
      return;
    }

    this.savingUser = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const securityCode = await this.requestSecurityCode(
        'USER_UPDATE',
        `Editar usuario ${user.username}`
      );
      if (!securityCode) return;
      await this.admin.updateUserProfile(user.id, {
        displayName: this.editUser.displayName.trim(),
        email: this.editUser.email.trim(),
        clientId: this.editUser.clientId || null,
        documentType: this.editUser.documentType,
        documentNumber: this.editUser.documentNumber.trim(),
        invimaRegistration: this.requiresBiomedicalCredentials(user.roles[0] || 'viewer')
          ? this.editUser.invimaRegistration.trim()
          : null,
        securityCode
      });
      if (this.editSignatureFile && this.requiresSignature(user.roles[0] || 'viewer')) {
        await this.admin.updateUserSignature(user.id, this.editSignatureFile);
      }
      if (this.isReader(user) && user.clientId) {
        await this.saveReaderAccess(user.id, user.clientId);
      }
      this.editingUserId = null;
      this.editSignatureFile = null;
      this.successMessage = 'Usuario actualizado correctamente.';
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el usuario.';
    } finally {
      this.savingUser = false;
      this.cdr.detectChanges();
    }
  }

  async removeUser(user: UserView): Promise<void> {
    if (!confirm('¿Eliminar usuario?')) return;
    const securityCode = await this.requestSecurityCode('USER_DELETE', `Eliminar usuario ${user.username}`);
    if (!securityCode) return;
    await this.admin.deleteUser(user.id, securityCode);
    await this.load();
  }

  isClientScopedRole(role: Role): boolean {
    return this.clientScopedRoles.includes(role);
  }

  isPlatformAdmin(): boolean {
    return this.auth.hasRole('superuser');
  }

  isTenantAdmin(): boolean {
    return this.auth.hasRole('client_admin');
  }

  canViewRolesAndPermissions(): boolean {
    return this.isPlatformAdmin() || this.isTenantAdmin();
  }

  canEditRolePermissions(): boolean {
    return this.isPlatformAdmin() || this.isTenantAdmin();
  }

  private visibleRolesForContext(roles: Role[]): Role[] {
    if (this.isPlatformAdmin()) {
      return roles.filter((role) => this.platformCreatableRoles.includes(role));
    }
    return roles;
  }

  private isVisiblePermissionForContext(permission: string): boolean {
    return !this.isPlatformAdmin() || this.platformAssignablePermissions.has(permission);
  }

  isRolePermissionsRoute(): boolean {
    return this.router.url.split('?')[0] === '/roles-permisos';
  }

  get assignableRoles(): Role[] {
    if (this.isPlatformAdmin()) {
      return this.roles.filter((role) => this.platformCreatableRoles.includes(role));
    }
    return this.roles.filter((role) => !this.isLegacyRole(role));
  }

  get creatableRoles(): Role[] {
    if (this.isPlatformAdmin()) {
      return this.roles.filter((role) => this.platformCreatableRoles.includes(role));
    }
    return this.assignableRoles;
  }

  assignableRolesFor(user?: UserView): Role[] {
    const currentRole = user?.roles?.[0];
    if (this.isPlatformAdmin()) {
      return this.assignableRoles;
    }
    if (this.isTenantAdmin() && currentRole === 'client_admin') {
      return this.assignableRoles;
    }
    if (currentRole && !this.assignableRoles.includes(currentRole)) {
      return [currentRole, ...this.assignableRoles];
    }
    return this.assignableRoles;
  }

  isLegacyRole(role?: Role | null): boolean {
    return Boolean(role && this.legacyPlatformRoles.has(role));
  }

  canChangeUserRole(user: UserView): boolean {
    const currentRole = user.roles?.[0];
    if (!currentRole) return false;
    if (this.isPlatformAdmin()) {
      return this.platformCreatableRoles.includes(currentRole);
    }
    return this.assignableRolesFor(user).length > 0;
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

  canManageTemporaryAccess(user: UserView): boolean {
    return Boolean(user.clientId) && user.roles.includes('ingeniero_biomedico');
  }

  documentTypeLabel(value?: string | null): string {
    return this.documentTypes.find((item) => item.value === value)?.label ?? 'Sin tipo';
  }

  roleLabel(role?: string | null): string {
    return this.roleLabels[role || ''] ?? role ?? 'Sin rol';
  }

  private readApiError(error: any, fallback: string): string {
    if (error?.status === 0) {
      return 'No fue posible conectar con el servidor. Revisa que la API esté activa e intenta nuevamente.';
    }
    if (typeof error?.error === 'string' && error.error.trim()) {
      return error.error.trim();
    }
    if (error?.error?.message) {
      return error.error.message;
    }
    if (typeof error?.message === 'string' && !error.message.includes('Http failure response')) {
      return error.message;
    }
    if (error?.statusText) {
      return `${fallback} Detalle: ${error.statusText}.`;
    }
    return fallback;
  }

  private async requestSecurityCode(action: string, summary: string): Promise<string | null> {
    try {
      const result = await this.admin.requestActionConfirmation({ action, summary });
      const code = window.prompt(
        `Se envió un código de confirmación a ${result.deliveryEmail}.\n\n${summary}\n\nIngresa el código para confirmar:`
      );
      if (!code?.trim()) {
        this.errorMessage = 'Acción cancelada. El código de confirmación es obligatorio.';
        return null;
      }
      return code.trim();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo enviar el código de confirmación.';
      return null;
    } finally {
      this.cdr.detectChanges();
    }
  }

  roleDescription(role?: Role | null): string {
    const descriptions: Partial<Record<Role, string>> = {
      superuser: 'Dueño total de la plataforma. Úsalo solo para administración crítica.',
      admin: 'Rol antiguo de administración de plataforma. Preferible usar roles SaaS específicos.',
      viewer: 'Rol legado de solo lectura. No se recomienda para usuarios nuevos.',
      saas_admin: 'Administra cartera, planes, suscripciones, soporte y auditoría SaaS.',
      saas_billing: 'Gestiona cobros, renovaciones y estados comerciales sin crear clientes.',
      saas_clients: 'Actualiza datos y configuración administrativa de clientes.',
      saas_support: 'Soporte interno: consulta clientes y restablece claves de administradores.',
      saas_auditor: 'Consulta cartera y auditoría sin modificar información.',
      client_admin: 'Administrador del cliente. Crea y controla usuarios de su institución.',
      almacenista: 'Solicita correctivos, firma reportes y gestiona movimientos operativos permitidos.',
      ingeniero_biomedico: 'Crea hojas de vida, reportes, cronogramas y documentos biomédicos.',
      calibracion: 'Carga certificados y reportes de calibración.',
      lector: 'Consulta información autorizada por área/ubicación y firma cuando aplique.',
      admin_odontologia: 'Administra la operación odontológica del cliente.',
      odontologo: 'Gestiona atención clínica odontológica.',
      auxiliar_odontologia: 'Apoya agenda, pacientes, adjuntos, inventario y esterilización.',
      recepcion_odontologia: 'Gestiona pacientes, agenda y pagos básicos.',
      auditor_odontologia: 'Consulta reportes y auditoría odontológica.',
      bacteriologo: 'Gestiona órdenes y resultados de laboratorio.',
      auxiliar_laboratorio: 'Apoya la gestión de órdenes de laboratorio.'
    };
    return descriptions[role || 'viewer'] ?? 'Rol configurable por permisos.';
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
    if (!this.canManageTemporaryAccess(user)) {
      this.errorMessage = 'Los permisos temporales solo se pueden activar a ingenieros biomédicos de un cliente.';
      this.successMessage = '';
      return;
    }

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
      for (const permission of permissionsToGrant) {
        const securityCode = await this.requestSecurityCode(
          'USER_TEMPORARY_PERMISSION_GRANT',
          `Activar permiso temporal ${this.permissionLabel(permission)} para ${user.username}`
        );
        if (!securityCode) return;
        await this.admin.grantTemporaryPermission(user.id, {
          permission,
          expiresAt: expiresAt.toISOString(),
          reason: this.temporaryPermissionForm.reason.trim() || null,
          securityCode
        });
      }
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
    const securityCode = await this.requestSecurityCode(
      'USER_TEMPORARY_PERMISSION_REVOKE',
      `Revocar permiso temporal ${this.permissionLabel(permission)} para ${user.username}`
    );
    if (!securityCode) return;
    this.temporaryPermissionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.revokeTemporaryPermission(user.id, permission, securityCode);
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

  private resetCreateUserForm(): void {
    this.username = '';
    this.displayName = '';
    this.email = '';
    this.role = this.creatableRoles[0] ?? this.assignableRoles[0] ?? 'saas_admin';
    this.clientId = this.clients[0]?.id ?? this.auth.currentUser()?.clientId ?? '';
    this.signatureFile = null;
    this.documentType = 'cedula_ciudadania';
    this.documentNumber = '';
    this.invimaRegistration = '';
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
      const nextState = !user.isActive;
      const securityCode = await this.requestSecurityCode(
        'USER_ACTIVE_UPDATE',
        `${nextState ? 'Activar' : 'Bloquear'} usuario ${user.username}`
      );
      if (!securityCode) return;
      await this.admin.updateUserActive(user.id, nextState, securityCode);
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
      const securityCode = await this.requestSecurityCode(
        'USER_ROLE_UPDATE',
        `Cambiar rol de ${user.username} a ${this.roleLabel(role)}`
      );
      if (!securityCode) return;
      await this.admin.updateUserRole(user.id, role, securityCode);
      user.roles = [role];
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el rol.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onSendPasswordSetup(user: UserView): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const securityCode = await this.requestSecurityCode(
        'USER_PASSWORD_RESET',
        `Enviar correo para que ${user.username} defina su contraseña`
      );
      if (!securityCode) return;
      await this.admin.sendUserPasswordSetup(user.id, securityCode);
      this.successMessage = 'Correo enviado. El usuario definirá su contraseña desde Recuperar contraseña.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo enviar el correo de contraseña.';
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

  isKnownSoftwarePermission(permission: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.permissionLabels, permission);
  }

  roleAssignablePermissions(role: Role): string[] {
    if (role === 'superuser') return this.permissions;
    return this.permissions.filter((permission) => !this.temporaryOnlyPermissions.has(permission));
  }

  permissionGroupsForRole(role: Role): PermissionGroupView[] {
    const allowed = this.roleAssignablePermissions(role);
    const grouped = new Map<string, string[]>();
    for (const permission of allowed) {
      const key = this.permissionGroupKey(permission);
      grouped.set(key, [...(grouped.get(key) ?? []), permission]);
    }

    return this.permissionGroupOrder
      .filter((key) => grouped.has(key))
      .map((key) => ({
        key,
        label: this.permissionGroupLabels[key]?.label ?? key,
        description: this.permissionGroupLabels[key]?.description ?? '',
        permissions: (grouped.get(key) ?? []).sort((a, b) =>
          this.permissionLabel(a).localeCompare(this.permissionLabel(b))
        )
      }));
  }

  applyRecommendedPermissions(role: Role): void {
    const recommended = this.recommendedRolePermissions[role];
    if (!recommended?.length) {
      this.errorMessage = 'Este rol aún no tiene una plantilla recomendada.';
      return;
    }
    const allowed = new Set(this.roleAssignablePermissions(role));
    this.permissionDraft = new Set(recommended.filter((permission) => allowed.has(permission)));
    this.errorMessage = '';
    this.successMessage = 'Plantilla base aplicada. Revisa los permisos y guarda cuando estés de acuerdo.';
  }

  clearPermissionDraft(): void {
    this.permissionDraft.clear();
  }

  setPermissionGroup(permissions: string[], enabled: boolean): void {
    for (const permission of permissions) {
      if (enabled) {
        this.permissionDraft.add(permission);
      } else {
        this.permissionDraft.delete(permission);
      }
    }
  }

  selectedPermissionsInGroup(permissions: string[]): number {
    return permissions.filter((permission) => this.permissionDraft.has(permission)).length;
  }

  private permissionGroupKey(permission: string): string {
    if (permission.startsWith('saas:') || permission.startsWith('clients:') || permission === 'reports:view' || permission === 'platform:templates:manage') {
      return 'saas';
    }
    if (permission === 'users:manage' || permission.startsWith('audit:')) {
      return 'users_audit';
    }
    if (permission.startsWith('software:')) {
      return 'software';
    }
    if (
      permission.startsWith('hb:') ||
      permission.startsWith('quick_guides:') ||
      permission.startsWith('inventory:') ||
      permission === 'areas:manage' ||
      permission === 'asset_history:upload'
    ) {
      return 'biomed';
    }
    if (
      permission.startsWith('maintenance:') ||
      permission.startsWith('service:') ||
      permission.startsWith('spareparts:') ||
      permission === 'schedules:manage'
    ) {
      return 'maintenance';
    }
    if (permission.startsWith('calibration:')) {
      return 'calibration';
    }
    if (permission.startsWith('odontology:')) {
      return 'odontology';
    }
    if (permission.startsWith('laboratory:')) {
      return 'laboratory';
    }
    if (permission === 'read:all') {
      return 'reading';
    }
    return 'other';
  }

  isEditingRole(role: Role): boolean {
    const roleId = this.roleIds.get(role);
    return !!roleId && this.editingRoleId === roleId;
  }

  startEditRolePermissions(role: Role): void {
    if (!this.canEditRolePermissions()) return;
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
      const roleName = role ? this.roleLabel(role) : `rol ${roleId}`;
      const action = this.isTenantAdmin() ? 'CLIENT_ROLE_PERMISSIONS_UPDATE' : 'ROLE_PERMISSIONS_UPDATE';
      const securityCode = await this.requestSecurityCode(
        action,
        this.isTenantAdmin()
          ? `Actualizar permisos de ${roleName} para este cliente`
          : `Actualizar permisos de ${roleName}`
      );
      if (!securityCode) return;
      await this.admin.updateRolePermissions(roleId, permissions, securityCode);
      this.rolePermissions[roleId] = permissions;
      this.cancelRolePermissionsEdit();
      this.successMessage = this.isTenantAdmin()
        ? 'Permisos guardados para este cliente. Los usuarios verán el cambio al iniciar sesión de nuevo.'
        : 'Permisos guardados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron guardar los permisos.';
    } finally {
      this.cdr.detectChanges();
    }
  }
}
