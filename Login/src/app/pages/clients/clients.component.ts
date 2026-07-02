import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

interface ClientView {
  id: string;
  name: string;
  nit: string;
  city: string;
  address: string | null;
  habilitationCode: string | null;
  email: string;
  logoPath: string | null;
  schemaName: string;
  clientAdminCount: number;
}

interface ClientAdminView {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isActive: boolean;
  documentType: string | null;
  documentNumber: string | null;
}

interface SoftwareSuiteView {
  key: string;
  name: string;
  description: string | null;
  enabled?: boolean;
  license_status?: 'trial' | 'active' | 'suspended' | 'expired';
}

interface ModuleView {
  key: string;
  name: string;
  description?: string | null;
  suiteKey?: string | null;
}

interface SubscriptionPlanView {
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
  clients_count: number;
}

type ClientTab = 'list' | 'plans';
type ClientDetailTab = 'summary' | 'subscription' | 'customization' | 'admins';
type BillingCycle = 'monthly' | 'annual';
type SubscriptionStatus = 'active' | 'grace' | 'read_only' | 'suspended' | 'cancelled';
type SubscriptionAccessMode = 'full' | 'read_only' | 'blocked';

interface SubscriptionPaymentView {
  id: string;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
  amount: number | null;
  currency: string;
  reference: string | null;
  notes: string | null;
}

interface SubscriptionEventView {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  actor_username: string | null;
  created_at: string;
}

interface ClientSubscriptionView {
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
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  access_mode: SubscriptionAccessMode;
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
  payments?: SubscriptionPaymentView[];
  events?: SubscriptionEventView[];
}

interface SubscriptionDraft {
  planKey: string | null;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  accessMode: SubscriptionAccessMode;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  graceEndsAt: string;
  amount: number | null;
  currency: string;
  notes: string;
}

interface SubscriptionPaymentDraft {
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  amount: number | null;
  currency: string;
  reference: string;
  notes: string;
}

interface ClientAdminEditDraft {
  displayName: string;
  email: string;
  documentType: string;
  documentNumber: string;
}

interface PlanDraft {
  key: string;
  name: string;
  clientType: string;
  description: string;
  includedSuites: string[];
  includedModules: string[];
  monthlyPrice: number | null;
  annualPrice: number | null;
  currency: string;
  graceDays: number;
  expirationAccessMode: 'read_only' | 'blocked';
  displayOrder: number;
  isActive: boolean;
}

const PLATFORM_ONLY_MODULES = ['clientes'];

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  clients: ClientView[] = [];
  softwareSuites: SoftwareSuiteView[] = [];
  subscriptionPlans: SubscriptionPlanView[] = [];
  modules: ModuleView[] = [];
  clientSoftwareSuites: Record<string, SoftwareSuiteView[]> = {};
  clientModules: Record<string, Set<string>> = {};
  clientSubscriptions: Record<string, ClientSubscriptionView> = {};
  clientAdmins: Record<string, ClientAdminView[]> = {};
  searchTerm = '';
  filterCity = 'todos';
  filterModule = 'todos';
  filterPlan = 'todos';
  filterSubscriptionStatus = 'todos';
  filterClientType = 'todos';
  filterCommercialAlert = 'todos';
  activeClientTab: ClientTab = 'list';
  activeClientDetailTab: ClientDetailTab = 'summary';
  openClientId: string | null = null;
  editingClientId: string | null = null;
  editingModulesClientId: string | null = null;
  editingSubscriptionClientId: string | null = null;
  savingModulesClientId: string | null = null;
  savingSubscriptionClientId: string | null = null;
  savingPaymentClientId: string | null = null;
  loadingAdminsClientId: string | null = null;
  resettingAdminUserId: string | null = null;
  editingClientAdminId: string | null = null;
  savingClientAdminUserId: string | null = null;
  deletingClientAdminUserId: string | null = null;
  editingPlanKey: string | null = null;
  creatingPlan = false;
  creatingClient = false;
  savingPlan = false;
  applyingPlanKey: string | null = null;
  moduleDraft = new Set<string>();
  softwareDraft = new Set<string>(['biomedico']);
  subscriptionDraft: SubscriptionDraft = this.createEmptySubscriptionDraft();
  paymentDraft: SubscriptionPaymentDraft = this.createDefaultPaymentDraft();
  planDraft: PlanDraft = this.createEmptyPlanDraft();
  editingSoftwareClientId: string | null = null;
  savingSoftwareClientId: string | null = null;
  editClient: { name: string; nit: string; city: string; address: string; habilitationCode: string; email: string } = {
    name: '',
    nit: '',
    city: '',
    address: '',
    habilitationCode: '',
    email: ''
  };
  loading = false;
  errorMessage = '';
  successMessage = '';

  name = '';
  nit = '';
  city = '';
  address = '';
  habilitationCode = '';
  email = '';
  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;
  adminUsername = '';
  adminDisplayName = '';
  adminEmail = '';
  adminDocumentType = 'cedula_ciudadania';
  adminDocumentNumber = '';
  adminSignatureFile: File | null = null;
  adminSignatureFileName = '';
  readonly signatureMaxSizeMb = 8;
  private readonly signatureMaxSizeBytes = this.signatureMaxSizeMb * 1024 * 1024;
  private readonly signatureAllowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  clientAdminDraft: ClientAdminEditDraft = {
    displayName: '',
    email: '',
    documentType: 'cedula_ciudadania',
    documentNumber: ''
  };
  selectedPlanKey = 'biomedico_ips';
  selectedBillingCycle: BillingCycle = 'monthly';
  adminRepairClientId: string | null = null;
  repairAdminUsername = '';
  repairAdminDisplayName = '';
  repairAdminEmail = '';
  repairAdminDocumentType = 'cedula_ciudadania';
  repairAdminDocumentNumber = '';
  repairAdminSignatureFile: File | null = null;
  repairAdminSignatureFileName = '';
  readonly documentTypes = [
    { value: 'cedula_ciudadania', label: 'Cédula ciudadanía' },
    { value: 'cedula_extranjeria', label: 'Cédula extranjería' },
    { value: 'pasaporte', label: 'Pasaporte' }
  ];
  constructor(
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await this.load();
  }

  get selectedClientForModal(): ClientView | null {
    if (!this.openClientId) {
      return null;
    }
    return this.clients.find((client) => client.id === this.openClientId) ?? null;
  }

  canCreateClients(): boolean {
    return this.auth.hasRole('superuser') && this.auth.hasPermission('clients:manage');
  }

  canUpdateClients(): boolean {
    return this.auth.hasPermission('clients:manage') || this.auth.hasPermission('saas:clients:update');
  }

  canManageSubscriptions(): boolean {
    return this.auth.hasPermission('clients:manage') || this.auth.hasPermission('saas:subscriptions:manage');
  }

  canManagePlans(): boolean {
    return this.auth.hasPermission('clients:manage') || this.auth.hasPermission('saas:plans:manage');
  }

  canResetClientAdminPasswords(): boolean {
    return this.auth.hasPermission('clients:manage')
      || this.auth.hasPermission('users:manage')
      || this.auth.hasPermission('saas:client_admins:reset_password');
  }

  canManageClientAdmins(): boolean {
    return this.auth.hasPermission('clients:manage') || this.auth.hasPermission('users:manage');
  }

  canDeleteClients(): boolean {
    return this.auth.hasRole('superuser') && this.auth.hasPermission('clients:manage');
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const rows = await this.admin.listClients();
      this.clients = rows.map((row) => ({
        id: row.id,
        name: row.name,
        nit: row.nit,
        city: row.city,
        address: row.address ?? null,
        habilitationCode: row.habilitation_code,
        email: row.email,
        logoPath: row.logo_path,
        schemaName: row.schema_name,
        clientAdminCount: row.client_admin_count ?? 0
      }));

      const [modulesResult, softwareSuitesResult, plansResult] = await Promise.allSettled([
        this.admin.listModules(),
        this.admin.listSoftwareSuites(),
        this.admin.listSubscriptionPlans(true)
      ]);

      if (modulesResult.status === 'fulfilled') {
        this.modules = modulesResult.value
          .filter((mod) => !PLATFORM_ONLY_MODULES.includes(mod.key))
          .map((mod) => ({
            key: mod.key,
            name: mod.name,
            description: mod.description,
            suiteKey: mod.suite_key ?? 'biomedico'
          }));
      }

      if (softwareSuitesResult.status === 'fulfilled') {
        this.softwareSuites = softwareSuitesResult.value.map((suite) => ({
          key: suite.key,
          name: suite.name,
          description: suite.description,
          enabled: suite.enabled,
          license_status: suite.license_status
        }));
      }

      if (plansResult.status === 'fulfilled') {
        this.subscriptionPlans = plansResult.value.map((plan) => ({
          key: plan.key,
          name: plan.name,
          client_type: plan.client_type,
          description: plan.description,
          included_suites: plan.included_suites ?? [],
          included_modules: plan.included_modules ?? [],
          monthly_price: plan.monthly_price,
          annual_price: plan.annual_price,
          currency: plan.currency,
          grace_days: plan.grace_days ?? 0,
          expiration_access_mode: plan.expiration_access_mode ?? 'read_only',
          display_order: plan.display_order,
          is_active: plan.is_active,
          clients_count: plan.clients_count ?? 0
        }));
        if (!this.activeSubscriptionPlans.some((plan) => plan.key === this.selectedPlanKey)) {
          this.selectedPlanKey = this.activeSubscriptionPlans[0]?.key ?? 'biomedico_ips';
        }
      }

      const detailsResult = await Promise.allSettled([
        this.loadAllClientSoftwareSuites(),
        this.loadAllClientModules(),
        this.loadAllClientSubscriptions()
      ]);

      const hasPartialFailure = [modulesResult, softwareSuitesResult, plansResult, ...detailsResult]
        .some((result) => result.status === 'rejected');
      if (hasPartialFailure) {
        this.errorMessage = 'Clientes cargados. Algunos detalles comerciales no se pudieron actualizar; reinicia el backend si acabas de aplicar cambios.';
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los clientes.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onCreateClient(): Promise<void> {
    if (!this.name || !this.nit || !this.city || !this.email || !this.address) {
      this.errorMessage = 'Completa los campos obligatorios del cliente.';
      return;
    }
    if (!this.adminUsername || !this.adminDisplayName || !this.adminEmail || !this.adminDocumentType || !this.adminDocumentNumber) {
      this.errorMessage = 'Completa los datos del administrador inicial del cliente.';
      return;
    }
    if (!this.selectedPlanKey) {
      this.errorMessage = 'Selecciona el plan comercial inicial del cliente.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    const securityCode = await this.requestSecurityCode(
      'CLIENT_CREATE',
      `Crear cliente ${this.name.trim()} con administrador ${this.adminEmail.trim()}`
    );
    if (!securityCode) return;
    try {
      const created = await this.admin.createClient({
        name: this.name.trim(),
        nit: this.nit.trim(),
        city: this.city.trim(),
        address: this.address.trim(),
        habilitationCode: this.habilitationCode.trim() || undefined,
        email: this.email.trim(),
        logoFile: this.logoFile,
        adminUsername: this.adminUsername.trim(),
        adminDisplayName: this.adminDisplayName.trim(),
        adminEmail: this.adminEmail.trim(),
        adminDocumentType: this.adminDocumentType,
        adminDocumentNumber: this.adminDocumentNumber.trim(),
        adminSignatureFile: this.adminSignatureFile,
        planKey: this.selectedPlanKey,
        billingCycle: this.selectedBillingCycle,
        securityCode
      });
      this.name = '';
      this.nit = '';
      this.city = '';
      this.address = '';
      this.habilitationCode = '';
      this.email = '';
      this.adminUsername = '';
      this.adminDisplayName = '';
      this.adminEmail = '';
      this.adminDocumentType = 'cedula_ciudadania';
      this.adminDocumentNumber = '';
      this.clearAdminSignature();
      this.clearCreateLogo();
      this.selectedPlanKey = this.activeSubscriptionPlans[0]?.key ?? 'biomedico_ips';
      this.selectedBillingCycle = 'monthly';
      this.softwareDraft = new Set(['biomedico']);
      this.successMessage = created.initial_admin_invitation_sent
        ? 'Cliente creado. El administrador inicial recibirá un correo para crear su contraseña.'
        : 'Cliente creado, pero no se pudo enviar el correo de activación al administrador. Revisa la configuración SMTP.';
      this.creatingClient = false;
      this.activeClientTab = 'list';
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el cliente.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async loadAllClientModules(): Promise<void> {
    const entries = await Promise.all(
      this.clients.map(async (client) => {
        const modules = await this.admin.listClientModules(client.id);
        return [client.id, new Set(modules.filter((m) => m.enabled).map((m) => m.key))] as const;
      })
    );
    this.clientModules = Object.fromEntries(entries);
  }

  async loadAllClientSoftwareSuites(): Promise<void> {
    const entries = await Promise.all(
      this.clients.map(async (client) => {
        const suites = await this.admin.listClientSoftwareSuites(client.id);
        return [client.id, suites] as const;
      })
    );
    this.clientSoftwareSuites = Object.fromEntries(entries);
  }

  async loadAllClientSubscriptions(): Promise<void> {
    const entries = await Promise.all(
      this.clients.map(async (client) => {
        const subscription = await this.admin.getClientSubscription(client.id);
        return [client.id, subscription as ClientSubscriptionView] as const;
      })
    );
    this.clientSubscriptions = Object.fromEntries(entries);
  }

  toggleCreateSoftware(suiteKey: string): void {
    if (this.softwareDraft.has(suiteKey)) {
      this.softwareDraft.delete(suiteKey);
    } else {
      this.softwareDraft.add(suiteKey);
    }
  }

  enabledSoftwareFor(clientId: string): SoftwareSuiteView[] {
    return (this.clientSoftwareSuites[clientId] || []).filter((suite) => suite.enabled);
  }

  startEditSoftware(clientId: string): void {
    this.activeClientDetailTab = 'customization';
    this.editingSoftwareClientId = clientId;
    this.softwareDraft = new Set(this.enabledSoftwareFor(clientId).map((suite) => suite.key));
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEditSoftware(): void {
    this.editingSoftwareClientId = null;
    this.softwareDraft = new Set(['biomedico']);
  }

  toggleClientSoftware(clientId: string, suiteKey: string): void {
    if (this.softwareDraft.has(suiteKey)) {
      this.softwareDraft.delete(suiteKey);
    } else {
      this.softwareDraft.add(suiteKey);
    }
    if (this.editingModulesClientId === clientId) {
      this.pruneModuleDraftForClient(clientId);
    }
  }

  async saveClientSoftware(clientId: string): Promise<void> {
    const client = this.clients.find((item) => item.id === clientId);
    if (this.softwareDraft.size === 0) {
      this.errorMessage = 'Selecciona al menos un software para el cliente.';
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'CLIENT_SOFTWARE_ACCESS_UPDATE',
      `Actualizar softwares de ${client?.name ?? 'cliente'}`
    );
    if (!securityCode) return;
    this.savingSoftwareClientId = clientId;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateClientSoftwareSuites(
        clientId,
        this.softwareSuites.map((suite) => ({
          key: suite.key,
          enabled: this.softwareDraft.has(suite.key),
          licenseStatus: this.softwareDraft.has(suite.key) ? 'active' : 'trial'
        })),
        securityCode
      );
      this.clientSoftwareSuites[clientId] = await this.admin.listClientSoftwareSuites(clientId);
      const modules = await this.admin.listClientModules(clientId);
      this.clientModules[clientId] = new Set(modules.filter((m) => m.enabled).map((m) => m.key));
      this.editingSoftwareClientId = null;
      this.softwareDraft = new Set(['biomedico']);
      this.successMessage = 'Softwares principales actualizados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron actualizar los softwares del cliente.';
    } finally {
      this.savingSoftwareClientId = null;
      this.cdr.detectChanges();
    }
  }

  toggleClientModule(clientId: string, moduleKey: string): void {
    if (this.editingModulesClientId !== clientId) return;
    if (this.moduleDraft.has(moduleKey)) {
      this.moduleDraft.delete(moduleKey);
    } else {
      this.moduleDraft.add(moduleKey);
    }
  }

  async saveClientModules(clientId: string): Promise<void> {
    const selectable = new Set(this.clientModulesAvailableFor(clientId).map((module) => module.key));
    const modules = Array.from(this.moduleDraft).filter((moduleKey) => selectable.has(moduleKey));
    const client = this.clients.find((item) => item.id === clientId);
    if (selectable.size > 0 && modules.length === 0) {
      this.errorMessage = 'Selecciona al menos un módulo para el cliente.';
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'CLIENT_MODULES_UPDATE',
      `Actualizar módulos de ${client?.name ?? 'cliente'}`
    );
    if (!securityCode) return;
    this.savingModulesClientId = clientId;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateClientModules(clientId, modules, securityCode);
      const updated = await this.admin.listClientModules(clientId);
      this.clientModules[clientId] = new Set(updated.filter((module) => module.enabled).map((module) => module.key));
      this.editingModulesClientId = null;
      this.moduleDraft.clear();
      this.successMessage = 'Módulos actualizados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron actualizar los módulos del cliente.';
    } finally {
      this.savingModulesClientId = null;
      this.cdr.detectChanges();
    }
  }

  startEditModules(clientId: string): void {
    this.activeClientDetailTab = 'customization';
    this.editingModulesClientId = clientId;
    this.moduleDraft = new Set(this.clientModules[clientId] ?? []);
    this.pruneModuleDraftForClient(clientId);
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEditModules(): void {
    this.editingModulesClientId = null;
    this.moduleDraft.clear();
  }

  startEditSubscription(clientId: string): void {
    const subscription = this.clientSubscriptions[clientId];
    this.activeClientDetailTab = 'subscription';
    this.editingSubscriptionClientId = clientId;
    this.subscriptionDraft = {
      planKey: subscription?.plan_key ?? this.subscriptionPlans[0]?.key ?? null,
      billingCycle: subscription?.billing_cycle ?? 'monthly',
      status: subscription?.status ?? 'active',
      accessMode: subscription?.access_mode ?? 'full',
      currentPeriodStartsAt: subscription?.current_period_starts_at ?? '',
      currentPeriodEndsAt: subscription?.current_period_ends_at ?? '',
      graceEndsAt: subscription?.grace_ends_at ?? '',
      amount: subscription?.amount ?? null,
      currency: subscription?.currency ?? 'COP',
      notes: subscription?.notes ?? ''
    };
    this.paymentDraft = this.createDefaultPaymentDraft(subscription);
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditSubscription(): void {
    this.editingSubscriptionClientId = null;
    this.subscriptionDraft = this.createEmptySubscriptionDraft();
    this.paymentDraft = this.createDefaultPaymentDraft();
  }

  async saveSubscription(clientId: string): Promise<void> {
    const client = this.clients.find((item) => item.id === clientId);
    const securityCode = await this.requestSecurityCode(
      'CLIENT_SUBSCRIPTION_UPDATE',
      `Actualizar suscripción de ${client?.name ?? 'cliente'}`
    );
    if (!securityCode) return;
    this.savingSubscriptionClientId = clientId;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const updated = await this.admin.updateClientSubscription(clientId, {
        planKey: this.subscriptionDraft.planKey,
        billingCycle: this.subscriptionDraft.billingCycle,
        status: this.subscriptionDraft.status,
        accessMode: this.subscriptionDraft.accessMode,
        currentPeriodStartsAt: this.subscriptionDraft.currentPeriodStartsAt || null,
        currentPeriodEndsAt: this.subscriptionDraft.currentPeriodEndsAt || null,
        graceEndsAt: this.subscriptionDraft.graceEndsAt || null,
        amount: this.subscriptionDraft.amount,
        currency: this.subscriptionDraft.currency || 'COP',
        notes: this.subscriptionDraft.notes || null,
        securityCode
      });
      this.clientSubscriptions[clientId] = updated as ClientSubscriptionView;
      this.clientSoftwareSuites[clientId] = await this.admin.listClientSoftwareSuites(clientId);
      this.clientModules[clientId] = new Set(
        (await this.admin.listClientModules(clientId)).filter((m) => m.enabled).map((m) => m.key)
      );
      this.editingSubscriptionClientId = null;
      this.successMessage = 'Suscripción actualizada.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar la suscripción.';
    } finally {
      this.savingSubscriptionClientId = null;
      this.cdr.detectChanges();
    }
  }

  async registerPayment(clientId: string): Promise<void> {
    const client = this.clients.find((item) => item.id === clientId);
    const securityCode = await this.requestSecurityCode(
      'CLIENT_SUBSCRIPTION_PAYMENT',
      `Registrar pago o renovación de ${client?.name ?? 'cliente'}`
    );
    if (!securityCode) return;
    this.savingPaymentClientId = clientId;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.registerSubscriptionPayment(clientId, {
        planKey: this.subscriptionDraft.planKey,
        paidAt: this.paymentDraft.paidAt || null,
        periodStart: this.paymentDraft.periodStart || null,
        periodEnd: this.paymentDraft.periodEnd || null,
        amount: this.paymentDraft.amount,
        currency: this.paymentDraft.currency || 'COP',
        reference: this.paymentDraft.reference || null,
        notes: this.paymentDraft.notes || null,
        billingCycle: this.subscriptionDraft.billingCycle,
        securityCode
      });
      this.clientSubscriptions[clientId] = await this.admin.getClientSubscription(clientId) as ClientSubscriptionView;
      this.paymentDraft = this.createDefaultPaymentDraft(this.clientSubscriptions[clientId]);
      this.successMessage = 'Pago registrado y suscripción activada.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo registrar el pago.';
    } finally {
      this.savingPaymentClientId = null;
      this.cdr.detectChanges();
    }
  }

  startEditClient(client: ClientView): void {
    this.activeClientDetailTab = 'summary';
    this.editingClientId = client.id;
    this.editClient = {
      name: client.name,
      nit: client.nit,
      city: client.city,
      address: client.address ?? '',
      habilitationCode: client.habilitationCode ?? '',
      email: client.email
    };
  }

  cancelEditClient(): void {
    this.editingClientId = null;
  }

  startCreateMissingAdmin(client: ClientView): void {
    this.activeClientDetailTab = 'admins';
    this.adminRepairClientId = client.id;
    this.repairAdminUsername = '';
    this.repairAdminDisplayName = '';
    this.repairAdminEmail = '';
    this.repairAdminDocumentType = 'cedula_ciudadania';
    this.repairAdminDocumentNumber = '';
    this.clearRepairAdminSignature();
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCreateMissingAdmin(): void {
    this.adminRepairClientId = null;
    this.repairAdminUsername = '';
    this.repairAdminDisplayName = '';
    this.repairAdminEmail = '';
    this.repairAdminDocumentType = 'cedula_ciudadania';
    this.repairAdminDocumentNumber = '';
    this.clearRepairAdminSignature();
  }

  async loadClientAdmins(clientId: string): Promise<void> {
    if (!this.canResetClientAdminPasswords()) return;
    this.loadingAdminsClientId = clientId;
    try {
      const admins = await this.admin.listClientAdmins(clientId);
      this.clientAdmins[clientId] = admins.map((admin) => ({
        id: admin.id,
        username: admin.username,
        displayName: admin.display_name,
        email: admin.email,
        isActive: admin.is_active,
        documentType: admin.document_type ?? null,
        documentNumber: admin.document_number ?? null
      }));
    } catch (error) {
      console.error(error);
      this.clientAdmins[clientId] = [];
      this.errorMessage = 'No se pudieron cargar los administradores del cliente.';
    } finally {
      this.loadingAdminsClientId = null;
      this.cdr.detectChanges();
    }
  }

  async sendClientAdminPasswordSetup(client: ClientView, admin: ClientAdminView): Promise<void> {
    const securityCode = await this.requestSecurityCode(
      'CLIENT_ADMIN_PASSWORD_RESET',
      `Enviar acceso a ${admin.email} para ${client.name}`
    );
    if (!securityCode) return;
    this.resettingAdminUserId = admin.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.sendClientAdminPasswordSetup(client.id, admin.id, securityCode);
      this.successMessage = `Correo de activación enviado a ${admin.email}.`;
      await this.loadClientAdmins(client.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo enviar el correo de activación.';
    } finally {
      this.resettingAdminUserId = null;
      this.cdr.detectChanges();
    }
  }

  startEditClientAdmin(admin: ClientAdminView): void {
    this.activeClientDetailTab = 'admins';
    this.editingClientAdminId = admin.id;
    this.clientAdminDraft = {
      displayName: admin.displayName,
      email: admin.email,
      documentType: admin.documentType || 'cedula_ciudadania',
      documentNumber: admin.documentNumber || ''
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditClientAdmin(): void {
    this.editingClientAdminId = null;
    this.clientAdminDraft = {
      displayName: '',
      email: '',
      documentType: 'cedula_ciudadania',
      documentNumber: ''
    };
  }

  async saveClientAdmin(client: ClientView, admin: ClientAdminView): Promise<void> {
    if (!this.clientAdminDraft.displayName.trim() || !this.clientAdminDraft.email.trim()) {
      this.errorMessage = 'Completa nombre y correo del administrador.';
      return;
    }
    if (!this.clientAdminDraft.documentType || !this.clientAdminDraft.documentNumber.trim()) {
      this.errorMessage = 'Completa tipo y número de documento del administrador.';
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'USER_UPDATE',
      `Editar administrador ${admin.username} de ${client.name}`
    );
    if (!securityCode) return;
    this.savingClientAdminUserId = admin.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateUserProfile(admin.id, {
        displayName: this.clientAdminDraft.displayName.trim(),
        email: this.clientAdminDraft.email.trim(),
        clientId: client.id,
        documentType: this.clientAdminDraft.documentType,
        documentNumber: this.clientAdminDraft.documentNumber.trim(),
        invimaRegistration: null,
        securityCode
      });
      this.successMessage = 'Administrador del cliente actualizado.';
      this.cancelEditClientAdmin();
      await this.loadClientAdmins(client.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el administrador del cliente.';
    } finally {
      this.savingClientAdminUserId = null;
      this.cdr.detectChanges();
    }
  }

  async toggleClientAdminActive(client: ClientView, admin: ClientAdminView): Promise<void> {
    const nextState = !admin.isActive;
    const securityCode = await this.requestSecurityCode(
      'USER_ACTIVE_UPDATE',
      `${nextState ? 'Activar' : 'Bloquear'} administrador ${admin.username} de ${client.name}`
    );
    if (!securityCode) return;
    this.savingClientAdminUserId = admin.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateUserActive(admin.id, nextState, securityCode);
      this.successMessage = nextState ? 'Administrador activado.' : 'Administrador bloqueado.';
      await this.load();
      this.openClientId = client.id;
      await this.loadClientAdmins(client.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el estado del administrador.';
    } finally {
      this.savingClientAdminUserId = null;
      this.cdr.detectChanges();
    }
  }

  async removeClientAdmin(client: ClientView, admin: ClientAdminView): Promise<void> {
    if (!confirm(`¿Eliminar el administrador ${admin.username} de ${client.name}? Esta acción retirará su acceso.`)) {
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'USER_DELETE',
      `Eliminar administrador ${admin.username} de ${client.name}`
    );
    if (!securityCode) return;
    this.deletingClientAdminUserId = admin.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.deleteUser(admin.id, securityCode);
      this.successMessage = 'Administrador del cliente eliminado.';
      this.cancelEditClientAdmin();
      await this.load();
      this.openClientId = client.id;
      await this.loadClientAdmins(client.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el administrador del cliente.';
    } finally {
      this.deletingClientAdminUserId = null;
      this.cdr.detectChanges();
    }
  }

  async createMissingAdmin(client: ClientView): Promise<void> {
    if (!this.repairAdminUsername || !this.repairAdminDisplayName || !this.repairAdminEmail || !this.repairAdminDocumentType || !this.repairAdminDocumentNumber) {
      this.errorMessage = 'Completa los datos del administrador del cliente.';
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'CLIENT_ADMIN_CREATE',
      `Crear administrador ${this.repairAdminEmail.trim()} para ${client.name}`
    );
    if (!securityCode) return;
    try {
      await this.admin.createClientAdminUser(client.id, {
        username: this.repairAdminUsername.trim(),
        displayName: this.repairAdminDisplayName.trim(),
        email: this.repairAdminEmail.trim(),
        securityCode,
        documentType: this.repairAdminDocumentType,
        documentNumber: this.repairAdminDocumentNumber.trim(),
        signatureFile: this.repairAdminSignatureFile
      });
      this.successMessage = 'Administrador del cliente creado. Recibirá un correo para definir su contraseña.';
      this.cancelCreateMissingAdmin();
      await this.load();
      this.openClientId = client.id;
      await this.loadClientAdmins(client.id);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el administrador del cliente.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async saveClient(clientId: string): Promise<void> {
    const securityCode = await this.requestSecurityCode(
      'CLIENT_UPDATE',
      `Editar datos de cliente ${this.editClient.name.trim()}`
    );
    if (!securityCode) return;
    await this.admin.updateClient(clientId, {
      name: this.editClient.name.trim(),
      nit: this.editClient.nit.trim(),
      city: this.editClient.city.trim(),
      address: this.editClient.address.trim(),
      habilitationCode: this.editClient.habilitationCode.trim() || undefined,
      email: this.editClient.email.trim(),
      securityCode
    });
    this.editingClientId = null;
    await this.load();
  }

  async removeClient(clientId: string): Promise<void> {
    if (!confirm('¿Eliminar cliente?')) return;
    const client = this.clients.find((item) => item.id === clientId);
    const securityCode = await this.requestSecurityCode(
      'CLIENT_DELETE',
      `Eliminar cliente ${client?.name ?? clientId}`
    );
    if (!securityCode) return;
    await this.admin.deleteClient(clientId, securityCode);
    await this.load();
  }

  get filteredClients(): ClientView[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.clients.filter((client) => {
      const hay = `${client.name} ${client.nit} ${client.city} ${client.address ?? ''} ${client.email}`.toLowerCase();
      const subscription = this.subscriptionFor(client.id);
      const matchesTerm = !term || hay.includes(term);
      const matchesCity = this.filterCity === 'todos' || client.city === this.filterCity;
      const matchesModule = this.filterModule === 'todos' || this.clientModules[client.id]?.has(this.filterModule);
      const matchesPlan = this.filterPlan === 'todos' || subscription?.plan_key === this.filterPlan;
      const matchesStatus = this.filterSubscriptionStatus === 'todos'
        || subscription?.effective_status === this.filterSubscriptionStatus;
      const matchesClientType = this.filterClientType === 'todos'
        || subscription?.plan_client_type === this.filterClientType;
      const matchesAlert = this.filterCommercialAlert === 'todos'
        || this.clientCommercialAlert(client).kind === this.filterCommercialAlert;
      return matchesTerm && matchesCity && matchesModule && matchesPlan && matchesStatus && matchesClientType && matchesAlert;
    });
  }

  get cityOptions(): string[] {
    return Array.from(new Set(this.clients.map((client) => client.city).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  get clientTypeOptions(): string[] {
    return Array.from(new Set(this.subscriptionPlans.map((plan) => plan.client_type).filter(Boolean))).sort((a, b) =>
      this.clientTypeLabel(a).localeCompare(this.clientTypeLabel(b))
    );
  }

  get activeSubscriptionPlans(): SubscriptionPlanView[] {
    return this.subscriptionPlans.filter((plan) => plan.is_active);
  }

  get selectedPlan(): SubscriptionPlanView | null {
    return this.planByKey(this.selectedPlanKey);
  }

  get activeClientCount(): number {
    return this.clients.filter((client) => {
      const subscription = this.subscriptionFor(client.id);
      return subscription && !subscription.is_blocked && !subscription.is_read_only;
    }).length;
  }

  get dueSoonClientCount(): number {
    return this.clients.filter((client) => this.clientCommercialAlert(client).kind === 'due_soon').length;
  }

  get readOnlyClientCount(): number {
    return this.clients.filter((client) => this.subscriptionFor(client.id)?.is_read_only).length;
  }

  get blockedClientCount(): number {
    return this.clients.filter((client) => this.subscriptionFor(client.id)?.is_blocked).length;
  }

  get missingAdminCount(): number {
    return this.clients.filter((client) => client.clientAdminCount === 0).length;
  }

  get monthlyRevenue(): number {
    return this.clients.reduce((total, client) => {
      const subscription = this.subscriptionFor(client.id);
      if (!subscription || subscription.billing_cycle !== 'monthly' || subscription.is_blocked) return total;
      return total + (subscription.amount ?? 0);
    }, 0);
  }

  get annualRevenue(): number {
    return this.clients.reduce((total, client) => {
      const subscription = this.subscriptionFor(client.id);
      if (!subscription || subscription.billing_cycle !== 'annual' || subscription.is_blocked) return total;
      return total + (subscription.amount ?? 0);
    }, 0);
  }

  enabledModulesFor(clientId: string): { key: string; name: string }[] {
    const enabled = this.clientModules[clientId] ?? new Set<string>();
    return this.clientModulesAvailableFor(clientId).filter((module) => enabled.has(module.key));
  }

  clientModulesAvailableFor(clientId: string): ModuleView[] {
    const enabledSuiteKeys = this.activeSoftwareKeysFor(clientId);
    return this.modules.filter((module) => !module.suiteKey || enabledSuiteKeys.has(module.suiteKey));
  }

  private activeSoftwareKeysFor(clientId: string): Set<string> {
    if (this.editingSoftwareClientId === clientId) {
      return new Set(this.softwareDraft);
    }
    return new Set(this.enabledSoftwareFor(clientId).map((suite) => suite.key));
  }

  private pruneModuleDraftForClient(clientId: string): void {
    const selectable = new Set(this.clientModulesAvailableFor(clientId).map((module) => module.key));
    this.moduleDraft = new Set(Array.from(this.moduleDraft).filter((moduleKey) => selectable.has(moduleKey)));
  }

  clearListFilters(): void {
    this.searchTerm = '';
    this.filterCity = 'todos';
    this.filterModule = 'todos';
    this.filterPlan = 'todos';
    this.filterSubscriptionStatus = 'todos';
    this.filterClientType = 'todos';
    this.filterCommercialAlert = 'todos';
  }

  subscriptionFor(clientId: string): ClientSubscriptionView | null {
    return this.clientSubscriptions[clientId] ?? null;
  }

  subscriptionStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      active: 'Activo',
      grace: 'En gracia',
      read_only: 'Solo lectura',
      suspended: 'Suspendido',
      cancelled: 'Cancelado'
    };
    return labels[status || 'active'] ?? 'Activo';
  }

  documentTypeLabel(value?: string | null): string {
    return this.documentTypes.find((item) => item.value === value)?.label ?? 'Sin tipo';
  }

  billingCycleLabel(cycle?: string): string {
    return cycle === 'annual' ? 'Anual' : 'Mensual';
  }

  accessModeLabel(mode?: string): string {
    const labels: Record<string, string> = {
      full: 'Acceso completo',
      read_only: 'Solo lectura',
      blocked: 'Bloqueado'
    };
    return labels[mode || 'full'] ?? 'Acceso completo';
  }

  subscriptionTone(subscription: ClientSubscriptionView | null): string {
    if (!subscription) return 'neutral';
    if (subscription.is_blocked) return 'blocked';
    if (subscription.is_read_only) return 'readonly';
    if (subscription.effective_status === 'grace') return 'grace';
    return 'active';
  }

  formatDate(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  formatMoney(value?: number | null, currency = 'COP'): string {
    if (value == null) return 'Sin valor';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'COP' ? 0 : 2
    }).format(value);
  }

  planByKey(planKey?: string | null): SubscriptionPlanView | null {
    return this.subscriptionPlans.find((plan) => plan.key === planKey) ?? null;
  }

  planPrice(plan: SubscriptionPlanView | null, cycle: BillingCycle): number | null {
    if (!plan) return null;
    return cycle === 'annual' ? plan.annual_price : plan.monthly_price;
  }

  planModules(plan: SubscriptionPlanView | null): ModuleView[] {
    if (!plan) return [];
    const included = new Set(plan.included_modules);
    return this.modules.filter((module) => included.has(module.key));
  }

  planSuites(plan: SubscriptionPlanView | null): SoftwareSuiteView[] {
    if (!plan) return [];
    const included = new Set(plan.included_suites);
    return this.softwareSuites.filter((suite) => included.has(suite.key));
  }

  filteredPlanModules(): ModuleView[] {
    const includedSuites = new Set(this.planDraft.includedSuites);
    return this.modules.filter((module) => !module.suiteKey || includedSuites.has(module.suiteKey));
  }

  clientTypeLabel(type?: string | null): string {
    const labels: Record<string, string> = {
      ips_hospital: 'IPS / Hospital',
      odontologico: 'Odontológico',
      laboratorio: 'Laboratorio',
      mixto: 'Mixto',
      consulta: 'Consulta / Auditoría'
    };
    return labels[type || ''] ?? 'Sin tipo';
  }

  clientCommercialAlert(client: ClientView): { kind: string; label: string; tone: string } {
    const subscription = this.subscriptionFor(client.id);
    if (client.clientAdminCount === 0) {
      return { kind: 'missing_admin', label: 'Sin administrador', tone: 'blocked' };
    }
    if (!subscription?.plan_key) {
      return { kind: 'missing_plan', label: 'Sin plan', tone: 'blocked' };
    }
    if (subscription.is_blocked) {
      return { kind: 'blocked', label: 'Bloqueado', tone: 'blocked' };
    }
    if (subscription.is_read_only) {
      return { kind: 'read_only', label: 'Solo lectura', tone: 'readonly' };
    }
    if (subscription.days_remaining != null && subscription.days_remaining < 0) {
      return { kind: 'expired', label: 'Vencido', tone: 'blocked' };
    }
    if (subscription.days_remaining != null && subscription.days_remaining <= 15) {
      return { kind: 'due_soon', label: `Vence en ${subscription.days_remaining} días`, tone: 'grace' };
    }
    return { kind: 'ok', label: 'Al día', tone: 'active' };
  }

  clientChecklist(client: ClientView): Array<{ label: string; ok: boolean }> {
    const subscription = this.subscriptionFor(client.id);
    return [
      { label: 'Administrador del cliente', ok: client.clientAdminCount > 0 },
      { label: 'Plan comercial asignado', ok: Boolean(subscription?.plan_key) },
      { label: 'Periodo comercial configurado', ok: Boolean(subscription?.current_period_ends_at) },
      { label: 'Acceso activo', ok: Boolean(subscription && !subscription.is_blocked && !subscription.is_read_only) },
      { label: 'Softwares habilitados', ok: this.enabledSoftwareFor(client.id).length > 0 },
      { label: 'Módulos habilitados', ok: this.enabledModulesFor(client.id).length > 0 },
      { label: 'Logo institucional', ok: Boolean(client.logoPath) }
    ];
  }

  onCreatePlanChange(): void {
    const plan = this.selectedPlan;
    this.softwareDraft = new Set(plan?.included_suites ?? ['biomedico']);
  }

  startCreatePlan(): void {
    this.creatingPlan = true;
    this.editingPlanKey = null;
    this.planDraft = this.createEmptyPlanDraft();
    this.errorMessage = '';
    this.successMessage = '';
  }

  startEditPlan(plan: SubscriptionPlanView): void {
    this.creatingPlan = false;
    this.editingPlanKey = plan.key;
    this.planDraft = {
      key: plan.key,
      name: plan.name,
      clientType: plan.client_type,
      description: plan.description ?? '',
      includedSuites: [...plan.included_suites],
      includedModules: [...plan.included_modules],
      monthlyPrice: plan.monthly_price,
      annualPrice: plan.annual_price,
      currency: plan.currency,
      graceDays: plan.grace_days,
      expirationAccessMode: plan.expiration_access_mode,
      displayOrder: plan.display_order,
      isActive: plan.is_active
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelPlanEdit(): void {
    this.creatingPlan = false;
    this.editingPlanKey = null;
    this.planDraft = this.createEmptyPlanDraft();
  }

  togglePlanSuite(suiteKey: string): void {
    this.planDraft.includedSuites = this.toggleArrayValue(this.planDraft.includedSuites, suiteKey);
    const selectableModuleKeys = new Set(this.filteredPlanModules().map((module) => module.key));
    this.planDraft.includedModules = this.planDraft.includedModules.filter((moduleKey) =>
      selectableModuleKeys.has(moduleKey)
    );
  }

  togglePlanModule(moduleKey: string): void {
    this.planDraft.includedModules = this.toggleArrayValue(this.planDraft.includedModules, moduleKey);
  }

  async savePlan(): Promise<void> {
    if (!this.planDraft.name.trim()) {
      this.errorMessage = 'El plan debe tener nombre.';
      return;
    }
    if (!this.planDraft.includedSuites.length) {
      this.errorMessage = 'Selecciona al menos un software principal para el plan.';
      return;
    }
    const selectableModuleKeys = new Set(this.filteredPlanModules().map((module) => module.key));
    this.planDraft.includedModules = this.planDraft.includedModules.filter((moduleKey) =>
      selectableModuleKeys.has(moduleKey)
    );
    if (!this.planDraft.includedModules.length) {
      this.errorMessage = 'Selecciona al menos un módulo para el plan.';
      return;
    }
    if (!/^[A-Z]{3}$/.test((this.planDraft.currency || '').trim().toUpperCase())) {
      this.errorMessage = 'La moneda debe tener 3 letras. Ejemplo: COP.';
      return;
    }
    if (this.planDraft.monthlyPrice != null && this.planDraft.monthlyPrice < 0) {
      this.errorMessage = 'El precio mensual no puede ser negativo.';
      return;
    }
    if (this.planDraft.annualPrice != null && this.planDraft.annualPrice < 0) {
      this.errorMessage = 'El precio anual no puede ser negativo.';
      return;
    }
    if (this.planDraft.graceDays < 0 || this.planDraft.graceDays > 365) {
      this.errorMessage = 'Los días de gracia deben estar entre 0 y 365.';
      return;
    }
    if (this.planDraft.displayOrder < 1) {
      this.errorMessage = 'La posición en listado debe ser mayor o igual a 1.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    const securityAction = this.editingPlanKey ? 'SUBSCRIPTION_PLAN_UPDATE' : 'SUBSCRIPTION_PLAN_CREATE';
    const securityCode = await this.requestSecurityCode(
      securityAction,
      `${this.editingPlanKey ? 'Editar' : 'Crear'} plan ${this.planDraft.name.trim()}`
    );
    if (!securityCode) return;
    this.savingPlan = true;
    const payload = {
      key: this.planDraft.key.trim(),
      name: this.planDraft.name.trim(),
      clientType: this.planDraft.clientType,
      description: this.planDraft.description.trim() || null,
      includedSuites: this.planDraft.includedSuites,
      includedModules: this.planDraft.includedModules,
      monthlyPrice: this.planDraft.monthlyPrice,
      annualPrice: this.planDraft.annualPrice,
      currency: this.planDraft.currency.trim().toUpperCase() || 'COP',
      graceDays: this.planDraft.graceDays ?? 0,
      expirationAccessMode: this.planDraft.expirationAccessMode,
      displayOrder: this.planDraft.displayOrder ?? 100,
      isActive: this.planDraft.isActive,
      securityCode
    };

    try {
      if (this.editingPlanKey) {
        await this.admin.updateSubscriptionPlan(this.editingPlanKey, payload);
        this.successMessage = 'Plan SaaS actualizado. Los clientes existentes conservan su personalización hasta aplicar el plan.';
      } else {
        await this.admin.createSubscriptionPlan(payload);
        this.successMessage = 'Plan SaaS creado.';
      }
      this.cancelPlanEdit();
      await this.reloadPlans();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo guardar el plan.';
    } finally {
      this.savingPlan = false;
      this.cdr.detectChanges();
    }
  }

  async applyPlanToSubscribedClients(plan: SubscriptionPlanView): Promise<void> {
    const count = plan.clients_count ?? 0;
    if (!count) {
      this.successMessage = 'Este plan no tiene clientes adheridos.';
      return;
    }
    if (!confirm(`¿Aplicar módulos y softwares del plan "${plan.name}" a ${count} cliente(s) adherido(s)?`)) {
      return;
    }
    const securityCode = await this.requestSecurityCode(
      'SUBSCRIPTION_PLAN_APPLY_TO_CLIENTS',
      `Aplicar plan ${plan.name} a ${count} cliente(s)`
    );
    if (!securityCode) return;
    this.applyingPlanKey = plan.key;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const result = await this.admin.applySubscriptionPlanToClients(plan.key, securityCode);
      this.successMessage = `Plan aplicado a ${result.affected_clients} cliente(s).`;
      await Promise.all([
        this.reloadPlans(),
        this.loadAllClientSoftwareSuites(),
        this.loadAllClientModules()
      ]);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aplicar el plan a los clientes.';
    } finally {
      this.applyingPlanKey = null;
      this.cdr.detectChanges();
    }
  }

  async reloadPlans(): Promise<void> {
    const plans = await this.admin.listSubscriptionPlans(true);
    this.subscriptionPlans = plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      client_type: plan.client_type,
      description: plan.description,
      included_suites: plan.included_suites ?? [],
      included_modules: plan.included_modules ?? [],
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      currency: plan.currency,
      grace_days: plan.grace_days ?? 0,
      expiration_access_mode: plan.expiration_access_mode ?? 'read_only',
      display_order: plan.display_order,
      is_active: plan.is_active,
      clients_count: plan.clients_count ?? 0
    }));
    if (!this.activeSubscriptionPlans.some((plan) => plan.key === this.selectedPlanKey)) {
      this.selectedPlanKey = this.activeSubscriptionPlans[0]?.key ?? 'biomedico_ips';
    }
  }

  onSubscriptionPlanChange(): void {
    const plan = this.planByKey(this.subscriptionDraft.planKey);
    const price = this.planPrice(plan, this.subscriptionDraft.billingCycle);
    if (price != null) {
      this.subscriptionDraft.amount = price;
      this.subscriptionDraft.currency = plan?.currency ?? 'COP';
    }
  }

  onSubscriptionCycleChange(): void {
    const price = this.planPrice(this.planByKey(this.subscriptionDraft.planKey), this.subscriptionDraft.billingCycle);
    if (price != null) {
      this.subscriptionDraft.amount = price;
    }
  }

  async quickRenewClient(client: ClientView): Promise<void> {
    const subscription = this.subscriptionFor(client.id);
    if (!subscription) return;
    if (client.clientAdminCount === 0) {
      this.errorMessage = 'Primero crea el administrador del cliente antes de renovar.';
      return;
    }
    if (!confirm(`¿Registrar renovación rápida para ${client.name}?`)) return;
    const securityCode = await this.requestSecurityCode(
      'CLIENT_SUBSCRIPTION_PAYMENT',
      `Registrar renovación rápida para ${client.name}`
    );
    if (!securityCode) return;

    const today = this.todayISO();
    const start = subscription.current_period_ends_at && subscription.current_period_ends_at >= today
      ? this.addDays(subscription.current_period_ends_at, 1)
      : today;
    const end = this.addPeriod(start, subscription.billing_cycle);
    const amount = subscription.amount ?? this.planPrice(this.planByKey(subscription.plan_key), subscription.billing_cycle);

    this.savingPaymentClientId = client.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.registerSubscriptionPayment(client.id, {
        planKey: subscription.plan_key,
        paidAt: today,
        periodStart: start,
        periodEnd: end,
        amount,
        currency: subscription.currency || 'COP',
        reference: 'Renovación rápida',
        notes: 'Renovación rápida desde panel SaaS.',
        billingCycle: subscription.billing_cycle,
        securityCode
      });
      this.clientSubscriptions[client.id] = await this.admin.getClientSubscription(client.id) as ClientSubscriptionView;
      this.successMessage = `Renovación registrada para ${client.name}.`;
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo registrar la renovación rápida.';
    } finally {
      this.savingPaymentClientId = null;
      this.cdr.detectChanges();
    }
  }

  exportClientsCsv(): void {
    const headers = [
      'Cliente', 'NIT', 'Ciudad', 'Correo', 'Tipo cliente', 'Plan', 'Estado',
      'Vencimiento', 'Dias restantes', 'Ciclo', 'Valor', 'Administrador', 'Alerta'
    ];
    const rows = this.filteredClients.map((client) => {
      const subscription = this.subscriptionFor(client.id);
      const alert = this.clientCommercialAlert(client);
      return [
        client.name,
        client.nit,
        client.city,
        client.email,
        this.clientTypeLabel(subscription?.plan_client_type),
        subscription?.plan_name ?? 'Sin plan',
        this.subscriptionStatusLabel(subscription?.effective_status),
        this.formatDate(subscription?.current_period_ends_at),
        subscription?.days_remaining ?? '',
        this.billingCycleLabel(subscription?.billing_cycle),
        subscription?.amount ?? '',
        client.clientAdminCount > 0 ? 'Sí' : 'No',
        alert.label
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes-saas-${this.todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  setClientTab(tab: ClientTab): void {
    if (tab === 'plans' && !this.canManagePlans()) {
      tab = 'list';
    }
    if (tab !== 'list') {
      this.closeClientInfo();
    }
    this.activeClientTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab !== 'plans') {
      this.cancelPlanEdit();
    }
  }

  setClientDetailTab(tab: ClientDetailTab): void {
    this.activeClientDetailTab = tab;
    if (tab !== 'summary') {
      this.editingClientId = null;
    }
    if (tab !== 'subscription') {
      this.cancelEditSubscription();
    }
    if (tab !== 'customization') {
      this.cancelEditModules();
      this.cancelEditSoftware();
    }
    if (tab !== 'admins') {
      this.cancelCreateMissingAdmin();
      this.cancelEditClientAdmin();
    }
    this.errorMessage = '';
    this.successMessage = '';
  }

  startCreateClient(): void {
    if (!this.canCreateClients()) return;
    this.resetCreateClientForm();
    this.creatingClient = true;
    this.activeClientTab = 'list';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCreateClient(): void {
    this.creatingClient = false;
    this.resetCreateClientForm();
    this.errorMessage = '';
  }

  onSelectCreateLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.logoFile = file;
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
    }
    this.logoPreviewUrl = file ? URL.createObjectURL(file) : null;
  }

  clearCreateLogo(input?: HTMLInputElement): void {
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
    }
    this.logoPreviewUrl = null;
    this.logoFile = null;
    if (input) {
      input.value = '';
    }
  }

  onSelectAdminSignature(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.isValidSignatureFile(file)) {
      this.clearAdminSignature(input);
      this.errorMessage = 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.';
      return;
    }
    if (file && !this.isValidSignatureSize(file)) {
      this.clearAdminSignature(input);
      this.errorMessage = this.signatureSizeErrorMessage('La firma del administrador');
      return;
    }
    this.errorMessage = '';
    this.adminSignatureFile = file;
    this.adminSignatureFileName = file?.name ?? '';
  }

  clearAdminSignature(input?: HTMLInputElement): void {
    this.adminSignatureFile = null;
    this.adminSignatureFileName = '';
    if (input) {
      input.value = '';
    }
  }

  onSelectRepairAdminSignature(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.isValidSignatureFile(file)) {
      this.clearRepairAdminSignature(input);
      this.errorMessage = 'La firma debe ser una imagen PNG/JPG/WEBP o un PDF.';
      return;
    }
    if (file && !this.isValidSignatureSize(file)) {
      this.clearRepairAdminSignature(input);
      this.errorMessage = this.signatureSizeErrorMessage('La firma del administrador');
      return;
    }
    this.errorMessage = '';
    this.repairAdminSignatureFile = file;
    this.repairAdminSignatureFileName = file?.name ?? '';
  }

  clearRepairAdminSignature(input?: HTMLInputElement): void {
    this.repairAdminSignatureFile = null;
    this.repairAdminSignatureFileName = '';
    if (input) {
      input.value = '';
    }
  }

  private isValidSignatureFile(file: File): boolean {
    const extension = file.name.toLowerCase().split('.').pop();
    return this.signatureAllowedTypes.includes(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(extension || '');
  }

  private isValidSignatureSize(file: File): boolean {
    return file.size <= this.signatureMaxSizeBytes;
  }

  private signatureSizeErrorMessage(label = 'La firma'): string {
    return `${label} no puede superar ${this.signatureMaxSizeMb} MB. Usa una imagen o PDF más liviano.`;
  }

  openClientInfo(clientId: string): void {
    const isDifferentClient = this.openClientId !== clientId;
    if (isDifferentClient) {
      this.resetClientDetailState();
      this.activeClientDetailTab = 'summary';
    }
    this.openClientId = clientId;
    if (this.canResetClientAdminPasswords()) {
      void this.loadClientAdmins(clientId);
    }
  }

  closeClientInfo(): void {
    if (!this.openClientId) {
      return;
    }
    this.openClientId = null;
    this.resetClientDetailState();
    this.activeClientDetailTab = 'summary';
  }

  toggleClientOpen(clientId: string): void {
    if (this.openClientId === clientId) {
      this.closeClientInfo();
      return;
    }
    this.openClientInfo(clientId);
  }

  private resetClientDetailState(): void {
    this.cancelEditModules();
    this.cancelEditSoftware();
    this.cancelEditSubscription();
    this.cancelCreateMissingAdmin();
    this.cancelEditClientAdmin();
    this.editingClientId = null;
  }

  async onUploadLogo(client: ClientView, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const securityCode = await this.requestSecurityCode(
      'CLIENT_LOGO_UPDATE',
      `Actualizar logo de ${client.name}`
    );
    if (!securityCode) {
      input.value = '';
      return;
    }

    try {
      const updated = await this.admin.uploadClientLogo(client.id, file, securityCode);
      client.logoPath = updated.logo_path ?? client.logoPath;
      this.successMessage = 'Logo actualizado.';
      this.errorMessage = '';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el logo.';
    } finally {
      input.value = '';
      this.cdr.detectChanges();
    }
  }

  logoUrl(client: ClientView): string | null {
    if (!client.logoPath) {
      return null;
    }
    if (client.logoPath.startsWith('http')) {
      return client.logoPath;
    }
    return joinBase(this.publicBase, client.logoPath);
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

  private resetCreateClientForm(): void {
    this.name = '';
    this.nit = '';
    this.city = '';
    this.address = '';
    this.habilitationCode = '';
    this.email = '';
    this.adminUsername = '';
    this.adminDisplayName = '';
    this.adminEmail = '';
    this.adminDocumentType = 'cedula_ciudadania';
    this.adminDocumentNumber = '';
    this.clearAdminSignature();
    this.clearCreateLogo();
    this.selectedPlanKey = this.activeSubscriptionPlans[0]?.key ?? 'biomedico_ips';
    this.selectedBillingCycle = 'monthly';
    this.softwareDraft = new Set(['biomedico']);
  }

  private createEmptySubscriptionDraft(): SubscriptionDraft {
    return {
      planKey: this.activeSubscriptionPlans[0]?.key ?? 'biomedico_ips',
      billingCycle: 'monthly',
      status: 'active',
      accessMode: 'full',
      currentPeriodStartsAt: '',
      currentPeriodEndsAt: '',
      graceEndsAt: '',
      amount: null,
      currency: 'COP',
      notes: ''
    };
  }

  private createDefaultPaymentDraft(subscription?: ClientSubscriptionView | null): SubscriptionPaymentDraft {
    const today = this.todayISO();
    const periodStart = subscription?.current_period_ends_at && subscription.current_period_ends_at >= today
      ? this.addDays(subscription.current_period_ends_at, 1)
      : today;
    return {
      paidAt: today,
      periodStart,
      periodEnd: this.addPeriod(periodStart, subscription?.billing_cycle ?? 'monthly'),
      amount: subscription?.amount ?? null,
      currency: subscription?.currency ?? 'COP',
      reference: '',
      notes: ''
    };
  }

  private createEmptyPlanDraft(): PlanDraft {
    return {
      key: '',
      name: '',
      clientType: 'ips_hospital',
      description: '',
      includedSuites: ['biomedico'],
      includedModules: ['usuarios', 'auditoria'],
      monthlyPrice: null,
      annualPrice: null,
      currency: 'COP',
      graceDays: 5,
      expirationAccessMode: 'read_only',
      displayOrder: 100,
      isActive: true
    };
  }

  private toggleArrayValue(values: string[], value: string): string[] {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }

  private todayISO(): string {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  private addDays(dateISO: string, days: number): string {
    const date = new Date(`${dateISO}T00:00:00`);
    date.setDate(date.getDate() + days);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  private addPeriod(dateISO: string, cycle: BillingCycle): string {
    const date = new Date(`${dateISO}T00:00:00`);
    if (cycle === 'annual') {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    date.setDate(date.getDate() - 1);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }
}
