import { ChangeDetectorRef, Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';
import { Permission } from '../../auth/models';
import {
  BiomedicalFeatureKey,
  canOpenBiomedicalFeature
} from '../../core/biomedical-access-policy';

interface SoftwareSuite {
  key: 'biomedico' | 'odontologico' | 'laboratorio' | string;
  name: string;
  description: string | null;
  enabled: boolean;
  client_enabled?: boolean;
  can_access?: boolean;
  license_status?: 'trial' | 'active' | 'suspended' | 'expired';
  subscription_status?: string;
  subscription_access_mode?: string;
}

interface ClientSubscription {
  effective_status: string;
  effective_access_mode: string;
  current_period_ends_at: string | null;
  grace_ends_at: string | null;
  days_remaining: number | null;
  is_read_only: boolean;
  is_blocked: boolean;
}

interface ClientModuleAccess {
  key: string;
  suite_key: string | null;
  enabled: boolean;
}

interface ClientModuleCard extends ClientModuleAccess {
  label: string;
  description: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  enabledModules: Set<string> | null = null;
  enabledModuleRows: ClientModuleAccess[] = [];
  softwareSuites: SoftwareSuite[] = [];
  selectedSuiteKey: string | null = null;
  subscription: ClientSubscription | null = null;
  clientInfo: { name: string; nit: string; city: string; address?: string | null; email: string; logo_path?: string | null } | null = null;
  private loadingClientInfo = false;
  readonly saasShortcutPermissions: Permission[] = [
    'clients:manage',
    'saas:access',
    'saas:clients:view',
    'saas:clients:update',
    'saas:subscriptions:manage',
    'saas:plans:manage',
    'saas:client_admins:reset_password'
  ];
  readonly moduleCatalog: Record<string, { label: string; description: string }> = {
    usuarios: {
      label: 'Usuarios',
      description: 'Usuarios internos, roles y accesos del cliente.'
    },
    auditoria: {
      label: 'Auditoría',
      description: 'Trazabilidad administrativa y operativa del cliente.'
    },
    hojas_de_vida: {
      label: 'Hojas de vida',
      description: 'Registro técnico e historial separado para equipos biomédicos e industriales.'
    },
    inventario: {
      label: 'Inventario',
      description: 'Equipos, ubicación, movimientos y control de activos.'
    },
    guias_rapidas: {
      label: 'Guías rápidas de uso',
      description: 'Guías por marca y modelo para operación segura.'
    },
    reportes_mantenimiento: {
      label: 'Reportes de mantenimiento',
      description: 'Solicitudes, preventivos, correctivos y firmas.'
    },
    cronogramas: {
      label: 'Cronogramas y Capacitaciones',
      description: 'Planes anuales independientes por categoría, capacitaciones y control documental.'
    },
    calibraciones: {
      label: 'Calibraciones',
      description: 'Cronograma y certificados de calibración.'
    },
    odontologia: {
      label: 'Odontología',
      description: 'Pacientes, agenda, historia clínica y documentos odontológicos.'
    },
    laboratorio: {
      label: 'Laboratorio clínico',
      description: 'Órdenes, muestras, resultados y reportes.'
    }
  };

  constructor(
    public readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const user = this.auth.currentUser();
      if (user?.clientId) {
        void this.loadClientInfo();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await Promise.all([this.loadSoftwareSuites(), this.loadModules(), this.loadSubscription()]);
    await this.loadClientInfo();
  }

  async loadSubscription(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.clientId) {
      this.subscription = null;
      return;
    }
    try {
      this.subscription = await firstValueFrom(
        this.http.get<ClientSubscription | null>(`${this.apiBase}/subscription/me?t=${Date.now()}`)
      );
      this.cdr.detectChanges();
    } catch {
      this.subscription = null;
    }
  }

  async loadSoftwareSuites(): Promise<void> {
    try {
      const token = this.auth.tokens()?.accessToken;
      if (!token) {
        setTimeout(() => {
          void this.loadSoftwareSuites();
        }, 300);
        return;
      }
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      this.softwareSuites = await firstValueFrom(
        this.http.get<SoftwareSuite[]>(`${this.apiBase}/software-suites/me`, { headers })
      );
      this.cdr.detectChanges();
    } catch {
      this.softwareSuites = [];
    }
  }

  async loadModules(): Promise<void> {
    try {
      const token = this.auth.tokens()?.accessToken;
      if (!token) {
        this.enabledModules = null;
        setTimeout(() => {
          void this.loadModules();
        }, 300);
        return;
      }
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
      const rows = await firstValueFrom(
        this.http.get<ClientModuleAccess[]>(`${this.apiBase}/modules/me`, { headers })
      );
      this.enabledModuleRows = rows.filter((row) => row.enabled);
      this.enabledModules = new Set(this.enabledModuleRows.map((row) => row.key));
    } catch {
      this.enabledModules = null;
      this.enabledModuleRows = [];
    }
  }

  async loadClientInfo(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.clientId) {
      this.clientInfo = null;
      return;
    }
    if (this.loadingClientInfo) return;
    const token = this.auth.tokens()?.accessToken;
    if (!token) {
      setTimeout(() => {
        void this.loadClientInfo();
      }, 300);
      return;
    }
    try {
      this.loadingClientInfo = true;
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      });
      const client = await firstValueFrom(
        this.http.get<{ name: string; nit: string; city: string; address?: string | null; email: string; logo_path?: string | null }>(
          `${this.apiBase}/clients/me?t=${Date.now()}`,
          { headers }
        )
      );
      this.clientInfo = client;
      this.cdr.detectChanges();
    } catch {
      // keep last known clientInfo to avoid flicker if token refresh delays
    } finally {
      this.loadingClientInfo = false;
    }
  }

  clientLogoUrl(): string | null {
    if (!this.clientInfo?.logo_path) return null;
    if (this.clientInfo.logo_path.startsWith('http')) return this.clientInfo.logo_path;
    return joinBase(this.publicBase, this.clientInfo.logo_path);
  }

  get visibleSoftwareSuites(): SoftwareSuite[] {
    return this.softwareSuites.filter((suite) => suite.enabled);
  }

  get selectedSuite(): SoftwareSuite | null {
    return this.softwareSuites.find((suite) => suite.key === this.selectedSuiteKey) ?? null;
  }

  get enabledModulesForSelectedSuite(): ClientModuleCard[] {
    if (!this.selectedSuiteKey) {
      return [];
    }
    return this.enabledModuleRows
      .filter((module) =>
        module.enabled
        && module.key !== 'auditoria'
        && (module.suite_key || 'biomedico') === this.selectedSuiteKey
      )
      .map((module) => ({
        ...module,
        label: this.moduleLabel(module.key),
        description: this.moduleDescription(module.key)
      }));
  }

  selectSuite(suiteKey: string): void {
    this.selectedSuiteKey = suiteKey;
    this.cdr.detectChanges();
  }

  backToSuites(): void {
    this.selectedSuiteKey = null;
  }

  suiteStatusLabel(suite: SoftwareSuite): string {
    const labels: Record<string, string> = {
      trial: 'Prueba',
      active: 'Activo',
      suspended: 'Suspendido',
      expired: 'Vencido'
    };
    return labels[suite.license_status || 'active'] || 'Activo';
  }

  subscriptionStatusLabel(): string {
    const labels: Record<string, string> = {
      active: 'Suscripción activa',
      grace: 'Suscripción en periodo de gracia',
      read_only: 'Suscripción en solo lectura',
      suspended: 'Suscripción suspendida',
      cancelled: 'Suscripción cancelada'
    };
    return labels[this.subscription?.effective_status || 'active'] || 'Suscripción activa';
  }

  subscriptionMessage(): string {
    if (!this.subscription) return '';
    if (this.subscription.is_blocked) {
      return 'El acceso operativo está bloqueado. Contacta al administrador de la plataforma para reactivar el servicio.';
    }
    if (this.subscription.is_read_only) {
      return 'Puedes consultar información y descargar documentos, pero no crear, editar, firmar ni subir archivos.';
    }
    if (this.subscription.effective_status === 'grace') {
      return `El servicio está en periodo de gracia${this.subscription.days_remaining != null ? ` por ${this.subscription.days_remaining} día(s)` : ''}.`;
    }
    if (this.subscription.current_period_ends_at) {
      return `Vence el ${this.formatDate(this.subscription.current_period_ends_at)}.`;
    }
    return '';
  }

  showSubscriptionNotice(): boolean {
    return Boolean(this.subscription?.is_blocked || this.subscription?.is_read_only || this.subscription?.effective_status === 'grace');
  }

  formatDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  canOpenOdontology(): boolean {
    return [
      'software:odontologico:access',
      'odontology:access',
      'odontology:settings:manage',
      'odontology:patients:manage',
      'odontology:patients:import',
      'odontology:appointments:manage',
      'odontology:clinical_records:manage',
      'odontology:odontogram:manage',
      'odontology:periodontogram:manage',
      'odontology:consents:manage',
      'odontology:treatment_plans:manage',
      'odontology:attachments:manage',
      'odontology:inventory:manage',
      'odontology:sterilization:manage',
      'odontology:payments:manage',
      'odontology:financial:view',
      'odontology:prescriptions:manage',
      'odontology:documents:manage',
      'odontology:reports:view'
    ].some((permission) => this.auth.hasPermission(permission as Permission));
  }

  canOpenBiomedFeature(featureKey: BiomedicalFeatureKey): boolean {
    const user = this.auth.currentUser();
    const roles = user?.roles?.length ? user.roles : user ? [user.role] : [];
    return canOpenBiomedicalFeature(featureKey, {
      permissions: user?.permissions ?? [],
      roles,
      enabledModules: this.enabledModules
    });
  }

  canOpenSaasAdministration(): boolean {
    return this.saasShortcutPermissions.some((permission) => this.auth.hasPermission(permission));
  }

  canManageBiomedicalCatalog(): boolean {
    return !this.auth.currentUser()?.clientId
      && this.auth.hasRole(['superuser', 'admin', 'saas_admin'])
      && this.auth.hasPermission('platform:biomedical_catalog:manage');
  }

  canOpenAuditAdministration(): boolean {
    const user = this.auth.currentUser();
    if (user?.clientId) {
      return this.auth.hasPermission('audit:client:view');
    }
    return this.auth.hasPermission('users:manage') || this.auth.hasPermission('saas:audit:view');
  }

  canShowClientModuleSummary(): boolean {
    return Boolean(this.auth.hasRole('client_admin') && this.enabledModulesForSelectedSuite.length);
  }

  moduleLabel(moduleKey: string): string {
    return this.moduleCatalog[moduleKey]?.label ?? moduleKey.replace(/_/g, ' ');
  }

  moduleDescription(moduleKey: string): string {
    return this.moduleCatalog[moduleKey]?.description ?? 'Módulo habilitado para este cliente.';
  }

  canShow(moduleKey: string): boolean {
    if (moduleKey === 'auditoria') {
      return this.canOpenAuditAdministration();
    }
    const user = this.auth.currentUser();
    if (!user?.clientId) {
      return true;
    }
    if (!this.enabledModules) {
      return true;
    }
    return this.enabledModules.has(moduleKey);
  }
}
