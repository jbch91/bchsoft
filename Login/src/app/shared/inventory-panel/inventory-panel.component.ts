import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiomedService } from '../../biomed/biomed.service';
import { CalibrationReportDto, CalibrationService } from '../../calibration/calibration.service';
import { MaintenanceReportDto, MaintenanceService } from '../../maintenance/maintenance.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InventoryPanelItem {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  siteName?: string | null;
  areaName?: string | null;
  locationName?: string | null;
  status: string;
}

@Component({
  selector: 'app-inventory-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss'
})
export class InventoryPanelComponent {
  @Input() items: InventoryPanelItem[] = [];
  @Input() selectedClientId = '';
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() canEdit = false;
  @Input() title = 'Inventario';
  @Input() emptyMessage = 'Sin equipos registrados.';

  @Output() editItem = new EventEmitter<InventoryPanelItem>();
  @Output() deleteItem = new EventEmitter<InventoryPanelItem>();

  searchTerm = '';
  filterSite = '';
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
    private readonly maintenance: MaintenanceService,
    private readonly calibration: CalibrationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get areaOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.areaName || '').filter(Boolean))).sort();
  }

  get siteOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.siteName || '').filter(Boolean))).sort();
  }

  get locationOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.locationName || '').filter(Boolean))).sort();
  }

  get statusOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.status || '').filter(Boolean))).sort();
  }

  get filteredItems(): InventoryPanelItem[] {
    const term = this.normalize(this.searchTerm);
    return this.items.filter((item) => {
      if (this.filterArea && item.areaName !== this.filterArea) return false;
      if (this.filterSite && item.siteName !== this.filterSite) return false;
      if (this.filterLocation && item.locationName !== this.filterLocation) return false;
      if (this.filterStatus && item.status !== this.filterStatus) return false;
      if (!term) return true;
      const haystack = [
        item.code,
        item.name,
        item.brand,
        item.model,
        item.serial,
        item.siteName,
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
    if (this.searchTerm.trim()) filters.push({ key: 'search', label: `Búsqueda: ${this.searchTerm.trim()}` });
    if (this.filterSite) filters.push({ key: 'site', label: `Sede: ${this.filterSite}` });
    if (this.filterArea) filters.push({ key: 'area', label: `Área: ${this.filterArea}` });
    if (this.filterLocation) filters.push({ key: 'location', label: `Ubicación: ${this.filterLocation}` });
    if (this.filterStatus) filters.push({ key: 'status', label: `Estado: ${this.filterStatus}` });
    return filters;
  }

  clearFilter(key: string): void {
    if (key === 'search') this.searchTerm = '';
    if (key === 'site') this.filterSite = '';
    if (key === 'area') this.filterArea = '';
    if (key === 'location') this.filterLocation = '';
    if (key === 'status') this.filterStatus = '';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterSite = '';
    this.filterArea = '';
    this.filterLocation = '';
    this.filterStatus = '';
  }

  exportInventory(useFiltered: boolean): void {
    const items = useFiltered ? this.filteredItems : this.items;
    const filenameBase = useFiltered ? 'inventario-filtrado' : 'inventario-completo';
    const headers = ['Código', 'Equipo', 'Marca', 'Modelo', 'Serie', 'Sede', 'Área', 'Ubicación', 'Estado operativo'];
    const rows = items.map((item) => [
      item.code,
      item.name,
      item.brand || '',
      item.model || '',
      item.serial || '',
      item.siteName || '',
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
        [headers[7]]: row[7],
        [headers[8]]: row[8]
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

  async downloadPdf(item: InventoryPanelItem): Promise<void> {
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

  async openCalibrationPdf(reportId: string): Promise<void> {
    const blob = await this.calibration.downloadPdf(reportId);
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

  async toggleHistory(item: InventoryPanelItem): Promise<void> {
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
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${String(value).replace(/\"/g, '""')}"`;
    const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => escape(cell)).join(','))];
    return lines.join('\n');
  }

  private normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
  }
}
