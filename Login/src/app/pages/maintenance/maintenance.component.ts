import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import type { AssetCategory } from '../../biomed/biomed.service';
import { MaintenanceService, MaintenanceReportDto, MaintenanceRequestDto } from '../../maintenance/maintenance.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import {
  maintenanceAssetMatchesLookup,
  maintenanceSpareStatusForReport,
  paginateMaintenanceItems
} from './maintenance-view.utils';

interface ClientLite {
  id: string;
  name: string;
  nit?: string;
  city?: string;
  address?: string;
  email?: string;
  logo_path?: string | null;
}

interface AssetLite {
  id: string;
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  status?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  locationName?: string | null;
}

interface PendingSpareCase {
  asset: AssetLite;
  report: MaintenanceReportDto | null;
}

type MaintenanceViewMode =
  | 'crear_solicitud'
  | 'solicitudes'
  | 'preventivos'
  | 'reportes'
  | 'protocolos_fisicos'
  | 'repuestos'
  | 'bajas'
  | 'equipos';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  @ViewChild('qrVideo') qrVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('reportFormCard') reportFormCard?: ElementRef<HTMLElement>;
  @ViewChild('preventiveProgrammedCard') preventiveProgrammedCard?: ElementRef<HTMLElement>;

  private readonly publicBase = getPublicBase();
  private qrStream: MediaStream | null = null;
  private qrTimer: ReturnType<typeof setTimeout> | null = null;
  private qrDetector: any = null;
  private routeSub: Subscription | null = null;
  private destroyed = false;
  private reportFilterCacheReports: MaintenanceReportDto[] | null = null;
  private reportFilterCacheAssets: Map<string, AssetLite> | null = null;
  private reportFilterCacheKey = '';
  private reportFilterCacheItems: MaintenanceReportDto[] = [];
  private preventiveProgrammedCacheRequests: MaintenanceRequestDto[] | null = null;
  private preventiveProgrammedCacheAssets: Map<string, AssetLite> | null = null;
  private preventiveProgrammedCacheItems: MaintenanceRequestDto[] = [];
  private preventiveFilterCacheSource: MaintenanceRequestDto[] | null = null;
  private preventiveFilterCacheAssets: Map<string, AssetLite> | null = null;
  private preventiveFilterCacheKey = '';
  private preventiveFilterCacheItems: MaintenanceRequestDto[] = [];
  readonly assetCategory: AssetCategory;

  loading = false;
  lastUpdatedAt: Date | null = null;
  errorMessage = '';
  successMessage = '';
  alertMessage = '';
  alertKind: 'success' | 'error' = 'success';
  reportOpening = false;
  openingReportRequestId = '';

  clients: ClientLite[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  assets: AssetLite[] = [];
  assetMap = new Map<string, AssetLite>();

  requests: MaintenanceRequestDto[] = [];
  reports: MaintenanceReportDto[] = [];
  requestSearchTerm = '';
  requestStatusFilter = '';
  reportSearchTerm = '';
  reportStatusFilter = '';
  reportSpareFilter = '';
  reportTypeFilter = '';
  reportSiteFilter = '';
  reportAreaFilter = '';
  reportDateFrom = '';
  reportDateTo = '';
  reportPage = 1;
  reportPageSize = 10;
  preventiveSearchTerm = '';
  preventiveSiteFilter = '';
  preventiveAreaFilter = '';
  preventiveLocationFilter = '';
  preventiveStatusFilter = '';
  preventivePage = 1;
  preventivePageSize = 10;
  assetSearchTerm = '';
  protocolSearchTerm = '';
  protocolSiteFilter = '';
  protocolAreaFilter = '';
  protocolStatusFilter = '';
  protocolReason = '';
  protocolGenerating = false;
  protocolConfirmationScope: 'selected' | 'all_active' | null = null;
  selectedProtocolAssetIds = new Set<string>();
  permissionsRefreshLoading = false;
  private lastPermissionRefreshAt = 0;
  private readonly permissionRefreshCooldownMs = 4000;
  qrScannerActive = false;
  qrScannerSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  qrScanError = '';
  qrManualCode = '';

  requestType: 'preventivo' | 'correctivo' = 'correctivo';
  requestAssetId = '';
  requestDescription = '';

  reportRequestId = '';
  reportSummary = '';
  reportFindings = '';
  reportActions = '';
  reportMaintenanceChecks: string[] = [];
  reportMaintenanceActivities: string[] = [];
  reportMaintenanceTests: string[] = [];
  reportAssetStatus: 'operativo' | 'operativo_observacion' | 'fuera_de_servicio' = 'operativo';
  reportAssetStatusObservations = '';
  reportRequiresSpareParts = false;
  reportSparePartsNeeded = '';
  reportSparePartsStatus: 'no_aplica' | 'solicitado' | 'recibido' = 'no_aplica';
  reportSparePartResolution: 'request_later' | 'installed_now' = 'request_later';
  reportFlowMode: 'normal' | 'install_spare' | 'retire_asset' = 'normal';
  reportFlowSource: MaintenanceReportDto | null = null;
  reportCorrectionMode = false;
  reportFormActive = false;
  reportSubView: 'pendientes_firma' | 'historial' = 'pendientes_firma';
  viewMode: MaintenanceViewMode = 'crear_solicitud';
  reportDetail: MaintenanceReportDto | null = null;
  signConfirmationReport: MaintenanceReportDto | null = null;
  signingReport = false;
  correctionDialogReport: MaintenanceReportDto | null = null;
  correctionReason = '';
  correctionSubmitting = false;

  readonly requestStatuses = [
    { value: '', label: 'Todos' },
    { value: 'abierto', label: 'Abierto' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'espera_repuesto', label: 'En espera de repuesto' },
    { value: 'correccion', label: 'Corrección solicitada' },
    { value: 'reportado', label: 'Reportado' },
    { value: 'firmado', label: 'Firmado' }
  ];
  readonly assetStatusOptions = [
    { value: 'operativo', label: 'Operativo' },
    { value: 'operativo_observacion', label: 'Operativo con observación' },
    { value: 'fuera_de_servicio', label: 'Fuera de servicio' }
  ];
  readonly maintenanceCheckOptions = [
    { value: 'revision_visual', label: 'Revisión visual externa' },
    { value: 'revision_cables_conexiones', label: 'Revisión de cables y conexiones' },
    { value: 'revision_accesorios', label: 'Revisión de accesorios' },
    { value: 'verificacion_alimentacion', label: 'Verificación eléctrica/batería' },
    { value: 'revision_alarmas_errores', label: 'Alarmas o códigos de error' },
    { value: 'prueba_funcional_inicial', label: 'Prueba funcional inicial' },
    { value: 'revision_seguridad_basica', label: 'Revisión básica de seguridad' }
  ];
  readonly maintenanceActivityOptions = [
    { value: 'limpieza_externa', label: 'Limpieza externa' },
    { value: 'limpieza_interna', label: 'Limpieza interna' },
    { value: 'ajuste_conexiones', label: 'Ajuste de conexiones' },
    { value: 'configuracion_parametros', label: 'Configuración de parámetros' },
    { value: 'reparacion_componente', label: 'Reparación de componente' },
    { value: 'instalacion_repuesto', label: 'Instalación/reemplazo de repuesto' },
    { value: 'lubricacion', label: 'Lubricación' },
    { value: 'actualizacion_software', label: 'Actualización de software' },
    { value: 'capacitacion_usuario', label: 'Inducción al usuario' },
    { value: 'prueba_funcional_final', label: 'Prueba funcional final' }
  ];
  readonly maintenanceTestOptions = [
    { value: 'encendido_apagado', label: 'Encendido y apagado' },
    { value: 'prueba_modos_operacion', label: 'Modos de operación' },
    { value: 'verificacion_alarmas', label: 'Verificación de alarmas' },
    { value: 'verificacion_accesorios', label: 'Verificación de accesorios' },
    { value: 'prueba_con_paciente_simulado', label: 'Paciente/simulador' },
    { value: 'verificacion_parametros', label: 'Parámetros dentro de rango' },
    { value: 'equipo_operativo_entregado', label: 'Equipo operativo y entregado' }
  ];
  readonly industrialMaintenanceTestOptions = [
    { value: 'encendido_apagado', label: 'Encendido y apagado' },
    { value: 'prueba_modos_operacion', label: 'Modos de operación' },
    { value: 'verificacion_alarmas', label: 'Verificación de alarmas' },
    { value: 'verificacion_parametros', label: 'Parámetros dentro de rango' },
    { value: 'verificacion_temperatura_presion', label: 'Temperatura o presión de operación' },
    { value: 'prueba_carga_operativa', label: 'Prueba con carga operativa' },
    { value: 'verificacion_consumo_electrico', label: 'Consumo y alimentación eléctrica' },
    { value: 'verificacion_fugas_drenajes', label: 'Fugas, drenajes y sellos' },
    { value: 'equipo_operativo_entregado', label: 'Equipo operativo y entregado' }
  ];
  readonly protocolStatusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'activo', label: 'Activo' },
    { value: 'operativo', label: 'Operativo' },
    { value: 'operativo_observacion', label: 'Operativo con observación' },
    { value: 'pendiente_repuesto', label: 'Pendiente por repuesto' },
    { value: 'fuera_de_servicio', label: 'Fuera de servicio' }
  ];

  constructor(
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly biomed: BiomedService,
    private readonly maintenance: MaintenanceService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute
  ) {
    this.assetCategory = this.route.snapshot.data['assetCategory'] === 'industrial'
      ? 'industrial'
      : 'biomedical';
  }

  get isIndustrialMaintenanceModule(): boolean {
    return this.assetCategory === 'industrial';
  }

  get maintenanceModuleTitle(): string {
    return this.isIndustrialMaintenanceModule
      ? 'Mantenimiento industrial'
      : 'Mantenimiento biomédico';
  }

  get maintenanceTestOptionsForCategory(): readonly { value: string; label: string }[] {
    return this.isIndustrialMaintenanceModule
      ? this.industrialMaintenanceTestOptions
      : this.maintenanceTestOptions;
  }

  async ngOnInit(): Promise<void> {
    if (this.canRefreshMaintenanceTemporaryPermissions) {
      await this.refreshCurrentPermissions(false);
    }
    if (!this.auth.hasPermission('maintenance:request:create') && this.auth.hasPermission('maintenance:report:create')) {
      this.viewMode = 'preventivos';
    } else if (!this.auth.hasPermission('maintenance:request:create')) {
      this.viewMode = 'solicitudes';
    }
    await this.loadClients();
    await this.loadData();
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      void this.applyRouteIntent(params);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopQrScan();
    this.routeSub?.unsubscribe();
  }

  async loadClients(): Promise<void> {
    const user = this.auth.currentUser();
    if (user?.clientId) {
      this.selectedClientId = user.clientId;
      this.clients = [];
      return;
    }

    try {
      const clients = await this.admin.listClients();
      this.clients = clients.map((client) => ({
        id: client.id,
        name: client.name,
        nit: client.nit,
        city: client.city,
        address: client.address ?? undefined,
        logo_path: client.logo_path
      }));
      this.selectedClientId = this.clients[0]?.id ?? '';
    } catch {
      this.clients = [];
      this.selectedClientId = '';
    }
  }

  get filteredClients(): ClientLite[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) => client.name.toLowerCase().includes(term));
  }

  get selectedClientInfo(): ClientLite | null {
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  clientLogoUrl(client: ClientLite | null): string | null {
    if (!client?.logo_path) return null;
    if (client.logo_path.startsWith('http')) return client.logo_path;
    return joinBase(this.publicBase, client.logo_path);
  }

  async onClientChange(): Promise<void> {
    await this.loadData();
  }

  async refreshMaintenanceData(): Promise<void> {
    if (this.loading) return;
    const previousRefresh = this.lastUpdatedAt;
    await this.loadData();
    if (this.lastUpdatedAt && this.lastUpdatedAt !== previousRefresh && !this.errorMessage) {
      this.successMessage = 'Información de mantenimiento actualizada.';
    }
  }

  async switchView(mode: MaintenanceViewMode): Promise<void> {
    if (mode === 'protocolos_fisicos' && !this.canPrintBlankProtocols) return;
    this.viewMode = mode;
    this.refreshViewSoon();

    if (mode === 'preventivos') {
      await this.loadData();
      this.scrollToPreventiveProgrammed();
    }
  }

  async applyRouteIntent(params: ParamMap): Promise<void> {
    const view = params.get('view');
    const requestId = params.get('requestId');
    const assetId = params.get('assetId');
    const assetCode = params.get('code');
    const clientId = params.get('clientId');

    if ((assetId || assetCode) && clientId && !this.auth.currentUser()?.clientId && this.selectedClientId !== clientId) {
      this.selectedClientId = clientId;
      await this.loadData();
    }

    if (assetId || assetCode) {
      if (!this.assets.length && this.selectedClientId) {
        await this.loadData();
      }
      const found = this.selectAssetFromCode(assetId || assetCode || '');
      if (found) {
        this.viewMode = 'crear_solicitud';
        this.requestType = 'correctivo';
        this.scrollToTop();
      }
    }

    if (view === 'reportes' && requestId) {
      this.viewMode = 'reportes';
      if (!this.requests.length && this.selectedClientId) {
        await this.loadData();
      }
      const request = this.requests.find((item) => item.id === requestId);
      if (request && request.status === 'abierto') {
        try {
          await this.maintenance.assignRequest(requestId);
          await this.loadData();
        } catch (error: any) {
          await this.loadData();
          this.viewMode = 'solicitudes';
          this.errorMessage = error?.error?.message ?? 'La solicitud ya no está disponible.';
          return;
        }
      }
      this.activateReportForm(requestId, 'Abrí la solicitud desde la notificación. Completa el reporte cuando termines la intervención.');
      return;
    }
    if (view === 'repuestos') {
      this.viewMode = 'repuestos';
      if (requestId) {
        const report = this.sparePartReports.find((item) => item.request_id === requestId);
        if (report) {
          this.successMessage = `Solicitud de repuesto abierta para ${this.assetLabel(report.asset_id)}.`;
        }
      }
    }
  }

  async loadData(): Promise<void> {
    if (!this.selectedClientId) {
      this.requests = [];
      this.reports = [];
      this.assets = [];
      this.assetMap = new Map();
      this.refreshViewSoon();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      const [assets, requests, reports] = await Promise.all([
        this.biomed.listAssets(this.selectedClientId, this.assetCategory),
        this.maintenance.listRequests(this.selectedClientId, this.assetCategory),
        this.maintenance.listReports(this.selectedClientId, {
          assetCategory: this.assetCategory,
          order: 'desc'
        })
      ]);
      this.assets = assets.map((asset) => ({
        id: asset.id,
        code: asset.code,
        name: asset.name,
        brand: asset.brand,
        model: asset.model,
        serial: asset.serial,
        status: asset.status,
        siteName: asset.site_name,
        areaName: asset.area_name,
        locationName: asset.location_name
      }));
      this.assetMap = new Map(this.assets.map((asset) => [asset.id, asset]));
      const eligibleProtocolIds = new Set(this.activeAssets.map((asset) => asset.id));
      this.selectedProtocolAssetIds = new Set(
        Array.from(this.selectedProtocolAssetIds).filter((assetId) => eligibleProtocolIds.has(assetId))
      );
      this.requests = requests;
      this.reports = reports;
      this.clampReportPage();
      if (!this.activeAssets.some((asset) => asset.id === this.requestAssetId)) {
        this.requestAssetId = '';
      }
      if (this.reportRequestId && !this.requests.some((request) => request.id === this.reportRequestId)) {
        this.reportRequestId = '';
        this.reportFormActive = false;
      }
      this.lastUpdatedAt = new Date();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la información de mantenimiento.';
    } finally {
      this.loading = false;
      this.refreshViewSoon();
    }
  }

  activateReportForm(requestId: string, message = ''): void {
    const request = this.requests.find((item) => item.id === requestId);
    if (!request) {
      this.reportFormActive = false;
      this.reportRequestId = '';
      this.errorMessage = 'Esta solicitud ya no está disponible para crear reporte.';
      return;
    }
    this.openReportFormForRequest(request, message);
  }

  private openReportFormForRequest(request: MaintenanceRequestDto, message = ''): void {
    if (['reportado', 'firmado', 'vencido'].includes(request.status)) {
      this.reportFormActive = false;
      this.reportRequestId = '';
      this.errorMessage = 'Esta solicitud ya no está disponible para crear reporte.';
      return;
    }
    if (request.status === 'espera_repuesto') {
      this.openSpareWorkflow(request);
      return;
    }
    this.reportRequestId = request.id;
    this.reportFormActive = true;
    this.errorMessage = '';
    this.resetReportFields();
    this.applyReportDefaults(request);
    if (message) this.successMessage = message;
    this.scrollToReportForm();
  }

  async createRequest(): Promise<void> {
    if (!this.selectedClientId || !this.requestAssetId) {
      this.errorMessage = 'Selecciona cliente y equipo.';
      return;
    }
    const cleanDescription = this.requestDescription.replace(/\s+/g, ' ').trim();
    if (this.requestType === 'correctivo' && cleanDescription.length < 10) {
      this.errorMessage = 'Describe la falla o necesidad con al menos 10 caracteres.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.maintenance.createRequest({
        clientId: this.selectedClientId,
        assetId: this.requestAssetId,
        assetCategory: this.assetCategory,
        type: this.requestType,
        description: cleanDescription
      });
      this.requestDescription = '';
      this.requestAssetId = '';
      this.assetSearchTerm = '';
      await this.loadData();
      this.viewMode = 'solicitudes';
      this.successMessage = 'Solicitud creada.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear la solicitud.';
    }
  }

  async takeRequest(requestId: string): Promise<void> {
    try {
      await this.maintenance.assignRequest(requestId);
      await this.loadData();
      this.activateReportForm(requestId, 'Solicitud tomada. Completa el reporte cuando termines la intervención.');
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo tomar la solicitud.';
    }
  }

  async startPreventiveReport(request: MaintenanceRequestDto): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.alertMessage = '';
    if (!this.canTakeRequest(request)) {
      this.errorMessage = 'No puedes tomar este mantenimiento preventivo en este momento.';
      return;
    }
    this.reportOpening = true;
    this.openingReportRequestId = request.id;
    this.openReportFormForRequest(
      request,
      `Abriendo mantenimiento preventivo para ${this.assetLabel(request.asset_id)}...`
    );
    try {
      if (request.status !== 'en_proceso') {
        await this.maintenance.assignRequest(request.id);
      }
      await this.loadData();
      const updatedRequest = this.requests.find((item) => item.id === request.id) ?? request;
      this.reportRequestId = updatedRequest.id;
      this.applyReportDefaults(updatedRequest);
      this.successMessage = `Mantenimiento preventivo cargado para ${this.assetLabel(updatedRequest.asset_id)}.`;
      this.scrollToReportForm();
    } catch (error: any) {
      console.error(error);
      this.reportFormActive = false;
      this.reportRequestId = '';
      this.viewMode = 'preventivos';
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el reporte preventivo.';
    } finally {
      this.reportOpening = false;
      this.openingReportRequestId = '';
    }
  }

  async deleteRequest(requestId: string): Promise<void> {
    if (!confirm('¿Eliminar solicitud de mantenimiento?')) {
      return;
    }
    try {
      await this.maintenance.deleteRequest(requestId);
      await this.loadData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar la solicitud.';
    }
  }

  async createReport(): Promise<void> {
    if (!this.reportRequestId) {
      this.errorMessage = 'Selecciona una solicitud.';
      return;
    }
    const request = this.selectedReportRequest;
    const summary = this.reportSummary?.trim();
    const findings = this.reportFindings?.trim();
    const actionsTaken = this.reportActions?.trim();
    if (!summary || !findings || !actionsTaken) {
      this.errorMessage = 'Completa resumen, hallazgos y acciones realizadas antes de guardar el reporte.';
      return;
    }
    if (!this.reportMaintenanceChecks.length) {
      this.errorMessage = 'Selecciona al menos una revisión realizada.';
      return;
    }
    if (!this.reportMaintenanceActivities.length) {
      this.errorMessage = 'Selecciona al menos una actividad técnica realizada.';
      return;
    }
    if (this.reportAssetStatus !== 'fuera_de_servicio' && !this.reportMaintenanceTests.length) {
      this.errorMessage = 'Selecciona al menos una prueba o verificación realizada.';
      return;
    }
    const assetStatusObservations = this.reportAssetStatusObservations.replace(/\s+/g, ' ').trim();
    if (this.reportAssetStatus !== 'operativo' && assetStatusObservations.length < 5) {
      this.errorMessage = this.reportAssetStatus === 'operativo_observacion'
        ? 'Describe la observación con la que queda operativo el equipo.'
        : 'Describe por qué el equipo queda fuera de servicio.';
      this.showAlert(this.errorMessage, 'error');
      return;
    }
    if (this.reportRequiresSpareParts && !this.reportSparePartsNeeded.trim()) {
      this.errorMessage = 'Describe el repuesto requerido antes de guardar el reporte.';
      this.showAlert(this.errorMessage, 'error');
      return;
    }
    if (
      this.reportRequiresSpareParts
      && this.reportSparePartResolution === 'installed_now'
      && !this.reportMaintenanceActivities.includes('instalacion_repuesto')
    ) {
      this.errorMessage = 'Marca la actividad de instalación o reemplazo del repuesto.';
      this.showAlert(this.errorMessage, 'error');
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;
    try {
      const requestBeforeSave = this.selectedReportRequest;
      const savedAssetLabel = requestBeforeSave ? this.assetLabel(requestBeforeSave.asset_id) : '';
      const flowMode = this.reportFlowMode;
      const wasCorrection = this.reportCorrectionMode;
      const isStandardPreventiveReport = Boolean(
        requestBeforeSave?.type === 'preventivo' && flowMode === 'normal' && !wasCorrection
      );
      const sparePartsStatusForPayload = maintenanceSpareStatusForReport(
        flowMode,
        this.reportRequiresSpareParts,
        wasCorrection ? this.reportSparePartsStatus : null,
        this.reportSparePartResolution === 'installed_now'
      );
      const requiresSparePartsForPayload = sparePartsStatusForPayload !== 'no_aplica';
      const hadPendingSparePartRequest = sparePartsStatusForPayload === 'solicitado';
      const installedSpareDuringService = Boolean(
        flowMode === 'normal' && !wasCorrection && sparePartsStatusForPayload === 'recibido'
      );
      const sparePartsNeededForPayload = flowMode === 'install_spare'
        ? (this.reportSparePartsNeeded.trim() || 'Repuesto instalado')
        : this.reportSparePartsNeeded.trim();
      await this.maintenance.createReport({
        requestId: this.reportRequestId,
        summary,
        findings,
        actionsTaken,
        maintenanceChecks: this.reportMaintenanceChecks,
        maintenanceActivities: this.reportMaintenanceActivities,
        maintenanceTests: this.reportMaintenanceTests,
        assetStatusAfter: this.reportAssetStatus,
        assetStatusObservations: this.reportAssetStatus === 'operativo' ? '' : assetStatusObservations,
        assetLifecycleAction: flowMode === 'retire_asset' ? 'retire' : null,
        requiresSpareParts: requiresSparePartsForPayload,
        sparePartsNeeded: requiresSparePartsForPayload ? sparePartsNeededForPayload : '',
        sparePartsStatus: sparePartsStatusForPayload,
        sparePartsInstalledNow: installedSpareDuringService
      });
      this.reportRequestId = '';
      this.resetReportFields();
      this.reportFormActive = false;
      await this.loadData();
      if (isStandardPreventiveReport) {
        const message = installedSpareDuringService
          ? `Reporte preventivo guardado${savedAssetLabel ? ` para ${savedAssetLabel}` : ''} con el repuesto instalado. Puedes continuar con el siguiente equipo.`
          : hadPendingSparePartRequest
          ? `Reporte preventivo guardado${savedAssetLabel ? ` para ${savedAssetLabel}` : ''}. El equipo quedó en Pendientes repuestos y se notificó al almacenista. Puedes continuar con el siguiente preventivo.`
          : `Reporte preventivo guardado${savedAssetLabel ? ` para ${savedAssetLabel}` : ''}. Puedes continuar con el siguiente equipo.`;
        this.showAlert(
          message,
          'success'
        );
        if (this.viewMode === 'preventivos') this.scrollToPreventiveProgrammed();
        return;
      }
      const message = wasCorrection
        ? 'Corrección guardada. El reporte volvió a quedar pendiente de firma.'
        : flowMode === 'install_spare'
        ? 'Reporte de instalación de repuesto creado. El caso salió de pendientes de repuesto.'
        : flowMode === 'retire_asset'
          ? 'Reporte de baja técnica creado. El caso salió de pendientes de repuesto.'
          : installedSpareDuringService
            ? 'Reporte creado con el repuesto instalado durante la intervención.'
          : 'Reporte creado.';
      this.showAlert(message, 'success');
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el reporte.';
      this.showAlert(this.errorMessage, 'error');
    } finally {
      this.loading = false;
      this.refreshViewSoon();
    }
  }

  openSignConfirmation(report: MaintenanceReportDto): void {
    if (!this.canSignReport(report)) return;
    this.reportDetail = null;
    this.signConfirmationReport = report;
  }

  closeSignConfirmation(): void {
    if (this.signingReport) return;
    this.signConfirmationReport = null;
  }

  async confirmSignReport(): Promise<void> {
    const report = this.signConfirmationReport;
    if (!report || this.signingReport) return;
    this.signingReport = true;
    try {
      await this.maintenance.signReport(report.id);
      await this.loadData();
      this.signConfirmationReport = null;
      this.showAlert('Reporte firmado correctamente.', 'success');
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo firmar el reporte.';
      this.showAlert(this.errorMessage, 'error');
    } finally {
      this.signingReport = false;
    }
  }

  openCorrectionDialog(report: MaintenanceReportDto): void {
    if (!this.canRequestReportCorrection(report)) return;
    this.reportDetail = null;
    this.correctionDialogReport = report;
    this.correctionReason = '';
  }

  closeCorrectionDialog(): void {
    if (this.correctionSubmitting) return;
    this.correctionDialogReport = null;
    this.correctionReason = '';
  }

  async requestReportCorrection(): Promise<void> {
    const report = this.correctionDialogReport;
    const cleanReason = this.correctionReason.replace(/\s+/g, ' ').trim();
    if (!report || this.correctionSubmitting) return;
    if (cleanReason.length < 10) {
      this.errorMessage = 'Describe la corrección solicitada con al menos 10 caracteres.';
      return;
    }
    this.correctionSubmitting = true;
    try {
      await this.maintenance.requestReportCorrection(report.id, cleanReason);
      await this.loadData();
      this.correctionDialogReport = null;
      this.correctionReason = '';
      this.showAlert('Corrección solicitada. El ingeniero recibió una notificación con el motivo.', 'success');
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo solicitar la corrección.';
      this.showAlert(this.errorMessage, 'error');
    } finally {
      this.correctionSubmitting = false;
    }
  }

  startReportCorrection(report: MaintenanceReportDto): void {
    if (!this.canCorrectReport(report)) return;
    this.reportDetail = null;
    this.reportRequestId = report.request_id;
    this.reportFormActive = true;
    this.reportCorrectionMode = true;
    this.viewMode = 'reportes';
    this.reportSummary = report.summary || '';
    this.reportFindings = report.findings || '';
    this.reportActions = report.actions_taken || '';
    this.reportMaintenanceChecks = this.asStringArray(report.maintenance_checks);
    this.reportMaintenanceActivities = this.asStringArray(report.maintenance_activities);
    this.reportMaintenanceTests = this.asStringArray(report.maintenance_tests);
    this.reportAssetStatus = this.isAssetStatus(report.asset_status_after) ? report.asset_status_after : 'operativo';
    this.reportAssetStatusObservations = report.asset_status_observations || '';
    this.reportRequiresSpareParts = Boolean(report.requires_spare_parts);
    this.reportSparePartsNeeded = report.spare_parts_needed || '';
    this.reportSparePartsStatus = this.isSpareStatus(report.spare_parts_status) ? report.spare_parts_status : 'no_aplica';
    this.reportSparePartResolution = this.reportSparePartsStatus === 'recibido' ? 'installed_now' : 'request_later';
    if (
      this.reportSparePartsStatus === 'recibido'
      && !this.reportMaintenanceActivities.includes('instalacion_repuesto')
    ) {
      this.reportMaintenanceActivities = [...this.reportMaintenanceActivities, 'instalacion_repuesto'];
    }
    this.reportFlowMode = 'normal';
    this.reportFlowSource = null;
    this.successMessage = `Corrección cargada. Motivo: ${report.correction_reason || 'Sin detalle registrado'}`;
    this.scrollToReportForm();
  }

  async downloadReport(reportId: string): Promise<void> {
    try {
      const blob = await this.maintenance.downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async refreshCurrentPermissions(force = true): Promise<void> {
    if (this.permissionsRefreshLoading || !this.auth.tokens()?.refreshToken) return;
    const now = Date.now();
    if (!force && now - this.lastPermissionRefreshAt < this.permissionRefreshCooldownMs) return;
    this.lastPermissionRefreshAt = now;
    const hadPermission = this.canPrintBlankProtocols;
    this.permissionsRefreshLoading = true;
    try {
      let refreshed = await this.auth.refreshSession();
      if (!refreshed) {
        refreshed = await this.auth.reloadCurrentUser();
      }
      if (!refreshed) return;

      if (!hadPermission && this.canPrintBlankProtocols) {
        this.viewMode = 'protocolos_fisicos';
        this.errorMessage = '';
        this.successMessage = 'Permiso actualizado. Ya puedes preparar protocolos físicos.';
      } else if (force && this.canPrintBlankProtocols) {
        this.errorMessage = '';
        this.successMessage = 'Permisos actualizados. La impresión temporal está activa.';
      } else if (force) {
        if (this.viewMode === 'protocolos_fisicos') this.viewMode = 'equipos';
        this.successMessage = '';
        this.errorMessage = 'El permiso temporal de protocolos físicos no está activo o ya venció.';
      }
    } finally {
      this.permissionsRefreshLoading = false;
      this.refreshViewSoon();
    }
  }

  openProtocolConfirmation(scope: 'selected' | 'all_active'): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.canPrintBlankProtocols) {
      this.errorMessage = 'Necesitas un permiso temporal activo para generar protocolos físicos.';
      return;
    }
    const reason = this.protocolReason.replace(/\s+/g, ' ').trim();
    if (reason.length < 10) {
      this.errorMessage = 'Registra un motivo de al menos 10 caracteres.';
      return;
    }
    const count = scope === 'all_active' ? this.activeAssets.length : this.selectedProtocolAssetIds.size;
    if (!count) {
      this.errorMessage = scope === 'all_active'
        ? 'No hay equipos vigentes para generar protocolos.'
        : 'Selecciona al menos un equipo.';
      return;
    }
    if (count > 500) {
      this.errorMessage = 'Cada lote admite máximo 500 equipos. Usa los filtros y genera varios lotes seleccionados.';
      return;
    }
    this.protocolReason = reason;
    this.protocolConfirmationScope = scope;
  }

  closeProtocolConfirmation(): void {
    if (this.protocolGenerating) return;
    this.protocolConfirmationScope = null;
  }

  async generateBlankProtocols(): Promise<void> {
    const scope = this.protocolConfirmationScope;
    if (!scope || this.protocolGenerating) return;

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = 'Preparando protocolos';
      previewWindow.document.body.textContent = 'Preparando PDF...';
    }

    this.protocolGenerating = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const result = await this.maintenance.generateBlankProtocols({
        scope,
        assetIds: scope === 'selected' ? Array.from(this.selectedProtocolAssetIds) : undefined,
        reason: this.protocolReason,
        assetCategory: this.assetCategory
      });
      const file = new File(
        [result.blob],
        `protocolos-mantenimiento-${result.batchCode.toLowerCase()}.pdf`,
        { type: 'application/pdf' }
      );
      const url = URL.createObjectURL(file);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      this.protocolConfirmationScope = null;
      this.selectedProtocolAssetIds = new Set<string>();
      this.protocolReason = '';
      this.successMessage = `Lote ${result.batchCode} generado con ${result.assetCount} protocolo(s).`;
    } catch (error: any) {
      previewWindow?.close();
      console.error(error);
      this.errorMessage = await this.blankProtocolErrorMessage(error);
      if (error?.status === 403) {
        await this.auth.reloadCurrentUser();
        if (!this.canPrintBlankProtocols) {
          this.protocolConfirmationScope = null;
          this.viewMode = 'equipos';
        }
      }
    } finally {
      this.protocolGenerating = false;
      this.refreshViewSoon();
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    if (!confirm('¿Eliminar reporte de mantenimiento?')) {
      return;
    }
    try {
      await this.maintenance.deleteReport(reportId);
      if (this.reportDetail?.id === reportId) this.reportDetail = null;
      await this.loadData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el reporte.';
    }
  }

  assetLabel(assetId: string): string {
    const asset = this.assetMap.get(assetId);
    return asset ? `${asset.code} - ${asset.name}` : assetId;
  }

  get activeAssets(): AssetLite[] {
    return this.assets.filter((asset) => asset.status !== 'dado_de_baja');
  }

  get canPrintBlankProtocols(): boolean {
    return Boolean(this.auth.currentUser()?.clientId)
      && this.auth.hasRole('ingeniero_biomedico')
      && this.auth.hasPermission('maintenance:protocol:print_blank');
  }

  get canRefreshMaintenanceTemporaryPermissions(): boolean {
    return Boolean(this.auth.currentUser()?.clientId) && this.auth.hasRole('ingeniero_biomedico');
  }

  get protocolSiteOptions(): string[] {
    return Array.from(new Set(this.activeAssets.map((asset) => asset.siteName).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get protocolAreaOptions(): string[] {
    const source = this.protocolSiteFilter
      ? this.activeAssets.filter((asset) => asset.siteName === this.protocolSiteFilter)
      : this.activeAssets;
    return Array.from(new Set(source.map((asset) => asset.areaName).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get filteredProtocolAssets(): AssetLite[] {
    const term = this.normalize(this.protocolSearchTerm);
    return this.activeAssets
      .filter((asset) => !this.protocolSiteFilter || asset.siteName === this.protocolSiteFilter)
      .filter((asset) => !this.protocolAreaFilter || asset.areaName === this.protocolAreaFilter)
      .filter((asset) => !this.protocolStatusFilter || asset.status === this.protocolStatusFilter)
      .filter((asset) => !term || this.assetHaystack(asset).includes(term))
      .sort((a, b) =>
        `${a.siteName || ''} ${a.areaName || ''} ${a.locationName || ''} ${a.code}`.localeCompare(
          `${b.siteName || ''} ${b.areaName || ''} ${b.locationName || ''} ${b.code}`
        )
      );
  }

  get selectedProtocolAssetCount(): number {
    return this.selectedProtocolAssetIds.size;
  }

  get allVisibleProtocolAssetsSelected(): boolean {
    return this.filteredProtocolAssets.length > 0
      && this.filteredProtocolAssets.every((asset) => this.selectedProtocolAssetIds.has(asset.id));
  }

  get protocolConfirmationCount(): number {
    return this.protocolConfirmationScope === 'all_active'
      ? this.activeAssets.length
      : this.selectedProtocolAssetIds.size;
  }

  isProtocolAssetSelected(assetId: string): boolean {
    return this.selectedProtocolAssetIds.has(assetId);
  }

  toggleProtocolAsset(assetId: string, selected: boolean): void {
    const next = new Set(this.selectedProtocolAssetIds);
    if (selected) next.add(assetId);
    else next.delete(assetId);
    this.selectedProtocolAssetIds = next;
  }

  toggleVisibleProtocolAssets(): void {
    const next = new Set(this.selectedProtocolAssetIds);
    if (this.allVisibleProtocolAssetsSelected) {
      this.filteredProtocolAssets.forEach((asset) => next.delete(asset.id));
    } else {
      this.filteredProtocolAssets.forEach((asset) => next.add(asset.id));
    }
    this.selectedProtocolAssetIds = next;
  }

  clearProtocolSelection(): void {
    this.selectedProtocolAssetIds = new Set<string>();
  }

  onProtocolSiteFilterChange(): void {
    if (this.protocolAreaFilter && !this.protocolAreaOptions.includes(this.protocolAreaFilter)) {
      this.protocolAreaFilter = '';
    }
  }

  get retiredAssets(): AssetLite[] {
    return this.assets.filter((asset) => asset.status === 'dado_de_baja');
  }

  get filteredAssets(): AssetLite[] {
    const term = this.normalize(this.assetSearchTerm);
    return this.activeAssets
      .filter((asset) => !term || this.assetHaystack(asset).includes(term))
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  }

  get selectedRequestAsset(): AssetLite | null {
    return this.assets.find((asset) => asset.id === this.requestAssetId) ?? null;
  }

  get canSubmitRequest(): boolean {
    const description = this.requestDescription.replace(/\s+/g, ' ').trim();
    return Boolean(
      !this.loading
      && this.selectedClientId
      && this.requestAssetId
      && (this.requestType !== 'correctivo' || description.length >= 10)
    );
  }

  get filteredRequests(): MaintenanceRequestDto[] {
    const term = this.normalize(this.requestSearchTerm);
    return this.manualRequests.filter((request) => {
      if (this.requestStatusFilter && request.status !== this.requestStatusFilter) return false;
      if (!term) return true;
      const asset = this.assetMap.get(request.asset_id);
      const haystack = [
        request.type,
        request.status,
        request.description,
        request.requester_name,
        asset?.code,
        asset?.name,
        asset?.brand,
        asset?.model,
        asset?.serial,
        asset?.siteName,
        asset?.areaName,
        asset?.locationName
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
  }

  get manualRequests(): MaintenanceRequestDto[] {
    return this.requests.filter((request) => !this.isScheduledPreventive(request));
  }

  get preventiveProgrammedRequests(): MaintenanceRequestDto[] {
    if (
      this.preventiveProgrammedCacheRequests === this.requests
      && this.preventiveProgrammedCacheAssets === this.assetMap
    ) {
      return this.preventiveProgrammedCacheItems;
    }

    const items = this.requests
      .filter((request) => this.isScheduledPreventive(request) && ['abierto', 'en_proceso'].includes(request.status))
      .sort((a, b) => {
        const assetA = this.assetMap.get(a.asset_id);
        const assetB = this.assetMap.get(b.asset_id);
        return `${assetA?.siteName ?? ''} ${assetA?.areaName ?? ''} ${assetA?.locationName ?? ''} ${assetA?.code ?? ''}`.localeCompare(
          `${assetB?.siteName ?? ''} ${assetB?.areaName ?? ''} ${assetB?.locationName ?? ''} ${assetB?.code ?? ''}`
        );
      });
    this.preventiveProgrammedCacheRequests = this.requests;
    this.preventiveProgrammedCacheAssets = this.assetMap;
    this.preventiveProgrammedCacheItems = items;
    return items;
  }

  get filteredPreventiveRequests(): MaintenanceRequestDto[] {
    const source = this.preventiveProgrammedRequests;
    const term = this.normalize(this.preventiveSearchTerm);
    const filterKey = [
      term,
      this.preventiveSiteFilter,
      this.preventiveAreaFilter,
      this.preventiveLocationFilter,
      this.preventiveStatusFilter
    ].join('|');
    if (
      this.preventiveFilterCacheSource === source
      && this.preventiveFilterCacheAssets === this.assetMap
      && this.preventiveFilterCacheKey === filterKey
    ) {
      return this.preventiveFilterCacheItems;
    }

    const items = source.filter((request) => {
      const asset = this.assetMap.get(request.asset_id);
      if (this.preventiveSiteFilter && asset?.siteName !== this.preventiveSiteFilter) return false;
      if (this.preventiveAreaFilter && asset?.areaName !== this.preventiveAreaFilter) return false;
      if (this.preventiveLocationFilter && asset?.locationName !== this.preventiveLocationFilter) return false;
      if (this.preventiveStatusFilter && request.status !== this.preventiveStatusFilter) return false;
      if (!term) return true;

      const haystack = [
        asset ? this.assetHaystack(asset) : '',
        request.description,
        request.assigned_name,
        request.requester_name,
        request.planned_date,
        request.deadline_date
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
    this.preventiveFilterCacheSource = source;
    this.preventiveFilterCacheAssets = this.assetMap;
    this.preventiveFilterCacheKey = filterKey;
    this.preventiveFilterCacheItems = items;
    return items;
  }

  get preventiveSiteOptions(): string[] {
    return this.preventiveAssetOptions('siteName');
  }

  get preventiveAreaOptions(): string[] {
    return this.preventiveAssetOptions('areaName', (asset) =>
      !this.preventiveSiteFilter || asset.siteName === this.preventiveSiteFilter
    );
  }

  get preventiveLocationOptions(): string[] {
    return this.preventiveAssetOptions('locationName', (asset) =>
      (!this.preventiveSiteFilter || asset.siteName === this.preventiveSiteFilter)
      && (!this.preventiveAreaFilter || asset.areaName === this.preventiveAreaFilter)
    );
  }

  get paginatedPreventiveRequests(): MaintenanceRequestDto[] {
    return paginateMaintenanceItems(this.filteredPreventiveRequests, this.preventivePage, this.preventivePageSize).items;
  }

  get preventiveEffectivePage(): number {
    return paginateMaintenanceItems(this.filteredPreventiveRequests, this.preventivePage, this.preventivePageSize).page;
  }

  get preventivePageCount(): number {
    return paginateMaintenanceItems(this.filteredPreventiveRequests, this.preventivePage, this.preventivePageSize).totalPages;
  }

  get preventivePageStart(): number {
    return paginateMaintenanceItems(this.filteredPreventiveRequests, this.preventivePage, this.preventivePageSize).start;
  }

  get preventivePageEnd(): number {
    return paginateMaintenanceItems(this.filteredPreventiveRequests, this.preventivePage, this.preventivePageSize).end;
  }

  get hasActivePreventiveFilters(): boolean {
    return Boolean(
      this.preventiveSearchTerm.trim()
      || this.preventiveSiteFilter
      || this.preventiveAreaFilter
      || this.preventiveLocationFilter
      || this.preventiveStatusFilter
    );
  }

  resetPreventivePage(): void {
    this.preventivePage = 1;
  }

  onPreventiveSiteFilterChange(): void {
    if (this.preventiveAreaFilter && !this.preventiveAreaOptions.includes(this.preventiveAreaFilter)) {
      this.preventiveAreaFilter = '';
    }
    if (this.preventiveLocationFilter && !this.preventiveLocationOptions.includes(this.preventiveLocationFilter)) {
      this.preventiveLocationFilter = '';
    }
    this.resetPreventivePage();
  }

  onPreventiveAreaFilterChange(): void {
    if (this.preventiveLocationFilter && !this.preventiveLocationOptions.includes(this.preventiveLocationFilter)) {
      this.preventiveLocationFilter = '';
    }
    this.resetPreventivePage();
  }

  clearPreventiveFilters(): void {
    this.preventiveSearchTerm = '';
    this.preventiveSiteFilter = '';
    this.preventiveAreaFilter = '';
    this.preventiveLocationFilter = '';
    this.preventiveStatusFilter = '';
    this.resetPreventivePage();
  }

  goToPreventivePage(page: number): void {
    this.preventivePage = Math.min(this.preventivePageCount, Math.max(1, page));
  }

  onPreventivePageSizeChange(): void {
    this.resetPreventivePage();
  }

  preventiveWindowLabel(request: MaintenanceRequestDto): string {
    if (!request.planned_date && !request.deadline_date) return 'Ventana no registrada';
    const planned = request.planned_date ? new Date(request.planned_date).toLocaleDateString('es-CO') : '-';
    const deadline = request.deadline_date ? new Date(request.deadline_date).toLocaleDateString('es-CO') : '-';
    return `${planned} - ${deadline}`;
  }

  get reportableRequests(): MaintenanceRequestDto[] {
    return this.requests.filter((request) =>
      ['abierto', 'en_proceso'].includes(request.status) || request.id === this.reportRequestId
    );
  }

  setReportSubView(view: 'pendientes_firma' | 'historial'): void {
    this.reportSubView = view;
    this.reportDetail = null;
    this.reportPage = 1;
    const validStatuses = this.reportStatusOptions.map((option) => option.value);
    if (!validStatuses.includes(this.reportStatusFilter)) {
      this.reportStatusFilter = '';
    }
  }

  get reportStatusOptions(): Array<{ value: string; label: string }> {
    if (this.reportSubView === 'historial') {
      return [
        { value: '', label: 'Todos' },
        { value: 'firmado', label: 'Firmados' }
      ];
    }
    return [
      { value: '', label: 'Todos' },
      { value: 'reportado', label: 'Por firmar' },
      { value: 'correccion', label: 'Corrección solicitada' },
      { value: 'espera_repuesto', label: 'En espera de repuesto' },
      { value: 'trazabilidad_repuesto', label: 'Trazabilidad de repuesto' }
    ];
  }

  get filteredReports(): MaintenanceReportDto[] {
    const term = this.normalize(this.reportSearchTerm);
    const filterKey = [
      this.reportSubView,
      term,
      this.reportStatusFilter,
      this.reportSpareFilter,
      this.reportTypeFilter,
      this.reportSiteFilter,
      this.reportAreaFilter,
      this.reportDateFrom,
      this.reportDateTo
    ].join('|');
    if (
      this.reportFilterCacheReports === this.reports
      && this.reportFilterCacheAssets === this.assetMap
      && this.reportFilterCacheKey === filterKey
    ) {
      return this.reportFilterCacheItems;
    }

    const source = this.reportSubView === 'pendientes_firma'
      ? this.pendingSignatureReports
      : this.reportHistory;

    const filtered = source.filter((report) => {
      const reportState = this.reportWorkflowStatus(report);
      if (this.reportStatusFilter && reportState !== this.reportStatusFilter) return false;
      if (this.reportSpareFilter === 'con_repuesto' && !report.requires_spare_parts) return false;
      if (this.reportSpareFilter === 'sin_repuesto' && report.requires_spare_parts) return false;
      if (this.reportTypeFilter && report.type !== this.reportTypeFilter) return false;
      const asset = this.assetMap.get(report.asset_id);
      if (this.reportSiteFilter && asset?.siteName !== this.reportSiteFilter) return false;
      if (this.reportAreaFilter && asset?.areaName !== this.reportAreaFilter) return false;
      const reportDate = report.created_at.slice(0, 10);
      if (this.reportDateFrom && reportDate < this.reportDateFrom) return false;
      if (this.reportDateTo && reportDate > this.reportDateTo) return false;
      if (!term) return true;
      const haystack = [
        report.type,
        reportState,
        report.engineer_name,
        report.summary,
        report.findings,
        report.actions_taken,
        report.asset_status_after,
        report.asset_status_observations,
        report.spare_parts_needed,
        report.correction_reason,
        asset?.code,
        asset?.name,
        asset?.brand,
        asset?.model,
        asset?.serial,
        asset?.siteName,
        asset?.areaName,
        asset?.locationName
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
    this.reportFilterCacheReports = this.reports;
    this.reportFilterCacheAssets = this.assetMap;
    this.reportFilterCacheKey = filterKey;
    this.reportFilterCacheItems = filtered;
    return filtered;
  }

  get reportSiteOptions(): string[] {
    return Array.from(
      new Set(
        this.reports
          .map((report) => this.assetMap.get(report.asset_id)?.siteName)
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  get reportAreaOptions(): string[] {
    const source = this.reportSiteFilter
      ? this.reports.filter((report) => this.assetMap.get(report.asset_id)?.siteName === this.reportSiteFilter)
      : this.reports;
    return Array.from(
      new Set(
        source
          .map((report) => this.assetMap.get(report.asset_id)?.areaName)
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  get paginatedReports(): MaintenanceReportDto[] {
    return paginateMaintenanceItems(this.filteredReports, this.reportPage, this.reportPageSize).items;
  }

  get reportPageCount(): number {
    return paginateMaintenanceItems(this.filteredReports, this.reportPage, this.reportPageSize).totalPages;
  }

  get reportPageStart(): number {
    return paginateMaintenanceItems(this.filteredReports, this.reportPage, this.reportPageSize).start;
  }

  get reportPageEnd(): number {
    return paginateMaintenanceItems(this.filteredReports, this.reportPage, this.reportPageSize).end;
  }

  get hasActiveReportFilters(): boolean {
    return Boolean(
      this.reportSearchTerm.trim()
      || this.reportStatusFilter
      || this.reportTypeFilter
      || this.reportSpareFilter
      || this.reportSiteFilter
      || this.reportAreaFilter
      || this.reportDateFrom
      || this.reportDateTo
    );
  }

  resetReportPage(): void {
    this.reportPage = 1;
  }

  onReportSiteFilterChange(): void {
    if (this.reportAreaFilter && !this.reportAreaOptions.includes(this.reportAreaFilter)) {
      this.reportAreaFilter = '';
    }
    this.resetReportPage();
  }

  clearReportFilters(): void {
    this.reportSearchTerm = '';
    this.reportStatusFilter = '';
    this.reportSpareFilter = '';
    this.reportTypeFilter = '';
    this.reportSiteFilter = '';
    this.reportAreaFilter = '';
    this.reportDateFrom = '';
    this.reportDateTo = '';
    this.resetReportPage();
  }

  goToReportPage(page: number): void {
    this.reportPage = Math.min(this.reportPageCount, Math.max(1, page));
  }

  onReportPageSizeChange(): void {
    this.resetReportPage();
  }

  openReportDetail(report: MaintenanceReportDto): void {
    this.reportDetail = report;
  }

  closeReportDetail(): void {
    this.reportDetail = null;
  }

  assetForReport(report: MaintenanceReportDto): AssetLite | null {
    return this.assetMap.get(report.asset_id) ?? null;
  }

  reportOptionLabels(
    values: string[] | null | undefined,
    options: readonly { value: string; label: string }[]
  ): string[] {
    const labels = new Map(options.map((option) => [option.value, option.label]));
    return this.asStringArray(values).map((value) => labels.get(value) ?? value);
  }

  get pendingSignatureReports(): MaintenanceReportDto[] {
    return this.reports.filter((report) => !report.is_fully_signed);
  }

  get reportHistory(): MaintenanceReportDto[] {
    return this.reports.filter((report) => report.is_fully_signed);
  }

  get sparePartReports(): MaintenanceReportDto[] {
    return this.reports.filter((report) => this.isWaitingSpareReport(report));
  }

  get pendingSpareAssets(): AssetLite[] {
    return this.assets.filter((asset) => asset.status === 'pendiente_repuesto');
  }

  get pendingSpareCases(): PendingSpareCase[] {
    const cases = new Map<string, PendingSpareCase>();
    for (const report of this.sparePartReports) {
      const asset = this.assetMap.get(report.asset_id);
      if (asset && !cases.has(asset.id)) {
        cases.set(asset.id, { asset, report });
      }
    }
    for (const asset of this.pendingSpareAssets) {
      if (!cases.has(asset.id)) {
        cases.set(asset.id, { asset, report: null });
      }
    }
    return Array.from(cases.values()).sort((a, b) =>
      `${a.asset.siteName || ''} ${a.asset.areaName || ''} ${a.asset.code}`.localeCompare(
        `${b.asset.siteName || ''} ${b.asset.areaName || ''} ${b.asset.code}`
      )
    );
  }

  get pendingSpareCount(): number {
    return this.pendingSpareCases.length;
  }

  assignedEngineerLabel(request: MaintenanceRequestDto): string {
    if (!request.assigned_to) return 'Sin asignar';
    if (request.assigned_to === this.auth.currentUser()?.id) return 'Tú';
    return request.assigned_name || 'Otro ingeniero';
  }

  requestAgeLabel(request: MaintenanceRequestDto): string {
    const createdAt = new Date(request.created_at).getTime();
    const elapsedHours = Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000));
    if (elapsedHours < 1) return 'Creada hace menos de una hora';
    if (elapsedHours < 24) return `Creada hace ${elapsedHours} h`;
    const days = Math.floor(elapsedHours / 24);
    return `Creada hace ${days} día${days === 1 ? '' : 's'}`;
  }

  requestAgeClass(request: MaintenanceRequestDto): string {
    if (request.status !== 'abierto') return 'neutral';
    const elapsedHours = Math.max(0, (Date.now() - new Date(request.created_at).getTime()) / 3_600_000);
    if (elapsedHours >= 48) return 'danger';
    if (elapsedHours >= 24) return 'warn';
    return 'neutral';
  }

  preventiveWindowClass(request: MaintenanceRequestDto): string {
    if (!request.deadline_date) return 'neutral';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(`${request.deadline_date.slice(0, 10)}T23:59:59`);
    if (deadline.getTime() < today.getTime()) return 'danger';
    const remainingDays = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
    return remainingDays <= 2 ? 'warn' : 'neutral';
  }

  selectedRequestLabel(requestId: string): string {
    const request = this.requests.find((item) => item.id === requestId);
    return request ? `${request.type} · ${this.assetLabel(request.asset_id)}` : 'Solicitud no encontrada';
  }

  onReportRequestChange(): void {
    if (this.reportFlowMode !== 'normal') {
      return;
    }
    const request = this.selectedReportRequest;
    if (request) {
      this.applyReportDefaults(request);
    }
  }

  get selectedReportRequest(): MaintenanceRequestDto | null {
    return this.requests.find((item) => item.id === this.reportRequestId) ?? null;
  }

  get selectedReportAsset(): AssetLite | null {
    const request = this.selectedReportRequest;
    return request ? this.assetMap.get(request.asset_id) ?? null : null;
  }

  pendingSpareReportForRequest(request: MaintenanceRequestDto): MaintenanceReportDto | null {
    return this.sparePartReports.find((report) => report.request_id === request.id) ?? null;
  }

  openSpareWorkflow(request: MaintenanceRequestDto): void {
    const report = this.pendingSpareReportForRequest(request);
    this.viewMode = 'repuestos';
    if (report) {
      this.successMessage = `Solicitud de repuesto ubicada para ${this.assetLabel(report.asset_id)}.`;
    }
  }

  statusLabel(status?: string | null): string {
    const labels: Record<string, string> = {
      abierto: 'Abierto',
      en_proceso: 'En proceso',
      reportado: 'Reportado',
      firmado: 'Firmado',
      espera_repuesto: 'En espera de repuesto',
      correccion: 'Corrección solicitada',
      vencido: 'Vencido',
      operativo: 'Operativo',
      activo: 'Activo',
      operativo_observacion: 'Operativo con observación',
      pendiente_repuesto: 'Pendiente por repuesto',
      fuera_de_servicio: 'Fuera de servicio',
      dado_de_baja: 'Dado de baja',
      pendiente: 'Pendiente',
      solicitado: 'Repuesto solicitado',
      recibido: 'Repuesto instalado',
      no_aplica: 'No aplica'
    };
    return labels[status || ''] ?? (status || '-');
  }

  statusClass(status?: string | null): string {
    if (!status) return 'neutral';
    if (['firmado', 'operativo', 'activo', 'recibido'].includes(status)) return 'ok';
    if (['abierto', 'reportado', 'operativo_observacion', 'solicitado'].includes(status)) return 'warn';
    if (['en_proceso', 'pendiente', 'pendiente_repuesto', 'espera_repuesto'].includes(status)) return 'pending';
    if (['fuera_de_servicio', 'dado_de_baja', 'vencido', 'correccion'].includes(status)) return 'danger';
    return 'neutral';
  }

  reportSignedDate(report: MaintenanceReportDto): string {
    if (report.correction_requested) {
      return 'Corrección solicitada';
    }
    if (this.isWaitingSpareReport(report)) {
      return report.is_fully_signed ? 'Firmado / En espera de repuesto' : 'Pendiente firma / espera repuesto';
    }
    return report.is_fully_signed ? 'Firmado' : 'Pendiente firma';
  }

  reportSignatureClass(report: MaintenanceReportDto): string {
    if (report.correction_requested) {
      return 'danger';
    }
    if (this.isWaitingSpareReport(report)) {
      return report.is_fully_signed ? 'pending' : 'warn';
    }
    return report.is_fully_signed ? 'ok' : 'warn';
  }

  onSparePartsToggle(): void {
    if (this.reportRequiresSpareParts) {
      this.reportSparePartsStatus = 'solicitado';
      this.reportSparePartResolution = 'request_later';
      return;
    }
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.reportSparePartResolution = 'request_later';
  }

  setReportSparePartResolution(resolution: 'request_later' | 'installed_now'): void {
    if (!this.reportRequiresSpareParts || this.reportFlowMode !== 'normal' || this.reportCorrectionMode) return;
    this.reportSparePartResolution = resolution;
    this.reportSparePartsStatus = resolution === 'installed_now' ? 'recibido' : 'solicitado';
    if (resolution === 'installed_now') {
      this.reportMaintenanceActivities = Array.from(new Set([
        ...this.reportMaintenanceActivities,
        'instalacion_repuesto'
      ]));
      return;
    }
    this.reportMaintenanceActivities = this.reportMaintenanceActivities.filter(
      (activity) => activity !== 'instalacion_repuesto'
    );
  }

  onReportAssetStatusChange(): void {
    if (this.reportAssetStatus === 'operativo') this.reportAssetStatusObservations = '';
  }

  reportSpareStateLabel(): string {
    return this.statusLabel(maintenanceSpareStatusForReport(
      this.reportFlowMode,
      this.reportRequiresSpareParts,
      this.reportCorrectionMode ? this.reportSparePartsStatus : null,
      this.reportSparePartResolution === 'installed_now'
    ));
  }

  reportTypeLabel(): string {
    if (this.reportFlowMode === 'install_spare' || this.reportFlowMode === 'retire_asset') {
      return 'Reporte correctivo';
    }
    const request = this.selectedReportRequest;
    if (!request) return 'Reporte técnico';
    if (request.status === 'espera_repuesto') return 'Reporte correctivo';
    return request.type === 'preventivo' ? 'Reporte preventivo' : 'Reporte correctivo';
  }

  submitReportLabel(): string {
    if (this.reportCorrectionMode) return 'Guardar corrección del reporte';
    if (this.reportFlowMode === 'install_spare') return 'Guardar instalación de repuesto';
    if (this.reportFlowMode === 'retire_asset') return 'Guardar baja técnica';
    const request = this.selectedReportRequest;
    if (request?.type === 'correctivo') return 'Guardar reporte correctivo';
    if (request?.type === 'preventivo') return 'Guardar reporte preventivo';
    return 'Guardar reporte';
  }

  optionChecked(kind: 'checks' | 'activities' | 'tests', value: string): boolean {
    const target = kind === 'checks'
      ? this.reportMaintenanceChecks
      : kind === 'activities'
        ? this.reportMaintenanceActivities
        : this.reportMaintenanceTests;
    return target.includes(value);
  }

  toggleReportOption(kind: 'checks' | 'activities' | 'tests', value: string, checked: boolean): void {
    const current = kind === 'checks'
      ? this.reportMaintenanceChecks
      : kind === 'activities'
        ? this.reportMaintenanceActivities
        : this.reportMaintenanceTests;
    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((item) => item !== value);
    if (kind === 'checks') this.reportMaintenanceChecks = next;
    if (kind === 'activities') this.reportMaintenanceActivities = next;
    if (kind === 'tests') this.reportMaintenanceTests = next;
  }

  startSpareInstallation(report: MaintenanceReportDto): void {
    if (!this.canContinueSpareCase(report)) return;
    this.reportRequestId = report.request_id;
    this.reportFormActive = true;
    this.reportSummary = `Instalación de repuesto para ${this.assetLabel(report.asset_id)}`;
    this.reportFindings = this.previousReportSummary(report);
    this.reportActions = `Se instala el repuesto solicitado: ${report.spare_parts_needed || 'repuesto pendiente de especificar'}.`;
    this.reportAssetStatus = 'operativo';
    this.reportAssetStatusObservations = '';
    this.reportRequiresSpareParts = true;
    this.reportSparePartsNeeded = report.spare_parts_needed || '';
    this.reportSparePartsStatus = 'recibido';
    this.reportSparePartResolution = 'installed_now';
    this.reportMaintenanceChecks = ['revision_visual', 'revision_cables_conexiones'];
    this.reportMaintenanceActivities = ['instalacion_repuesto', 'prueba_funcional_final'];
    this.reportMaintenanceTests = ['encendido_apagado', 'prueba_modos_operacion', 'equipo_operativo_entregado'];
    this.reportFlowMode = 'install_spare';
    this.reportFlowSource = report;
    this.successMessage = 'Cargué la falla anterior. Completa el estado final y guarda el reporte de instalación.';
    this.scrollToReportForm();
  }

  startAssetRetirement(report: MaintenanceReportDto): void {
    if (!this.canContinueSpareCase(report)) return;
    this.reportRequestId = report.request_id;
    this.reportFormActive = true;
    this.reportSummary = `Baja técnica para ${this.assetLabel(report.asset_id)}`;
    this.reportFindings = this.previousReportSummary(report);
    this.reportActions = `Se determina baja técnica del equipo. Motivo sugerido: repuesto no disponible, no viable o costo no conveniente. Repuesto solicitado: ${report.spare_parts_needed || '-'}.`;
    this.reportAssetStatus = 'fuera_de_servicio';
    this.reportAssetStatusObservations = `Equipo fuera de servicio por inviabilidad técnica o económica del repuesto solicitado: ${report.spare_parts_needed || 'sin detalle'}.`;
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.reportSparePartResolution = 'request_later';
    this.reportMaintenanceChecks = ['revision_visual', 'revision_cables_conexiones'];
    this.reportMaintenanceActivities = ['reparacion_componente'];
    this.reportMaintenanceTests = [];
    this.reportFlowMode = 'retire_asset';
    this.reportFlowSource = report;
    this.successMessage = 'Cargué la falla anterior. Revisa la justificación y guarda el reporte de baja técnica.';
    this.scrollToReportForm();
  }

  cancelReportWorkflow(): void {
    this.reportSummary = '';
    this.reportFindings = '';
    this.reportActions = '';
    this.reportAssetStatus = 'operativo';
    this.reportAssetStatusObservations = '';
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.reportSparePartResolution = 'request_later';
    this.resetReportWorkflow();
    this.reportRequestId = '';
    this.reportFormActive = false;
    this.errorMessage = '';
  }

  reportWorkflowTitle(): string {
    if (this.reportFlowMode === 'install_spare') return 'Instalación de repuesto';
    if (this.reportFlowMode === 'retire_asset') return 'Baja técnica del equipo';
    return '';
  }

  reportsForAsset(assetId: string): MaintenanceReportDto[] {
    return this.reports.filter((report) => report.asset_id === assetId);
  }

  historicalReportsForRetiredAsset(assetId: string): MaintenanceReportDto[] {
    const finalReportId = this.retirementReportForAsset(assetId)?.id;
    return this.reportsForAsset(assetId).filter((report) => report.id !== finalReportId);
  }

  retirementReportForAsset(assetId: string): MaintenanceReportDto | null {
    return this.reportsForAsset(assetId).find((report) =>
      this.normalize(`${report.summary || ''} ${report.actions_taken || ''}`).includes('baja tecnica') ||
      report.asset_status_after === 'fuera_de_servicio'
    ) ?? this.reportsForAsset(assetId)[0] ?? null;
  }

  canRemoveRetiredAsset(): boolean {
    return this.auth.hasRole('almacenista') || this.auth.hasRole('superuser');
  }

  async removeRetiredAsset(asset: AssetLite): Promise<void> {
    if (!this.selectedClientId) return;
    if (!confirm(`¿Retirar definitivamente del sistema el equipo ${asset.code} - ${asset.name}?`)) {
      return;
    }
    try {
      await this.biomed.deleteAsset(this.selectedClientId, asset.id);
      await this.loadData();
      this.successMessage = 'Equipo retirado del inventario activo.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo retirar el equipo.';
    }
  }

  async startQrScan(): Promise<void> {
    this.qrScanError = '';
    if (!this.qrScannerSupported) {
      this.qrScanError = 'Este navegador no soporta lectura QR directa. Usa el campo de código manual.';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.qrScanError = 'No se pudo acceder a la cámara en este navegador.';
      return;
    }

    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      this.qrDetector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      this.qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      this.qrScannerActive = true;
      this.refreshViewSoon();
      setTimeout(() => {
        const video = this.qrVideo?.nativeElement;
        if (!video || !this.qrStream) return;
        video.srcObject = this.qrStream;
        void video.play();
        this.scanQrFrame();
      }, 50);
    } catch (error) {
      console.error(error);
      this.stopQrScan();
      this.qrScanError = 'No se pudo iniciar la cámara para leer el QR.';
      this.refreshViewSoon();
    }
  }

  stopQrScan(): void {
    if (this.qrTimer) {
      clearTimeout(this.qrTimer);
      this.qrTimer = null;
    }
    if (this.qrStream) {
      this.qrStream.getTracks().forEach((track) => track.stop());
      this.qrStream = null;
    }
    this.qrScannerActive = false;
  }

  applyManualQrCode(): void {
    if (!this.qrManualCode.trim()) {
      this.qrScanError = 'Escribe o pega el código del equipo.';
      return;
    }
    this.selectAssetFromCode(this.qrManualCode);
  }

  private async scanQrFrame(): Promise<void> {
    if (!this.qrScannerActive || !this.qrDetector || !this.qrVideo?.nativeElement) return;
    try {
      const codes = await this.qrDetector.detect(this.qrVideo.nativeElement);
      const value = codes?.[0]?.rawValue;
      if (value && this.selectAssetFromCode(value)) {
        this.stopQrScan();
        return;
      }
    } catch {
      // La cámara puede entregar frames no listos; seguimos intentando sin ruido al usuario.
    }
    this.qrTimer = setTimeout(() => void this.scanQrFrame(), 450);
  }

  private selectAssetFromCode(rawValue: string): boolean {
    const asset = this.activeAssets.find((item) => maintenanceAssetMatchesLookup(item, rawValue));
    if (!asset) {
      this.qrScanError = 'No encontré un equipo con ese código QR o serial.';
      return false;
    }
    this.requestAssetId = asset.id;
    this.assetSearchTerm = `${asset.code} ${asset.name}`;
    this.qrManualCode = '';
    this.qrScanError = '';
    this.successMessage = `Equipo seleccionado: ${asset.code} - ${asset.name}`;
    this.refreshViewSoon();
    return true;
  }

  private assetHaystack(asset: AssetLite): string {
    return [
      asset.id,
      asset.code,
      asset.name,
      asset.brand,
      asset.model,
      asset.serial,
      asset.status,
      asset.siteName,
      asset.areaName,
      asset.locationName
    ]
      .map((value) => this.normalize(value))
      .join(' ');
  }

  private preventiveAssetOptions(
    field: 'siteName' | 'areaName' | 'locationName',
    matches: (asset: AssetLite) => boolean = () => true
  ): string[] {
    const values = new Set<string>();
    for (const request of this.preventiveProgrammedRequests) {
      const asset = this.assetMap.get(request.asset_id);
      if (!asset || !matches(asset)) continue;
      const value = asset[field];
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  private async blankProtocolErrorMessage(error: any): Promise<string> {
    const fallback = 'No se pudieron generar los protocolos físicos.';
    if (error?.error instanceof Blob) {
      try {
        const text = await error.error.text();
        const parsed = JSON.parse(text);
        return parsed?.message || fallback;
      } catch {
        return fallback;
      }
    }
    return error?.error?.message || error?.message || fallback;
  }

  private normalize(value?: string | null): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  canTakeRequest(request: MaintenanceRequestDto): boolean {
    if (!this.auth.hasPermission('maintenance:report:create')) {
      return false;
    }
    if (['reportado', 'firmado', 'espera_repuesto', 'correccion'].includes(request.status)) {
      return false;
    }
    const currentUserId = this.auth.currentUser()?.id;
    if (!this.auth.hasRole('superuser') && request.assigned_to && request.assigned_to !== currentUserId) {
      return false;
    }
    if (request.status === 'en_proceso') {
      return this.auth.hasRole('superuser') || !request.assigned_to || request.assigned_to === currentUserId;
    }
    return true;
  }

  takeRequestLabel(request: MaintenanceRequestDto): string {
    return request.status === 'en_proceso' ? 'Continuar reporte' : 'Tomar';
  }

  canContinueSpareCase(report: MaintenanceReportDto): boolean {
    if (!this.auth.hasPermission('maintenance:report:create')) return false;
    const request = this.requests.find((item) => item.id === report.request_id);
    if (!request) return false;
    return this.auth.hasRole('superuser')
      || !request.assigned_to
      || request.assigned_to === this.auth.currentUser()?.id;
  }

  spareCaseAssignmentLabel(report: MaintenanceReportDto): string {
    const request = this.requests.find((item) => item.id === report.request_id);
    return request ? this.assignedEngineerLabel(request) : 'otro ingeniero';
  }

  private isScheduledPreventive(request: MaintenanceRequestDto): boolean {
    return request.type === 'preventivo' && request.source === 'cronograma';
  }

  canSignReport(report: MaintenanceReportDto): boolean {
    if (!this.canSignMaintenanceReport()) {
      return false;
    }
    if (report.correction_requested) {
      return false;
    }
    if (report.is_fully_signed) {
      return false;
    }
    if (report.signed_by_me) {
      return false;
    }
    return report.request_status !== 'firmado';
  }

  canRequestReportCorrection(report: MaintenanceReportDto): boolean {
    if (!this.canSignMaintenanceReport()) {
      return false;
    }
    if (report.is_fully_signed || report.signed_by_me || report.correction_requested) {
      return false;
    }
    return report.request_status !== 'firmado';
  }

  canCorrectReport(report: MaintenanceReportDto): boolean {
    if (!report.correction_requested) {
      return false;
    }
    if (!this.auth.hasPermission('maintenance:report:create') && !this.auth.hasRole('superuser')) {
      return false;
    }
    const currentUserId = this.auth.currentUser()?.id;
    return this.auth.hasRole('superuser') || report.created_by === currentUserId;
  }

  private canSignMaintenanceReport(): boolean {
    return this.auth.hasPermission('maintenance:report:sign') ||
      this.auth.hasRole(['almacenista', 'lector', 'viewer', 'superuser']);
  }

  private reportWorkflowStatus(report: MaintenanceReportDto): string {
    if (report.correction_requested) {
      return 'correccion';
    }
    if (report.is_fully_signed) {
      return 'firmado';
    }
    if (this.isWaitingSpareReport(report)) {
      return 'espera_repuesto';
    }
    if (this.isIntermediateSpareRequestReport(report)) {
      return 'trazabilidad_repuesto';
    }
    return report.is_fully_signed ? 'firmado' : report.request_status || 'reportado';
  }

  private isIntermediateSpareRequestReport(report: MaintenanceReportDto): boolean {
    return Boolean(report.requires_spare_parts && report.spare_parts_status !== 'recibido');
  }

  private isWaitingSpareReport(report: MaintenanceReportDto): boolean {
    return Boolean(
      report.requires_spare_parts &&
      report.spare_parts_status !== 'recibido' &&
      report.request_status === 'espera_repuesto' &&
      !this.hasReceivedSpareReport(report)
    );
  }

  private hasReceivedSpareReport(report: MaintenanceReportDto): boolean {
    if (!report.request_id) return false;
    const createdAt = new Date(report.created_at).getTime();
    return this.reports.some((candidate) =>
      candidate.request_id === report.request_id &&
      candidate.id !== report.id &&
      candidate.requires_spare_parts &&
      candidate.spare_parts_status === 'recibido' &&
      new Date(candidate.created_at).getTime() >= createdAt
    );
  }

  private previousReportSummary(report: MaintenanceReportDto): string {
    const lines = [
      'Antecedente del reporte en espera de repuesto:',
      `Resumen: ${report.summary || 'Sin resumen registrado.'}`,
      `Hallazgos: ${report.findings || 'Sin hallazgos registrados.'}`,
      `Acciones previas: ${report.actions_taken || 'Sin acciones registradas.'}`,
      `Repuesto solicitado: ${report.spare_parts_needed || '-'}`
    ];
    return lines.join('\n');
  }

  private resetReportWorkflow(): void {
    this.reportFlowMode = 'normal';
    this.reportFlowSource = null;
    this.reportCorrectionMode = false;
  }

  private asStringArray(value?: string[] | null): string[] {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  }

  private isAssetStatus(value?: string | null): value is 'operativo' | 'operativo_observacion' | 'fuera_de_servicio' {
    return ['operativo', 'operativo_observacion', 'fuera_de_servicio'].includes(value || '');
  }

  private isSpareStatus(value?: string | null): value is 'no_aplica' | 'solicitado' | 'recibido' {
    return ['no_aplica', 'solicitado', 'recibido'].includes(value || '');
  }

  private applyReportDefaults(request: MaintenanceRequestDto): void {
    if (request.type === 'preventivo') {
      this.reportMaintenanceChecks = [
        'revision_visual',
        'revision_cables_conexiones',
        'revision_accesorios',
        'verificacion_alimentacion'
      ];
      this.reportMaintenanceActivities = ['limpieza_externa', 'ajuste_conexiones', 'prueba_funcional_final'];
      this.reportMaintenanceTests = ['encendido_apagado', 'prueba_modos_operacion', 'equipo_operativo_entregado'];
      return;
    }
    this.reportMaintenanceChecks = ['revision_visual', 'revision_cables_conexiones', 'prueba_funcional_inicial'];
    this.reportMaintenanceActivities = [];
    this.reportMaintenanceTests = ['encendido_apagado'];
  }

  private resetReportFields(): void {
    this.reportSummary = '';
    this.reportFindings = '';
    this.reportActions = '';
    this.reportMaintenanceChecks = [];
    this.reportMaintenanceActivities = [];
    this.reportMaintenanceTests = [];
    this.reportAssetStatus = 'operativo';
    this.reportAssetStatusObservations = '';
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.reportSparePartResolution = 'request_later';
    this.resetReportWorkflow();
  }

  private scrollToTop(): void {
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  private scrollToReportForm(): void {
    setTimeout(() => {
      const element = this.reportFormCard?.nativeElement;
      if (element) {
        element.scrollTo({ top: 0, behavior: 'smooth' });
        element.focus({ preventScroll: true });
        return;
      }
    }, 80);
  }

  private clampReportPage(): void {
    this.reportPage = paginateMaintenanceItems(this.filteredReports, this.reportPage, this.reportPageSize).page;
  }

  private scrollToPreventiveProgrammed(): void {
    setTimeout(() => {
      const element = this.preventiveProgrammedCard?.nativeElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      this.scrollToTop();
    }, 120);
  }

  private showAlert(message: string, kind: 'success' | 'error' = 'success'): void {
    this.alertMessage = message;
    this.alertKind = kind;
    this.successMessage = kind === 'success' ? message : '';
    this.errorMessage = kind === 'error' ? message : '';
    setTimeout(() => {
      if (this.alertMessage === message) {
        this.alertMessage = '';
      }
    }, 6500);
  }

  private refreshViewSoon(): void {
    setTimeout(() => {
      if (!this.destroyed) {
        this.cdr.detectChanges();
      }
    }, 0);
  }
}
