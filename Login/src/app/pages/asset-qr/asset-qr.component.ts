import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import type { AssetCategory } from '../../biomed/biomed.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import {
  MaintenanceReportDto,
  MaintenanceRequestDto,
  MaintenanceService,
  PreventiveMaintenanceProgressDto,
  PreventiveProgressItemDto
} from '../../maintenance/maintenance.service';

interface QrAssetView {
  id: string;
  category: AssetCategory;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  status: string | null;
  photoPath: string | null;
  siteName: string | null;
  areaName: string | null;
  locationName: string | null;
}

@Component({
  selector: 'app-asset-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-qr.component.html',
  styleUrl: './asset-qr.component.scss'
})
export class AssetQrComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  private readonly currentPeriod = this.periodInBogota();

  assetId = '';
  clientId = '';
  asset: QrAssetView | null = null;
  requests: MaintenanceRequestDto[] = [];
  reports: MaintenanceReportDto[] = [];
  preventiveProgress: PreventiveMaintenanceProgressDto | null = null;
  loading = true;
  errorMessage = '';
  successMessage = '';
  requestFormOpen = false;
  requestDescription = '';
  requestSaving = false;
  photoFailed = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    public readonly auth: AuthService,
    private readonly biomed: BiomedService,
    private readonly maintenance: MaintenanceService
  ) {}

  async ngOnInit(): Promise<void> {
    this.assetId = this.route.snapshot.paramMap.get('assetId')?.trim() || '';
    this.clientId = this.auth.currentUser()?.clientId || '';
    if (!this.assetId) {
      this.loading = false;
      this.errorMessage = 'El código QR no contiene un equipo válido.';
      return;
    }
    if (!this.clientId) {
      this.loading = false;
      this.errorMessage = 'Abre este QR con un usuario asociado a la institución del equipo.';
      return;
    }
    await this.loadContext();
  }

  get isEngineer(): boolean {
    return this.auth.hasRole('ingeniero_biomedico');
  }

  get isAreaReporter(): boolean {
    return !this.isEngineer && this.auth.hasRole(['responsable_area', 'lector']);
  }

  get isWarehouse(): boolean {
    return !this.isEngineer
      && !this.auth.hasRole(['responsable_area', 'lector'])
      && this.auth.hasRole('almacenista');
  }

  get roleLabel(): string {
    if (this.isEngineer) return 'INGENIERÍA BIOMÉDICA';
    if (this.isAreaReporter) return 'RESPONSABLE DEL ÁREA';
    if (this.isWarehouse) return 'ALMACÉN';
    return 'CONSULTA DEL EQUIPO';
  }

  get activeCorrectiveRequest(): MaintenanceRequestDto | null {
    const priority: Record<string, number> = {
      correccion: 0,
      en_proceso: 1,
      abierto: 2,
      espera_repuesto: 3,
      reportado: 4
    };
    return this.requests
      .filter((request) => request.type === 'correctivo' && priority[request.status] !== undefined)
      .sort((a, b) => {
        const byStatus = priority[a.status] - priority[b.status];
        if (byStatus) return byStatus;
        return this.requestTime(b) - this.requestTime(a);
      })[0] ?? null;
  }

  get activeCorrectiveReport(): MaintenanceReportDto | null {
    const requestId = this.activeCorrectiveRequest?.id;
    if (!requestId) return null;
    return this.reports
      .filter((report) => report.request_id === requestId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  }

  get currentPreventiveItem(): PreventiveProgressItemDto | null {
    const phasePriority: Record<string, number> = {
      in_progress: 0,
      not_started: 1,
      pending_signature: 2,
      waiting_spare: 3,
      warranty: 4,
      completed: 5
    };
    return (this.preventiveProgress?.items ?? [])
      .filter((item) => item.asset_id === this.assetId)
      .filter((item) => String(item.planned_date || '').startsWith(this.currentPeriod))
      .sort((a, b) => phasePriority[a.phase] - phasePriority[b.phase])[0] ?? null;
  }

  get actionablePreventiveItem(): PreventiveProgressItemDto | null {
    const item = this.currentPreventiveItem;
    return item && ['not_started', 'in_progress'].includes(item.phase) && item.request_id
      ? item
      : null;
  }

  get currentPreventiveReport(): MaintenanceReportDto | null {
    const reportId = this.currentPreventiveItem?.report_id;
    return reportId ? this.reports.find((report) => report.id === reportId) ?? null : null;
  }

  get currentPreventiveRequest(): MaintenanceRequestDto | null {
    const requestId = this.currentPreventiveItem?.request_id;
    return requestId ? this.requests.find((request) => request.id === requestId) ?? null : null;
  }

  get hasPendingSpare(): boolean {
    return this.asset?.status === 'pendiente_repuesto'
      || this.activeCorrectiveRequest?.status === 'espera_repuesto'
      || this.reports.some((report) =>
        report.requires_spare_parts && report.spare_parts_status !== 'recibido'
      );
  }

  get pendingSpareRequest(): MaintenanceRequestDto | null {
    const report = this.reports
      .filter((item) => item.requires_spare_parts && item.spare_parts_status !== 'recibido')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (report) {
      return this.requests.find((request) => request.id === report.request_id) ?? null;
    }
    return this.requests.find((request) => request.status === 'espera_repuesto') ?? null;
  }

  get canCreateCorrective(): boolean {
    return this.auth.hasPermission('maintenance:request:create')
      && !this.activeCorrectiveRequest
      && this.asset?.status !== 'dado_de_baja';
  }

  get canSubmitCorrective(): boolean {
    return this.canCreateCorrective
      && !this.requestSaving
      && this.requestDescription.replace(/\s+/g, ' ').trim().length >= 10;
  }

  get photoUrl(): string | null {
    if (!this.asset?.photoPath || this.photoFailed) return null;
    return /^https?:\/\//i.test(this.asset.photoPath)
      ? this.asset.photoPath
      : joinBase(this.publicBase, this.asset.photoPath);
  }

  get maintenanceRoute(): string {
    return this.asset?.category === 'industrial'
      ? '/mantenimiento-industrial'
      : '/mantenimiento';
  }

  async loadContext(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const rawAsset = await this.biomed.getAssetDetails(this.clientId, this.assetId);
      this.asset = this.mapAsset(rawAsset);
      const progressRequest = this.isEngineer
        ? this.maintenance.getPreventiveProgress(
            this.clientId,
            Number(this.currentPeriod.slice(0, 4)),
            Number(this.currentPeriod.slice(5, 7)),
            this.asset.category
          )
        : Promise.resolve(null);
      const [requests, reports, progress] = await Promise.all([
        this.maintenance.listRequests(this.clientId, this.asset.category),
        this.maintenance.listReports(this.clientId, {
          assetId: this.assetId,
          assetCategory: this.asset.category,
          order: 'desc',
          limit: 50
        }),
        progressRequest
      ]);
      this.requests = requests.filter((request) => request.asset_id === this.assetId);
      this.reports = reports.filter((report) => report.asset_id === this.assetId);
      this.preventiveProgress = progress;
    } catch (error: any) {
      const status = Number(error?.status || error?.error?.status || 0);
      this.errorMessage = status === 403
        ? 'Este equipo no corresponde a las áreas o ubicaciones autorizadas para tu usuario.'
        : error?.error?.message || 'No se pudo consultar el equipo asociado al código QR.';
      this.asset = null;
    } finally {
      this.loading = false;
    }
  }

  openRequestForm(): void {
    if (!this.canCreateCorrective) return;
    this.requestFormOpen = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  closeRequestForm(): void {
    if (this.requestSaving) return;
    this.requestFormOpen = false;
    this.requestDescription = '';
  }

  async createCorrectiveRequest(): Promise<void> {
    if (!this.asset || !this.canSubmitCorrective) return;
    const description = this.requestDescription.replace(/\s+/g, ' ').trim();
    this.requestSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.maintenance.createRequest({
        clientId: this.clientId,
        assetId: this.asset.id,
        assetCategory: this.asset.category,
        type: 'correctivo',
        description
      });
      this.requestFormOpen = false;
      this.requestDescription = '';
      await this.loadContext();
      this.successMessage = 'Solicitud correctiva enviada a ingeniería biomédica.';
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo crear la solicitud correctiva.';
    } finally {
      this.requestSaving = false;
    }
  }

  openExistingCorrective(): void {
    const request = this.activeCorrectiveRequest;
    if (!request) return;
    const report = this.activeCorrectiveReport;
    if (request.status === 'espera_repuesto') {
      this.openSpareCase(request);
      return;
    }
    if (report && ['correccion', 'reportado', 'firmado'].includes(request.status)) {
      void this.router.navigate([this.maintenanceRoute], {
        queryParams: { view: 'reportes', reportId: report.id, assetId: this.assetId, source: 'qr' }
      });
      return;
    }
    if (this.isEngineer && this.auth.hasPermission('maintenance:report:create')) {
      void this.router.navigate([this.maintenanceRoute], {
        queryParams: { view: 'reportes', requestId: request.id, assetId: this.assetId, source: 'qr' }
      });
      return;
    }
    void this.router.navigate([this.maintenanceRoute], {
      queryParams: { view: 'solicitudes', assetId: this.assetId, source: 'qr' }
    });
  }

  openPreventive(): void {
    const item = this.actionablePreventiveItem;
    if (!item?.request_id) return;
    void this.router.navigate([this.maintenanceRoute], {
      queryParams: {
        view: 'preventivos',
        requestId: item.request_id,
        assetId: this.assetId,
        qrAction: 'preventive'
      }
    });
  }

  openPreventiveReport(): void {
    const report = this.currentPreventiveReport;
    if (!report) return;
    void this.router.navigate([this.maintenanceRoute], {
      queryParams: { view: 'reportes', reportId: report.id, assetId: this.assetId, source: 'qr' }
    });
  }

  openSpareCase(request: MaintenanceRequestDto | null = this.pendingSpareRequest): void {
    void this.router.navigate([this.maintenanceRoute], {
      queryParams: {
        view: 'repuestos',
        requestId: request?.id || undefined,
        assetId: this.assetId,
        source: 'qr'
      }
    });
  }

  openMaintenance(): void {
    void this.router.navigate([this.maintenanceRoute]);
  }

  openInventory(): void {
    void this.router.navigate(['/inventario'], {
      queryParams: { assetId: this.assetId, source: 'qr' }
    });
  }

  statusLabel(status?: string | null): string {
    const labels: Record<string, string> = {
      activo: 'OPERATIVO',
      operativo: 'OPERATIVO',
      operativo_observacion: 'OPERATIVO CON OBSERVACIÓN',
      pendiente_repuesto: 'PENDIENTE DE REPUESTO',
      fuera_de_servicio: 'FUERA DE SERVICIO',
      dado_de_baja: 'DADO DE BAJA'
    };
    return labels[status || ''] || String(status || 'SIN ESTADO').replaceAll('_', ' ').toUpperCase();
  }

  requestStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      abierto: 'SOLICITUD ABIERTA',
      en_proceso: 'EN PROCESO',
      correccion: 'EN CORRECCIÓN',
      espera_repuesto: 'ESPERANDO REPUESTO',
      reportado: 'PENDIENTE DE FIRMA',
      firmado: 'FINALIZADO'
    };
    return labels[status] || status.replaceAll('_', ' ').toUpperCase();
  }

  preventiveStatusLabel(item: PreventiveProgressItemDto): string {
    const labels: Record<string, string> = {
      not_started: 'POR REALIZAR',
      in_progress: 'EN PROCESO',
      pending_signature: 'PENDIENTE DE FIRMA',
      waiting_spare: 'ESPERANDO REPUESTO',
      warranty: 'EN GARANTÍA',
      completed: 'FINALIZADO'
    };
    return labels[item.phase] || item.phase.replaceAll('_', ' ').toUpperCase();
  }

  formatDate(value?: string | null): string {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
  }

  private mapAsset(asset: any): QrAssetView {
    return {
      id: String(asset.id),
      category: asset.asset_category === 'industrial' ? 'industrial' : 'biomedical',
      code: String(asset.code || 'SIN CÓDIGO'),
      name: String(asset.name || 'EQUIPO SIN NOMBRE'),
      brand: asset.brand || null,
      model: asset.model || null,
      serial: asset.serial || null,
      status: asset.status || null,
      photoPath: asset.photo_path || null,
      siteName: asset.site_name || null,
      areaName: asset.area_name || null,
      locationName: asset.location_name || null
    };
  }

  private requestTime(request: MaintenanceRequestDto): number {
    return new Date(request.updated_at || request.created_at).getTime();
  }

  private periodInBogota(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}`;
  }
}
