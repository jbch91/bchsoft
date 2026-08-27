import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AssetHistoryItemDto,
  type AssetCategory,
  type AssetScheduleEnrollmentMode,
  BiomedService,
  CatalogReviewDto,
  EquipmentCatalogItemDto,
  MaintenancePeriodicityChangeMode,
  MaintenanceScheduleProgrammingItemDto,
  MaintenanceScheduleProgrammingPreviewDto,
  MaintenanceScheduleProgrammingSelectionDto,
  MaintenanceScheduleSyncBatchDto,
  MaintenanceScheduleSyncDto,
  PendingHistoricalProtocolDto
} from '../../biomed/biomed.service';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { InventoryPanelComponent, InventoryPanelItem } from '../../shared/inventory-panel/inventory-panel.component';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { CalibrationService } from '../../calibration/calibration.service';
import { QuickGuidesService } from '../../quick-guides/quick-guides.service';
import { Workbook as ExcelWorkbookConstructor } from 'exceljs';
import type { Workbook as ExcelWorkbook } from 'exceljs';
import * as XLSX from 'xlsx';
import { buildHvImportTemplate } from './hv-import-template';
import {
  isNotRegisteredMarker,
  normalizeOptionalRecordedValue,
  resolveHvCalibrationImport,
  resolveHvRiskImport
} from './hv-import-rules';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

interface SiteOption {
  id: string;
  name: string;
  address?: string | null;
}

interface AreaOption {
  id: string;
  name: string;
  siteId: string | null;
  siteName?: string | null;
}

interface LocationOption {
  id: string;
  name: string;
  areaId: string | null;
  siteId?: string | null;
  siteName?: string | null;
}

interface AssetImportPayload {
  assetCategory: AssetCategory;
  code: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  invimaReg: string;
  siteId: string;
  areaId: string;
  locationId: string;
  requiresSanitaryClassification: boolean;
  riskClass?: string;
  requiresElectricalClassification: boolean;
  electricalProtectionClass?: string;
  appliedPartType?: string;
  isMobile?: boolean;
  manufacturer?: string;
  acquisitionType?: string;
  acquisitionDate?: string;
  usefulLifeYears?: number;
  warrantyYears?: number;
  supplierName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  maintenanceFrequency?: string;
  requiresCalibration?: boolean;
  calibrationFrequency?: string;
}

interface ImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  siteName: string;
  areaName: string;
  locationName: string;
  errors: string[];
  fieldErrors: { field: string; message: string }[];
  originalRow: Record<string, unknown>;
  payload?: AssetImportPayload;
}

interface AssetView extends InventoryPanelItem {
  id: string;
  assetCategory: AssetCategory;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location?: string | null;
  status: string;
  photoPath?: string | null;
  invimaReg?: string | null;
  riskClass?: string | null;
  requiresSanitaryClassification?: boolean;
  requiresElectricalClassification?: boolean;
  electricalProtectionClass?: string | null;
  appliedPartType?: string | null;
  isMobile?: boolean;
  manufacturer?: string | null;
  areaName?: string | null;
  locationName?: string | null;
  siteName?: string | null;
  siteId?: string | null;
  areaId?: string | null;
  locationId?: string | null;
  acquisitionDate?: string | null;
  warrantyYears?: number | null;
  hasPendingSpare?: boolean;
}

type LifeSheetWorkspaceView = 'records' | 'pending_protocols';
type SupplementalDocumentType = 'maintenance_corrective' | 'calibration' | 'other';

@Component({
  selector: 'app-hojas-de-vida',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent, InventoryPanelComponent],
  templateUrl: './hojas-de-vida.component.html',
  styleUrl: './hojas-de-vida.component.scss'
})
export class HojasDeVidaComponent implements OnDestroy {
  readonly assetCategory: AssetCategory;
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  private readonly maxImageSizeMb = 5;
  private readonly maxPdfSizeMb = 10;
  private readonly maxHistoricalPdfBytes = 15 * 1024 * 1024;
  private readonly maxImportRows = 500;
  private readonly maxImportFileSizeMb = 10;
  private pendingRouteAssetId: string | null = null;
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  assets: AssetView[] = [];
  sites: SiteOption[] = [];
  areas: AreaOption[] = [];
  locations: LocationOption[] = [];
  locationsAll: LocationOption[] = [];
  equipmentCatalog: EquipmentCatalogItemDto[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  importPanelOpen = false;
  permissionsRefreshLoading = false;
  assetSaving = false;
  scheduleProgrammingLoading = false;
  scheduleProgrammingPreview: MaintenanceScheduleProgrammingPreviewDto | null = null;
  scheduleProgrammingError = '';
  private originalMaintenanceFrequency = '';
  assetModalMode: 'create' | 'edit' | 'view' | null = null;
  selectedAssetForModal: AssetView | null = null;
  assetDetailsLoading = false;
  detailModalTab: 'summary' | 'history' | 'documents' = 'summary';
  activeLifeSheetView: LifeSheetWorkspaceView = 'records';
  readonly currentProtocolYear = new Date().getFullYear();
  pendingProtocols: PendingHistoricalProtocolDto[] = [];
  pendingProtocolsLoading = false;
  pendingProtocolsError = '';
  pendingProtocolSearch = '';
  pendingProtocolArea = '';
  pendingProtocolMonth = '';
  pendingProtocolUpload: PendingHistoricalProtocolDto | null = null;
  pendingProtocolUploadDate = '';
  pendingProtocolUploadTitle = '';
  pendingProtocolUploadDescription = '';
  pendingProtocolUploadFile: File | null = null;
  pendingProtocolUploadLoading = false;
  pendingProtocolUploadError = '';
  readonly todayInBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota'
  }).format(new Date());
  readonly pendingProtocolMonths = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];
  assetHistoryItems: AssetHistoryItemDto[] = [];
  assetHistoryLoading = false;
  assetHistoryError = '';
  assetHistoryFrom = '';
  assetHistoryTo = '';
  assetHistoryOrder: 'asc' | 'desc' = 'desc';
  assetHistoryLimit = 8;
  assetHistoryOffset = 0;
  assetHistoryHasMore = false;
  supplementalDocumentType: SupplementalDocumentType = 'other';
  supplementalDocumentDate = this.todayInBogota;
  supplementalDocumentTitle = 'Documento técnico del equipo';
  supplementalDocumentDescription = '';
  supplementalDocumentFile: File | null = null;
  supplementalDocumentLoading = false;
  supplementalDocumentError = '';
  supplementalDocumentSuccess = '';
  archivedAssetDocuments: AssetHistoryItemDto[] = [];
  archivedAssetDocumentsLoading = false;
  archivedAssetDocumentsError = '';
  private archivedAssetDocumentsLoaded = false;
  private archivedAssetDocumentsLoadToken = 0;
  readonly supplementalDocumentTypeOptions: {
    value: SupplementalDocumentType;
    label: string;
    defaultTitle: string;
  }[] = [
    {
      value: 'other',
      label: 'Documento técnico u otro soporte',
      defaultTitle: 'Documento técnico del equipo'
    },
    {
      value: 'calibration',
      label: 'Certificado de calibración histórico',
      defaultTitle: 'Certificado de calibración histórico'
    },
    {
      value: 'maintenance_corrective',
      label: 'Reporte correctivo histórico',
      defaultTitle: 'Reporte de mantenimiento correctivo histórico'
    }
  ];
  private assetHistoryLoadToken = 0;
  private lastPermissionRefreshAt = 0;
  private readonly permissionRefreshCooldownMs = 15_000;
  private readonly handleWindowFocus = () => {
    void this.refreshCurrentPermissions(false);
  };
  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.refreshCurrentPermissions(false);
    }
  };
  formMode: 'full' | 'wizard' = 'wizard';
  wizardStep = 0;
  readonly wizardSteps = [
    'Datos del equipo',
    'Datos de adquisición',
    'Mantenimiento y calibración',
    'Componentes del equipo',
    'Documentación técnica',
    'Limpieza y desinfección',
    'Recomendaciones',
    'Resumen'
  ];
  readonly biomedicalImportHeaders = [
    'Código*',
    'Nombre*',
    'Marca*',
    'Modelo*',
    'Serie*',
    'Sede*',
    'Área*',
    'Ubicación*',
    'Registro Invima*',
    'Requiere riesgo sanitario*',
    'Clasificación riesgo sanitario',
    'Requiere riesgo eléctrico*',
    'Clase protección eléctrica',
    'Tipo parte aplicada',
    'Fabricante',
    'Tipo equipo',
    'Forma adquisición',
    'Fecha adquisición',
    'Vida útil años',
    'Garantía años',
    'Proveedor',
    'Teléfono proveedor',
    'Correo proveedor',
    'Frecuencia mantenimiento',
    'Requiere calibración',
    'Frecuencia calibración'
  ];
  readonly industrialImportHeaders = [
    'Código*',
    'Nombre*',
    'Marca*',
    'Modelo*',
    'Serie*',
    'Sede*',
    'Área*',
    'Ubicación*',
    'Fabricante',
    'Tipo equipo',
    'Forma adquisición',
    'Fecha adquisición',
    'Vida útil años',
    'Garantía años',
    'Proveedor',
    'Teléfono proveedor',
    'Correo proveedor',
    'Frecuencia mantenimiento'
  ];
  readonly acquisitionTypes = ['COMPRA DIRECTA', 'DONACION'];
  readonly riskClasses = ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'];
  readonly electricalProtectionClasses = ['Clase I', 'Clase II', 'Energizado internamente'];
  readonly appliedPartTypes = ['No aplica', 'Tipo B', 'Tipo BF', 'Tipo CF'];
  readonly frequencyOptions = ['mensual', 'bimensual', 'trimestral', 'cuatrimestral', 'semestral', 'anual'];
  readonly equipmentTypeOptions = ['Fijo', 'Móvil'];
  readonly warrantyYearOptions = [1, 2, 3];

  editingAssetId: string | null = null;
  code = '';
  name = '';
  brand = '';
  model = '';
  private catalogEquipmentSelectionKey = '';
  private catalogBrandSelectionKey = '';
  serial = '';
  invimaReg = '';
  acquisitionType = 'COMPRA DIRECTA';
  contractText = '';
  acquisitionDate = '';
  usefulLifeYears: number | null = null;
  warrantyYears: number | null = null;
  supplierName = '';
  supplierPhone = '';
  supplierEmail = '';
  powerType = 'AC';
  voltage = '';
  tempMin: number | null = null;
  tempMax: number | null = null;
  humidityMin: number | null = null;
  humidityMax: number | null = null;
  maintenanceFrequency = 'mensual';
  scheduleEnrollmentMode: AssetScheduleEnrollmentMode = 'new';
  requiresCalibration = false;
  calibrationFrequency = 'anual';
  siteId = '';
  areaId = '';
  locationId = '';
  requiresSanitaryClassification = true;
  riskClass = 'Clase I';
  requiresElectricalClassification = false;
  electricalProtectionClass = '';
  appliedPartType = '';
  isMobile = false;
  manufacturer = '';
  photo: File | null = null;
  photoPreviewUrl: string | null = null;
  manualOperacion: File | null = null;
  manualServicio: File | null = null;

  accessories: { name: string; quantity: number; brand?: string; serial?: string }[] = [];
  cleaning: { procedure: string; frequency?: string; responsible?: string }[] = [];
  recommendations: { text: string }[] = [];
  importPreviewRows: ImportPreviewRow[] = [];
  importOriginalHeaders: string[] = [];
  importFileName = '';
  importMessage = '';
  importMessageType: 'info' | 'success' | 'error' = 'info';
  importReading = false;
  importLoading = false;
  importTemplateLoading = false;

  constructor(
    private readonly biomed: BiomedService,
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
    private readonly calibration: CalibrationService,
    private readonly quickGuides: QuickGuidesService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute
  ) {
    this.assetCategory = this.route.snapshot.data['assetCategory'] === 'industrial'
      ? 'industrial'
      : 'biomedical';
    if (this.assetCategory === 'industrial') {
      this.wizardSteps[2] = 'Mantenimiento';
    }
    void this.init();
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.route.queryParams.subscribe((params) => {
      const assetId = typeof params['assetId'] === 'string' ? params['assetId'] : '';
      if (assetId) {
        this.pendingRouteAssetId = assetId;
        void this.openPendingRouteAsset();
      }
    });
  }

  get isIndustrialAssetModule(): boolean {
    return this.assetCategory === 'industrial';
  }

  get importHeaders(): readonly string[] {
    return this.isIndustrialAssetModule
      ? this.industrialImportHeaders
      : this.biomedicalImportHeaders;
  }

  get lifeSheetTitle(): string {
    return this.isIndustrialAssetModule ? 'Hojas de vida industriales' : 'Hojas de vida';
  }

  get inventoryTitle(): string {
    return this.isIndustrialAssetModule
      ? 'Hojas de vida industriales registradas'
      : 'Hojas de vida registradas';
  }

  ngOnDestroy(): void {
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  setFormMode(mode: 'full' | 'wizard'): void {
    this.formMode = mode;
    if (mode === 'wizard') {
      this.wizardStep = 0;
    }
  }

  showSection(index: number): boolean {
    return this.formMode === 'full' || this.wizardStep === index;
  }

  canProceedStep(): boolean {
    if (this.formMode !== 'wizard') return true;
    if (this.wizardStep === 0) {
      return Boolean(
        this.name &&
          this.brand &&
          this.model &&
          this.serial &&
          this.siteId &&
          this.areaId &&
          this.locationId &&
          this.code &&
          (this.isIndustrialAssetModule || this.invimaReg) &&
          (this.isIndustrialAssetModule || !this.requiresSanitaryClassification || this.riskClass) &&
          (this.isIndustrialAssetModule || !this.requiresElectricalClassification || (this.electricalProtectionClass && this.appliedPartType))
      );
    }
    return true;
  }

  isLastStep(): boolean {
    return this.wizardStep >= this.wizardSteps.length - 1;
  }

  nextStep(): void {
    if (!this.isLastStep()) {
      this.wizardStep += 1;
    }
  }

  prevStep(): void {
    if (this.wizardStep > 0) {
      this.wizardStep -= 1;
    }
  }

  async init(): Promise<void> {
    await this.refreshCurrentPermissions(false);

    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await this.onClientChange();
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
        await this.onClientChange();
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

  async onClientChange(): Promise<void> {
    this.closePendingProtocolUpload(true);
    await this.loadSites();
    await Promise.all([
      this.loadAreas(),
      this.loadEquipmentCatalog(),
      this.loadAssets(),
      this.loadPendingProtocols()
    ]);
    await this.openPendingRouteAsset();
  }

  setLifeSheetView(view: LifeSheetWorkspaceView): void {
    this.activeLifeSheetView = view;
    if (view === 'pending_protocols' && !this.pendingProtocolsLoading) {
      void this.loadPendingProtocols();
    }
  }

  get canUploadHistoricalProtocols(): boolean {
    return this.auth.hasPermission('asset_history:upload');
  }

  get pendingProtocolAreas(): string[] {
    return Array.from(
      new Set(this.pendingProtocols.map((item) => item.area_name || '').filter(Boolean))
    ).sort();
  }

  get filteredPendingProtocols(): PendingHistoricalProtocolDto[] {
    const term = this.pendingProtocolSearch.toLocaleLowerCase('es-CO').trim();
    return this.pendingProtocols.filter((item) => {
      if (this.pendingProtocolArea && item.area_name !== this.pendingProtocolArea) return false;
      if (this.pendingProtocolMonth && item.planned_date.slice(5, 7) !== this.pendingProtocolMonth) {
        return false;
      }
      if (!term) return true;
      return [item.code, item.name, item.brand, item.model, item.serial, item.area_name, item.location_name]
        .map((value) => String(value || '').toLocaleLowerCase('es-CO'))
        .join(' ')
        .includes(term);
    });
  }

  get pendingProtocolEquipmentCount(): number {
    return new Set(this.pendingProtocols.map((item) => item.asset_id)).size;
  }

  get pendingProtocolEligibleCount(): number {
    return this.pendingProtocols.filter((item) => item.eligible).length;
  }

  get pendingProtocolOldestDate(): string {
    return this.pendingProtocols[0]?.planned_date || '';
  }

  clearPendingProtocolFilters(): void {
    this.pendingProtocolSearch = '';
    this.pendingProtocolArea = '';
    this.pendingProtocolMonth = '';
  }

  pendingProtocolStateLabel(item: PendingHistoricalProtocolDto): string {
    if (!item.eligible) return item.schedule_status === 'draft' ? 'Cronograma sin aprobar' : 'No conciliable';
    return 'Pendiente de PDF';
  }

  async loadPendingProtocols(): Promise<void> {
    if (!this.selectedClientId) {
      this.pendingProtocols = [];
      return;
    }
    this.pendingProtocolsLoading = true;
    this.pendingProtocolsError = '';
    try {
      this.pendingProtocols = await this.biomed.listPendingHistoricalProtocols(
        this.selectedClientId,
        { year: this.currentProtocolYear, assetCategory: this.assetCategory }
      );
    } catch (error) {
      console.error(error);
      this.pendingProtocols = [];
      this.pendingProtocolsError = 'No se pudieron cargar los protocolos pendientes.';
    } finally {
      this.pendingProtocolsLoading = false;
      this.cdr.detectChanges();
    }
  }

  get pendingProtocolUploadMinDate(): string {
    if (!this.pendingProtocolUpload?.planned_date) return '';
    return `${this.pendingProtocolUpload.planned_date.slice(0, 7)}-01`;
  }

  get pendingProtocolUploadMaxDate(): string {
    if (!this.pendingProtocolUpload?.planned_date) return '';
    const [year, month] = this.pendingProtocolUpload.planned_date
      .slice(0, 7)
      .split('-')
      .map(Number);
    const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return monthEnd < this.todayInBogota ? monthEnd : this.todayInBogota;
  }

  openPendingProtocolUpload(protocol: PendingHistoricalProtocolDto): void {
    if (!this.canUploadHistoricalProtocols || !protocol.eligible) return;
    this.pendingProtocolUpload = protocol;
    this.pendingProtocolUploadDate = protocol.planned_date.slice(0, 10);
    this.pendingProtocolUploadTitle = `Mantenimiento preventivo - ${this.formatProtocolMonth(protocol.planned_date)}`;
    this.pendingProtocolUploadDescription = '';
    this.pendingProtocolUploadFile = null;
    this.pendingProtocolUploadLoading = false;
    this.pendingProtocolUploadError = '';
    this.cdr.detectChanges();
  }

  closePendingProtocolUpload(force = false): void {
    if (this.pendingProtocolUploadLoading && !force) return;
    this.pendingProtocolUpload = null;
    this.pendingProtocolUploadDate = '';
    this.pendingProtocolUploadTitle = '';
    this.pendingProtocolUploadDescription = '';
    this.pendingProtocolUploadFile = null;
    this.pendingProtocolUploadLoading = false;
    this.pendingProtocolUploadError = '';
  }

  onPendingProtocolFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const validationError = this.historicalPdfSelectionError(file);
    if (validationError) {
      this.pendingProtocolUploadFile = null;
      this.pendingProtocolUploadError = validationError;
      input.value = '';
      return;
    }
    this.pendingProtocolUploadFile = file;
    this.pendingProtocolUploadError = '';
  }

  async uploadPendingProtocolPdf(): Promise<void> {
    const protocol = this.pendingProtocolUpload;
    if (!protocol || !this.selectedClientId || this.pendingProtocolUploadLoading) return;
    if (!this.pendingProtocolUploadDate) {
      this.pendingProtocolUploadError = 'Selecciona la fecha real del mantenimiento.';
      return;
    }
    if (this.pendingProtocolUploadDate.slice(0, 7) !== protocol.planned_date.slice(0, 7)) {
      this.pendingProtocolUploadError = 'La fecha real debe permanecer dentro del mes programado.';
      return;
    }
    if (this.pendingProtocolUploadDate > this.todayInBogota) {
      this.pendingProtocolUploadError = 'La fecha del mantenimiento no puede estar en el futuro.';
      return;
    }
    const fileError = this.historicalPdfSelectionError(this.pendingProtocolUploadFile);
    if (fileError) {
      this.pendingProtocolUploadError = fileError;
      return;
    }
    if (!this.pendingProtocolUploadTitle.trim()) {
      this.pendingProtocolUploadError = 'Escribe un título para identificar el protocolo.';
      return;
    }

    this.pendingProtocolUploadLoading = true;
    this.pendingProtocolUploadError = '';
    try {
      await this.biomed.uploadAssetHistoryFile(this.selectedClientId, protocol.asset_id, {
        file: this.pendingProtocolUploadFile!,
        documentDate: this.pendingProtocolUploadDate,
        documentType: 'maintenance_preventive',
        maintenanceScheduleItemId: protocol.id,
        title: this.pendingProtocolUploadTitle.trim(),
        description: this.pendingProtocolUploadDescription.trim() || undefined
      });
      const equipmentLabel = `${protocol.code} - ${protocol.name}`;
      this.closePendingProtocolUpload(true);
      await this.loadPendingProtocols();
      this.activeLifeSheetView = 'pending_protocols';
      this.successMessage = `Protocolo de ${equipmentLabel} cargado y conciliado con el cronograma.`;
    } catch (error) {
      console.error(error);
      this.pendingProtocolUploadError = this.extractErrorMessage(error)
        || 'No se pudo cargar ni conciliar el protocolo.';
    } finally {
      this.pendingProtocolUploadLoading = false;
      this.cdr.detectChanges();
    }
  }

  formatProtocolMonth(value: string): string {
    const [year, month] = value.slice(0, 7).split('-').map(Number);
    if (!year || !month) return value;
    return new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  formatHistoricalPdfFile(file: File | null): string {
    if (!file) return 'Ningún archivo seleccionado';
    return `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  }

  private historicalPdfSelectionError(file: File | null): string | null {
    if (!file) return 'Selecciona el archivo PDF.';
    const isPdf = file.type === 'application/pdf' || file.name.toLocaleLowerCase('es-CO').endsWith('.pdf');
    if (!isPdf) return 'El archivo debe estar en formato PDF.';
    if (file.size > this.maxHistoricalPdfBytes) return 'El PDF supera el límite permitido de 15 MB.';
    return null;
  }

  get equipmentCatalogNames(): string[] {
    return this.equipmentCatalog.map((item) => item.name);
  }

  get equipmentCatalogBrands(): string[] {
    return this.findCatalogEquipment(this.name)?.brands.map((brand) => brand.name) ?? [];
  }

  get equipmentCatalogModels(): string[] {
    const equipment = this.findCatalogEquipment(this.name);
    const brand = equipment?.brands.find(
      (item) => this.normalizeCatalogSelection(item.name) === this.normalizeCatalogSelection(this.brand)
    );
    return brand?.models.map((model) => model.name) ?? [];
  }

  onEquipmentCatalogChange(): void {
    const nextKey = this.normalizeCatalogSelection(this.name);
    if (nextKey !== this.catalogEquipmentSelectionKey) {
      this.brand = '';
      this.model = '';
      this.catalogBrandSelectionKey = '';
    }
    this.catalogEquipmentSelectionKey = nextKey;
  }

  onBrandCatalogChange(): void {
    const nextKey = `${this.normalizeCatalogSelection(this.name)}|${this.normalizeCatalogSelection(this.brand)}`;
    if (nextKey !== this.catalogBrandSelectionKey) {
      this.model = '';
    }
    this.catalogBrandSelectionKey = nextKey;
  }

  private async openPendingRouteAsset(): Promise<void> {
    if (!this.pendingRouteAssetId || !this.selectedClientId) {
      return;
    }
    const assetId = this.pendingRouteAssetId;
    this.pendingRouteAssetId = null;
    await this.openViewModal({ id: assetId } as InventoryPanelItem);
  }

  getSelectedSiteName(): string {
    return this.sites.find((site) => site.id === this.siteId)?.name ?? '-';
  }

  getSelectedAreaName(): string {
    return this.areas.find((area) => area.id === this.areaId)?.name ?? '-';
  }

  getSelectedLocationName(): string {
    return this.locations.find((location) => location.id === this.locationId)?.name ?? '-';
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  get importHasRows(): boolean {
    return this.importPreviewRows.length > 0;
  }

  get importHasErrors(): boolean {
    return this.importPreviewRows.some((row) => row.errors.length > 0);
  }

  get importValidRowsCount(): number {
    return this.importPreviewRows.filter((row) => row.payload && !row.errors.length).length;
  }

  get importErrorRowsCount(): number {
    return this.importPreviewRows.filter((row) => row.errors.length > 0).length;
  }

  get canOpenFormTab(): boolean {
    return this.auth.hasPermission('hb:create') || this.auth.hasPermission('hb:import');
  }

  get canImportAssets(): boolean {
    return this.auth.hasPermission('hb:import');
  }

  get canRefreshTemporaryPermissions(): boolean {
    return this.auth.isAuthenticated()
      && (this.auth.hasRole('ingeniero_biomedico') || Boolean(this.auth.currentUser()?.clientId));
  }

  get canCreateAssets(): boolean {
    return this.auth.hasPermission('hb:create');
  }

  get assetFormModalOpen(): boolean {
    return this.assetModalMode === 'create' || this.assetModalMode === 'edit';
  }

  toggleImportPanel(): void {
    if (!this.canImportAssets) return;
    this.activeLifeSheetView = 'records';
    this.importPanelOpen = !this.importPanelOpen;
  }

  async refreshCurrentPermissions(force = true): Promise<void> {
    if (this.permissionsRefreshLoading || !this.auth.tokens()?.refreshToken) return;
    const now = Date.now();
    if (!force && now - this.lastPermissionRefreshAt < this.permissionRefreshCooldownMs) return;
    this.lastPermissionRefreshAt = now;
    const hadImportPermission = this.canImportAssets;
    const hadHistoryPermission = this.canUploadHistoricalProtocols;
    this.permissionsRefreshLoading = true;
    try {
      let refreshed = await this.auth.refreshSession();
      if (!refreshed) {
        refreshed = await this.auth.reloadCurrentUser();
      }
      if (!refreshed) return;
      const gainedPermissions: string[] = [];
      const gainedImportPermission = !hadImportPermission && this.canImportAssets;
      if (gainedImportPermission) {
        this.activeLifeSheetView = 'records';
        this.importPanelOpen = true;
        gainedPermissions.push('importación masiva');
      }
      if (!hadHistoryPermission && this.canUploadHistoricalProtocols) {
        gainedPermissions.push('migración de protocolos históricos');
      }
      if (gainedPermissions.length) {
        this.errorMessage = '';
        this.successMessage = `Permisos actualizados. Ya puedes usar: ${gainedPermissions.join(' y ')}.`;
      } else if (force) {
        const activePermissions: string[] = [];
        if (this.canImportAssets) activePermissions.push('importación masiva');
        if (this.canUploadHistoricalProtocols) activePermissions.push('migración de protocolos históricos');
        if (activePermissions.length) {
          this.errorMessage = '';
          this.successMessage = `Permisos actualizados. Activos: ${activePermissions.join(' y ')}.`;
        } else {
          this.successMessage = '';
          this.errorMessage = 'No aparecen permisos temporales activos para importación o migración de PDFs. Verifica su vigencia con el administrador del cliente.';
        }
      }
      if (!this.canUploadHistoricalProtocols && this.activeLifeSheetView === 'pending_protocols') {
        this.pendingProtocolsError = '';
      }
    } finally {
      this.permissionsRefreshLoading = false;
      this.cdr.detectChanges();
    }
  }

  async openCreateModal(): Promise<void> {
    if (!this.canCreateAssets) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedAssetForModal = null;
    this.resetForm();
    await this.loadLocationsForForm();
    this.assetModalMode = 'create';
    this.formMode = 'wizard';
    this.wizardStep = 0;
    this.cdr.detectChanges();
  }

  async openViewModal(asset: InventoryPanelItem): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedAssetForModal = this.assets.find((item) => item.id === asset.id) ?? (asset as AssetView);
    this.assetModalMode = 'view';
    this.detailModalTab = 'summary';
    this.resetAssetHistory();
    this.resetSupplementalDocumentUpload();
    this.assetDetailsLoading = true;
    try {
      await this.loadAssetDetails(asset.id);
      void this.loadAssetHistory(true);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la hoja de vida.';
    } finally {
      this.assetDetailsLoading = false;
      this.cdr.detectChanges();
    }
  }

  async openEditModal(asset: InventoryPanelItem): Promise<void> {
    if (!this.canCreateAssets) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedAssetForModal = this.assets.find((item) => item.id === asset.id) ?? (asset as AssetView);
    this.assetModalMode = 'edit';
    this.assetDetailsLoading = true;
    this.formMode = 'wizard';
    this.wizardStep = 0;
    try {
      await this.loadAssetDetails(asset.id);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la hoja de vida para edición.';
    } finally {
      this.assetDetailsLoading = false;
      this.cdr.detectChanges();
    }
  }

  editFromViewModal(): void {
    if (!this.canCreateAssets || !this.selectedAssetForModal) return;
    this.assetModalMode = 'edit';
    this.formMode = 'wizard';
    this.wizardStep = 0;
  }

  closeAssetModal(): void {
    this.assetModalMode = null;
    this.selectedAssetForModal = null;
    this.assetDetailsLoading = false;
    this.detailModalTab = 'summary';
    this.resetAssetHistory();
    this.resetSupplementalDocumentUpload();
    this.resetForm();
    this.cdr.detectChanges();
  }

  setDetailModalTab(tab: 'summary' | 'history' | 'documents'): void {
    this.detailModalTab = tab;
    if (tab === 'history' && !this.assetHistoryItems.length && !this.assetHistoryLoading) {
      void this.loadAssetHistory(true);
    }
    if (tab === 'documents' && !this.archivedAssetDocumentsLoaded && !this.archivedAssetDocumentsLoading) {
      void this.loadArchivedAssetDocuments();
    }
  }

  resetAssetHistory(): void {
    this.assetHistoryItems = [];
    this.assetHistoryLoading = false;
    this.assetHistoryError = '';
    this.assetHistoryFrom = '';
    this.assetHistoryTo = '';
    this.assetHistoryOrder = 'desc';
    this.assetHistoryOffset = 0;
    this.assetHistoryHasMore = false;
    this.assetHistoryLoadToken += 1;
  }

  async loadAssetHistory(reset = true): Promise<void> {
    if (!this.selectedClientId || !this.selectedAssetForModal?.id) {
      this.assetHistoryItems = [];
      return;
    }
    if (reset) {
      this.assetHistoryOffset = 0;
      this.assetHistoryHasMore = false;
      this.assetHistoryItems = [];
    }
    const token = ++this.assetHistoryLoadToken;
    this.assetHistoryLoading = true;
    this.assetHistoryError = '';
    try {
      const rows = await this.biomed.listAssetHistory(this.selectedClientId, this.selectedAssetForModal.id, {
        from: this.assetHistoryFrom || undefined,
        to: this.assetHistoryTo || undefined,
        order: this.assetHistoryOrder,
        limit: this.assetHistoryLimit,
        offset: this.assetHistoryOffset
      });
      if (token !== this.assetHistoryLoadToken) return;
      this.assetHistoryItems = rows;
      this.assetHistoryHasMore = rows.length === this.assetHistoryLimit;
    } catch (error) {
      console.error(error);
      if (token !== this.assetHistoryLoadToken) return;
      this.assetHistoryItems = [];
      this.assetHistoryHasMore = false;
      this.assetHistoryError = 'No se pudo cargar el historial del equipo.';
    } finally {
      if (token === this.assetHistoryLoadToken) {
        this.assetHistoryLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async nextAssetHistoryPage(): Promise<void> {
    if (this.assetHistoryLoading || !this.assetHistoryHasMore) return;
    this.assetHistoryOffset += this.assetHistoryLimit;
    await this.loadAssetHistory(false);
  }

  async previousAssetHistoryPage(): Promise<void> {
    if (this.assetHistoryLoading || this.assetHistoryOffset === 0) return;
    this.assetHistoryOffset = Math.max(0, this.assetHistoryOffset - this.assetHistoryLimit);
    await this.loadAssetHistory(false);
  }

  assetHistoryTypeLabel(item: AssetHistoryItemDto): string {
    if (item.item_type === 'maintenance_report') {
      return item.subtype === 'preventivo' ? 'Mantenimiento preventivo' : 'Mantenimiento correctivo';
    }
    if (item.item_type === 'calibration_report') return 'Calibración';
    if (item.item_type === 'movement_report') return 'Movimiento';
    if (item.subtype === 'maintenance_preventive') return 'Protocolo preventivo histórico';
    if (item.subtype === 'maintenance_corrective') return 'Reporte correctivo histórico';
    if (item.subtype === 'calibration') return 'Certificado de calibración histórico';
    return 'Documento PDF';
  }

  resetSupplementalDocumentUpload(preserveSuccess = false): void {
    this.supplementalDocumentType = 'other';
    this.supplementalDocumentDate = this.todayInBogota;
    this.supplementalDocumentTitle = 'Documento técnico del equipo';
    this.supplementalDocumentDescription = '';
    this.supplementalDocumentFile = null;
    this.supplementalDocumentLoading = false;
    this.supplementalDocumentError = '';
    if (!preserveSuccess) this.supplementalDocumentSuccess = '';
    this.archivedAssetDocuments = [];
    this.archivedAssetDocumentsLoading = false;
    this.archivedAssetDocumentsError = '';
    this.archivedAssetDocumentsLoaded = false;
    this.archivedAssetDocumentsLoadToken += 1;
  }

  onSupplementalDocumentTypeChange(): void {
    const defaultTitles = this.supplementalDocumentTypeOptions.map((item) => item.defaultTitle);
    if (!this.supplementalDocumentTitle.trim() || defaultTitles.includes(this.supplementalDocumentTitle)) {
      this.supplementalDocumentTitle = this.supplementalDocumentTypeOptions.find(
        (item) => item.value === this.supplementalDocumentType
      )?.defaultTitle ?? '';
    }
    this.supplementalDocumentError = '';
  }

  onSupplementalDocumentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const validationError = this.historicalPdfSelectionError(file);
    if (validationError) {
      this.supplementalDocumentFile = null;
      this.supplementalDocumentError = validationError;
      input.value = '';
      return;
    }
    this.supplementalDocumentFile = file;
    this.supplementalDocumentError = '';
    this.supplementalDocumentSuccess = '';
  }

  async uploadSupplementalDocument(fileInput: HTMLInputElement): Promise<void> {
    if (
      !this.canUploadHistoricalProtocols
      || !this.selectedClientId
      || !this.selectedAssetForModal?.id
      || this.supplementalDocumentLoading
    ) return;
    if (!this.supplementalDocumentDate) {
      this.supplementalDocumentError = 'Selecciona la fecha del documento.';
      return;
    }
    if (this.supplementalDocumentDate > this.todayInBogota) {
      this.supplementalDocumentError = 'La fecha del documento no puede estar en el futuro.';
      return;
    }
    if (!this.supplementalDocumentTitle.trim()) {
      this.supplementalDocumentError = 'Escribe un título para identificar el documento.';
      return;
    }
    const fileError = this.historicalPdfSelectionError(this.supplementalDocumentFile);
    if (fileError) {
      this.supplementalDocumentError = fileError;
      return;
    }

    this.supplementalDocumentLoading = true;
    this.supplementalDocumentError = '';
    this.supplementalDocumentSuccess = '';
    try {
      await this.biomed.uploadAssetHistoryFile(this.selectedClientId, this.selectedAssetForModal.id, {
        file: this.supplementalDocumentFile!,
        documentDate: this.supplementalDocumentDate,
        documentType: this.supplementalDocumentType,
        title: this.supplementalDocumentTitle.trim(),
        description: this.supplementalDocumentDescription.trim() || undefined
      });
      this.resetSupplementalDocumentUpload(true);
      this.supplementalDocumentSuccess = 'Documento PDF archivado correctamente en la hoja de vida.';
      fileInput.value = '';
      await Promise.all([this.loadArchivedAssetDocuments(), this.loadAssetHistory(true)]);
    } catch (error) {
      console.error(error);
      this.supplementalDocumentError = this.extractErrorMessage(error)
        || 'No se pudo archivar el documento PDF.';
    } finally {
      this.supplementalDocumentLoading = false;
      this.cdr.detectChanges();
    }
  }

  async loadArchivedAssetDocuments(): Promise<void> {
    if (!this.selectedClientId || !this.selectedAssetForModal?.id) {
      this.archivedAssetDocuments = [];
      return;
    }
    const clientId = this.selectedClientId;
    const assetId = this.selectedAssetForModal.id;
    const token = ++this.archivedAssetDocumentsLoadToken;
    this.archivedAssetDocumentsLoading = true;
    this.archivedAssetDocumentsError = '';
    try {
      const rows = await this.biomed.listAssetHistory(clientId, assetId, {
        order: 'desc',
        limit: 25,
        offset: 0
      });
      if (
        token !== this.archivedAssetDocumentsLoadToken
        || this.selectedClientId !== clientId
        || this.selectedAssetForModal?.id !== assetId
      ) return;
      this.archivedAssetDocuments = rows.filter((item) => item.item_type === 'legacy_pdf');
      this.archivedAssetDocumentsLoaded = true;
    } catch (error) {
      console.error(error);
      if (token !== this.archivedAssetDocumentsLoadToken) return;
      this.archivedAssetDocuments = [];
      this.archivedAssetDocumentsError = 'No se pudieron cargar los documentos archivados.';
    } finally {
      if (token === this.archivedAssetDocumentsLoadToken) {
        this.archivedAssetDocumentsLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async openSelectedAssetPdf(): Promise<void> {
    if (!this.selectedAssetForModal) return;
    await this.downloadPdf(this.selectedAssetForModal);
  }

  async openSelectedAssetQuickGuide(): Promise<void> {
    if (!this.selectedClientId || !this.selectedAssetForModal?.id) return;
    try {
      const blob = await this.quickGuides.downloadAssetGuidePdf(this.selectedClientId, this.selectedAssetForModal.id);
      this.openBlob(blob);
    } catch (error: any) {
      if (error?.status === 404) {
        window.alert('Este equipo aún no tiene una guía rápida aprobada para su combinación de equipo, marca y modelo.');
        return;
      }
      window.alert('No se pudo abrir la guía rápida de uso.');
    }
  }

  async openAssetHistoryItem(item: AssetHistoryItemDto): Promise<void> {
    if (!item.pdf_path) return;
    if (item.item_type === 'maintenance_report') {
      this.openBlob(await this.maintenance.downloadReportPdf(item.id));
      return;
    }
    if (item.item_type === 'calibration_report') {
      this.openBlob(await this.calibration.downloadPdf(item.id));
      return;
    }
    if (item.item_type === 'movement_report') {
      if (!this.selectedClientId) return;
      this.openBlob(await this.biomed.downloadAssetMovementPdf(this.selectedClientId, item.id));
      return;
    }
    if (!this.selectedClientId) return;
    this.openBlob(await this.biomed.downloadAssetHistoryFilePdf(this.selectedClientId, item.id));
  }

  async downloadHvImportTemplate(): Promise<void> {
    if (!this.selectedClientId) {
      this.setImportMessage('Selecciona primero un cliente para descargar la plantilla.', 'error');
      return;
    }

    if (this.importTemplateLoading) return;
    this.importTemplateLoading = true;
    this.setImportMessage('Generando plantilla de importación...', 'info');
    this.cdr.detectChanges();

    try {
      await this.loadSites();
      await this.loadAreas();
      await this.loadLocationsAll();
      await this.loadEquipmentCatalog();

      const workbook = this.createExcelWorkbook();
      buildHvImportTemplate(workbook, {
        assetCategory: this.assetCategory,
        headers: this.importHeaders,
        sites: this.sites,
        areas: this.areas,
        locations: this.locationsAll,
        equipmentCatalog: this.equipmentCatalog,
        sanitaryRiskClasses: this.riskClasses,
        electricalProtectionClasses: this.electricalProtectionClasses,
        appliedPartTypes: this.appliedPartTypes,
        frequencies: this.frequencyOptions,
        acquisitionTypes: this.acquisitionTypes,
        equipmentTypes: this.equipmentTypeOptions,
        warrantyOptions: this.warrantyYearOptions,
        maxRows: this.maxImportRows
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      this.downloadBlob(
        blob,
        this.isIndustrialAssetModule
          ? 'plantilla-hojas-de-vida-industriales.xlsx'
          : 'plantilla-hojas-de-vida.xlsx'
      );
      this.setImportMessage('Plantilla generada. Revisa la carpeta de descargas del navegador.', 'success');
    } catch (error) {
      console.error(error);
      this.setImportMessage('No se pudo generar la plantilla. Verifica la sesión y vuelve a intentar.', 'error');
    } finally {
      this.importTemplateLoading = false;
      this.cdr.detectChanges();
    }
  }

  async onHvImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    this.importPreviewRows = [];
    this.importOriginalHeaders = [];
    this.setImportMessage('', 'info');
    this.importFileName = file?.name ?? '';
    if (!file) {
      this.cdr.detectChanges();
      return;
    }

    if (!this.selectedClientId) {
      this.setImportMessage('Selecciona primero un cliente.', 'error');
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      this.setImportMessage('El archivo debe ser Excel (.xlsx, .xls) o CSV.', 'error');
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    if (file.size > this.maxImportFileSizeMb * 1024 * 1024) {
      this.setImportMessage(`El archivo supera ${this.maxImportFileSizeMb} MB. Divide la carga en archivos más pequeños.`, 'error');
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.importReading = true;
    this.setImportMessage('Leyendo y validando el archivo...', 'info');
    this.cdr.detectChanges();

    try {
      await this.loadSites();
      await this.loadAreas();
      await this.loadLocationsAll();

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        this.setImportMessage('El archivo no tiene hojas para leer.', 'error');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      this.importOriginalHeaders = this.getWorksheetHeaders(worksheet);
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const rows = rawRows.filter((row) => this.rowHasAnyValue(row));
      if (rows.length > this.maxImportRows) {
        this.setImportMessage(`El archivo tiene ${rows.length} filas. Importa máximo ${this.maxImportRows} equipos por archivo.`, 'error');
        return;
      }

      this.importPreviewRows = this.buildImportPreview(rows);
      if (!rows.length) {
        this.setImportMessage('El archivo no tiene filas para importar.', 'error');
      } else if (this.importHasErrors) {
        this.setImportMessage(`Archivo leído con ${this.importErrorRowsCount} fila(s) con errores y ${this.importValidRowsCount} lista(s).`, 'error');
      } else {
        this.setImportMessage(`Archivo leído: ${this.importValidRowsCount} equipo(s) listos para importar.`, 'success');
      }
    } catch (error) {
      console.error(error);
      this.setImportMessage('No se pudo leer el archivo. Verifica que sea una plantilla válida de hojas de vida.', 'error');
    } finally {
      this.importReading = false;
      input.value = '';
      this.cdr.detectChanges();
    }
  }

  async confirmHvImport(): Promise<void> {
    if (!this.selectedClientId || this.importHasErrors || !this.importValidRowsCount) {
      return;
    }
    this.importLoading = true;
    this.setImportMessage('', 'info');
    try {
      const validRows = this.importPreviewRows.filter((row) => row.payload && !row.errors.length);
      const result = await this.biomed.importAssets(
        this.selectedClientId,
        validRows.map((row) => row.payload!),
        this.assetCategory
      );
      const importSuccess = `Importación completada: ${result.imported} hoja(s) de vida creadas.${this.catalogReviewNotice(result.catalogReview)}${this.scheduleSyncBatchNotice(result.scheduleSync)}`;
      this.setImportMessage(importSuccess, 'success');
      this.successMessage = importSuccess;
      this.importPreviewRows = [];
      this.importFileName = '';
      await Promise.all([this.loadAssets(), this.loadEquipmentCatalog(), this.loadPendingProtocols()]);
      this.resetForm();
      this.importPanelOpen = false;
    } catch (error) {
      console.error(error);
      this.setImportMessage(
        this.extractErrorMessage(error) || 'No se pudo completar la importación. Revisa duplicados o datos obligatorios.',
        'error'
      );
    } finally {
      this.importLoading = false;
      this.cdr.detectChanges();
    }
  }

  clearHvImport(): void {
    this.importPreviewRows = [];
    this.importOriginalHeaders = [];
    this.importFileName = '';
    this.importReading = false;
    this.setImportMessage('', 'info');
  }

  private setImportMessage(message: string, type: 'info' | 'success' | 'error'): void {
    this.importMessage = message;
    this.importMessageType = type;
  }

  private createExcelWorkbook(): ExcelWorkbook {
    try {
      return new ExcelWorkbookConstructor() as ExcelWorkbook;
    } catch (error) {
      console.error(error);
      throw new Error('No se pudo inicializar el generador de Excel.');
    }
  }

  async downloadHvImportErrors(): Promise<void> {
    const errorRows = this.importPreviewRows.filter((row) => row.errors.length > 0);
    if (!errorRows.length) {
      return;
    }

    const workbook = this.createExcelWorkbook();
    workbook.creator = 'INBIHOSPITALARIO';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Corregir hojas de vida', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headers = this.importOriginalHeaders.length ? this.importOriginalHeaders : this.importHeaders;
    const errorHeader = 'Errores encontrados';
    const allHeaders = [...headers, errorHeader];
    worksheet.columns = allHeaders.map((header) => ({
      header,
      key: header,
      width: header === errorHeader ? 72 : Math.min(Math.max(header.length + 4, 15), 30)
    }));

    worksheet.getRow(1).height = 28;
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA64045' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF8F343A' } },
        left: { style: 'thin', color: { argb: 'FF8F343A' } },
        bottom: { style: 'thin', color: { argb: 'FF8F343A' } },
        right: { style: 'thin', color: { argb: 'FF8F343A' } }
      };
    });

    this.importPreviewRows.forEach((preview) => {
      const values = headers.map((header) => this.excelCellValue(this.valueFromRow(preview.originalRow, header)));
      values.push(preview.errors.join(' | '));
      const excelRow = worksheet.addRow(values);
      excelRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      if (!preview.errors.length) {
        return;
      }

      const fieldKeys = new Set(preview.fieldErrors.map((error) => this.normalizeHeader(error.field)));
      excelRow.eachCell((cell, colNumber) => {
        const header = allHeaders[colNumber - 1];
        const isErrorColumn = header === errorHeader;
        const isFieldWithError = fieldKeys.has(this.normalizeHeader(header));
        if (isErrorColumn || isFieldWithError) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isErrorColumn ? 'FFFFE4E6' : 'FFFEE2E2' } };
          cell.font = { color: { argb: 'FF991B1B' }, bold: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFEF4444' } },
            left: { style: 'thin', color: { argb: 'FFEF4444' } },
            bottom: { style: 'thin', color: { argb: 'FFEF4444' } },
            right: { style: 'thin', color: { argb: 'FFEF4444' } }
          };
        }
      });
    });

    const guideSheet = workbook.addWorksheet('Guia de correccion');
    guideSheet.columns = [
      { header: 'Cómo corregir', key: 'guide', width: 100 }
    ];
    [
      'Corrige las celdas marcadas en rojo en la hoja "Corregir hojas de vida".',
      'La columna "Errores encontrados" explica qué debe corregirse en cada fila.',
      'Puedes borrar la columna "Errores encontrados" antes de subir nuevamente el archivo; si la dejas, el sistema la ignorará.',
      'No cambies los nombres de las columnas obligatorias marcadas con asterisco (*).'
    ].forEach((text) => guideSheet.addRow({ guide: text }));
    guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guideSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA64045' } };

    const baseName = this.importFileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    this.downloadBlob(blob, `corregir-importacion-${baseName || 'hojas-de-vida'}.xlsx`);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  private buildImportPreview(rows: Record<string, unknown>[]): ImportPreviewRow[] {
    const existingCodes = new Set(this.assets.map((asset) => this.normalizeText(asset.code)));
    const fileCodes = new Set<string>();
    const sanitaryRequirementColumnPresent = this.hasImportHeader(
      'Requiere riesgo sanitario*',
      'Requiere riesgo sanitario'
    );
    const electricalRequirementColumnPresent = this.hasImportHeader(
      'Requiere riesgo eléctrico*',
      'Requiere riesgo electrico*',
      'Requiere clasificación eléctrica*',
      'Requiere clasificacion electrica*'
    );
    return rows.map((row, index) => {
      const code = this.rowValue(row, 'Código*', 'Código', 'Codigo*', 'Codigo');
      const name = this.rowValue(row, 'Nombre*', 'Nombre');
      const brand = this.rowValue(row, 'Marca*', 'Marca');
      const model = this.rowValue(row, 'Modelo*', 'Modelo');
      const serial = this.rowValue(row, 'Serie*', 'Serie', 'Serial*', 'Serial');
      const siteName = this.rowValue(row, 'Sede*', 'Sede');
      const areaName = this.rowValue(row, 'Área*', 'Área', 'Area*', 'Area');
      const locationName = this.rowValue(row, 'Ubicación*', 'Ubicación', 'Ubicacion*', 'Ubicacion');
      const invimaReg = this.rowValue(row, 'Registro Invima*', 'Registro Invima');
      const requiresSanitaryRaw = this.rowValue(
        row,
        'Requiere riesgo sanitario*',
        'Requiere riesgo sanitario'
      );
      const riskClass = this.rowValue(
        row,
        'Clasificación riesgo sanitario',
        'Clasificacion riesgo sanitario',
        'Riesgo*',
        'Riesgo'
      );
      const requiresElectricalRaw = this.rowValue(
        row,
        'Requiere riesgo eléctrico*',
        'Requiere riesgo electrico*',
        'Requiere clasificación eléctrica*',
        'Requiere clasificacion electrica*'
      );
      const electricalProtectionClassRaw = this.rowValue(
        row,
        'Clase protección eléctrica',
        'Clase proteccion electrica'
      );
      const appliedPartTypeRaw = this.rowValue(row, 'Tipo parte aplicada');
      const manufacturer = this.rowValue(row, 'Fabricante');
      const equipmentTypeRaw = this.rowValue(row, 'Tipo equipo');
      const acquisitionTypeRaw = this.rowValue(row, 'Forma adquisición', 'Forma adquisicion');
      const acquisitionDateRaw = this.valueFromRow(row, 'Fecha adquisición', 'Fecha adquisicion');
      const usefulLifeRaw = this.rowValue(row, 'Vida útil años', 'Vida util años');
      const warrantyRaw = this.rowValue(row, 'Garantía años', 'Garantia años');
      const supplierName = this.rowValue(row, 'Proveedor');
      const supplierPhone = this.rowValue(row, 'Teléfono proveedor', 'Telefono proveedor');
      const supplierEmailRaw = this.rowValue(row, 'Correo proveedor');
      const maintenanceFrequencyRaw = this.rowValue(row, 'Frecuencia mantenimiento');
      const requiresCalibrationRaw = this.rowValue(row, 'Requiere calibración', 'Requiere calibracion');
      const calibrationFrequencyRaw = this.rowValue(row, 'Frecuencia calibración', 'Frecuencia calibracion');
      const errors: string[] = [];

      const required = [
        ['Código', code],
        ['Nombre', name],
        ['Marca', brand],
        ['Modelo', model],
        ['Serie', serial],
        ['Sede', siteName],
        ['Área', areaName],
        ['Ubicación', locationName],
        ...(!this.isIndustrialAssetModule ? [['Registro Invima', invimaReg]] : [])
      ];
      required.forEach(([label, value]) => {
        if (!String(value).trim()) errors.push(`${label} es obligatorio`);
      });

      const normalizedCode = this.normalizeText(code);
      if (code && code.length > 80) {
        errors.push('Código no puede superar 80 caracteres');
      }
      if (normalizedCode && existingCodes.has(normalizedCode)) {
        errors.push('El código ya existe en el inventario');
      }
      if (normalizedCode && fileCodes.has(normalizedCode)) {
        errors.push('El código está repetido en el Excel');
      }
      if (normalizedCode) {
        fileCodes.add(normalizedCode);
      }

      const site = this.sites.find((item) => this.normalizeText(item.name) === this.normalizeText(siteName));
      const area = site
        ? this.areas.find((item) => item.siteId === site.id && this.normalizeText(item.name) === this.normalizeText(areaName))
        : null;
      const location = area
        ? this.locationsAll.find((item) => item.areaId === area.id && this.normalizeText(item.name) === this.normalizeText(locationName))
        : null;

      if (siteName && !site) errors.push('La sede no existe; créala antes de importar');
      if (areaName && site && !area) errors.push('El área no existe en esa sede');
      if (locationName && area && !location) errors.push('La ubicación no existe en esa área');

      const risk = this.isIndustrialAssetModule
        ? {
            requiresSanitaryClassification: false,
            riskClass: undefined,
            requiresElectricalClassification: false,
            electricalProtectionClass: undefined,
            appliedPartType: undefined,
            errors: []
          }
        : resolveHvRiskImport({
            requiresSanitaryValue: requiresSanitaryRaw,
            sanitaryRiskClassValue: riskClass,
            requiresElectricalValue: requiresElectricalRaw,
            electricalProtectionClassValue: electricalProtectionClassRaw,
            appliedPartTypeValue: appliedPartTypeRaw,
            sanitaryRequirementColumnPresent,
            electricalRequirementColumnPresent,
            sanitaryRiskClasses: this.riskClasses,
            electricalProtectionClasses: this.electricalProtectionClasses,
            appliedPartTypes: this.appliedPartTypes
          });
      errors.push(...risk.errors);

      const matchedEquipmentType = this.matchAllowedValue(equipmentTypeRaw, this.equipmentTypeOptions);
      if (equipmentTypeRaw && !matchedEquipmentType) {
        errors.push('Tipo equipo no permitido. Usa: Fijo o Móvil');
      }

      const matchedAcquisitionType = this.matchAllowedValue(acquisitionTypeRaw, this.acquisitionTypes);
      if (acquisitionTypeRaw && !matchedAcquisitionType) {
        errors.push('Forma de adquisición no permitida. Usa: COMPRA DIRECTA o DONACION');
      }

      const acquisitionDateIsMissing = isNotRegisteredMarker(acquisitionDateRaw);
      const acquisitionDate = acquisitionDateIsMissing ? null : this.parseExcelDate(acquisitionDateRaw);
      if (this.hasCellValue(acquisitionDateRaw) && !acquisitionDateIsMissing && !acquisitionDate) {
        errors.push('Fecha adquisición no válida. Usa yyyy-mm-dd, día/mes/año o NR');
      }

      const usefulLifeYears = this.parseOptionalNumber(usefulLifeRaw);
      if (usefulLifeRaw && usefulLifeYears === undefined) {
        errors.push('Vida útil debe ser un número mayor a 0');
      }

      const warrantyYears = this.parseOptionalNumber(warrantyRaw);
      const warrantyIsValid = warrantyYears !== undefined && Number.isInteger(warrantyYears) && this.warrantyYearOptions.includes(warrantyYears);
      if (warrantyRaw && !warrantyIsValid) {
        errors.push('Garantía debe ser 1, 2 o 3 años');
      }
      if (warrantyIsValid && !acquisitionDate) {
        errors.push('Fecha adquisición es obligatoria cuando el equipo tiene garantía');
      }

      const supplierEmail = normalizeOptionalRecordedValue(supplierEmailRaw);
      if (supplierEmail && !this.isValidEmail(supplierEmail)) {
        errors.push('Correo proveedor no tiene un formato válido');
      }

      const maintenanceFrequency = this.normalizeFrequency(maintenanceFrequencyRaw);
      if (maintenanceFrequency && !this.frequencyOptions.includes(maintenanceFrequency)) {
        errors.push(`Frecuencia de mantenimiento no permitida. Usa: ${this.frequencyOptions.join(', ')}`);
      }
      const calibration = this.isIndustrialAssetModule
        ? { requiresCalibration: false, calibrationFrequency: undefined, errors: [] }
        : resolveHvCalibrationImport(
            requiresCalibrationRaw,
            calibrationFrequencyRaw,
            this.frequencyOptions
          );
      errors.push(...calibration.errors);

      const payload = site && area && location && !errors.length
        ? {
            assetCategory: this.assetCategory,
            code: code.trim(),
            name: this.catalogStorageValue(name),
            brand: this.catalogStorageValue(brand),
            model: this.catalogStorageValue(model),
            serial: serial.trim(),
            invimaReg: this.isIndustrialAssetModule ? '' : invimaReg.trim(),
            siteId: site.id,
            areaId: area.id,
            locationId: location.id,
            requiresSanitaryClassification: risk.requiresSanitaryClassification,
            riskClass: risk.riskClass,
            requiresElectricalClassification: risk.requiresElectricalClassification,
            electricalProtectionClass: risk.electricalProtectionClass,
            appliedPartType: risk.appliedPartType,
            isMobile: this.normalizeText(matchedEquipmentType || equipmentTypeRaw).includes('movil'),
            manufacturer: manufacturer || undefined,
            acquisitionType: matchedAcquisitionType || 'COMPRA DIRECTA',
            acquisitionDate: acquisitionDate || undefined,
            usefulLifeYears,
            warrantyYears,
            supplierName: supplierName || undefined,
            supplierPhone: supplierPhone || undefined,
            supplierEmail: supplierEmail || undefined,
            maintenanceFrequency: maintenanceFrequency || 'mensual',
            requiresCalibration: calibration.requiresCalibration,
            calibrationFrequency: calibration.calibrationFrequency
          }
        : undefined;

      return {
        rowNumber: index + 2,
        code,
        name,
        siteName,
        areaName,
        locationName,
        errors,
        fieldErrors: this.inferImportFieldErrors(errors),
        originalRow: row,
        payload
      };
    });
  }

  private inferImportFieldErrors(errors: string[]): { field: string; message: string }[] {
    const mappings: { field: string; tokens: string[] }[] = [
      { field: 'Código*', tokens: ['codigo'] },
      { field: 'Nombre*', tokens: ['nombre'] },
      { field: 'Marca*', tokens: ['marca'] },
      { field: 'Modelo*', tokens: ['modelo'] },
      { field: 'Serie*', tokens: ['serie', 'serial'] },
      { field: 'Sede*', tokens: ['sede'] },
      { field: 'Área*', tokens: ['area'] },
      { field: 'Ubicación*', tokens: ['ubicacion'] },
      { field: 'Registro Invima*', tokens: ['invima'] },
      { field: 'Requiere riesgo sanitario*', tokens: ['requiere riesgo sanitario'] },
      { field: 'Clasificación riesgo sanitario', tokens: ['clasificacion de riesgo sanitario'] },
      { field: 'Requiere riesgo eléctrico*', tokens: ['requiere clasificacion electrica', 'requiere riesgo electrico'] },
      { field: 'Clase protección eléctrica', tokens: ['clase de proteccion electrica'] },
      { field: 'Tipo parte aplicada', tokens: ['tipo de parte aplicada'] },
      { field: 'Tipo equipo', tokens: ['tipo equipo'] },
      { field: 'Forma adquisición', tokens: ['forma de adquisicion'] },
      { field: 'Fecha adquisición', tokens: ['fecha adquisicion'] },
      { field: 'Vida útil años', tokens: ['vida util'] },
      { field: 'Garantía años', tokens: ['garantia'] },
      { field: 'Correo proveedor', tokens: ['correo proveedor'] },
      { field: 'Frecuencia mantenimiento', tokens: ['frecuencia de mantenimiento'] },
      { field: 'Requiere calibración', tokens: ['requiere calibracion'] },
      { field: 'Frecuencia calibración', tokens: ['frecuencia de calibracion'] }
    ];
    const result: { field: string; message: string }[] = [];
    const seen = new Set<string>();

    errors.forEach((message) => {
      const normalizedMessage = this.normalizeText(message);
      mappings.forEach((mapping) => {
        if (!mapping.tokens.some((token) => normalizedMessage.includes(this.normalizeText(token)))) {
          return;
        }
        const key = `${mapping.field}-${message}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ field: mapping.field, message });
        }
      });
    });

    return result;
  }

  private getWorksheetHeaders(worksheet: XLSX.WorkSheet): string[] {
    if (!worksheet['!ref']) {
      return [...this.importHeaders];
    }
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
      const value = String(cell?.v ?? '').trim();
      if (value && this.normalizeHeader(value) !== this.normalizeHeader('Errores encontrados')) {
        headers.push(value);
      }
    }
    return headers.length ? headers : [...this.importHeaders];
  }

  private hasImportHeader(...keys: string[]): boolean {
    const headers = this.importOriginalHeaders.length ? this.importOriginalHeaders : this.importHeaders;
    const normalizedKeys = new Set(keys.map((key) => this.normalizeHeader(key)));
    return headers.some((header) => normalizedKeys.has(this.normalizeHeader(header)));
  }

  private excelCellValue(value: unknown): string | number | Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'number') {
      return value;
    }
    return String(value ?? '').trim();
  }

  private rowValue(row: Record<string, unknown>, ...keys: string[]): string {
    const value = this.valueFromRow(row, ...keys);
    if (value instanceof Date) {
      return this.formatDateForInput(value);
    }
    return String(value ?? '').trim();
  }

  private valueFromRow(row: Record<string, unknown>, ...keys: string[]): unknown {
    const normalizedKeys = keys.map((key) => this.normalizeHeader(key));
    const match = Object.entries(row).find(([key]) => normalizedKeys.includes(this.normalizeHeader(key)));
    return match?.[1] ?? '';
  }

  private normalizeHeader(value: string): string {
    return this.normalizeText(value.replace('*', ''));
  }

  private rowHasAnyValue(row: Record<string, unknown>): boolean {
    return Object.entries(row).some(([key, value]) =>
      this.normalizeHeader(key) !== this.normalizeHeader('Errores encontrados') && this.hasCellValue(value)
    );
  }

  private hasCellValue(value: unknown): boolean {
    if (value instanceof Date) {
      return true;
    }
    return String(value ?? '').trim().length > 0;
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeCatalogSelection(value: unknown): string {
    return this.normalizeText(value).replace(/\s+/g, ' ');
  }

  private catalogStorageValue(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleUpperCase('es-CO');
  }

  private catalogReviewNotice(review?: CatalogReviewDto | null): string {
    const pending = review?.pendingNodes ?? [];
    if (!pending.length) return '';
    const labels = pending.map((node) => `${node.label.toLowerCase()} ${node.value}`);
    return ` Quedó pendiente de aprobación en el catálogo: ${labels.join(', ')}.`;
  }

  private scheduleSyncNotice(sync?: MaintenanceScheduleSyncDto | null): string {
    if (!sync) return '';
    const firstDate = sync.firstPlannedDate ? this.formatIsoDateForDisplay(sync.firstPlannedDate) : '';
    const notes: string[] = [];
    if (sync.itemsRemoved) {
      if (sync.itemsAdded) {
        notes.push(
          `El cronograma quedó reprogramado: ${sync.itemsRemoved} registro(s) sin ejecutar reemplazado(s) por ${sync.itemsAdded} ventana(s) correcta(s)${firstDate ? ` desde el ${firstDate}` : ''}.`
        );
      } else {
        notes.push(
          `Se retiraron ${sync.itemsRemoved} mantenimiento(s) sin ejecutar que ya no corresponden a la nueva periodicidad.`
        );
      }
    } else if (sync.status === 'scheduled') {
      if (sync.itemsAdded) {
        notes.push(
          `Se incorporó al cronograma con ${sync.itemsAdded} mantenimiento(s)${firstDate ? ` desde el ${firstDate}` : ''}.`
        );
      } else {
        notes.push(
          `El equipo ya está incorporado en el cronograma${firstDate ? ` desde el ${firstDate}` : ''}.`
        );
      }
    } else if (sync.status === 'warranty') {
      const releaseDate = sync.warrantyReleaseDate
        ? this.formatIsoDateForDisplay(sync.warrantyReleaseDate)
        : '';
      notes.push(
        `Quedó en espera por garantía${releaseDate ? ` hasta el ${releaseDate}` : ''} y entrará en la siguiente vigencia aplicable.`
      );
    } else if (sync.status === 'next_cycle') {
      notes.push('No quedan ventanas operativas en la vigencia actual; se incluirá en el siguiente cronograma.');
    } else if (sync.status === 'warranty_data_required') {
      notes.push(`El cronograma quedó pendiente: ${sync.warrantyError || 'revisa la fecha de adquisición y la garantía.'}`);
    } else if (!sync.itemsRemoved) {
      notes.push('Se incluirá automáticamente cuando exista un cronograma para esta vigencia.');
    }
    if (sync.activeItemsAdded) {
      notes.push(`${sync.activeItemsAdded} mantenimiento(s) vigente(s) quedó(aron) activo(s) para realizar.`);
    }
    const evidenceCount = sync.historicalEvidenceRequired?.length ?? 0;
    if (evidenceCount) {
      notes.push(`${evidenceCount} periodo(s) anterior(es) requieren conciliar su PDF escaneado.`);
    }
    if (sync.historicalNotPerformed) {
      notes.push(`${sync.historicalNotPerformed} periodo(s) quedaron registrados como no realizados.`);
    }
    return notes.length ? ` ${notes.join(' ')}` : '';
  }

  private scheduleSyncBatchNotice(sync?: MaintenanceScheduleSyncBatchDto | null): string {
    if (!sync?.assets?.length) return '';
    const scheduled = sync.assets.filter((item) => item.status === 'scheduled').length;
    const warranty = sync.assets.filter((item) => item.status === 'warranty').length;
    const nextCycle = sync.assets.filter((item) => item.status === 'next_cycle').length;
    const awaiting = sync.assets.filter((item) => item.status === 'awaiting_schedule').length;
    const parts: string[] = [];
    if (scheduled) parts.push(`${scheduled} incorporado(s) al cronograma`);
    if (warranty) parts.push(`${warranty} en espera por garantía`);
    if (nextCycle) parts.push(`${nextCycle} para la siguiente vigencia`);
    if (awaiting) parts.push(`${awaiting} en espera de crear cronograma`);
    return parts.length ? ` Programación: ${parts.join(', ')}.` : '';
  }

  formatIsoDateForDisplay(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private findCatalogEquipment(name: string): EquipmentCatalogItemDto | undefined {
    const key = this.normalizeCatalogSelection(name);
    return this.equipmentCatalog.find(
      (item) => this.normalizeCatalogSelection(item.name) === key
    );
  }

  private normalizeFrequency(value: string): string {
    return this.normalizeText(value);
  }

  private matchAllowedValue(value: string, allowed: string[]): string | null {
    return allowed.find((item) => this.normalizeText(item) === this.normalizeText(value)) ?? null;
  }

  private parseOptionalNumber(value: string): number | undefined {
    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private extractErrorMessage(error: unknown): string | null {
    if (typeof error === 'object' && error && 'error' in error) {
      const nested = (error as { error?: { message?: string } }).error;
      return nested?.message ?? null;
    }
    return null;
  }

  private extractErrorCode(error: unknown): string | null {
    if (typeof error === 'object' && error && 'error' in error) {
      const nested = (error as { error?: { code?: string } }).error;
      return nested?.code ?? null;
    }
    return null;
  }

  private parseExcelDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return this.formatDateForInput(value);
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return this.validIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }
    const dateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
      return this.validIsoDate(Number(dateMatch[3]), Number(dateMatch[2]), Number(dateMatch[1]));
    }
    return null;
  }

  private validIsoDate(year: number, month: number, day: number): string | null {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() + 1 !== month ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private formatDateForInput(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async loadAssets(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    try {
      const rows = await this.biomed.listAssets(this.selectedClientId, this.assetCategory);
      this.assets = rows.map((row) => ({
        id: row.id,
        assetCategory: row.asset_category,
        code: row.code,
        name: row.name,
        brand: row.brand,
        model: row.model,
        serial: row.serial,
        location: row.location,
        status: row.status,
        photoPath: row.photo_path ?? null,
        invimaReg: row.invima_reg ?? null,
        riskClass: row.risk_class ?? null,
        requiresSanitaryClassification: row.requires_sanitary_classification ?? Boolean(row.risk_class),
        requiresElectricalClassification: row.requires_electrical_classification ?? false,
        electricalProtectionClass: row.electrical_protection_class ?? null,
        appliedPartType: row.applied_part_type ?? null,
        isMobile: row.is_mobile ?? false,
        manufacturer: row.manufacturer ?? null,
        siteName: row.site_name ?? null,
        siteId: row.site_id ?? null,
        areaName: row.area_name ?? null,
        locationName: row.location_name ?? null,
        areaId: row.area_id ?? null,
        locationId: row.location_id ?? null,
        acquisitionDate: row.acquisition_date ?? null,
        warrantyYears: row.warranty_years ?? null,
        hasPendingSpare: row.has_pending_spare ?? false
      }));
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar las hojas de vida.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadEquipmentCatalog(): Promise<void> {
    if (!this.selectedClientId) {
      this.equipmentCatalog = [];
      return;
    }
    try {
      this.equipmentCatalog = await this.biomed.listEquipmentCatalog(
        this.selectedClientId,
        this.assetCategory
      );
    } catch (error) {
      console.error(error);
      this.equipmentCatalog = [];
    }
  }

  async loadSites(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    try {
      const rows = await this.biomed.listSites(this.selectedClientId);
      this.sites = rows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address ?? null
      }));
      if (!this.sites.find((site) => site.id === this.siteId)) {
        this.siteId = this.sites[0]?.id ?? '';
      }
    } catch (error) {
      console.error(error);
      this.sites = [];
    }
  }

  async loadAreas(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    try {
      const rows = await this.biomed.listAreas(this.selectedClientId);
      this.areas = rows.map((row) => ({
        id: row.id,
        name: row.name,
        siteId: row.site_id ?? null,
        siteName: row.site_name ?? null
      }));
      const visibleAreas = this.areasForSelectedSite();
      if (!visibleAreas.find((area) => area.id === this.areaId)) {
        this.areaId = visibleAreas[0]?.id ?? this.areas[0]?.id ?? '';
      }
      await this.loadLocationsAll();
      await this.loadLocationsForForm();
    } catch (error) {
      console.error(error);
    }
  }

  async loadLocationsAll(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    const rows = await this.biomed.listLocations(this.selectedClientId);
    this.locationsAll = rows.map((row) => ({
      id: row.id,
      name: row.name,
      areaId: row.area_id ?? null,
      siteId: row.site_id ?? null,
      siteName: row.site_name ?? null
    }));
  }

  async loadLocationsForForm(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    if (!this.areaId) {
      this.locations = [];
      this.locationId = '';
      return;
    }
    const requestedAreaId = this.areaId;
    const rows = await this.biomed.listLocations(this.selectedClientId, requestedAreaId);
    if (this.areaId !== requestedAreaId) {
      return;
    }
    this.locations = rows.map((row) => ({
      id: row.id,
      name: row.name,
      areaId: row.area_id ?? null,
      siteId: row.site_id ?? null,
      siteName: row.site_name ?? null
    }));
    if (!this.locations.find((loc) => loc.id === this.locationId)) {
      this.locationId = this.locations[0]?.id ?? '';
    }
    this.cdr.detectChanges();
  }

  areasForSelectedSite(): AreaOption[] {
    return this.siteId ? this.areas.filter((area) => area.siteId === this.siteId) : this.areas;
  }

  async onSiteForFormChange(): Promise<void> {
    const siteAreas = this.areasForSelectedSite();
    this.areaId = siteAreas[0]?.id ?? '';
    this.locationId = '';
    await this.loadLocationsForForm();
  }

  onSanitaryRequirementChange(): void {
    if (!this.requiresSanitaryClassification) {
      this.riskClass = '';
      return;
    }
    if (!this.riskClass) this.riskClass = this.riskClasses[0];
  }

  onElectricalRequirementChange(): void {
    if (!this.requiresElectricalClassification) {
      this.electricalProtectionClass = '';
      this.appliedPartType = '';
    }
  }

  private maintenanceFrequencyChanged(): boolean {
    return Boolean(
      this.editingAssetId
      && this.normalizeFrequency(this.maintenanceFrequency) !== this.originalMaintenanceFrequency
    );
  }

  private scheduleProgrammingSelection(): MaintenanceScheduleProgrammingSelectionDto | undefined {
    if (!this.scheduleProgrammingPreview?.requiresConfirmation) return undefined;
    return {
      changeMode: this.scheduleProgrammingPreview.changeMode,
      effectiveDate: this.scheduleProgrammingPreview.effectiveDate,
      schedules: this.scheduleProgrammingPreview.schedules.map((schedule) => ({
        scheduleId: schedule.scheduleId,
        items: schedule.items.map((item) => ({
          month: item.month,
          plannedDate: item.plannedDate,
          ...(item.phase === 'historical'
            ? {
                historicalResolution: item.historicalResolution || 'pending_evidence',
                nonExecutionReason: item.nonExecutionReason.trim()
              }
            : {})
        }))
      }))
    };
  }

  scheduleProgrammingDateError(item: MaintenanceScheduleProgrammingItemDto): string {
    if (!item.plannedDate) return 'Selecciona una fecha.';
    if (item.plannedDate < item.minDate || item.plannedDate > item.maxDate) {
      return `Debe estar entre ${this.formatIsoDateForDisplay(item.minDate)} y ${this.formatIsoDateForDisplay(item.maxDate)}.`;
    }
    const date = new Date(`${item.plannedDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return 'La fecha no es válida.';
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
      return 'Selecciona un día hábil.';
    }
    return '';
  }

  scheduleProgrammingResolutionError(item: MaintenanceScheduleProgrammingItemDto): string {
    if (item.phase !== 'historical') return '';
    if (!item.historicalResolution) return 'Selecciona cómo se resolverá este periodo.';
    if (
      item.historicalResolution === 'not_performed'
      && !item.nonExecutionReason.trim()
    ) {
      return 'La justificación es obligatoria.';
    }
    if (item.nonExecutionReason.trim().length > 500) {
      return 'La justificación no puede superar 500 caracteres.';
    }
    return '';
  }

  get scheduleProgrammingValid(): boolean {
    return Boolean(
      this.scheduleProgrammingPreview?.schedules.every((schedule) =>
        schedule.items.every(
          (item) =>
            !this.scheduleProgrammingDateError(item)
            && !this.scheduleProgrammingResolutionError(item)
        )
      )
    );
  }

  get scheduleProgrammingWindowCount(): number {
    return this.scheduleProgrammingPreview?.schedules.reduce(
      (total, schedule) => total + schedule.items.length,
      0
    ) ?? 0;
  }

  get scheduleProgrammingHistoricalCount(): number {
    return this.scheduleProgrammingPreview?.schedules.reduce(
      (total, schedule) => total + schedule.historicalItems,
      0
    ) ?? 0;
  }

  get scheduleProgrammingEvidenceCount(): number {
    return this.scheduleProgrammingPreview?.schedules.reduce(
      (total, schedule) => total + schedule.items.filter(
        (item) =>
          item.phase === 'historical'
          && item.historicalResolution === 'pending_evidence'
      ).length,
      0
    ) ?? 0;
  }

  get scheduleProgrammingNotPerformedCount(): number {
    return this.scheduleProgrammingPreview?.schedules.reduce(
      (total, schedule) => total + schedule.items.filter(
        (item) =>
          item.phase === 'historical'
          && item.historicalResolution === 'not_performed'
      ).length,
      0
    ) ?? 0;
  }

  get scheduleProgrammingCurrentCount(): number {
    return this.scheduleProgrammingPreview?.schedules.reduce(
      (total, schedule) => total + schedule.currentItems,
      0
    ) ?? 0;
  }

  scheduleProgrammingPhaseLabel(item: MaintenanceScheduleProgrammingItemDto): string {
    if (item.phase === 'historical') {
      return item.historicalResolution === 'not_performed'
        ? 'No realizado'
        : 'PDF por conciliar';
    }
    return {
      current: 'Ventana vigente',
      future: 'Próximo mantenimiento'
    }[item.phase] || item.phase;
  }

  scheduleProgrammingDateLabel(item: MaintenanceScheduleProgrammingItemDto): string {
    if (item.phase === 'historical') return 'Fecha del mantenimiento físico';
    if (item.phase === 'current') return 'Fecha para activar o realizar';
    return 'Fecha programada';
  }

  formatScheduleMonth(value: string): string {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return value;
    const formatted = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return formatted.charAt(0).toLocaleUpperCase('es-CO') + formatted.slice(1);
  }

  cancelScheduleProgramming(): void {
    if (this.assetSaving) return;
    this.scheduleProgrammingPreview = null;
    this.scheduleProgrammingError = '';
  }

  async setScheduleProgrammingMode(mode: MaintenancePeriodicityChangeMode): Promise<void> {
    if (
      this.assetSaving
      || this.scheduleProgrammingLoading
      || this.scheduleProgrammingPreview?.changeMode === mode
      || (mode === 'correction' && !this.scheduleProgrammingPreview?.correctionAllowed)
    ) return;
    await this.prepareScheduleProgramming(mode);
  }

  async confirmScheduleProgramming(): Promise<void> {
    if (!this.scheduleProgrammingValid || this.assetSaving) return;
    this.scheduleProgrammingError = '';
    await this.onCreateAsset(true);
  }

  private async prepareScheduleProgramming(
    changeMode: MaintenancePeriodicityChangeMode = 'correction'
  ): Promise<'required' | 'not_required' | 'error'> {
    if (!this.selectedClientId || !this.editingAssetId) return 'not_required';
    this.scheduleProgrammingLoading = true;
    this.errorMessage = '';
    try {
      const preview = await this.biomed.previewAssetMaintenanceSchedule(
        this.selectedClientId,
        this.editingAssetId,
        {
          maintenanceFrequency: this.maintenanceFrequency,
          areaId: this.areaId || null,
          locationId: this.locationId || null,
          acquisitionDate: this.acquisitionDate || null,
          warrantyYears: this.warrantyYears,
          changeMode
        }
      );
      if (!preview.requiresConfirmation) return 'not_required';
      this.scheduleProgrammingPreview = preview;
      this.scheduleProgrammingError = '';
      return 'required';
    } catch (error) {
      console.error(error);
      this.errorMessage = this.extractErrorMessage(error)
        || 'No se pudieron preparar las fechas del cronograma aprobado.';
      return 'error';
    } finally {
      this.scheduleProgrammingLoading = false;
      this.cdr.detectChanges();
    }
  }

  async onCreateAsset(skipScheduleProgrammingPreview = false): Promise<void> {
    if (this.assetSaving || this.scheduleProgrammingLoading) return;
    if (!this.selectedClientId || !this.code || !this.name) {
      this.errorMessage = 'Código y nombre son obligatorios.';
      return;
    }
    if (!this.isIndustrialAssetModule && this.requiresSanitaryClassification && !this.riskClass) {
      this.errorMessage = 'Selecciona la clasificación de riesgo sanitario.';
      return;
    }
    if (
      !this.isIndustrialAssetModule &&
      this.requiresElectricalClassification &&
      (!this.electricalProtectionClass || !this.appliedPartType)
    ) {
      this.errorMessage = 'Selecciona la clase de protección eléctrica y el tipo de parte aplicada.';
      return;
    }
    if (this.warrantyYears && !this.acquisitionDate) {
      this.errorMessage = 'La fecha de adquisición es obligatoria cuando el equipo tiene garantía.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    if (this.editingAssetId && this.maintenanceFrequencyChanged() && !skipScheduleProgrammingPreview) {
      const preparation = await this.prepareScheduleProgramming();
      if (preparation !== 'not_required') return;
    }
    this.assetSaving = true;
    let historicalFollowUpAssetId = '';
    let historicalFollowUpDates: string[] = [];
    let historicalFollowUpCount = 0;
    try {
      if (this.editingAssetId) {
        const editedAssetId = this.editingAssetId;
        const result = await this.biomed.updateAsset(this.selectedClientId, this.editingAssetId, {
          code: this.code.trim(),
          name: this.catalogStorageValue(this.name),
          brand: this.catalogStorageValue(this.brand) || undefined,
          model: this.catalogStorageValue(this.model) || undefined,
          assetCategory: this.assetCategory,
          serial: this.serial.trim() || undefined,
          invimaReg: this.isIndustrialAssetModule ? undefined : (this.invimaReg.trim() || undefined),
          acquisitionType: this.acquisitionType,
          contractText: this.contractText.trim() || undefined,
          acquisitionDate: this.acquisitionDate || undefined,
          usefulLifeYears: this.usefulLifeYears ?? undefined,
          warrantyYears: this.warrantyYears ?? undefined,
          supplierName: this.supplierName.trim() || undefined,
          supplierPhone: this.supplierPhone.trim() || undefined,
          supplierEmail: this.supplierEmail.trim() || undefined,
          powerType: this.powerType,
          voltage: this.voltage.trim() || undefined,
          tempMin: this.tempMin ?? undefined,
          tempMax: this.tempMax ?? undefined,
          humidityMin: this.humidityMin ?? undefined,
          humidityMax: this.humidityMax ?? undefined,
          maintenanceFrequency: this.maintenanceFrequency,
          requiresCalibration: !this.isIndustrialAssetModule && this.requiresCalibration,
          calibrationFrequency: !this.isIndustrialAssetModule && this.requiresCalibration
            ? this.calibrationFrequency
            : undefined,
          siteId: this.siteId || undefined,
          areaId: this.areaId || undefined,
          locationId: this.locationId || undefined,
          requiresSanitaryClassification: !this.isIndustrialAssetModule && this.requiresSanitaryClassification,
          riskClass: !this.isIndustrialAssetModule && this.requiresSanitaryClassification ? this.riskClass : undefined,
          requiresElectricalClassification: !this.isIndustrialAssetModule && this.requiresElectricalClassification,
          electricalProtectionClass: !this.isIndustrialAssetModule && this.requiresElectricalClassification
            ? this.electricalProtectionClass
            : undefined,
          appliedPartType: !this.isIndustrialAssetModule && this.requiresElectricalClassification
            ? this.appliedPartType
            : undefined,
          isMobile: this.isMobile,
          manufacturer: this.manufacturer.trim() || undefined,
          photo: this.photo,
          accessories: this.accessories,
          cleaning: this.cleaning,
          recommendations: this.recommendations,
          maintenanceScheduleProgramming: this.scheduleProgrammingSelection(),
          manualOperacion: this.manualOperacion,
          manualServicio: this.manualServicio
        });
        const evidence = result.scheduleSync?.historicalEvidenceRequired ?? [];
        if (evidence.length) {
          historicalFollowUpAssetId = editedAssetId;
          historicalFollowUpDates = evidence.map((item) => item.plannedDate);
          historicalFollowUpCount = evidence.length;
        }
        this.successMessage = `Hoja de vida actualizada.${this.catalogReviewNotice(result.catalogReview)}${this.scheduleSyncNotice(result.scheduleSync)}`;
      } else {
        const result = await this.biomed.createAsset(this.selectedClientId, {
          code: this.code.trim(),
          name: this.catalogStorageValue(this.name),
          brand: this.catalogStorageValue(this.brand) || undefined,
          model: this.catalogStorageValue(this.model) || undefined,
          assetCategory: this.assetCategory,
          serial: this.serial.trim() || undefined,
          invimaReg: this.isIndustrialAssetModule ? undefined : (this.invimaReg.trim() || undefined),
          acquisitionType: this.acquisitionType,
          contractText: this.contractText.trim() || undefined,
          acquisitionDate: this.acquisitionDate || undefined,
          usefulLifeYears: this.usefulLifeYears ?? undefined,
          warrantyYears: this.warrantyYears ?? undefined,
          supplierName: this.supplierName.trim() || undefined,
          supplierPhone: this.supplierPhone.trim() || undefined,
          supplierEmail: this.supplierEmail.trim() || undefined,
          powerType: this.powerType,
          voltage: this.voltage.trim() || undefined,
          tempMin: this.tempMin ?? undefined,
          tempMax: this.tempMax ?? undefined,
          humidityMin: this.humidityMin ?? undefined,
          humidityMax: this.humidityMax ?? undefined,
          maintenanceFrequency: this.maintenanceFrequency,
          scheduleEnrollmentMode: this.scheduleEnrollmentMode,
          requiresCalibration: !this.isIndustrialAssetModule && this.requiresCalibration,
          calibrationFrequency: !this.isIndustrialAssetModule && this.requiresCalibration
            ? this.calibrationFrequency
            : undefined,
          siteId: this.siteId || undefined,
          areaId: this.areaId || undefined,
          locationId: this.locationId || undefined,
          requiresSanitaryClassification: !this.isIndustrialAssetModule && this.requiresSanitaryClassification,
          riskClass: !this.isIndustrialAssetModule && this.requiresSanitaryClassification ? this.riskClass : undefined,
          requiresElectricalClassification: !this.isIndustrialAssetModule && this.requiresElectricalClassification,
          electricalProtectionClass: !this.isIndustrialAssetModule && this.requiresElectricalClassification
            ? this.electricalProtectionClass
            : undefined,
          appliedPartType: !this.isIndustrialAssetModule && this.requiresElectricalClassification
            ? this.appliedPartType
            : undefined,
          isMobile: this.isMobile,
          manufacturer: this.manufacturer.trim() || undefined,
          photo: this.photo,
          accessories: this.accessories,
          cleaning: this.cleaning,
          recommendations: this.recommendations,
          manualOperacion: this.manualOperacion,
          manualServicio: this.manualServicio
        });
        const evidence = result.scheduleSync?.historicalEvidenceRequired ?? [];
        if (result.id && evidence.length) {
          historicalFollowUpAssetId = result.id;
          historicalFollowUpDates = evidence.map((item) => item.plannedDate);
          historicalFollowUpCount = evidence.length;
        }
        this.successMessage = `Hoja de vida creada.${this.catalogReviewNotice(result.catalogReview)}${this.scheduleSyncNotice(result.scheduleSync)}`;
      }

      this.resetForm();
      this.assetModalMode = null;
      this.selectedAssetForModal = null;
      await Promise.all([this.loadAssets(), this.loadEquipmentCatalog(), this.loadPendingProtocols()]);
      if (historicalFollowUpAssetId && historicalFollowUpDates.length) {
        if (this.auth.hasPermission('asset_history:upload')) {
          this.activeLifeSheetView = 'pending_protocols';
          const nextPendingProtocol = this.pendingProtocols.find((item) =>
            item.asset_id === historicalFollowUpAssetId
            && historicalFollowUpDates.includes(item.planned_date)
            && item.eligible
          );
          if (nextPendingProtocol) this.openPendingProtocolUpload(nextPendingProtocol);
        } else {
          this.successMessage += ` Solicita el permiso temporal “Migrar PDFs históricos de equipos” para cargar ${historicalFollowUpCount} evidencia(s) pendiente(s).`;
        }
      }
    } catch (error) {
      console.error(error);
      const message = this.extractErrorMessage(error) || 'No se pudo guardar la hoja de vida.';
      if (
        !skipScheduleProgrammingPreview
        && this.editingAssetId
        && this.extractErrorCode(error) === 'MAINTENANCE_SCHEDULE_DATES_REQUIRED'
      ) {
        this.assetSaving = false;
        const preparation = await this.prepareScheduleProgramming();
        if (preparation === 'not_required') this.errorMessage = message;
        return;
      }
      if (this.scheduleProgrammingPreview) {
        this.scheduleProgrammingError = message;
      } else {
        this.errorMessage = message;
      }
    } finally {
      this.assetSaving = false;
      this.cdr.detectChanges();
    }
  }

  startEdit(asset: InventoryPanelItem): void {
    void this.openEditModal(asset);
  }

  cancelEdit(): void {
    this.closeAssetModal();
  }

  resetForm(): void {
    this.editingAssetId = null;
    this.wizardStep = 0;
    this.code = '';
    this.name = '';
    this.brand = '';
    this.model = '';
    this.catalogEquipmentSelectionKey = '';
    this.catalogBrandSelectionKey = '';
    this.serial = '';
    this.invimaReg = '';
    this.acquisitionType = 'COMPRA DIRECTA';
    this.contractText = '';
    this.acquisitionDate = '';
    this.usefulLifeYears = null;
    this.warrantyYears = null;
    this.supplierName = '';
    this.supplierPhone = '';
    this.supplierEmail = '';
    this.powerType = 'AC';
    this.voltage = '';
    this.tempMin = null;
    this.tempMax = null;
    this.humidityMin = null;
    this.humidityMax = null;
    this.maintenanceFrequency = 'mensual';
    this.scheduleEnrollmentMode = 'new';
    this.originalMaintenanceFrequency = '';
    this.scheduleProgrammingPreview = null;
    this.scheduleProgrammingError = '';
    this.scheduleProgrammingLoading = false;
    this.assetSaving = false;
    this.requiresCalibration = false;
    this.calibrationFrequency = 'anual';
    this.requiresSanitaryClassification = !this.isIndustrialAssetModule;
    this.riskClass = this.isIndustrialAssetModule ? '' : 'Clase I';
    this.requiresElectricalClassification = false;
    this.electricalProtectionClass = '';
    this.appliedPartType = '';
    this.siteId = this.sites[0]?.id ?? '';
    const siteAreas = this.areasForSelectedSite();
    this.areaId = siteAreas[0]?.id ?? this.areas[0]?.id ?? '';
    void this.loadLocationsForForm();
    this.manufacturer = '';
    this.isMobile = false;
    this.photo = null;
    if (this.photoPreviewUrl) {
      URL.revokeObjectURL(this.photoPreviewUrl);
      this.photoPreviewUrl = null;
    }
    this.manualOperacion = null;
    this.manualServicio = null;
    this.accessories = [];
    this.cleaning = [];
    this.recommendations = [];
  }

  async loadAssetDetails(assetId: string): Promise<void> {
    if (!this.selectedClientId) return;
    const data = await this.biomed.getAssetDetails(this.selectedClientId, assetId);
    const dataCategory: AssetCategory = data.asset_category === 'industrial' ? 'industrial' : 'biomedical';
    if (dataCategory !== this.assetCategory) {
      throw new Error('El equipo no pertenece a esta categoría de hojas de vida.');
    }
    this.editingAssetId = assetId;
    this.code = data.code ?? '';
    this.name = data.name ?? '';
    this.brand = data.brand ?? '';
    this.model = data.model ?? '';
    this.catalogEquipmentSelectionKey = this.normalizeCatalogSelection(this.name);
    this.catalogBrandSelectionKey = `${this.catalogEquipmentSelectionKey}|${this.normalizeCatalogSelection(this.brand)}`;
    this.serial = data.serial ?? '';
    this.invimaReg = data.invima_reg ?? '';
    this.acquisitionType = data.acquisition_type ?? 'COMPRA DIRECTA';
    this.contractText = data.contract_text ?? '';
    this.acquisitionDate = data.acquisition_date ?? '';
    this.usefulLifeYears = data.useful_life_years ?? null;
    this.warrantyYears = data.warranty_years ?? null;
    this.supplierName = data.supplier_name ?? '';
    this.supplierPhone = data.supplier_phone ?? '';
    this.supplierEmail = data.supplier_email ?? '';
    this.powerType = data.power_type ?? 'AC';
    this.voltage = data.voltage ?? '';
    this.tempMin = data.temp_min ?? null;
    this.tempMax = data.temp_max ?? null;
    this.humidityMin = data.humidity_min ?? null;
    this.humidityMax = data.humidity_max ?? null;
    this.originalMaintenanceFrequency = this.normalizeFrequency(data.maintenance_frequency ?? '');
    this.maintenanceFrequency = data.maintenance_frequency ?? 'mensual';
    this.requiresCalibration = this.isIndustrialAssetModule ? false : (data.requires_calibration ?? false);
    this.calibrationFrequency = data.calibration_frequency ?? 'anual';
    this.requiresSanitaryClassification = this.isIndustrialAssetModule
      ? false
      : (data.requires_sanitary_classification ?? Boolean(data.risk_class));
    this.riskClass = this.requiresSanitaryClassification ? (data.risk_class ?? 'Clase I') : '';
    this.requiresElectricalClassification = this.isIndustrialAssetModule
      ? false
      : (data.requires_electrical_classification ?? false);
    this.electricalProtectionClass = this.requiresElectricalClassification
      ? (data.electrical_protection_class ?? '')
      : '';
    this.appliedPartType = this.requiresElectricalClassification ? (data.applied_part_type ?? '') : '';
    this.isMobile = data.is_mobile ?? false;
    this.manufacturer = data.manufacturer ?? '';
    this.siteId = data.site_id ?? this.siteId;
    this.areaId = data.area_id ?? this.areaId;
    await this.loadLocationsForForm();
    this.locationId = data.location_id ?? this.locationId;
    this.accessories = (data.accessories ?? []).map((a: any) => ({
      name: a.name,
      quantity: a.quantity ?? 1,
      brand: a.brand ?? '',
      serial: a.serial ?? ''
    }));
    this.cleaning = (data.cleaning ?? []).map((c: any) => ({
      procedure: c.procedure,
      frequency: c.frequency ?? '',
      responsible: c.responsible ?? ''
    }));
    this.recommendations = (data.recommendations ?? []).map((r: any) => ({
      text: r.text
    }));
  }

  onManualOperacionSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (file && this.isFileTooLarge(file, this.maxPdfSizeMb)) {
      this.errorMessage = `El PDF supera ${this.maxPdfSizeMb} MB.`;
      this.manualOperacion = null;
      input.value = '';
      return;
    }
    this.manualOperacion = file;
  }

  onManualServicioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (file && this.isFileTooLarge(file, this.maxPdfSizeMb)) {
      this.errorMessage = `El PDF supera ${this.maxPdfSizeMb} MB.`;
      this.manualServicio = null;
      input.value = '';
      return;
    }
    this.manualServicio = file;
  }

  addAccessory(): void {
    this.accessories.push({ name: '', quantity: 1, brand: '', serial: '' });
  }

  removeAccessory(index: number): void {
    this.accessories.splice(index, 1);
  }

  addCleaning(): void {
    this.cleaning.push({ procedure: '', frequency: '', responsible: '' });
  }

  removeCleaning(index: number): void {
    this.cleaning.splice(index, 1);
  }

  addRecommendation(): void {
    this.recommendations.push({ text: '' });
  }

  removeRecommendation(index: number): void {
    this.recommendations.splice(index, 1);
  }

  async deleteAsset(asset: InventoryPanelItem): Promise<void> {
    if (!this.selectedClientId) return;
    await this.biomed.deleteAsset(this.selectedClientId, asset.id);
    await Promise.all([this.loadAssets(), this.loadPendingProtocols()]);
  }

  async downloadPdf(asset: AssetView): Promise<void> {
    if (!this.selectedClientId) return;
    const blob = await this.biomed.downloadAssetFullPdf(this.selectedClientId, asset.id);
    this.openBlob(blob);
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (file && this.isFileTooLarge(file, this.maxImageSizeMb)) {
      this.errorMessage = `La imagen supera ${this.maxImageSizeMb} MB.`;
      this.photo = null;
      input.value = '';
      return;
    }
    this.photo = file;
    if (this.photoPreviewUrl) {
      URL.revokeObjectURL(this.photoPreviewUrl);
      this.photoPreviewUrl = null;
    }
    if (this.photo) {
      this.photoPreviewUrl = URL.createObjectURL(this.photo);
    }
  }

  private isFileTooLarge(file: File, maxMb: number): boolean {
    return file.size > maxMb * 1024 * 1024;
  }

  assetPhotoUrl(asset: AssetView): string | null {
    if (!asset.photoPath) {
      return null;
    }
    if (asset.photoPath.startsWith('http')) {
      return asset.photoPath;
    }
    return `${this.apiBase}${asset.photoPath}`;
  }
}
