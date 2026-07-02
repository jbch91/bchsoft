import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BiomedService } from '../../biomed/biomed.service';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { InventoryPanelComponent, InventoryPanelItem } from '../../shared/inventory-panel/inventory-panel.component';
import { Workbook as ExcelWorkbookConstructor } from 'exceljs';
import * as XLSX from 'xlsx';

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
  code: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  invimaReg: string;
  siteId: string;
  areaId: string;
  locationId: string;
  riskClass: string;
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
  isMobile?: boolean;
  manufacturer?: string | null;
  areaName?: string | null;
  locationName?: string | null;
  siteName?: string | null;
  siteId?: string | null;
  areaId?: string | null;
  locationId?: string | null;
}

interface ExcelCell {
  font?: unknown;
  fill?: unknown;
  alignment?: unknown;
  border?: unknown;
  dataValidation?: unknown;
}

interface ExcelRow {
  height?: number;
  font?: unknown;
  fill?: unknown;
  eachCell: (callback: (cell: ExcelCell, colNumber: number) => void) => void;
}

interface ExcelColumn {
  numFmt?: string;
}

interface ExcelWorksheet {
  columns: unknown[];
  autoFilter?: unknown;
  addRow: (row: unknown) => ExcelRow;
  addRows: (rows: unknown[]) => void;
  getCell: (rowNumber: number, columnNumber: number) => ExcelCell;
  getColumn: (columnNumber: number) => ExcelColumn;
  getRow: (rowNumber: number) => ExcelRow;
  eachRow: (callback: (row: ExcelRow, rowNumber: number) => void) => void;
}

interface ExcelWorkbook {
  creator: string;
  created: Date;
  addWorksheet: (name: string, options?: unknown) => ExcelWorksheet;
  xlsx: {
    writeBuffer: () => Promise<BlobPart>;
  };
}

@Component({
  selector: 'app-hojas-de-vida',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent, InventoryPanelComponent],
  templateUrl: './hojas-de-vida.component.html',
  styleUrl: './hojas-de-vida.component.scss'
})
export class HojasDeVidaComponent {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  private readonly maxImageSizeMb = 5;
  private readonly maxPdfSizeMb = 10;
  private readonly maxImportRows = 500;
  private readonly maxImportFileSizeMb = 10;
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  assets: AssetView[] = [];
  sites: SiteOption[] = [];
  areas: AreaOption[] = [];
  locations: LocationOption[] = [];
  locationsAll: LocationOption[] = [];
  siteEdits: Record<string, string> = {};
  siteAddressEdits: Record<string, string> = {};
  areaEdits: Record<string, string> = {};
  locationEdits: Record<string, string> = {};
  areasOpen = true;
  areasFormOpen = false;
  areasView: 'list' | 'create-site' | 'create-area' | 'create-location' = 'list';
  loading = false;
  errorMessage = '';
  successMessage = '';
  viewMode: 'inventory' | 'form' | 'areas' = 'inventory';
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
  readonly importHeaders = [
    'Código*',
    'Nombre*',
    'Marca*',
    'Modelo*',
    'Serie*',
    'Sede*',
    'Área*',
    'Ubicación*',
    'Registro Invima*',
    'Riesgo*',
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
  readonly acquisitionTypes = ['COMPRA DIRECTA', 'DONACION'];
  readonly riskClasses = ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'];
  readonly frequencyOptions = ['mensual', 'bimensual', 'trimestral', 'cuatrimestral', 'semestral', 'anual'];
  readonly equipmentTypeOptions = ['Fijo', 'Móvil'];
  readonly warrantyYearOptions = [1, 2, 3];

  editingAreaId: string | null = null;
  editingSiteId: string | null = null;
  editingLocationId: string | null = null;
  editingAssetId: string | null = null;
  code = '';
  name = '';
  brand = '';
  model = '';
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
  requiresCalibration = false;
  calibrationFrequency = 'anual';
  siteId = '';
  areaId = '';
  locationId = '';
  riskClass = 'Clase I';
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

  newAreaName = '';
  newSiteName = '';
  newSiteAddress = '';
  newLocationName = '';

  constructor(
    private readonly biomed: BiomedService,
    private readonly admin: AdminService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute
  ) {
    void this.init();
    this.route.queryParams.subscribe((params) => {
      const assetId = params['assetId'];
      if (assetId) {
        void this.loadAssetDetails(assetId);
      }
    });
  }

  trackByAreaId(_index: number, area: { id: string }): string {
    return area.id;
  }

  trackBySiteId(_index: number, site: { id: string }): string {
    return site.id;
  }

  trackByLocationId(_index: number, location: { id: string }): string {
    return location.id;
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
          this.invimaReg &&
          this.riskClass
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
    await this.auth.refreshSession().catch(() => false);

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
    await this.loadSites();
    await this.loadAreas();
    await this.loadAssets();
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

      const workbook = this.createExcelWorkbook();
      workbook.creator = 'INBIHOSPITALARIO';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Hojas de vida', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      const catalogSheet = workbook.addWorksheet('Catalogos');
      const guideSheet = workbook.addWorksheet('Instrucciones');

      const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort();
      const siteNames = unique(this.sites.map((site) => site.name));
      const areaNames = unique(this.areas.map((area) => area.name));
      const locationNames = unique(this.locationsAll.map((location) => location.name));
      const warrantyOptions = ['1', '2', '3'];
      const yesNoOptions = ['Sí', 'No'];
      const equipmentTypeOptions = ['Fijo', 'Móvil'];

      const headers = this.importHeaders;
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.min(Math.max(header.length + 4, 15), 28)
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

      worksheet.addRow({
        'Código*': 'EQ-001',
        'Nombre*': 'Monitor de signos vitales',
        'Marca*': 'Marca ejemplo',
        'Modelo*': 'Modelo ejemplo',
        'Serie*': 'SER-001',
        'Sede*': siteNames[0] ?? 'Sede principal',
        'Área*': areaNames[0] ?? 'Urgencias',
        'Ubicación*': locationNames[0] ?? 'Consultorio 1',
        'Registro Invima*': 'INVIMA-000',
        'Riesgo*': 'Clase IIA',
        Fabricante: 'Fabricante ejemplo',
        'Tipo equipo': 'Fijo',
        'Forma adquisición': 'COMPRA DIRECTA',
        'Fecha adquisición': '2026-01-15',
        'Vida útil años': 10,
        'Garantía años': 1,
        Proveedor: 'Proveedor ejemplo',
        'Teléfono proveedor': '3000000000',
        'Correo proveedor': 'proveedor@correo.com',
        'Frecuencia mantenimiento': 'trimestral',
        'Requiere calibración': 'No',
        'Frecuencia calibración': 'anual'
      });
      worksheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
      worksheet.getRow(2).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
      worksheet.autoFilter = { from: 'A1', to: 'V1' };
      worksheet.getColumn(14).numFmt = 'yyyy-mm-dd';
      worksheet.getColumn(15).numFmt = '0';
      worksheet.getColumn(16).numFmt = '0';

      catalogSheet.columns = [
        { header: 'Sedes', key: 'sites', width: 28 },
        { header: 'Áreas', key: 'areas', width: 28 },
        { header: 'Ubicaciones', key: 'locations', width: 28 },
        { header: 'Riesgos', key: 'risks', width: 18 },
        { header: 'Frecuencias', key: 'frequencies', width: 20 },
        { header: 'Adquisición', key: 'acquisition', width: 22 },
        { header: 'Tipo equipo', key: 'equipmentType', width: 16 },
        { header: 'Garantía', key: 'warranty', width: 14 },
        { header: 'Sí/No', key: 'yesNo', width: 12 }
      ];
      const catalogColumns = [
        siteNames,
        areaNames,
        locationNames,
        this.riskClasses,
        this.frequencyOptions,
        this.acquisitionTypes,
        equipmentTypeOptions,
        warrantyOptions,
        yesNoOptions
      ];
      const maxCatalogRows = Math.max(...catalogColumns.map((items) => items.length), 1);
      for (let rowIndex = 0; rowIndex < maxCatalogRows; rowIndex += 1) {
        catalogSheet.addRow(catalogColumns.map((items) => items[rowIndex] ?? ''));
      }
      catalogSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5F1F25' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      guideSheet.columns = [{ width: 36 }, { width: 90 }];
      guideSheet.addRows([
        ['Cómo usar la plantilla', 'Selecciona valores desde las listas desplegables cuando el campo lo permita.'],
        ['Orden correcto', 'Primero crea sedes, áreas y ubicaciones en el sistema; luego descarga esta plantilla.'],
        ['Campos obligatorios', 'Todos los encabezados con * son obligatorios.'],
        ['Sede, Área y Ubicación', 'Deben existir previamente en el cliente seleccionado. El sistema validará la relación antes de importar.'],
        ['Fechas', 'Usa formato yyyy-mm-dd o selecciona la fecha desde Excel.'],
        ['Validación final', 'Aunque Excel permita escribir manualmente, el software vuelve a validar todo antes de guardar.']
      ]);
      guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFA64045' } };
      guideSheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        });
      });

      const listFormula = (columnLetter: string, values: string[]): string => {
        const endRow = Math.max(values.length + 1, 2);
        return `Catalogos!$${columnLetter}$2:$${columnLetter}$${endRow}`;
      };
      const addListValidation = (columnNumber: number, formula: string, prompt: string): void => {
        for (let rowNumber = 2; rowNumber <= 501; rowNumber += 1) {
          worksheet.getCell(rowNumber, columnNumber).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Valor no permitido',
            error: 'Selecciona un valor de la lista desplegable.',
            showInputMessage: true,
            promptTitle: 'Selecciona de la lista',
            prompt
          };
        }
      };

      addListValidation(6, listFormula('A', siteNames), 'Selecciona la sede creada para este cliente.');
      addListValidation(7, listFormula('B', areaNames), 'Selecciona el área creada para este cliente.');
      addListValidation(8, listFormula('C', locationNames), 'Selecciona la ubicación creada para este cliente.');
      addListValidation(10, listFormula('D', this.riskClasses), 'Selecciona la clase de riesgo del equipo.');
      addListValidation(12, listFormula('G', equipmentTypeOptions), 'Selecciona si el equipo es fijo o móvil.');
      addListValidation(13, listFormula('F', this.acquisitionTypes), 'Selecciona la forma de adquisición.');
      addListValidation(16, listFormula('H', warrantyOptions), 'Selecciona los años de garantía si aplica.');
      addListValidation(20, listFormula('E', this.frequencyOptions), 'Selecciona la frecuencia de mantenimiento.');
      addListValidation(21, listFormula('I', yesNoOptions), 'Indica si el equipo requiere calibración.');
      addListValidation(22, listFormula('E', this.frequencyOptions), 'Selecciona la frecuencia de calibración si aplica.');

      for (let rowNumber = 2; rowNumber <= 501; rowNumber += 1) {
        worksheet.getCell(rowNumber, 15).dataValidation = {
          type: 'whole',
          operator: 'between',
          allowBlank: true,
          formulae: [0, 50],
          showErrorMessage: true,
          errorTitle: 'Vida útil no válida',
          error: 'Ingresa un número entre 0 y 50.'
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      this.downloadBlob(blob, 'plantilla-hojas-de-vida.xlsx');
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
      const result = await this.biomed.importAssets(this.selectedClientId, validRows.map((row) => row.payload!));
      this.setImportMessage(`Importación completada: ${result.imported} hoja(s) de vida creadas.`, 'success');
      this.importPreviewRows = [];
      this.importFileName = '';
      await this.loadAssets();
      this.resetForm();
      this.viewMode = 'inventory';
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
      const riskClass = this.rowValue(row, 'Riesgo*', 'Riesgo');
      const manufacturer = this.rowValue(row, 'Fabricante');
      const equipmentTypeRaw = this.rowValue(row, 'Tipo equipo');
      const acquisitionTypeRaw = this.rowValue(row, 'Forma adquisición', 'Forma adquisicion');
      const acquisitionDateRaw = this.valueFromRow(row, 'Fecha adquisición', 'Fecha adquisicion');
      const usefulLifeRaw = this.rowValue(row, 'Vida útil años', 'Vida util años');
      const warrantyRaw = this.rowValue(row, 'Garantía años', 'Garantia años');
      const supplierName = this.rowValue(row, 'Proveedor');
      const supplierPhone = this.rowValue(row, 'Teléfono proveedor', 'Telefono proveedor');
      const supplierEmail = this.rowValue(row, 'Correo proveedor');
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
        ['Registro Invima', invimaReg],
        ['Riesgo', riskClass]
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

      const matchedRiskClass = this.matchAllowedValue(riskClass, this.riskClasses);
      if (riskClass && !matchedRiskClass) {
        errors.push(`Riesgo no permitido. Usa: ${this.riskClasses.join(', ')}`);
      }

      const matchedEquipmentType = this.matchAllowedValue(equipmentTypeRaw, this.equipmentTypeOptions);
      if (equipmentTypeRaw && !matchedEquipmentType) {
        errors.push('Tipo equipo no permitido. Usa: Fijo o Móvil');
      }

      const matchedAcquisitionType = this.matchAllowedValue(acquisitionTypeRaw, this.acquisitionTypes);
      if (acquisitionTypeRaw && !matchedAcquisitionType) {
        errors.push('Forma de adquisición no permitida. Usa: COMPRA DIRECTA o DONACION');
      }

      const acquisitionDate = this.parseExcelDate(acquisitionDateRaw);
      if (this.hasCellValue(acquisitionDateRaw) && !acquisitionDate) {
        errors.push('Fecha adquisición no válida. Usa formato día/mes/año');
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

      if (supplierEmail && !this.isValidEmail(supplierEmail)) {
        errors.push('Correo proveedor no tiene un formato válido');
      }

      const maintenanceFrequency = this.normalizeFrequency(maintenanceFrequencyRaw);
      if (maintenanceFrequency && !this.frequencyOptions.includes(maintenanceFrequency)) {
        errors.push(`Frecuencia de mantenimiento no permitida. Usa: ${this.frequencyOptions.join(', ')}`);
      }
      const requiresCalibrationResult = this.parseBooleanText(requiresCalibrationRaw);
      if (!requiresCalibrationResult.valid) {
        errors.push('Requiere calibración debe ser Sí o No');
      }
      const requiresCalibration = requiresCalibrationResult.value;
      const calibrationFrequency = this.normalizeFrequency(calibrationFrequencyRaw) || 'anual';
      if ((requiresCalibration || calibrationFrequencyRaw) && !this.frequencyOptions.includes(calibrationFrequency)) {
        errors.push(`Frecuencia de calibración no permitida. Usa: ${this.frequencyOptions.join(', ')}`);
      }

      const payload = site && area && location && !errors.length
        ? {
            code: code.trim(),
            name: name.trim(),
            brand: brand.trim(),
            model: model.trim(),
            serial: serial.trim(),
            invimaReg: invimaReg.trim(),
            siteId: site.id,
            areaId: area.id,
            locationId: location.id,
            riskClass: matchedRiskClass || 'Clase I',
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
            requiresCalibration,
            calibrationFrequency: requiresCalibration ? calibrationFrequency : undefined
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
      { field: 'Riesgo*', tokens: ['riesgo'] },
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

  private normalizeFrequency(value: string): string {
    return this.normalizeText(value);
  }

  private matchAllowedValue(value: string, allowed: string[]): string | null {
    return allowed.find((item) => this.normalizeText(item) === this.normalizeText(value)) ?? null;
  }

  private parseBooleanText(value: string): { value: boolean; valid: boolean } {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return { value: false, valid: true };
    }
    if (['si', 'true', '1', 'x'].includes(normalized)) {
      return { value: true, valid: true };
    }
    if (['no', 'false', '0'].includes(normalized)) {
      return { value: false, valid: true };
    }
    return { value: false, valid: false };
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const dateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
      return `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    }
    return null;
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
      const rows = await this.biomed.listAssets(this.selectedClientId);
      this.assets = rows.map((row) => ({
        id: row.id,
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
        isMobile: row.is_mobile ?? false,
        manufacturer: row.manufacturer ?? null,
        siteName: row.site_name ?? null,
        siteId: row.site_id ?? null,
        areaName: row.area_name ?? null,
        locationName: row.location_name ?? null,
        areaId: row.area_id ?? null,
        locationId: row.location_id ?? null
      }));
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar las hojas de vida.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
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
      this.siteEdits = Object.fromEntries(this.sites.map((site) => [site.id, site.name]));
      this.siteAddressEdits = Object.fromEntries(this.sites.map((site) => [site.id, site.address ?? '']));
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
      this.areaEdits = Object.fromEntries(this.areas.map((area) => [area.id, area.name]));
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
    this.locationEdits = Object.fromEntries(this.locationsAll.map((loc) => [loc.id, loc.name]));
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
    const rows = await this.biomed.listLocations(this.selectedClientId, this.areaId || undefined);
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
  }

  areasForSelectedSite(): AreaOption[] {
    return this.siteId ? this.areas.filter((area) => area.siteId === this.siteId) : this.areas;
  }

  areasBySite(siteId: string): AreaOption[] {
    return this.areas.filter((area) => area.siteId === siteId);
  }

  locationsByArea(areaId: string): LocationOption[] {
    return this.locationsAll.filter((loc) => loc.areaId === areaId);
  }

  async onSiteForFormChange(): Promise<void> {
    const siteAreas = this.areasForSelectedSite();
    this.areaId = siteAreas[0]?.id ?? '';
    this.locationId = '';
    await this.loadLocationsForForm();
  }

  async onCreateSite(): Promise<void> {
    if (!this.newSiteName || !this.selectedClientId) {
      return;
    }
    const name = this.newSiteName.trim();
    if (this.sites.some((site) => site.name.toLowerCase() === name.toLowerCase())) {
      this.errorMessage = 'Esta sede ya existe para este cliente.';
      this.newSiteName = '';
      alert('Esta sede ya existe para este cliente.');
      return;
    }
    await this.biomed.createSite(this.selectedClientId, name, this.newSiteAddress.trim() || undefined);
    this.newSiteName = '';
    this.newSiteAddress = '';
    await this.loadSites();
    this.cdr.detectChanges();
  }

  async onUpdateSite(siteId: string): Promise<void> {
    const name = this.siteEdits[siteId]?.trim();
    if (!name || !this.selectedClientId) {
      return;
    }
    await this.biomed.updateSite(this.selectedClientId, siteId, {
      name,
      address: this.siteAddressEdits[siteId]?.trim() || null
    });
    this.editingSiteId = null;
    await this.loadSites();
    await this.loadAreas();
    this.cdr.detectChanges();
  }

  async onDeleteSite(siteId: string): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      await this.biomed.deleteSite(this.selectedClientId, siteId);
      if (this.siteId === siteId) {
        this.siteId = '';
      }
      await this.loadSites();
      await this.loadAreas();
      await this.loadAssets();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se puede eliminar una sede con áreas o equipos asociados.';
    }
    this.cdr.detectChanges();
  }

  async onCreateArea(): Promise<void> {
    if (!this.newAreaName || !this.selectedClientId || !this.siteId) {
      return;
    }
    const name = this.newAreaName.trim();
    if (this.areas.some((area) => area.siteId === this.siteId && area.name.toLowerCase() === name.toLowerCase())) {
      this.errorMessage = 'Esta área ya existe para esta sede.';
      this.newAreaName = '';
      alert('Esta área ya existe para esta sede.');
      return;
    }
    await this.biomed.createArea(this.selectedClientId, name, this.siteId);
    this.newAreaName = '';
    await this.loadAreas();
    this.cdr.detectChanges();
  }

  async onCreateLocation(): Promise<void> {
    if (!this.newLocationName || !this.selectedClientId || !this.areaId) {
      return;
    }
    await this.biomed.createLocation(this.selectedClientId, this.areaId, this.newLocationName.trim());
    this.newLocationName = '';
    await this.loadLocationsAll();
    await this.loadLocationsForForm();
    this.cdr.detectChanges();
  }

  async onUpdateArea(areaId: string): Promise<void> {
    const name = this.areaEdits[areaId]?.trim();
    if (!name || !this.selectedClientId) {
      return;
    }
    const area = this.areas.find((item) => item.id === areaId);
    await this.biomed.updateArea(this.selectedClientId, areaId, name, area?.siteId ?? this.siteId ?? null);
    this.editingAreaId = null;
    await this.loadAreas();
    this.cdr.detectChanges();
  }

  async onDeleteArea(areaId: string): Promise<void> {
    if (!this.selectedClientId) return;
    await this.biomed.deleteArea(this.selectedClientId, areaId);
    await this.loadAreas();
    this.cdr.detectChanges();
  }

  async onUpdateLocation(locationId: string): Promise<void> {
    const name = this.locationEdits[locationId]?.trim();
    if (!name || !this.selectedClientId) {
      return;
    }
    const location = this.locationsAll.find((item) => item.id === locationId);
    await this.biomed.updateLocation(this.selectedClientId, locationId, { name, areaId: location?.areaId ?? this.areaId ?? null });
    this.editingLocationId = null;
    await this.loadLocationsAll();
    await this.loadLocationsForForm();
    this.cdr.detectChanges();
  }

  async onDeleteLocation(locationId: string): Promise<void> {
    if (!this.selectedClientId) return;
    await this.biomed.deleteLocation(this.selectedClientId, locationId);
    await this.loadLocationsAll();
    await this.loadLocationsForForm();
    this.cdr.detectChanges();
  }

  startEditArea(areaId: string): void {
    this.editingAreaId = areaId;
  }

  startEditSite(siteId: string): void {
    this.editingSiteId = siteId;
  }

  cancelEditSite(): void {
    this.editingSiteId = null;
  }

  cancelEditArea(): void {
    this.editingAreaId = null;
  }

  startEditLocation(locationId: string): void {
    this.editingLocationId = locationId;
  }

  cancelEditLocation(): void {
    this.editingLocationId = null;
  }

  isEditingLocationInArea(areaId: string): boolean {
    if (!this.editingLocationId) {
      return false;
    }
    return this.locationsByArea(areaId).some((loc) => loc.id === this.editingLocationId);
  }

  async onCreateAsset(): Promise<void> {
    if (!this.selectedClientId || !this.code || !this.name) {
      this.errorMessage = 'Código y nombre son obligatorios.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      if (this.editingAssetId) {
        await this.biomed.updateAsset(this.selectedClientId, this.editingAssetId, {
          code: this.code.trim(),
          name: this.name.trim(),
          brand: this.brand.trim() || undefined,
          model: this.model.trim() || undefined,
          serial: this.serial.trim() || undefined,
          invimaReg: this.invimaReg.trim() || undefined,
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
          requiresCalibration: this.requiresCalibration,
          calibrationFrequency: this.requiresCalibration ? this.calibrationFrequency : undefined,
          siteId: this.siteId || undefined,
          areaId: this.areaId || undefined,
          locationId: this.locationId || undefined,
          riskClass: this.riskClass,
          isMobile: this.isMobile,
          manufacturer: this.manufacturer.trim() || undefined,
          photo: this.photo,
          accessories: this.accessories,
          cleaning: this.cleaning,
          recommendations: this.recommendations,
          manualOperacion: this.manualOperacion,
          manualServicio: this.manualServicio
        });
        this.successMessage = 'Hoja de vida actualizada.';
      } else {
        await this.biomed.createAsset(this.selectedClientId, {
          code: this.code.trim(),
          name: this.name.trim(),
          brand: this.brand.trim() || undefined,
          model: this.model.trim() || undefined,
          serial: this.serial.trim() || undefined,
          invimaReg: this.invimaReg.trim() || undefined,
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
          requiresCalibration: this.requiresCalibration,
          calibrationFrequency: this.requiresCalibration ? this.calibrationFrequency : undefined,
          siteId: this.siteId || undefined,
          areaId: this.areaId || undefined,
          locationId: this.locationId || undefined,
          riskClass: this.riskClass,
          isMobile: this.isMobile,
          manufacturer: this.manufacturer.trim() || undefined,
          photo: this.photo,
          accessories: this.accessories,
          cleaning: this.cleaning,
          recommendations: this.recommendations,
          manualOperacion: this.manualOperacion,
          manualServicio: this.manualServicio
        });
        this.successMessage = 'Hoja de vida creada.';
      }

      this.resetForm();
      await this.loadAssets();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo guardar la hoja de vida.';
    }
  }

  startEdit(asset: InventoryPanelItem): void {
    void this.loadAssetDetails(asset.id);
    this.viewMode = 'form';
  }

  cancelEdit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.editingAssetId = null;
    this.wizardStep = 0;
    this.code = '';
    this.name = '';
    this.brand = '';
    this.model = '';
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
    this.requiresCalibration = false;
    this.calibrationFrequency = 'anual';
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
    this.editingAssetId = assetId;
    this.code = data.code ?? '';
    this.name = data.name ?? '';
    this.brand = data.brand ?? '';
    this.model = data.model ?? '';
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
    this.maintenanceFrequency = data.maintenance_frequency ?? 'mensual';
    this.requiresCalibration = data.requires_calibration ?? false;
    this.calibrationFrequency = data.calibration_frequency ?? 'anual';
    this.riskClass = data.risk_class ?? 'Clase I';
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
    await this.loadAssets();
  }

  async downloadPdf(asset: AssetView): Promise<void> {
    if (!this.selectedClientId) return;
    const blob = await this.biomed.downloadAssetPdf(this.selectedClientId, asset.id);
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
