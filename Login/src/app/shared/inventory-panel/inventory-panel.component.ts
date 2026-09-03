import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
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
  requiresCalibration?: boolean | null;
  calibrationFrequency?: string | null;
}

type LifeSheetCondition =
  | ''
  | 'attention_required'
  | 'pending_spare'
  | 'requires_calibration'
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
type InventoryExportFormat = 'csv' | 'xlsx' | 'pdf';

interface InventoryExportContext {
  title: string;
  clientName: string;
  clientNit: string;
  clientCity: string;
  generatedAt: string;
  generatedDate: Date;
  exportedBy: string;
  scope: string;
  itemCount: number;
  filenameBase: string;
}

@Component({
  selector: 'app-inventory-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-panel.component.html',
  styleUrl: './inventory-panel.component.scss'
})
export class InventoryPanelComponent implements OnDestroy {
  @ViewChild('exportDialog') private exportDialog?: ElementRef<HTMLElement>;
  @ViewChild('traceabilityDialog') private traceabilityDialog?: ElementRef<HTMLElement>;

  readonly lifeSheetConditions: readonly {
    value: Exclude<LifeSheetCondition, ''>;
    label: string;
  }[] = [
    { value: 'attention_required', label: 'Requieren atención' },
    { value: 'pending_spare', label: 'Con repuesto pendiente' },
    { value: 'requires_calibration', label: 'Requieren calibración' },
    { value: 'under_warranty', label: 'En garantía' },
    { value: 'operational', label: 'Operativos' },
    { value: 'operational_observation', label: 'Operativos con observaciones' },
    { value: 'out_of_service', label: 'Fuera de servicio' },
    { value: 'without_current_warranty', label: 'Sin garantía vigente' }
  ];
  @Input() items: InventoryPanelItem[] = [];
  @Input() selectedClientId = '';
  @Input() clientName = '';
  @Input() clientNit = '';
  @Input() clientCity = '';
  @Input() exportedBy = '';
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
  exportFormat: InventoryExportFormat = 'xlsx';
  exportSearchTerm = '';
  exportSite = '';
  exportArea = '';
  exportLocation = '';
  exportCondition: LifeSheetCondition = '';
  exportModalOpen = false;
  exportLoading = false;
  exportError = '';

  historyAssetId = '';
  historyFrom = '';
  historyTo = '';
  historyOrder: 'asc' | 'desc' = 'desc';
  historyItems: AssetHistoryItemDto[] = [];
  historyMovements: AssetMovementDto[] = [];
  traceabilityModalOpen = false;
  historyLoading = false;
  historyError = '';
  historyLoadToken = 0;
  historyLimit = 10;
  historyOffset = 0;
  historyTotal = 0;
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
  private exportTriggerElement: HTMLElement | null = null;
  private traceabilityTriggerElement: HTMLElement | null = null;
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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.exportModalOpen && !this.traceabilityModalOpen) return;
    if (event.key === 'Escape') {
      if (this.exportModalOpen) {
        this.closeExportModal();
      } else {
        this.closeTraceabilityModal();
      }
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = this.exportModalOpen
      ? this.exportDialog?.nativeElement
      : this.traceabilityDialog?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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

  get exportItemCount(): number {
    return this.exportFilteredItems.length;
  }

  get exportSiteOptions(): string[] {
    return this.uniqueExportValues(this.exportSourceItems.map((item) => item.siteName));
  }

  get exportAreaOptions(): string[] {
    return this.uniqueExportValues(
      this.exportSourceItems
        .filter((item) => !this.exportSite || item.siteName === this.exportSite)
        .map((item) => item.areaName)
    );
  }

  get exportLocationOptions(): string[] {
    return this.uniqueExportValues(
      this.exportSourceItems
        .filter((item) => !this.exportSite || item.siteName === this.exportSite)
        .filter((item) => !this.exportArea || item.areaName === this.exportArea)
        .map((item) => item.locationName)
    );
  }

  get exportFilteredItems(): InventoryPanelItem[] {
    const term = this.normalize(this.exportSearchTerm);
    return this.exportSourceItems.filter((item) => {
      if (this.exportSite && item.siteName !== this.exportSite) return false;
      if (this.exportArea && item.areaName !== this.exportArea) return false;
      if (this.exportLocation && item.locationName !== this.exportLocation) return false;
      if (this.exportCondition && !this.matchesLifeSheetCondition(item, this.exportCondition)) {
        return false;
      }
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

  get hasExportFilters(): boolean {
    return Boolean(
      this.exportSearchTerm.trim()
      || this.exportSite
      || this.exportArea
      || this.exportLocation
      || this.exportCondition
    );
  }

  private get exportSourceItems(): InventoryPanelItem[] {
    return this.visibleItems;
  }

  get visibleItems(): InventoryPanelItem[] {
    if (this.showRetired) return this.items;
    return this.items.filter((item) => item.status !== 'dado_de_baja');
  }

  get selectedHistoryAsset(): InventoryPanelItem | null {
    return this.items.find((item) => item.id === this.historyAssetId) ?? null;
  }

  get historyPageNumber(): number {
    return Math.floor(this.historyOffset / this.historyLimit) + 1;
  }

  get historyShowingFrom(): number {
    return this.historyMovements.length ? this.historyOffset + 1 : 0;
  }

  get historyShowingTo(): number {
    return this.historyOffset + this.historyMovements.length;
  }

  get hasTraceabilityFilters(): boolean {
    return Boolean(this.historyFrom || this.historyTo || this.historyOrder !== 'desc');
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

  onExportSiteChange(): void {
    if (this.exportArea && !this.exportAreaOptions.includes(this.exportArea)) {
      this.exportArea = '';
    }
    this.validateExportLocation();
  }

  onExportAreaChange(): void {
    this.validateExportLocation();
  }

  clearExportFilters(): void {
    this.exportSearchTerm = '';
    this.exportSite = '';
    this.exportArea = '';
    this.exportLocation = '';
    this.exportCondition = '';
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
    if (condition === 'requires_calibration') return Boolean(item.requiresCalibration);
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

  openExportModal(): void {
    this.exportTriggerElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.exportError = '';
    this.exportSearchTerm = this.searchTerm;
    this.exportSite = this.filterSite;
    this.exportArea = this.filterArea;
    this.exportLocation = this.filterLocation;
    this.exportCondition = this.conditionFilterEnabled ? this.filterCondition : '';
    this.onExportSiteChange();
    this.exportModalOpen = true;
    setTimeout(() => {
      const dialog = this.exportDialog?.nativeElement;
      dialog?.querySelector<HTMLInputElement>('[data-export-autofocus]')?.focus();
    });
  }

  closeExportModal(): void {
    if (this.exportLoading) return;
    this.hideExportModal();
  }

  async confirmExport(): Promise<void> {
    if (this.exportLoading || this.exportItemCount === 0) return;
    this.exportLoading = true;
    this.exportError = '';
    this.refreshView();
    await this.yieldToBrowser();
    try {
      await this.exportSelectedInventory();
      this.hideExportModal();
    } catch (error) {
      console.error('No se pudo generar la exportación del inventario.', error);
      this.exportError = `No se pudo generar el archivo ${this.exportFormat.toUpperCase()}. Intenta nuevamente.`;
    } finally {
      this.exportLoading = false;
      this.refreshView();
    }
  }

  private hideExportModal(): void {
    this.exportModalOpen = false;
    this.exportError = '';
    const trigger = this.exportTriggerElement;
    this.exportTriggerElement = null;
    setTimeout(() => trigger?.focus());
  }

  async exportInventory(useFiltered: boolean): Promise<void> {
    const items = useFiltered ? this.filteredItems : this.items;
    await this.downloadInventory(items, this.createExportContext(items.length, false));
  }

  async exportSelectedInventory(): Promise<void> {
    const items = this.exportFilteredItems;
    await this.downloadInventory(items, this.createExportContext(items.length, true));
  }

  private async downloadInventory(
    items: InventoryPanelItem[],
    context: InventoryExportContext
  ): Promise<void> {
    const headers = [
      'Código',
      'Equipo',
      'Marca',
      'Modelo',
      'Serie',
      'Sede',
      'Área',
      'Ubicación',
      'Estado operativo',
      'Requiere calibración',
      'Frecuencia calibración'
    ];
    const rows = items.map((item) => [
      item.code,
      item.name,
      item.brand || '',
      item.model || '',
      item.serial || '',
      item.siteName || '',
      item.areaName || '',
      item.locationName || '',
      this.assetStatusLabel(item.status).toUpperCase(),
      item.requiresCalibration ? 'SÍ' : 'NO',
      item.requiresCalibration
        ? String(item.calibrationFrequency || 'NO REGISTRA').toUpperCase()
        : 'NO APLICA'
    ]);

    if (this.exportFormat === 'csv') {
      const metadataHeaders = [
        'Institución',
        'NIT',
        'Ciudad',
        'Generado',
        'Generado por',
        'Alcance',
        'Software'
      ];
      const metadataValues = [
        context.clientName,
        context.clientNit,
        context.clientCity,
        context.generatedAt,
        context.exportedBy,
        context.scope,
        'INBIHOSPITALARIO'
      ];
      const csv = `\uFEFF${this.toCsv(
        [...metadataHeaders, ...headers],
        rows.map((row) => [...metadataValues, ...row])
      )}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, `${context.filenameBase}.csv`);
      return;
    }

    if (this.exportFormat === 'xlsx') {
      const xlsxModule = await import('xlsx');
      const XLSX = (
        (xlsxModule as any).utils
          ? xlsxModule
          : (xlsxModule as any).default
      ) as typeof import('xlsx');
      if (!XLSX?.utils || typeof XLSX.write !== 'function') {
        throw new Error('El módulo de Excel no está disponible.');
      }
      const worksheet = XLSX.utils.aoa_to_sheet([
        [context.title],
        [
          'INSTITUCIÓN', context.clientName, '', '',
          'NIT', context.clientNit,
          'CIUDAD', context.clientCity, ''
        ],
        [
          'GENERADO', context.generatedAt, '', '',
          'GENERADO POR', context.exportedBy, '', '', ''
        ],
        ['ALCANCE', context.scope, '', '', '', '', '', '', ''],
        ['TOTAL DE EQUIPOS', String(context.itemCount), '', '', '', '', '', '', ''],
        [],
        headers,
        ...rows,
        [],
        ['SOFTWARE UTILIZADO', 'INBIHOSPITALARIO', '', '', '', '', '', '', '']
      ]);
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
        { s: { r: 1, c: 7 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
        { s: { r: 2, c: 5 }, e: { r: 2, c: 10 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 10 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 10 } },
        { s: { r: 8 + rows.length, c: 1 }, e: { r: 8 + rows.length, c: 10 } }
      ];
      worksheet['!cols'] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 22 },
        { wch: 24 },
        { wch: 24 },
        { wch: 26 },
        { wch: 22 },
        { wch: 24 }
      ];
      worksheet['!autofilter'] = {
        ref: `A7:K${Math.max(7, 7 + rows.length)}`
      };
      const workbook = XLSX.utils.book_new();
      workbook.Props = {
        Title: context.title,
        Subject: context.scope,
        Author: context.exportedBy,
        Company: context.clientName,
        CreatedDate: context.generatedDate
      };
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario biomédico');
      const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([content], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      this.downloadBlob(blob, `${context.filenameBase}.xlsx`);
      return;
    }

    const [jsPdfModule, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const JsPdfConstructor = (
      (jsPdfModule as any).jsPDF
      || (jsPdfModule as any).default?.jsPDF
      || (jsPdfModule as any).default
    );
    const autoTable = (
      (autoTableModule as any).autoTable
      || (autoTableModule as any).default?.default
      || (autoTableModule as any).default
    );
    if (typeof JsPdfConstructor !== 'function' || typeof autoTable !== 'function') {
      throw new Error('El módulo de PDF no está disponible.');
    }
    const doc = new JsPdfConstructor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const drawHeader = () => {
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 0, pageWidth, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text('INVENTARIO BIOMÉDICO', 10, 9.5);

      doc.setTextColor(31, 41, 55);
      doc.setFontSize(7.5);
      doc.text(`INSTITUCIÓN: ${context.clientName}`, 10, 21);
      doc.text(`NIT: ${context.clientNit}  |  CIUDAD: ${context.clientCity}`, 10, 26);
      doc.text(`GENERADO: ${context.generatedAt}  |  GENERADO POR: ${context.exportedBy}`, 10, 31);
      const scopeLines = doc.splitTextToSize(`ALCANCE: ${context.scope}`, pageWidth - 44);
      doc.text(scopeLines, 10, 36);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL: ${context.itemCount} EQUIPOS`, pageWidth - 10, 21, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    };
    doc.setProperties({
      title: context.title,
      subject: `${context.clientName} - ${context.scope}`,
      author: context.exportedBy,
      creator: 'INBIHOSPITALARIO'
    });
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 43,
      margin: { top: 43, right: 10, bottom: 13, left: 10 },
      theme: 'grid',
      styles: {
        cellPadding: 1.8,
        fontSize: 7,
        overflow: 'ellipsize',
        textColor: [31, 41, 55]
      },
      headStyles: {
        fillColor: [15, 118, 110],
        fontStyle: 'bold',
        textColor: [255, 255, 255]
      },
      alternateRowStyles: { fillColor: [244, 247, 249] },
      willDrawPage: drawHeader,
      didDrawPage: () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `GENERADO CON INBIHOSPITALARIO  |  ${context.clientName}  |  ${context.itemCount} EQUIPOS`,
          10,
          pageHeight - 5
        );
        doc.text(
          `PÁGINA ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth - 10,
          pageHeight - 5,
          { align: 'right' }
        );
      }
    });
    this.downloadBlob(doc.output('blob'), `${context.filenameBase}.pdf`);
  }

  private createExportContext(itemCount: number, useModalFilters: boolean): InventoryExportContext {
    const generatedDate = new Date();
    const generatedAt = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(generatedDate);
    const fileDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota'
    }).format(generatedDate);
    const clientName = this.clientName.trim()
      || `CLIENTE ${this.selectedClientId.slice(0, 8).toUpperCase() || 'ASIGNADO'}`;
    const site = useModalFilters ? this.exportSite : this.filterSite;
    const area = useModalFilters ? this.exportArea : this.filterArea;
    const location = useModalFilters ? this.exportLocation : this.filterLocation;
    const condition = useModalFilters ? this.exportCondition : this.filterCondition;
    const search = (useModalFilters ? this.exportSearchTerm : this.searchTerm).trim();
    const scopeParts = [
      site ? `Sede: ${site}` : '',
      area ? `Área: ${area}` : '',
      location ? `Ubicación: ${location}` : '',
      condition ? `Condición: ${this.lifeSheetConditionLabel(condition)}` : '',
      search ? `Búsqueda: ${search}` : ''
    ].filter(Boolean);
    const scope = scopeParts.join(' | ') || 'Inventario completo autorizado';
    const scopeToken = location
      || area
      || site
      || (condition ? this.lifeSheetConditionLabel(condition) : '')
      || (scopeParts.length ? 'filtrado' : 'completo');
    return {
      title: 'INVENTARIO BIOMÉDICO',
      clientName,
      clientNit: this.clientNit.trim() || 'NO REGISTRA',
      clientCity: this.clientCity.trim() || 'NO REGISTRA',
      generatedAt,
      generatedDate,
      exportedBy: this.exportedBy.trim() || 'USUARIO DEL CLIENTE',
      scope,
      itemCount,
      filenameBase: [
        'inventario-biomedico',
        this.filenameToken(clientName),
        this.filenameToken(scopeToken),
        fileDate
      ].filter(Boolean).join('-')
    };
  }

  private filenameToken(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => revokeObjectUrl(url), 1000);
  }

  private validateExportLocation(): void {
    if (this.exportLocation && !this.exportLocationOptions.includes(this.exportLocation)) {
      this.exportLocation = '';
    }
  }

  private uniqueExportValues(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.map((value) => value || '').filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
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
      this.historyMovements = [];
      this.historyTotal = 0;
      return;
    }
    if (this.historyFrom && this.historyTo && this.historyFrom > this.historyTo) {
      this.historyItems = [];
      this.historyMovements = [];
      this.historyTotal = 0;
      this.historyHasMore = false;
      this.historyError = 'La fecha inicial no puede ser posterior a la fecha final.';
      return;
    }
    if (reset) {
      this.historyOffset = 0;
      this.historyItems = [];
      this.historyMovements = [];
      this.historyTotal = 0;
      this.historyHasMore = true;
    }
    const token = ++this.historyLoadToken;
    this.historyLoading = true;
    this.historyError = '';
    try {
      if (this.isLifeSheetMode) {
        const result = await this.biomed.listAssetHistory(this.selectedClientId, this.historyAssetId, {
            from: this.historyFrom || undefined,
            to: this.historyTo || undefined,
            order: this.historyOrder,
            limit: this.historyLimit,
            offset: this.historyOffset
          });
        if (token !== this.historyLoadToken) return;
        this.historyItems = result;
        this.historyMovements = [];
        this.historyTotal = this.historyOffset + result.length + (result.length === this.historyLimit ? 1 : 0);
        this.historyHasMore = result.length === this.historyLimit;
      } else {
        const movements = await this.biomed.listAssetMovements(
          this.selectedClientId,
          this.historyAssetId,
          {
            from: this.historyFrom || undefined,
            to: this.historyTo || undefined,
            order: this.historyOrder,
            limit: this.historyLimit,
            offset: this.historyOffset
          }
        );
        if (token !== this.historyLoadToken) return;
        this.historyMovements = movements;
        this.historyItems = this.mapMovementHistory(movements);
        this.historyTotal = Number(movements[0]?.total_count || 0);
        this.historyHasMore = this.historyOffset + movements.length < this.historyTotal;
      }
      this.refreshViewSoon();
    } catch (error) {
      console.error(error);
      this.historyItems = [];
      this.historyMovements = [];
      this.historyTotal = 0;
      this.historyHasMore = false;
      this.historyError = 'No se pudo cargar la trazabilidad del equipo. Intenta nuevamente.';
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

  async openTraceability(item: InventoryPanelItem): Promise<void> {
    this.traceabilityTriggerElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.historyAssetId = item.id;
    this.movingAssetId = null;
    this.historyFrom = '';
    this.historyTo = '';
    this.historyOrder = 'desc';
    this.historyError = '';
    this.traceabilityModalOpen = true;
    this.refreshViewSoon();
    await this.loadHistory(true);
    setTimeout(() => {
      this.traceabilityDialog?.nativeElement
        .querySelector<HTMLElement>('[data-traceability-autofocus]')
        ?.focus();
    });
  }

  closeTraceabilityModal(): void {
    this.traceabilityModalOpen = false;
    this.historyLoadToken += 1;
    this.historyLoading = false;
    const trigger = this.traceabilityTriggerElement;
    this.traceabilityTriggerElement = null;
    setTimeout(() => trigger?.focus());
  }

  async clearTraceabilityFilters(): Promise<void> {
    this.historyFrom = '';
    this.historyTo = '';
    this.historyOrder = 'desc';
    await this.loadHistory(true);
  }

  async toggleHistory(item: InventoryPanelItem): Promise<void> {
    if (this.traceabilityModalOpen && this.historyAssetId === item.id) {
      this.closeTraceabilityModal();
      return;
    }
    await this.openTraceability(item);
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
    this.traceabilityModalOpen = false;
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

  movementTypeLabel(movement: AssetMovementDto): string {
    const codeChanged = this.movementCodeChanged(movement);
    const siteChanged = this.movementValueChanged(movement.from_site_name, movement.to_site_name);
    const areaChanged = this.movementValueChanged(movement.from_area_name, movement.to_area_name);
    const locationChanged = this.movementValueChanged(
      movement.from_location_name,
      movement.to_location_name
    );
    if (codeChanged && (siteChanged || areaChanged || locationChanged)) {
      return 'Traslado y cambio de código';
    }
    if (codeChanged) return 'Cambio de código';
    if (siteChanged) return 'Traslado entre sedes';
    if (areaChanged) return 'Cambio de área';
    if (locationChanged) return 'Cambio de ubicación';
    return 'Actualización de inventario';
  }

  movementCodeChanged(movement: AssetMovementDto): boolean {
    return this.movementValueChanged(movement.from_code, movement.to_code);
  }

  movementOrigin(movement: AssetMovementDto): string {
    return this.movementPlace(
      movement.from_site_name,
      movement.from_area_name,
      movement.from_location_name,
      'Sin ubicación anterior registrada'
    );
  }

  movementDestination(movement: AssetMovementDto): string {
    return this.movementPlace(
      movement.to_site_name,
      movement.to_area_name,
      movement.to_location_name,
      'Sin ubicación de destino registrada'
    );
  }

  movementActor(movement: AssetMovementDto): string {
    return movement.moved_by_name?.trim() || 'Usuario no identificado';
  }

  movementRoleLabel(role: string | null | undefined): string {
    const normalized = String(role || '').trim().toLowerCase();
    const labels: Record<string, string> = {
      admin_cliente: 'Administrador del cliente',
      administrador_cliente: 'Administrador del cliente',
      ingeniero_biomedico: 'Ingeniero biomédico',
      jefe_area: 'Jefe o responsable de área',
      almacenista: 'Almacenista',
      superadmin: 'Administrador de la plataforma'
    };
    return labels[normalized] || String(role || '').replace(/_/g, ' ') || 'Rol no registrado';
  }

  private movementValueChanged(
    fromValue: string | null | undefined,
    toValue: string | null | undefined
  ): boolean {
    return this.normalize(fromValue) !== this.normalize(toValue);
  }

  private movementPlace(
    site: string | null | undefined,
    area: string | null | undefined,
    location: string | null | undefined,
    fallback: string
  ): string {
    return [site, area, location]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' / ') || fallback;
  }

  private mapMovementHistory(rows: AssetMovementDto[]): AssetHistoryItemDto[] {
    return rows.map((movement) => {
      const origin = this.movementOrigin(movement);
      const destination = this.movementDestination(movement);
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
    const lines = [headers, ...rows].map((row) => row.map((cell) => escape(cell)).join(','));
    return lines.join('\n');
  }

  private formatHistoryDate(value: string): string {
    const [year, month, day] = String(value || '').slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
  }

  private refreshView(): void {
    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }

  private yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  private refreshViewSoon(): void {
    setTimeout(() => {
      this.refreshView();
    }, 0);
  }
}
