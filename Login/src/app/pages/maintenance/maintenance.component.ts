import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { MaintenanceService, MaintenanceReportDto, MaintenanceRequestDto } from '../../maintenance/maintenance.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

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

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  @ViewChild('qrVideo') qrVideo?: ElementRef<HTMLVideoElement>;

  private readonly publicBase = getPublicBase();
  private qrStream: MediaStream | null = null;
  private qrTimer: ReturnType<typeof setTimeout> | null = null;
  private qrDetector: any = null;
  private routeSub: Subscription | null = null;

  loading = false;
  errorMessage = '';
  successMessage = '';

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
  assetSearchTerm = '';
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
  reportAssetStatus: 'operativo' | 'operativo_observacion' | 'fuera_de_servicio' = 'operativo';
  reportRequiresSpareParts = false;
  reportSparePartsNeeded = '';
  reportSparePartsStatus: 'no_aplica' | 'solicitado' | 'recibido' = 'no_aplica';
  reportFlowMode: 'normal' | 'install_spare' | 'retire_asset' = 'normal';
  reportFlowSource: MaintenanceReportDto | null = null;
  reportFormActive = false;
  reportSubView: 'pendientes_firma' | 'historial' = 'pendientes_firma';
  viewMode: 'crear_solicitud' | 'solicitudes' | 'reportes' | 'repuestos' | 'bajas' | 'equipos' = 'crear_solicitud';

  readonly requestStatuses = [
    { value: '', label: 'Todos' },
    { value: 'abierto', label: 'Abierto' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'espera_repuesto', label: 'En espera de repuesto' },
    { value: 'reportado', label: 'Reportado' },
    { value: 'firmado', label: 'Firmado' }
  ];
  readonly assetStatusOptions = [
    { value: 'operativo', label: 'Operativo' },
    { value: 'operativo_observacion', label: 'Operativo con observación' },
    { value: 'fuera_de_servicio', label: 'Fuera de servicio' }
  ];
  readonly spareStatusOptions = [
    { value: 'solicitado', label: 'Solicitar repuesto' },
    { value: 'recibido', label: 'Recibido' }
  ];

  constructor(
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly biomed: BiomedService,
    private readonly maintenance: MaintenanceService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadClients();
    await this.loadData();
    if (!this.auth.hasPermission('maintenance:request:create')) {
      this.viewMode = 'solicitudes';
    }
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      void this.applyRouteIntent(params);
    });
  }

  ngOnDestroy(): void {
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

  async applyRouteIntent(params: ParamMap): Promise<void> {
    const view = params.get('view');
    const requestId = params.get('requestId');
    if (view === 'reportes' && requestId) {
      if (!this.requests.length && this.selectedClientId) {
        await this.loadData();
      }
      const request = this.requests.find((item) => item.id === requestId);
      if (request && request.status === 'abierto') {
        await this.maintenance.assignRequest(requestId);
        await this.loadData();
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
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      const [assets, requests, reports] = await Promise.all([
        this.biomed.listAssets(this.selectedClientId),
        this.maintenance.listRequests(this.selectedClientId),
        this.maintenance.listReports(this.selectedClientId, { order: 'desc' })
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
      this.requests = requests;
      this.reports = reports;
      this.requestAssetId = this.activeAssets[0]?.id ?? '';
      if (this.reportRequestId && !this.requests.some((request) => request.id === this.reportRequestId)) {
        this.reportRequestId = '';
        this.reportFormActive = false;
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la información de mantenimiento.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  activateReportForm(requestId: string, message = ''): void {
    const request = this.requests.find((item) => item.id === requestId);
    if (!request || ['reportado', 'firmado'].includes(request.status)) {
      this.reportFormActive = false;
      this.reportRequestId = '';
      this.viewMode = 'reportes';
      this.errorMessage = 'Esta solicitud ya no está disponible para crear reporte.';
      return;
    }
    if (request.status === 'espera_repuesto') {
      this.openSpareWorkflow(request);
      return;
    }
    this.reportRequestId = requestId;
    this.reportFormActive = true;
    this.viewMode = 'reportes';
    this.resetReportFields();
    if (message) this.successMessage = message;
    this.scrollToTop();
  }

  async createRequest(): Promise<void> {
    if (!this.selectedClientId || !this.requestAssetId) {
      this.errorMessage = 'Selecciona cliente y equipo.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.maintenance.createRequest({
        clientId: this.selectedClientId,
        assetId: this.requestAssetId,
        type: this.requestType,
        description: this.requestDescription?.trim()
      });
      this.requestDescription = '';
      this.requestAssetId = this.activeAssets[0]?.id ?? '';
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
    } catch (error) {
      console.error(error);
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
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.maintenance.createReport({
        requestId: this.reportRequestId,
        summary: this.reportSummary?.trim(),
        findings: this.reportFindings?.trim(),
        actionsTaken: this.reportActions?.trim(),
        assetStatusAfter: this.reportAssetStatus,
        assetLifecycleAction: this.reportFlowMode === 'retire_asset' ? 'retire' : null,
        requiresSpareParts: this.reportRequiresSpareParts,
        sparePartsNeeded: this.reportRequiresSpareParts ? this.reportSparePartsNeeded.trim() : '',
        sparePartsStatus: this.reportRequiresSpareParts ? this.reportSparePartsStatus : 'no_aplica'
      });
      this.reportSummary = '';
      this.reportFindings = '';
      this.reportActions = '';
      this.reportAssetStatus = 'operativo';
      this.reportRequiresSpareParts = false;
      this.reportSparePartsNeeded = '';
      this.reportSparePartsStatus = 'no_aplica';
      this.reportRequestId = '';
      const flowMode = this.reportFlowMode;
      this.resetReportWorkflow();
      this.reportFormActive = false;
      await this.loadData();
      this.successMessage = flowMode === 'install_spare'
        ? 'Reporte de instalación de repuesto creado. El caso salió de pendientes de repuesto.'
        : flowMode === 'retire_asset'
          ? 'Reporte de baja técnica creado. El caso salió de pendientes de repuesto.'
          : 'Reporte creado.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo crear el reporte.';
    }
  }

  async signReport(reportId: string): Promise<void> {
    try {
      await this.maintenance.signReport(reportId);
      await this.loadData();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo firmar el reporte.';
    }
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

  async deleteReport(reportId: string): Promise<void> {
    if (!confirm('¿Eliminar reporte de mantenimiento?')) {
      return;
    }
    try {
      await this.maintenance.deleteReport(reportId);
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

  get retiredAssets(): AssetLite[] {
    return this.assets.filter((asset) => asset.status === 'dado_de_baja');
  }

  get filteredAssets(): AssetLite[] {
    const term = this.normalize(this.assetSearchTerm);
    if (!term) return this.activeAssets;
    return this.activeAssets.filter((asset) => this.assetHaystack(asset).includes(term));
  }

  get selectedRequestAsset(): AssetLite | null {
    return this.assets.find((asset) => asset.id === this.requestAssetId) ?? null;
  }

  get filteredRequests(): MaintenanceRequestDto[] {
    const term = this.normalize(this.requestSearchTerm);
    return this.requests.filter((request) => {
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

  get reportableRequests(): MaintenanceRequestDto[] {
    return this.requests.filter((request) =>
      ['abierto', 'en_proceso'].includes(request.status) || request.id === this.reportRequestId
    );
  }

  get filteredReports(): MaintenanceReportDto[] {
    const term = this.normalize(this.reportSearchTerm);
    const source = this.reportSubView === 'pendientes_firma'
      ? this.pendingSignatureReports
      : this.reportHistory;

    return source.filter((report) => {
      const reportState = this.reportWorkflowStatus(report);
      if (this.reportStatusFilter && reportState !== this.reportStatusFilter) return false;
      if (this.reportSpareFilter === 'con_repuesto' && !report.requires_spare_parts) return false;
      if (this.reportSpareFilter === 'sin_repuesto' && report.requires_spare_parts) return false;
      if (!term) return true;
      const asset = this.assetMap.get(report.asset_id);
      const haystack = [
        report.type,
        reportState,
        report.summary,
        report.findings,
        report.actions_taken,
        report.asset_status_after,
        report.spare_parts_needed,
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

  get reportListCount(): number {
    return this.pendingSignatureReports.length + this.reportHistory.length;
  }

  get pendingSignatureReports(): MaintenanceReportDto[] {
    return this.reports.filter((report) =>
      !this.isWaitingSpareReport(report) &&
      !this.isIntermediateSpareRequestReport(report) &&
      !report.is_fully_signed
    );
  }

  get reportHistory(): MaintenanceReportDto[] {
    return this.reports.filter((report) =>
      !this.isWaitingSpareReport(report) &&
      (report.is_fully_signed || this.isIntermediateSpareRequestReport(report))
    );
  }

  get sparePartReports(): MaintenanceReportDto[] {
    return this.reports.filter((report) => this.isWaitingSpareReport(report));
  }

  get pendingSpareAssets(): AssetLite[] {
    return this.assets.filter((asset) => asset.status === 'pendiente_repuesto');
  }

  selectedRequestLabel(requestId: string): string {
    const request = this.requests.find((item) => item.id === requestId);
    return request ? `${request.type} · ${this.assetLabel(request.asset_id)}` : 'Solicitud no encontrada';
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
      operativo: 'Operativo',
      activo: 'Activo',
      operativo_observacion: 'Operativo con observación',
      pendiente_repuesto: 'Pendiente por repuesto',
      fuera_de_servicio: 'Fuera de servicio',
      dado_de_baja: 'Dado de baja',
      pendiente: 'Pendiente',
      solicitado: 'Repuesto solicitado',
      recibido: 'Recibido',
      no_aplica: 'No aplica'
    };
    return labels[status || ''] ?? (status || '-');
  }

  statusClass(status?: string | null): string {
    if (!status) return 'neutral';
    if (['firmado', 'operativo', 'activo', 'recibido'].includes(status)) return 'ok';
    if (['abierto', 'reportado', 'operativo_observacion', 'solicitado'].includes(status)) return 'warn';
    if (['en_proceso', 'pendiente', 'pendiente_repuesto', 'espera_repuesto'].includes(status)) return 'pending';
    if (status === 'fuera_de_servicio' || status === 'dado_de_baja') return 'danger';
    return 'neutral';
  }

  reportSignedDate(report: MaintenanceReportDto): string {
    if (this.isIntermediateSpareRequestReport(report)) {
      return this.isWaitingSpareReport(report) ? 'En espera de repuesto' : 'Solicitud de repuesto';
    }
    return report.is_fully_signed ? 'Firmado' : 'Pendiente firma';
  }

  reportSignatureClass(report: MaintenanceReportDto): string {
    if (this.isIntermediateSpareRequestReport(report)) {
      return this.isWaitingSpareReport(report) ? 'pending' : 'neutral';
    }
    return report.is_fully_signed ? 'ok' : 'warn';
  }

  onSparePartsToggle(): void {
    if (this.reportRequiresSpareParts) {
      this.reportSparePartsStatus = 'solicitado';
      return;
    }
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
  }

  startSpareInstallation(report: MaintenanceReportDto): void {
    this.reportRequestId = report.request_id;
    this.reportFormActive = true;
    this.reportSummary = `Instalación de repuesto para ${this.assetLabel(report.asset_id)}`;
    this.reportFindings = this.previousReportSummary(report);
    this.reportActions = `Se instala el repuesto solicitado: ${report.spare_parts_needed || 'repuesto pendiente de especificar'}.`;
    this.reportAssetStatus = 'operativo';
    this.reportRequiresSpareParts = true;
    this.reportSparePartsNeeded = report.spare_parts_needed || '';
    this.reportSparePartsStatus = 'recibido';
    this.reportFlowMode = 'install_spare';
    this.reportFlowSource = report;
    this.viewMode = 'reportes';
    this.successMessage = 'Cargué la falla anterior. Completa el estado final y guarda el reporte de instalación.';
    this.scrollToTop();
  }

  startAssetRetirement(report: MaintenanceReportDto): void {
    this.reportRequestId = report.request_id;
    this.reportFormActive = true;
    this.reportSummary = `Baja técnica para ${this.assetLabel(report.asset_id)}`;
    this.reportFindings = this.previousReportSummary(report);
    this.reportActions = `Se determina baja técnica del equipo. Motivo sugerido: repuesto no disponible, no viable o costo no conveniente. Repuesto solicitado: ${report.spare_parts_needed || '-'}.`;
    this.reportAssetStatus = 'fuera_de_servicio';
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.reportFlowMode = 'retire_asset';
    this.reportFlowSource = report;
    this.viewMode = 'reportes';
    this.successMessage = 'Cargué la falla anterior. Revisa la justificación y guarda el reporte de baja técnica.';
    this.scrollToTop();
  }

  cancelReportWorkflow(): void {
    this.reportSummary = '';
    this.reportFindings = '';
    this.reportActions = '';
    this.reportAssetStatus = 'operativo';
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.resetReportWorkflow();
    this.reportRequestId = '';
    this.reportFormActive = false;
  }

  reportWorkflowTitle(): string {
    if (this.reportFlowMode === 'install_spare') return 'Instalación de repuesto';
    if (this.reportFlowMode === 'retire_asset') return 'Baja técnica del equipo';
    return '';
  }

  reportsForAsset(assetId: string): MaintenanceReportDto[] {
    return this.reports.filter((report) => report.asset_id === assetId);
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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
    const value = this.normalize(rawValue);
    const asset = this.activeAssets.find((item) => {
      const candidates = [item.id, item.code, item.serial, `${item.code}-${item.serial}`];
      return candidates.some((candidate) => {
        const normalized = this.normalize(candidate);
        return normalized && (value === normalized || value.includes(normalized));
      });
    });
    if (!asset) {
      this.qrScanError = 'No encontré un equipo con ese código QR o serial.';
      return false;
    }
    this.requestAssetId = asset.id;
    this.assetSearchTerm = `${asset.code} ${asset.name}`;
    this.qrManualCode = '';
    this.qrScanError = '';
    this.successMessage = `Equipo seleccionado: ${asset.code} - ${asset.name}`;
    this.cdr.detectChanges();
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
    if (['reportado', 'firmado', 'espera_repuesto'].includes(request.status)) {
      return false;
    }
    if (request.status === 'en_proceso') {
      const currentUserId = this.auth.currentUser()?.id;
      return this.auth.hasRole('superuser') || !request.assigned_to || request.assigned_to === currentUserId;
    }
    return true;
  }

  takeRequestLabel(request: MaintenanceRequestDto): string {
    return request.status === 'en_proceso' ? 'Continuar reporte' : 'Tomar';
  }

  canSignReport(report: MaintenanceReportDto): boolean {
    if (!this.auth.hasPermission('maintenance:report:sign')) {
      return false;
    }
    if (report.requires_spare_parts && report.spare_parts_status !== 'recibido') {
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

  private reportWorkflowStatus(report: MaintenanceReportDto): string {
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
  }

  private resetReportFields(): void {
    this.reportSummary = '';
    this.reportFindings = '';
    this.reportActions = '';
    this.reportAssetStatus = 'operativo';
    this.reportRequiresSpareParts = false;
    this.reportSparePartsNeeded = '';
    this.reportSparePartsStatus = 'no_aplica';
    this.resetReportWorkflow();
  }

  private scrollToTop(): void {
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }
}
