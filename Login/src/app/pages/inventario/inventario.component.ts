import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BiomedService } from '../../biomed/biomed.service';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { MaintenanceService, MaintenanceReportDto } from '../../maintenance/maintenance.service';
import { CalibrationService, CalibrationReportDto } from '../../calibration/calibration.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  areaName?: string | null;
  locationName?: string | null;
  status: string;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent {
  private readonly publicBase = getPublicBase();
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  items: InventoryItem[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';
  filterArea = '';
  filterLocation = '';
  filterStatus = '';
  exportFormat: 'csv' | 'xlsx' | 'pdf' = 'xlsx';
  historyAssetId = '';
  historyFrom = '';
  historyTo = '';
  historyReports: MaintenanceReportDto[] = [];
  historyCalibration: CalibrationReportDto[] = [];
  expandedAssetId: string | null = null;
  historyLoading = false;
  historyCalibrationLoading = false;
  historyLoadToken = 0;
  historyLimit = 4;
  historyOffset = 0;
  historyHasMoreMaintenance = true;
  historyHasMoreCalibration = true;

  constructor(
    private readonly biomed: BiomedService,
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
    private readonly calibration: CalibrationService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {
    void this.init();
  }

  async init(): Promise<void> {
    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await this.loadItems();
      return;
    }

    if (this.auth.hasPermission('clients:manage')) {
      const rows = await this.admin.listClients();
      this.clients = rows.map((row) => ({
        id: row.id,
        name: row.name,
        nit: row.nit,
        city: row.city,
        email: row.email,
        address: row.address ?? null,
        logoPath: row.logo_path ?? null
      }));
      this.selectedClientId = this.clients[0]?.id ?? '';
      if (this.selectedClientId) {
        await this.loadItems();
      }
    }
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) =>
      client.name.toLowerCase().includes(term)
    );
  }

  get selectedClientInfo(): ClientOption | null {
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  async loadItems(): Promise<void> {
    if (!this.selectedClientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const rows = await this.biomed.listAssets(this.selectedClientId);
      this.items = rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        brand: row.brand,
        model: row.model,
        serial: row.serial,
        areaName: row.area_name ?? null,
        locationName: row.location_name ?? null,
        status: row.status
      }));
      if (this.historyAssetId && this.items.some((item) => item.id === this.historyAssetId)) {
        await this.loadHistory();
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar el inventario.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get areaOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.areaName || '').filter(Boolean))).sort();
  }

  get locationOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.locationName || '').filter(Boolean))).sort();
  }

  get statusOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.status || '').filter(Boolean))).sort();
  }

  get filteredItems(): InventoryItem[] {
    const term = this.normalize(this.searchTerm);
    return this.items.filter((item) => {
      if (this.filterArea && item.areaName !== this.filterArea) return false;
      if (this.filterLocation && item.locationName !== this.filterLocation) return false;
      if (this.filterStatus && item.status !== this.filterStatus) return false;
      if (!term) return true;
      const haystack = [
        item.code,
        item.name,
        item.brand,
        item.model,
        item.serial,
        item.areaName,
        item.locationName
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
  }

  get filteredCount(): number {
    return this.filteredItems.length;
  }

  get totalCount(): number {
    return this.items.length;
  }

  get activeFilters(): { key: string; label: string }[] {
    const filters: { key: string; label: string }[] = [];
    if (this.searchTerm.trim()) {
      filters.push({ key: 'search', label: `Búsqueda: ${this.searchTerm.trim()}` });
    }
    if (this.filterArea) {
      filters.push({ key: 'area', label: `Área: ${this.filterArea}` });
    }
    if (this.filterLocation) {
      filters.push({ key: 'location', label: `Ubicación: ${this.filterLocation}` });
    }
    if (this.filterStatus) {
      filters.push({ key: 'status', label: `Estado: ${this.filterStatus}` });
    }
    return filters;
  }

  clearFilter(key: string): void {
    if (key === 'search') this.searchTerm = '';
    if (key === 'area') this.filterArea = '';
    if (key === 'location') this.filterLocation = '';
    if (key === 'status') this.filterStatus = '';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterArea = '';
    this.filterLocation = '';
    this.filterStatus = '';
  }

  exportInventory(useFiltered: boolean): void {
    const items = useFiltered ? this.filteredItems : this.items;
    const filenameBase = useFiltered ? 'inventario-filtrado' : 'inventario-completo';
    const headers = [
      'Código',
      'Equipo',
      'Marca',
      'Modelo',
      'Serie',
      'Área',
      'Ubicación',
      'Estado operativo'
    ];
    const rows = items.map((item) => [
      item.code,
      item.name,
      item.brand || '',
      item.model || '',
      item.serial || '',
      item.areaName || '',
      item.locationName || '',
      item.status || ''
    ]);

    if (this.exportFormat === 'csv') {
      const csv = this.toCsv(headers, rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (this.exportFormat === 'xlsx') {
      const data = rows.map((row) => ({
        [headers[0]]: row[0],
        [headers[1]]: row[1],
        [headers[2]]: row[2],
        [headers[3]]: row[3],
        [headers[4]]: row[4],
        [headers[5]]: row[5],
        [headers[6]]: row[6],
        [headers[7]]: row[7]
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
      XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [headers],
      body: rows
    });
    doc.save(`${filenameBase}.pdf`);
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${String(value).replace(/\"/g, '""')}"`;
    const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => escape(cell)).join(','))];
    return lines.join('\n');
  }

  private normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
  }

  async deleteItem(item: InventoryItem): Promise<void> {
    if (!this.selectedClientId) return;
    await this.biomed.deleteAsset(this.selectedClientId, item.id);
    await this.loadItems();
  }

  async downloadPdf(item: InventoryItem): Promise<void> {
    if (!this.selectedClientId) return;
    const blob = await this.biomed.downloadAssetPdf(this.selectedClientId, item.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async openHistoryHv(): Promise<void> {
    const asset = this.items.find((item) => item.id === this.historyAssetId);
    if (!asset) return;
    await this.downloadPdf(asset);
  }

  async openReportPdf(reportId: string): Promise<void> {
    const blob = await this.maintenance.downloadReportPdf(reportId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async loadHistory(reset = true): Promise<void> {
    if (!this.selectedClientId || !this.historyAssetId) {
      this.historyReports = [];
      this.historyCalibration = [];
      return;
    }
    if (reset) {
      this.historyOffset = 0;
      this.historyReports = [];
      this.historyCalibration = [];
      this.historyHasMoreMaintenance = true;
      this.historyHasMoreCalibration = true;
    }
    const token = ++this.historyLoadToken;
    this.historyLoading = true;
    this.historyCalibrationLoading = true;
    try {
      const [reportsResult, calibrationResult] = await Promise.all([
        this.maintenance.listReports(this.selectedClientId, {
          assetId: this.historyAssetId,
          from: this.historyFrom || undefined,
          to: this.historyTo || undefined,
          order: 'desc',
          limit: this.historyLimit,
          offset: this.historyOffset
        }),
        this.calibration.listReports(this.selectedClientId, this.historyAssetId, this.historyLimit, this.historyOffset)
      ]);

      if (token !== this.historyLoadToken) return;
      this.historyReports = reportsResult;
      this.historyHasMoreMaintenance = reportsResult.length === this.historyLimit;
      this.historyCalibration = calibrationResult;
      this.historyHasMoreCalibration = calibrationResult.length === this.historyLimit;
      this.cdr.detectChanges();
    } catch (error) {
      console.error(error);
      this.historyReports = [];
      this.historyCalibration = [];
      this.cdr.detectChanges();
    } finally {
      if (token === this.historyLoadToken) {
        this.historyLoading = false;
        this.historyCalibrationLoading = false;
      }
    }
  }

  async nextHistoryPage(): Promise<void> {
    if (!this.historyHasMoreMaintenance && !this.historyHasMoreCalibration) return;
    this.historyOffset += this.historyLimit;
    await this.loadHistory(false);
  }

  async prevHistoryPage(): Promise<void> {
    if (this.historyOffset === 0) return;
    this.historyOffset = Math.max(0, this.historyOffset - this.historyLimit);
    await this.loadHistory(false);
  }

  async openCalibrationPdf(reportId: string): Promise<void> {
    const blob = await this.calibration.downloadPdf(reportId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  goEdit(item: InventoryItem): void {
    void this.router.navigate(['/hojas-de-vida'], { queryParams: { assetId: item.id } });
  }

  async toggleHistory(item: InventoryItem): Promise<void> {
    if (this.expandedAssetId === item.id) {
      this.expandedAssetId = null;
      return;
    }
    this.expandedAssetId = item.id;
    this.historyAssetId = item.id;
    this.historyFrom = '';
    this.historyTo = '';
    await this.loadHistory(true);
    setTimeout(() => {
      const el = document.getElementById(`history-${item.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }
}
