import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { MaintenanceService, MaintenanceReportDto, MaintenanceRequestDto } from '../../maintenance/maintenance.service';
import { getPublicBase, joinBase } from '../../core/api-base';

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
}

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent implements OnInit {
  private readonly publicBase = getPublicBase();
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

  requestType: 'preventivo' | 'correctivo' = 'correctivo';
  requestAssetId = '';
  requestDescription = '';

  reportRequestId = '';
  reportSummary = '';
  reportFindings = '';
  reportActions = '';
  viewMode: 'solicitudes' | 'reportes' | 'equipos' = 'solicitudes';

  constructor(
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly biomed: BiomedService,
    private readonly maintenance: MaintenanceService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadClients();
    await this.loadData();
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
        name: asset.name
      }));
      this.assetMap = new Map(this.assets.map((asset) => [asset.id, asset]));
      this.requests = requests;
      this.reports = reports;
      this.requestAssetId = this.assets[0]?.id ?? '';
      this.reportRequestId = this.requests[0]?.id ?? '';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la información de mantenimiento.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
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
      await this.loadData();
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
        actionsTaken: this.reportActions?.trim()
      });
      this.reportSummary = '';
      this.reportFindings = '';
      this.reportActions = '';
      await this.loadData();
      this.successMessage = 'Reporte creado.';
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

  canTakeRequest(request: MaintenanceRequestDto): boolean {
    if (!this.auth.hasPermission('maintenance:report:create')) {
      return false;
    }
    return request.status !== 'en_proceso';
  }

  canSignReport(report: MaintenanceReportDto): boolean {
    if (!this.auth.hasPermission('maintenance:report:sign')) {
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
}
