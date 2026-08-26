import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssetHistoryItemDto,
  BiomedService,
  HistoricalMaintenanceOccurrenceDto,
  MaintenanceScheduleSyncDto
} from '../../biomed/biomed.service';
import { CalibrationService } from '../../calibration/calibration.service';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { QuickGuidesService } from '../../quick-guides/quick-guides.service';

export interface InventoryPanelItem {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  siteName?: string | null;
  siteId?: string | null;
  areaName?: string | null;
  areaId?: string | null;
  locationName?: string | null;
  locationId?: string | null;
  status: string;
}

interface MoveSiteOption {
  id: string;
  name: string;
}

interface MoveAreaOption {
  id: string;
  name: string;
  site_id: string | null;
}

interface MoveLocationOption {
  id: string;
  name: string;
  area_id: string | null;
}

type HistoryDocumentType =
  | 'maintenance_preventive'
  | 'maintenance_corrective'
  | 'calibration'
  | 'other';

@Component({
  selector: 'app-inventory-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss'
})
export class InventoryPanelComponent implements OnDestroy {
  @Input() items: InventoryPanelItem[] = [];
  @Input() selectedClientId = '';
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() canEdit = false;
  @Input() canMove = false;
  @Input() canUploadHistory = false;
  @Input() viewInModal = false;
  @Input() showRetired = false;
  @Input() title = 'Inventario';
  @Input() emptyMessage = 'Sin equipos registrados.';

  @Output() viewItem = new EventEmitter<InventoryPanelItem>();
  @Output() editItem = new EventEmitter<InventoryPanelItem>();
  @Output() deleteItem = new EventEmitter<InventoryPanelItem>();
  @Output() movedItem = new EventEmitter<void>();

  searchTerm = '';
  filterSite = '';
  filterArea = '';
  filterLocation = '';
  filterStatus = '';
  exportFormat: 'csv' | 'xlsx' | 'pdf' = 'xlsx';

  historyAssetId = '';
  historyFrom = '';
  historyTo = '';
  historyOrder: 'asc' | 'desc' = 'asc';
  historyItems: AssetHistoryItemDto[] = [];
  expandedAssetId: string | null = null;
  historyLoading = false;
  historyLoadToken = 0;
  historyLimit = 4;
  historyOffset = 0;
  historyHasMore = true;
  historyUploadFile: File | null = null;
  historyUploadDate = '';
  historyUploadDocumentType: HistoryDocumentType = 'maintenance_preventive';
  historyUploadTitle = 'Mantenimiento preventivo histórico';
  historyUploadDescription = '';
  historicalMaintenanceOccurrences: HistoricalMaintenanceOccurrenceDto[] = [];
  historicalEvidenceDates: string[] = [];
  selectedHistoricalMaintenanceOccurrenceId = '';
  historicalOccurrencesLoading = false;
  historyUploadLoading = false;
  historyUploadError = '';
  historyUploadSuccess = '';
  movingAssetId: string | null = null;
  moveLoading = false;
  moveError = '';
  moveSuccess = '';
  moveSites: MoveSiteOption[] = [];
  moveAreas: MoveAreaOption[] = [];
  moveLocations: MoveLocationOption[] = [];

  requestDelete(item: InventoryPanelItem): void {
    const label = [item.code, item.name].filter(Boolean).join(' - ');
    const confirmed = window.confirm(
      `¿Eliminar definitivamente ${label || 'este equipo'}? ` +
      'También se eliminarán su hoja de vida, documentos asociados y programaciones del cronograma.'
    );
    if (confirmed) {
      this.deleteItem.emit(item);
    }
  }

  moveForm = {
    code: '',
    siteId: '',
    areaId: '',
    locationId: '',
    notes: ''
  };
  private destroyed = false;
  private historicalOccurrenceLoadToken = 0;
  private readonly maxHistoryPdfBytes = 15 * 1024 * 1024;

  readonly historyDocumentTypeOptions: { value: HistoryDocumentType; label: string }[] = [
    { value: 'maintenance_preventive', label: 'Mantenimiento preventivo' },
    { value: 'maintenance_corrective', label: 'Mantenimiento correctivo' },
    { value: 'calibration', label: 'Calibración' },
    { value: 'other', label: 'Otro documento' }
  ];

  constructor(
    private readonly biomed: BiomedService,
    private readonly maintenance: MaintenanceService,
    private readonly calibration: CalibrationService,
    private readonly quickGuides: QuickGuidesService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroyed = true;
  }

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
    return Array.from(new Set(this.visibleItems.map((item) => item.status || '').filter(Boolean))).sort();
  }

  get moveAreasForSite(): MoveAreaOption[] {
    return this.moveAreas.filter((area) => area.site_id === this.moveForm.siteId);
  }

  get moveLocationsForArea(): MoveLocationOption[] {
    return this.moveLocations.filter((location) => location.area_id === this.moveForm.areaId);
  }

  get filteredItems(): InventoryPanelItem[] {
    const term = this.normalize(this.searchTerm);
    return this.visibleItems.filter((item) => {
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
    return this.visibleItems.length;
  }

  get visibleItems(): InventoryPanelItem[] {
    if (this.showRetired) return this.items;
    return this.items.filter((item) => item.status !== 'dado_de_baja');
  }

  get selectedHistoryAsset(): InventoryPanelItem | null {
    return this.items.find((item) => item.id === this.historyAssetId) ?? null;
  }

  get canUploadHistoryFile(): boolean {
    return this.canUploadHistory;
  }

  get historicalEvidencePendingLabels(): string[] {
    return this.historicalEvidenceDates.map((date) => this.formatHistoryDate(date));
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

  async exportInventory(useFiltered: boolean): Promise<void> {
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
      const XLSX = await import('xlsx');
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

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
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

  async openQuickGuideForAsset(): Promise<void> {
    if (!this.selectedClientId || !this.historyAssetId) return;
    try {
      const blob = await this.quickGuides.downloadAssetGuidePdf(this.selectedClientId, this.historyAssetId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      if (error?.status === 404) {
        window.alert('Este equipo aún no tiene una guía rápida aprobada para su marca y modelo.');
        return;
      }
      window.alert('No se pudo abrir la guía rápida de uso.');
    }
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

  async openMovementPdf(movementId: string): Promise<void> {
    if (!this.selectedClientId) return;
    const blob = await this.biomed.downloadAssetMovementPdf(this.selectedClientId, movementId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async openLegacyPdf(fileId: string): Promise<void> {
    if (!this.selectedClientId) return;
    const blob = await this.biomed.downloadAssetHistoryFilePdf(this.selectedClientId, fileId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async openHistoryItem(item: AssetHistoryItemDto): Promise<void> {
    if (!item.pdf_path) return;
    if (item.item_type === 'maintenance_report') {
      await this.openReportPdf(item.id);
      return;
    }
    if (item.item_type === 'calibration_report') {
      await this.openCalibrationPdf(item.id);
      return;
    }
    if (item.item_type === 'movement_report') {
      await this.openMovementPdf(item.id);
      return;
    }
    await this.openLegacyPdf(item.id);
  }

  historyTypeLabel(item: AssetHistoryItemDto): string {
    if (item.item_type === 'maintenance_report') {
      return item.subtype === 'preventivo' ? 'Mantenimiento preventivo' : 'Mantenimiento correctivo';
    }
    if (item.item_type === 'calibration_report') return 'Calibración';
    if (item.item_type === 'movement_report') return 'Movimiento';
    if (item.subtype === 'maintenance_preventive') return 'Preventivo migrado';
    if (item.subtype === 'maintenance_corrective') return 'Correctivo migrado';
    if (item.subtype === 'calibration') return 'Calibración migrada';
    return 'PDF migrado';
  }

  get eligibleHistoricalMaintenanceOccurrences(): HistoricalMaintenanceOccurrenceDto[] {
    return this.historicalMaintenanceOccurrences.filter((occurrence) => occurrence.eligible);
  }

  get historicalOccurrenceHelp(): string {
    if (this.historyUploadDocumentType !== 'maintenance_preventive') return '';
    if (!this.historyUploadDate) {
      return 'Selecciona la fecha real para buscar la ocurrencia del cronograma de ese mes.';
    }
    if (this.historicalOccurrencesLoading) return 'Buscando ocurrencias del cronograma...';
    if (!this.historicalMaintenanceOccurrences.length) {
      return 'No existe una ocurrencia para ese mes. El PDF se archivará sin modificar el cronograma.';
    }
    if (!this.eligibleHistoricalMaintenanceOccurrences.length) {
      return (
        this.historicalMaintenanceOccurrences[0]?.unavailable_reason ||
        'La ocurrencia encontrada no admite conciliación.'
      );
    }
    return 'Al subir el PDF, esta ocurrencia quedará realizada con la fecha real del documento.';
  }

  historicalOccurrenceLabel(occurrence: HistoricalMaintenanceOccurrenceDto): string {
    const planned = this.formatHistoryDate(occurrence.planned_date);
    const frequency = this.titleCaseLabel(occurrence.frequency);
    const status = this.historyOccurrenceStatusLabel(occurrence.status);
    return `#${occurrence.occurrence_number} · ${planned} · ${frequency} · ${status}`;
  }

  onHistoryDocumentTypeChange(): void {
    this.historyUploadTitle = this.historyDocumentDefaultTitle(this.historyUploadDocumentType);
    this.clearHistoricalOccurrences();
    if (this.historyUploadDocumentType === 'maintenance_preventive' && this.historyUploadDate) {
      void this.loadHistoricalMaintenanceOccurrences();
    }
  }

  onHistoryUploadDateChange(): void {
    this.clearHistoricalOccurrences();
    if (this.historyUploadDocumentType === 'maintenance_preventive' && this.historyUploadDate) {
      void this.loadHistoricalMaintenanceOccurrences();
    }
  }

  private async loadHistoricalMaintenanceOccurrences(): Promise<void> {
    if (!this.selectedClientId || !this.historyAssetId || !this.historyUploadDate) return;
    const token = ++this.historicalOccurrenceLoadToken;
    this.historicalOccurrencesLoading = true;
    this.historyUploadError = '';
    try {
      const rows = await this.biomed.listHistoricalMaintenanceOccurrences(
        this.selectedClientId,
        this.historyAssetId,
        this.historyUploadDate
      );
      if (token !== this.historicalOccurrenceLoadToken) return;
      this.historicalMaintenanceOccurrences = rows;
      const eligible = rows.filter((occurrence) => occurrence.eligible);
      this.selectedHistoricalMaintenanceOccurrenceId = eligible[0]?.id || '';
    } catch (error: any) {
      if (token !== this.historicalOccurrenceLoadToken) return;
      this.historicalMaintenanceOccurrences = [];
      this.selectedHistoricalMaintenanceOccurrenceId = '';
      this.historyUploadError =
        error?.error?.message || 'No se pudieron consultar las ocurrencias del cronograma.';
    } finally {
      if (token === this.historicalOccurrenceLoadToken) {
        this.historicalOccurrencesLoading = false;
        this.refreshViewSoon();
      }
    }
  }

  async loadHistory(reset = true): Promise<void> {
    if (!this.selectedClientId || !this.historyAssetId) {
      this.historyItems = [];
      return;
    }
    if (reset) {
      this.historyOffset = 0;
      this.historyItems = [];
      this.historyHasMore = true;
    }
    const token = ++this.historyLoadToken;
    this.historyLoading = true;
    try {
      const result = await this.biomed.listAssetHistory(this.selectedClientId, this.historyAssetId, {
        from: this.historyFrom || undefined,
        to: this.historyTo || undefined,
        order: this.historyOrder,
        limit: this.historyLimit,
        offset: this.historyOffset
      });
      if (token !== this.historyLoadToken) return;
      this.historyItems = result;
      this.historyHasMore = result.length === this.historyLimit;
      this.refreshViewSoon();
    } catch (error) {
      console.error(error);
      this.historyItems = [];
      this.refreshViewSoon();
    } finally {
      if (token === this.historyLoadToken) {
        this.historyLoading = false;
        this.refreshViewSoon();
      }
    }
  }

  async nextHistoryPage(): Promise<void> {
    if (!this.historyHasMore) return;
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
    this.movingAssetId = null;
    this.historyFrom = '';
    this.historyTo = '';
    this.historyOrder = 'asc';
    this.historicalEvidenceDates = [];
    this.resetHistoryUpload();
    await this.loadHistory(true);
    setTimeout(() => {
      const el = document.getElementById(`history-${item.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  async openHistoricalUpload(item: InventoryPanelItem, plannedDates: string[]): Promise<void> {
    this.expandedAssetId = item.id;
    this.historyAssetId = item.id;
    this.movingAssetId = null;
    this.historyFrom = '';
    this.historyTo = '';
    this.historyOrder = 'asc';
    this.historicalEvidenceDates = Array.from(
      new Set(plannedDates.map((date) => date.slice(0, 10)).filter(Boolean))
    ).sort();
    this.resetHistoryUpload();
    this.historyUploadDate = this.historicalEvidenceDates[0] || '';
    await Promise.all([
      this.loadHistory(true),
      this.loadHistoricalMaintenanceOccurrences()
    ]);
    setTimeout(() => {
      document.getElementById(`history-${item.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 0);
  }

  onHistoryFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.isPdfFile(file)) {
      this.historyUploadFile = null;
      input.value = '';
      this.historyUploadError = 'Solo se permiten archivos PDF.';
      return;
    }
    if (file && file.size > this.maxHistoryPdfBytes) {
      this.historyUploadFile = null;
      input.value = '';
      this.historyUploadError = 'El PDF supera el límite de 15 MB.';
      return;
    }
    this.historyUploadError = '';
    this.historyUploadFile = file;
  }

  async uploadHistoryFile(): Promise<void> {
    if (!this.selectedClientId || !this.historyAssetId) return;
    if (!this.historyUploadDate) {
      this.historyUploadError = 'Selecciona la fecha real del documento.';
      return;
    }
    if (!this.historyUploadFile) {
      this.historyUploadError = 'Selecciona un archivo PDF.';
      return;
    }
    if (
      this.historyUploadDocumentType === 'maintenance_preventive' &&
      this.historicalMaintenanceOccurrences.length &&
      !this.selectedHistoricalMaintenanceOccurrenceId
    ) {
      this.historyUploadError =
        this.historicalMaintenanceOccurrences[0]?.unavailable_reason ||
        'Selecciona una ocurrencia disponible del cronograma.';
      return;
    }
    this.historyUploadLoading = true;
    this.historyUploadError = '';
    this.historyUploadSuccess = '';
    try {
      const result = await this.biomed.uploadAssetHistoryFile(this.selectedClientId, this.historyAssetId, {
        file: this.historyUploadFile,
        documentDate: this.historyUploadDate,
        documentType: this.historyUploadDocumentType,
        maintenanceScheduleItemId: this.selectedHistoricalMaintenanceOccurrenceId || undefined,
        title: this.historyUploadTitle.trim(),
        description: this.historyUploadDescription.trim()
      });
      this.historyUploadSuccess = result.reconciliation
        ? 'Mantenimiento histórico conciliado con el cronograma.'
        : 'PDF histórico archivado correctamente.';
      if (result.reconciliation) {
        const reconciledMonth = result.reconciliation.plannedDate.slice(0, 7);
        const matchingIndex = this.historicalEvidenceDates.findIndex(
          (date) => date.startsWith(reconciledMonth)
        );
        if (matchingIndex >= 0) this.historicalEvidenceDates.splice(matchingIndex, 1);
      }
      this.resetHistoryUpload(true);
      this.historyUploadDate = this.historicalEvidenceDates[0] || '';
      if (this.historyUploadDate) {
        await Promise.all([
          this.loadHistory(true),
          this.loadHistoricalMaintenanceOccurrences()
        ]);
        this.historyUploadSuccess += ` Continúa con ${this.historicalEvidenceDates.length} evidencia(s) pendiente(s).`;
      } else {
        await this.loadHistory(true);
      }
    } catch (error: any) {
      console.error(error);
      this.historyUploadError = error?.error?.message || 'No se pudo cargar el PDF histórico.';
    } finally {
      this.historyUploadLoading = false;
      this.refreshViewSoon();
    }
  }

  async deleteHistoryFile(item: AssetHistoryItemDto): Promise<void> {
    if (!this.selectedClientId || item.item_type !== 'legacy_pdf') return;
    const ok = window.confirm('¿Eliminar este PDF histórico del equipo?');
    if (!ok) return;
    try {
      await this.biomed.deleteAssetHistoryFile(this.selectedClientId, item.id);
      await this.loadHistory(true);
    } catch (error: any) {
      this.historyUploadError = error?.error?.message || 'No se pudo eliminar el PDF histórico.';
    }
  }

  async startMove(item: InventoryPanelItem): Promise<void> {
    if (!this.selectedClientId) return;
    this.expandedAssetId = null;
    this.movingAssetId = item.id;
    this.moveError = '';
    this.moveSuccess = '';
    this.moveForm = {
      code: item.code || '',
      siteId: item.siteId || '',
      areaId: item.areaId || '',
      locationId: item.locationId || '',
      notes: ''
    };
    await this.loadMoveCatalogs();
  }

  cancelMove(): void {
    this.movingAssetId = null;
    this.moveError = '';
    this.moveSuccess = '';
  }

  async loadMoveCatalogs(): Promise<void> {
    if (!this.selectedClientId) return;
    const [sites, areas, locations] = await Promise.all([
      this.biomed.listSites(this.selectedClientId),
      this.biomed.listAreas(this.selectedClientId),
      this.biomed.listLocations(this.selectedClientId)
    ]);
    this.moveSites = sites.map((site) => ({ id: site.id, name: site.name }));
    this.moveAreas = areas.map((area) => ({ id: area.id, name: area.name, site_id: area.site_id }));
    this.moveLocations = locations.map((location) => ({ id: location.id, name: location.name, area_id: location.area_id }));
    if (!this.moveForm.siteId && this.moveSites.length) {
      this.moveForm.siteId = this.moveSites[0].id;
    }
    if (!this.moveAreasForSite.some((area) => area.id === this.moveForm.areaId)) {
      this.moveForm.areaId = this.moveAreasForSite[0]?.id || '';
    }
    if (!this.moveLocationsForArea.some((location) => location.id === this.moveForm.locationId)) {
      this.moveForm.locationId = this.moveLocationsForArea[0]?.id || '';
    }
    this.refreshViewSoon();
  }

  onMoveSiteChange(): void {
    this.moveForm.areaId = this.moveAreasForSite[0]?.id || '';
    this.onMoveAreaChange();
  }

  onMoveAreaChange(): void {
    this.moveForm.locationId = this.moveLocationsForArea[0]?.id || '';
  }

  async submitMove(): Promise<void> {
    if (!this.selectedClientId || !this.movingAssetId) return;
    if (!this.moveForm.code.trim() || !this.moveForm.siteId || !this.moveForm.areaId || !this.moveForm.locationId) {
      this.moveError = 'Completa código, sede, área y ubicación.';
      return;
    }
    this.moveLoading = true;
    this.moveError = '';
    this.moveSuccess = '';
    try {
      const result = await this.biomed.moveAsset(this.selectedClientId, this.movingAssetId, {
        code: this.moveForm.code.trim(),
        siteId: this.moveForm.siteId,
        areaId: this.moveForm.areaId,
        locationId: this.moveForm.locationId,
        notes: this.moveForm.notes.trim()
      });
      this.moveSuccess = `Movimiento guardado y reporte PDF generado.${this.moveScheduleSyncNotice(result.scheduleSync)}`;
      this.movedItem.emit();
      this.movingAssetId = null;
    } catch (error: any) {
      console.error(error);
      this.moveError = error?.error?.message || 'No se pudo guardar el movimiento.';
    } finally {
      this.moveLoading = false;
      this.refreshViewSoon();
    }
  }

  private moveScheduleSyncNotice(sync?: MaintenanceScheduleSyncDto | null): string {
    if (!sync?.schedulesFound) {
      return ' No existe un cronograma vigente para reajustar.';
    }
    if (!sync.itemsRemoved && !sync.itemsAdded) {
      return ' Las fechas ejecutadas o ya iniciadas se conservaron sin cambios.';
    }
    const firstDate = sync.firstPlannedDate
      ? this.formatHistoryDate(sync.firstPlannedDate)
      : '';
    const active = sync.activeItemsAdded
      ? ` ${sync.activeItemsAdded} mantenimiento(s) quedó(aron) activo(s).`
      : '';
    return ` El cronograma aprobado se alineó con el área y ubicación de destino: ${sync.itemsRemoved} fecha(s) anterior(es) reemplazada(s) por ${sync.itemsAdded} fecha(s)${firstDate ? ` desde el ${firstDate}` : ''}.${active}`;
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${String(value).replace(/\"/g, '""')}"`;
    const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => escape(cell)).join(','))];
    return lines.join('\n');
  }

  private resetHistoryUpload(keepSuccess = false): void {
    this.historyUploadFile = null;
    this.historyUploadDate = '';
    this.historyUploadDocumentType = 'maintenance_preventive';
    this.historyUploadTitle = 'Mantenimiento preventivo histórico';
    this.historyUploadDescription = '';
    this.clearHistoricalOccurrences();
    this.historyUploadError = '';
    if (!keepSuccess) this.historyUploadSuccess = '';
  }

  private clearHistoricalOccurrences(): void {
    this.historicalOccurrenceLoadToken += 1;
    this.historicalMaintenanceOccurrences = [];
    this.selectedHistoricalMaintenanceOccurrenceId = '';
    this.historicalOccurrencesLoading = false;
  }

  private historyDocumentDefaultTitle(type: HistoryDocumentType): string {
    return {
      maintenance_preventive: 'Mantenimiento preventivo histórico',
      maintenance_corrective: 'Mantenimiento correctivo histórico',
      calibration: 'Calibración histórica',
      other: 'Documento histórico migrado'
    }[type];
  }

  private historyOccurrenceStatusLabel(status: string): string {
    return {
      pending: 'Programado',
      active: 'Activo',
      expired: 'Vencido',
      done: 'Realizado'
    }[status] || status;
  }

  private formatHistoryDate(value: string): string {
    const [year, month, day] = String(value || '').slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private titleCaseLabel(value: string): string {
    const clean = String(value || '').trim();
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : '-';
  }

  private isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  private normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
  }

  private refreshViewSoon(): void {
    setTimeout(() => {
      if (!this.destroyed) {
        this.cdr.detectChanges();
      }
    }, 0);
  }
}
