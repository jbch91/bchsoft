import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssetHistoryItemDto,
  AssetMovementDto,
  BiomedService,
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
  acquisitionDate?: string | null;
  warrantyYears?: number | null;
  hasPendingSpare?: boolean;
}

type LifeSheetCondition =
  | ''
  | 'attention_required'
  | 'pending_spare'
  | 'under_warranty'
  | 'operational'
  | 'operational_observation'
  | 'out_of_service'
  | 'without_current_warranty';

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

export type InventoryPanelMode = 'life_sheets' | 'inventory';

@Component({
  selector: 'app-inventory-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss'
})
export class InventoryPanelComponent implements OnDestroy {
  readonly lifeSheetConditions: readonly {
    value: Exclude<LifeSheetCondition, ''>;
    label: string;
  }[] = [
    { value: 'attention_required', label: 'Requieren atención' },
    { value: 'pending_spare', label: 'Con repuesto pendiente' },
    { value: 'under_warranty', label: 'En garantía' },
    { value: 'operational', label: 'Operativos' },
    { value: 'operational_observation', label: 'Operativos con observaciones' },
    { value: 'out_of_service', label: 'Fuera de servicio' },
    { value: 'without_current_warranty', label: 'Sin garantía vigente' }
  ];
  @Input() items: InventoryPanelItem[] = [];
  @Input() selectedClientId = '';
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Input() canMove = false;
  @Input() canRequestMaintenance = false;
  @Input() showOperationalConditions = false;
  @Input() mode: InventoryPanelMode = 'inventory';
  @Input() viewInModal = false;
  @Input() showRetired = false;
  @Input() title = 'Inventario';
  @Input() emptyMessage = 'Sin equipos registrados.';

  @Output() viewItem = new EventEmitter<InventoryPanelItem>();
  @Output() editItem = new EventEmitter<InventoryPanelItem>();
  @Output() deleteItem = new EventEmitter<InventoryPanelItem>();
  @Output() requestMaintenance = new EventEmitter<InventoryPanelItem>();
  @Output() movedItem = new EventEmitter<void>();

  searchTerm = '';
  filterSite = '';
  filterArea = '';
  filterLocation = '';
  filterStatus = '';
  filterCondition: LifeSheetCondition = '';
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
  private readonly currentDateInBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota'
  }).format(new Date());

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

  get isLifeSheetMode(): boolean {
    return this.mode === 'life_sheets';
  }

  get conditionFilterEnabled(): boolean {
    return this.isLifeSheetMode || this.showOperationalConditions;
  }

  get inventoryAreaCount(): number {
    return this.areaOptions.length;
  }

  get inventoryOperationalCount(): number {
    return this.visibleItems.filter((item) =>
      ['activo', 'operativo'].includes(String(item.status || '').toLowerCase())
    ).length;
  }

  get inventoryWarrantyCount(): number {
    return this.visibleItems.filter((item) => this.isUnderWarranty(item)).length;
  }

  get inventoryPendingSpareCount(): number {
    return this.visibleItems.filter((item) => Boolean(item.hasPendingSpare)).length;
  }

  get inventoryObservationCount(): number {
    return this.visibleItems.filter(
      (item) => String(item.status || '').toLowerCase() === 'operativo_observacion'
    ).length;
  }

  get inventoryOutOfServiceCount(): number {
    return this.visibleItems.filter(
      (item) => String(item.status || '').toLowerCase() === 'fuera_de_servicio'
    ).length;
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

  lifeSheetConditionCount(condition: LifeSheetCondition): number {
    const items = this.visibleItems.filter((item) => this.matchesBaseFilters(item));
    if (!condition) return items.length;
    return items.filter((item) => this.matchesLifeSheetCondition(item, condition)).length;
  }

  lifeSheetConditionLabel(condition: LifeSheetCondition): string {
    if (!condition) return 'Todas';
    return this.lifeSheetConditions.find((option) => option.value === condition)?.label || condition;
  }

  get moveAreasForSite(): MoveAreaOption[] {
    return this.moveAreas.filter((area) => area.site_id === this.moveForm.siteId);
  }

  get moveLocationsForArea(): MoveLocationOption[] {
    return this.moveLocations.filter((location) => location.area_id === this.moveForm.areaId);
  }

  get filteredItems(): InventoryPanelItem[] {
    return this.visibleItems.filter((item) => {
      if (!this.matchesBaseFilters(item)) return false;
      if (this.conditionFilterEnabled && this.filterCondition) {
        return this.matchesLifeSheetCondition(item, this.filterCondition);
      }
      return true;
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

  assetStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, string> = {
      activo: 'Activo',
      operativo: 'Operativo',
      operativo_observacion: 'Operativo con observaciones',
      pendiente_repuesto: 'Pendiente de repuesto',
      fuera_de_servicio: 'Fuera de servicio',
      dado_de_baja: 'Dado de baja'
    };
    return labels[String(status || '').toLowerCase()] || status || 'Sin estado';
  }

  isUnderWarranty(item: InventoryPanelItem): boolean {
    const acquisitionDate = this.dateOnly(item.acquisitionDate);
    const warrantyYears = Number(item.warrantyYears);
    if (
      !acquisitionDate
      || !Number.isInteger(warrantyYears)
      || warrantyYears < 1
      || warrantyYears > 50
    ) {
      return false;
    }
    const releaseDate = new Date(Date.UTC(
      acquisitionDate.getUTCFullYear() + warrantyYears,
      acquisitionDate.getUTCMonth(),
      acquisitionDate.getUTCDate()
    ));
    if (releaseDate.getUTCMonth() !== acquisitionDate.getUTCMonth()) {
      releaseDate.setUTCDate(0);
    }
    return this.formatDateOnly(releaseDate) > this.currentDateInBogota;
  }

  get activeFilters(): { key: string; label: string }[] {
    const filters: { key: string; label: string }[] = [];
    if (this.searchTerm.trim()) filters.push({ key: 'search', label: `Búsqueda: ${this.searchTerm.trim()}` });
    if (this.filterSite) filters.push({ key: 'site', label: `Sede: ${this.filterSite}` });
    if (this.filterArea) filters.push({ key: 'area', label: `Área: ${this.filterArea}` });
    if (this.filterLocation) filters.push({ key: 'location', label: `Ubicación: ${this.filterLocation}` });
    if (this.filterStatus) filters.push({ key: 'status', label: `Estado: ${this.filterStatus}` });
    if (this.filterCondition) {
      filters.push({
        key: 'condition',
        label: `Condición: ${this.lifeSheetConditionLabel(this.filterCondition)}`
      });
    }
    return filters;
  }

  clearFilter(key: string): void {
    if (key === 'search') this.searchTerm = '';
    if (key === 'site') this.filterSite = '';
    if (key === 'area') this.filterArea = '';
    if (key === 'location') this.filterLocation = '';
    if (key === 'status') this.filterStatus = '';
    if (key === 'condition') this.filterCondition = '';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterSite = '';
    this.filterArea = '';
    this.filterLocation = '';
    this.filterStatus = '';
    this.filterCondition = '';
  }

  private matchesBaseFilters(item: InventoryPanelItem): boolean {
    if (this.filterArea && item.areaName !== this.filterArea) return false;
    if (this.filterSite && item.siteName !== this.filterSite) return false;
    if (this.filterLocation && item.locationName !== this.filterLocation) return false;
    if (this.filterStatus && item.status !== this.filterStatus) return false;
    const term = this.normalize(this.searchTerm);
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
  }

  private matchesLifeSheetCondition(
    item: InventoryPanelItem,
    condition: Exclude<LifeSheetCondition, ''>
  ): boolean {
    const status = String(item.status || '').toLowerCase();
    if (condition === 'pending_spare') return Boolean(item.hasPendingSpare);
    if (condition === 'under_warranty') return this.isUnderWarranty(item);
    if (condition === 'operational') return ['activo', 'operativo'].includes(status);
    if (condition === 'operational_observation') return status === 'operativo_observacion';
    if (condition === 'out_of_service') return status === 'fuera_de_servicio';
    if (condition === 'without_current_warranty') return !this.isUnderWarranty(item);
    return Boolean(item.hasPendingSpare)
      || status === 'operativo_observacion'
      || status === 'fuera_de_servicio';
  }

  private dateOnly(value: string | null | undefined): Date | null {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatDateOnly(value: Date): string {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
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
      const result = this.isLifeSheetMode
        ? await this.biomed.listAssetHistory(this.selectedClientId, this.historyAssetId, {
            from: this.historyFrom || undefined,
            to: this.historyTo || undefined,
            order: this.historyOrder,
            limit: this.historyLimit,
            offset: this.historyOffset
          })
        : this.mapMovementHistory(
            await this.biomed.listAssetMovements(
              this.selectedClientId,
              this.historyAssetId,
              this.historyLimit,
              this.historyOffset
            )
          );
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
    await this.loadHistory(true);
    setTimeout(() => {
      const el = document.getElementById(`history-${item.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  async deleteHistoryFile(item: AssetHistoryItemDto): Promise<void> {
    if (!this.selectedClientId || item.item_type !== 'legacy_pdf') return;
    const ok = window.confirm('¿Eliminar este PDF histórico del equipo?');
    if (!ok) return;
    try {
      await this.biomed.deleteAssetHistoryFile(this.selectedClientId, item.id);
      await this.loadHistory(true);
    } catch (error: any) {
      window.alert(error?.error?.message || 'No se pudo eliminar el PDF histórico.');
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

  private mapMovementHistory(rows: AssetMovementDto[]): AssetHistoryItemDto[] {
    return rows.map((movement) => {
      const origin = [
        movement.from_site_name,
        movement.from_area_name,
        movement.from_location_name
      ].filter(Boolean).join(' / ') || 'Sin ubicación anterior';
      const destination = [
        movement.to_site_name,
        movement.to_area_name,
        movement.to_location_name
      ].filter(Boolean).join(' / ') || 'Sin ubicación de destino';
      const details = [
        movement.notes,
        movement.moved_by_name ? `Responsable: ${movement.moved_by_name}` : ''
      ].filter(Boolean).join(' · ');
      return {
        id: movement.id,
        item_type: 'movement_report',
        subtype: 'movement',
        event_date: movement.created_at,
        title: `${origin} -> ${destination}`,
        description: details || null,
        pdf_path: movement.pdf_path ?? null,
        created_at: movement.created_at
      };
    });
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${String(value).replace(/\"/g, '""')}"`;
    const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => escape(cell)).join(','))];
    return lines.join('\n');
  }

  private formatHistoryDate(value: string): string {
    const [year, month, day] = String(value || '').slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
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
