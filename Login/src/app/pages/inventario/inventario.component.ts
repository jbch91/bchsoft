import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BiomedService } from '../../biomed/biomed.service';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { InventoryPanelComponent, InventoryPanelItem } from '../../shared/inventory-panel/inventory-panel.component';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

interface QrCodeApi {
  toDataURL: typeof import('qrcode').toDataURL;
}

type QrExportFormatValue = 'a4' | 'brother-12' | 'brother-18' | 'brother-24';

interface QrExportFormatOption {
  value: QrExportFormatValue;
  label: string;
  description: string;
  tapeWidthMm?: number;
  minLabelLengthMm?: number;
  maxLabelLengthMm?: number;
  qrSizeMm?: number;
}

interface BrotherLabelLayout {
  codeY: number;
  codeSize: number;
  codeMinSize: number;
  codeChars: number;
  nameY: number;
  nameSize: number;
  nameMinSize: number;
  nameChars: number;
  detailsSize: number;
  detailsMinSize: number;
  detailsChars: number;
  brandY: number;
  serialY: number;
  clientY: number;
  clientSize: number;
  clientMinSize: number;
  clientChars: number;
  softwareY: number;
  softwareSize: number;
}

interface PdfSingleLine {
  text: string;
  fontSize: number;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent, InventoryPanelComponent],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent {
  private readonly publicBase = getPublicBase();
  clients: ClientOption[] = [];
  private assignedClientInfo: ClientOption | null = null;
  clientSearchTerm = '';
  selectedClientId = '';
  items: InventoryPanelItem[] = [];
  loading = false;
  errorMessage = '';
  qrModalOpen = false;
  qrSearchTerm = '';
  qrAreaFilter = '';
  qrStatusFilter = '';
  readonly qrExportFormats: QrExportFormatOption[] = [
    {
      value: 'a4',
      label: 'Hoja A4 · 15 etiquetas',
      description: 'Para impresora convencional, 15 etiquetas por página.'
    },
    {
      value: 'brother-12',
      label: 'Brother TZe 12 mm · prueba',
      description: 'Etiqueta mínima con largo automático. Imprime una unidad y confirma la lectura.',
      tapeWidthMm: 12,
      minLabelLengthMm: 40,
      maxLabelLengthMm: 72,
      qrSizeMm: 9.5
    },
    {
      value: 'brother-18',
      label: 'Brother TZe 18 mm · compacta',
      description: 'Compatible con PT-P700. El largo se ajusta al contenido de cada equipo.',
      tapeWidthMm: 18,
      minLabelLengthMm: 52,
      maxLabelLengthMm: 92,
      qrSizeMm: 14.5
    },
    {
      value: 'brother-24',
      label: 'Brother TZe 24 mm · recomendada',
      description: 'Mayor tamaño de QR y largo automático para nombres extensos.',
      tapeWidthMm: 24,
      minLabelLengthMm: 58,
      maxLabelLengthMm: 108,
      qrSizeMm: 17.5
    }
  ];
  qrExportFormat: QrExportFormatValue = 'brother-18';
  qrSelectedIds = new Set<string>();
  qrGenerating = false;
  qrGenerationMode: 'pdf' | 'png' | null = null;
  qrPreviewLoading = false;
  qrPreviewItemId = '';
  qrPreviewUrl = '';
  qrPage = 1;
  readonly qrPageSize = 30;
  qrProgressCompleted = 0;
  qrProgressTotal = 0;
  qrError = '';
  qrSuccess = '';
  requestModalItem: InventoryPanelItem | null = null;
  requestDescription = '';
  requestSaving = false;
  requestError = '';
  requestSuccess = '';
  private qrOperationId = 0;
  private qrPreviewRequestId = 0;
  private qrApiPromise: Promise<QrCodeApi> | null = null;

  constructor(
    private readonly biomed: BiomedService,
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.init();
  }

  async init(): Promise<void> {
    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await Promise.all([
        this.loadItems(),
        this.loadAssignedClientInfo()
      ]);
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
    return this.clients.find((client) => client.id === this.selectedClientId)
      ?? (this.assignedClientInfo?.id === this.selectedClientId ? this.assignedClientInfo : null);
  }

  get isAreaResponsible(): boolean {
    return this.auth.hasRole('responsable_area');
  }

  get canManageQr(): boolean {
    return !this.isAreaResponsible && !this.auth.hasRole(['lector', 'viewer']);
  }

  get canRequestMaintenance(): boolean {
    return this.isAreaResponsible && this.auth.hasPermission('maintenance:request:create');
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  private async loadAssignedClientInfo(): Promise<void> {
    try {
      const client = await this.admin.getMyClient();
      this.assignedClientInfo = {
        id: client.id,
        name: client.name,
        nit: client.nit,
        city: client.city,
        email: client.email,
        address: client.address,
        logoPath: client.logo_path
      };
    } catch (error) {
      console.warn('No se pudo cargar la identificación del cliente para el inventario.', error);
    } finally {
      this.cdr.detectChanges();
    }
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
        siteId: row.site_id ?? null,
        siteName: row.site_name ?? null,
        areaId: row.area_id ?? null,
        areaName: row.area_name ?? null,
        locationId: row.location_id ?? null,
        locationName: row.location_name ?? null,
        status: row.status,
        acquisitionDate: row.acquisition_date ?? null,
        warrantyYears: row.warranty_years ?? null,
        hasPendingSpare: Boolean(row.has_pending_spare)
      }));
      this.qrSelectedIds.clear();
      if (this.qrModalOpen) {
        this.resetQrWorkspace();
        const firstItem = this.qrFilteredItems[0];
        if (firstItem) void this.previewQr(firstItem);
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar el inventario.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openQrModal(): void {
    if (!this.canManageQr) return;
    this.qrModalOpen = true;
    this.qrError = '';
    this.qrSuccess = '';
    this.resetQrWorkspace();
    const firstItem = this.qrFilteredItems[0];
    if (firstItem) void this.previewQr(firstItem);
  }

  closeQrModal(): void {
    this.cancelQrGeneration(false);
    this.qrPreviewRequestId += 1;
    this.qrModalOpen = false;
    this.qrError = '';
    this.qrSuccess = '';
    this.qrPreviewLoading = false;
    this.qrPreviewItemId = '';
    this.qrPreviewUrl = '';
  }

  @HostListener('document:keydown.escape')
  closeActiveInventoryModal(): void {
    if (this.qrModalOpen) {
      this.closeQrModal();
      return;
    }
    if (this.requestModalItem && !this.requestSaving) {
      this.closeMaintenanceRequest();
    }
  }

  openMaintenanceRequest(item: InventoryPanelItem): void {
    if (!this.canRequestMaintenance) return;
    this.requestModalItem = item;
    this.requestDescription = '';
    this.requestError = '';
    this.requestSuccess = '';
  }

  closeMaintenanceRequest(): void {
    if (this.requestSaving) return;
    this.requestModalItem = null;
    this.requestDescription = '';
    this.requestError = '';
  }

  async submitMaintenanceRequest(): Promise<void> {
    const item = this.requestModalItem;
    if (!item || !this.selectedClientId || this.requestSaving) return;

    const description = this.requestDescription.replace(/\s+/g, ' ').trim();
    if (description.length < 10) {
      this.requestError = 'Describe la falla o necesidad con al menos 10 caracteres.';
      return;
    }

    this.requestSaving = true;
    this.requestError = '';
    try {
      await this.maintenance.createRequest({
        clientId: this.selectedClientId,
        assetId: item.id,
        assetCategory: 'biomedical',
        type: 'correctivo',
        description
      });
      this.requestSuccess = `Solicitud enviada para ${item.code} - ${item.name}.`;
      this.requestModalItem = null;
      this.requestDescription = '';
    } catch (error: any) {
      this.requestError = error?.error?.message ?? 'No se pudo enviar la solicitud de revisión.';
    } finally {
      this.requestSaving = false;
      this.cdr.detectChanges();
    }
  }

  get qrAreaOptions(): string[] {
    return Array.from(new Set(this.qrEligibleItems.map((item) => item.areaName || '').filter(Boolean))).sort();
  }

  get qrStatusOptions(): string[] {
    return Array.from(new Set(this.qrEligibleItems.map((item) => item.status || '').filter(Boolean))).sort();
  }

  get qrEligibleItems(): InventoryPanelItem[] {
    return this.items.filter((item) => item.status !== 'dado_de_baja');
  }

  get qrFilteredItems(): InventoryPanelItem[] {
    const term = this.normalize(this.qrSearchTerm);
    return this.qrEligibleItems.filter((item) => {
      if (this.qrAreaFilter && item.areaName !== this.qrAreaFilter) return false;
      if (this.qrStatusFilter && item.status !== this.qrStatusFilter) return false;
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

  get qrSelectedItems(): InventoryPanelItem[] {
    return this.qrEligibleItems.filter((item) => this.qrSelectedIds.has(item.id));
  }

  get qrPagedItems(): InventoryPanelItem[] {
    const offset = (this.qrPage - 1) * this.qrPageSize;
    return this.qrFilteredItems.slice(offset, offset + this.qrPageSize);
  }

  get qrPageCount(): number {
    return Math.max(1, Math.ceil(this.qrFilteredItems.length / this.qrPageSize));
  }

  get qrPreviewItem(): InventoryPanelItem | null {
    return this.qrEligibleItems.find((item) => item.id === this.qrPreviewItemId) ?? null;
  }

  get qrExportItems(): InventoryPanelItem[] {
    return this.qrSelectedItems.length ? this.qrSelectedItems : this.qrFilteredItems;
  }

  get qrExportScopeLabel(): string {
    return this.qrSelectedItems.length ? 'seleccionados' : 'filtrados';
  }

  get selectedQrExportFormat(): QrExportFormatOption {
    return this.qrExportFormats.find((format) => format.value === this.qrExportFormat)
      ?? this.qrExportFormats[0];
  }

  get qrExportButtonLabel(): string {
    const count = this.qrExportItems.length;
    if (this.qrGenerationMode === 'pdf') return 'Generando PDF...';
    return this.qrExportFormat === 'a4'
      ? `Descargar PDF A4 (${count})`
      : `Descargar etiquetas (${count})`;
  }

  get qrAllFilteredSelected(): boolean {
    return this.qrFilteredItems.length > 0
      && this.qrFilteredItems.every((item) => this.qrSelectedIds.has(item.id));
  }

  isQrSelected(item: InventoryPanelItem): boolean {
    return this.qrSelectedIds.has(item.id);
  }

  toggleQrSelection(item: InventoryPanelItem): void {
    if (this.qrSelectedIds.has(item.id)) {
      this.qrSelectedIds.delete(item.id);
      return;
    }
    this.qrSelectedIds.add(item.id);
  }

  toggleAllQrFiltered(): void {
    if (this.qrAllFilteredSelected) {
      this.qrFilteredItems.forEach((item) => this.qrSelectedIds.delete(item.id));
      return;
    }
    this.selectAllQrFiltered();
  }

  selectAllQrFiltered(): void {
    this.qrFilteredItems.forEach((item) => this.qrSelectedIds.add(item.id));
  }

  clearQrSelection(): void {
    this.qrSelectedIds.clear();
  }

  clearQrFilters(): void {
    this.qrSearchTerm = '';
    this.qrAreaFilter = '';
    this.qrStatusFilter = '';
    this.onQrFiltersChanged();
  }

  onQrFiltersChanged(): void {
    this.qrPage = 1;
    const previewStillVisible = this.qrFilteredItems.some((item) => item.id === this.qrPreviewItemId);
    if (previewStillVisible) return;

    this.qrPreviewRequestId += 1;
    this.qrPreviewItemId = '';
    this.qrPreviewUrl = '';
    this.qrPreviewLoading = false;
    const firstItem = this.qrFilteredItems[0];
    if (firstItem) void this.previewQr(firstItem);
  }

  setQrPage(page: number): void {
    this.qrPage = Math.min(Math.max(page, 1), this.qrPageCount);
  }

  async previewQr(item: InventoryPanelItem): Promise<void> {
    const requestId = ++this.qrPreviewRequestId;
    this.qrPreviewItemId = item.id;
    this.qrPreviewUrl = '';
    this.qrPreviewLoading = true;
    this.qrError = '';
    try {
      const dataUrl = await this.createQrDataUrl(item, 320);
      if (requestId !== this.qrPreviewRequestId || this.qrPreviewItemId !== item.id) return;
      this.qrPreviewUrl = dataUrl;
    } catch (error) {
      console.error('No se pudo generar la vista previa QR.', error);
      if (requestId === this.qrPreviewRequestId) {
        this.qrError = `No se pudo generar el QR de ${item.code || item.name}.`;
      }
    } finally {
      if (requestId === this.qrPreviewRequestId) {
        this.qrPreviewLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async downloadQrPng(item: InventoryPanelItem): Promise<void> {
    if (this.qrGenerating) return;
    const operationId = ++this.qrOperationId;
    this.qrGenerating = true;
    this.qrGenerationMode = 'png';
    this.qrProgressCompleted = 0;
    this.qrProgressTotal = 1;
    this.qrError = '';
    this.qrSuccess = '';
    try {
      const dataUrl = await this.createQrDataUrl(item, 720);
      if (operationId !== this.qrOperationId) return;
      this.downloadDataUrl(dataUrl, `${this.safeFilename(item.code || item.name)}-qr.png`);
      this.qrProgressCompleted = 1;
      this.qrSuccess = `QR de ${item.code || item.name} descargado.`;
    } catch (error) {
      console.error('No se pudo descargar el QR.', error);
      if (operationId === this.qrOperationId) {
        this.qrError = `No se pudo generar el QR de ${item.code || item.name}.`;
      }
    } finally {
      if (operationId === this.qrOperationId) {
        this.qrGenerating = false;
        this.qrGenerationMode = null;
        this.cdr.detectChanges();
      }
    }
  }

  async downloadQrPdf(): Promise<void> {
    if (this.qrGenerating) return;
    const targets = this.qrExportItems;
    if (!targets.length) {
      this.qrError = 'No hay equipos para generar el PDF de códigos QR.';
      return;
    }

    const operationId = ++this.qrOperationId;
    this.qrGenerating = true;
    this.qrGenerationMode = 'pdf';
    this.qrProgressCompleted = 0;
    this.qrProgressTotal = targets.length;
    this.qrError = '';
    this.qrSuccess = '';
    const exportFormat = this.selectedQrExportFormat;
    try {
      const jsPdfModule = await import('jspdf');
      const JsPdfConstructor = (
        (jsPdfModule as any).jsPDF
        || (jsPdfModule as any).default?.jsPDF
        || (jsPdfModule as any).default
      );
      if (typeof JsPdfConstructor !== 'function') {
        throw new Error('El módulo PDF no está disponible.');
      }

      const clientName = this.selectedClientInfo?.name || 'CLIENTE';
      const doc = exportFormat.value === 'a4'
        ? await this.buildA4QrPdf(JsPdfConstructor, targets, operationId, clientName)
        : await this.buildBrotherQrPdf(JsPdfConstructor, targets, operationId, clientName, exportFormat);

      if (operationId !== this.qrOperationId) return;
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
      const clientPart = this.safeFilename(clientName);
      const formatPart = exportFormat.value === 'a4'
        ? 'a4'
        : `brother-${exportFormat.tapeWidthMm}mm`;
      doc.save(`codigos-qr-${clientPart}-${formatPart}-${date}.pdf`);
      this.qrSuccess = exportFormat.value === 'a4'
        ? `PDF A4 generado con ${targets.length} código${targets.length === 1 ? '' : 's'} QR.`
        : `${targets.length} etiqueta${targets.length === 1 ? '' : 's'} Brother de ${exportFormat.tapeWidthMm} mm generada${targets.length === 1 ? '' : 's'}.`;
    } catch (error) {
      console.error('No se pudo generar el PDF de códigos QR.', error);
      if (operationId === this.qrOperationId) {
        this.qrError = `No se pudo completar el PDF (${this.qrProgressCompleted} de ${this.qrProgressTotal}).`;
      }
    } finally {
      if (operationId === this.qrOperationId) {
        this.qrGenerating = false;
        this.qrGenerationMode = null;
        this.cdr.detectChanges();
      }
    }
  }

  private async buildA4QrPdf(
    JsPdfConstructor: any,
    targets: InventoryPanelItem[],
    operationId: number,
    clientName: string
  ): Promise<any> {
    const doc = new JsPdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const gap = 3;
    const columns = 3;
    const rowsPerPage = 5;
    const cardsPerPage = columns * rowsPerPage;
    const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
    const cardHeight = 50;
    const qrSize = 21;
    const totalPages = Math.ceil(targets.length / cardsPerPage);

    const drawPageFrame = (page: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(143, 50, 55);
      doc.text('CÓDIGOS QR DE INVENTARIO BIOMÉDICO', margin, 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(this.truncate(clientName.toUpperCase(), 82), margin, 14);
      doc.text(`PÁGINA ${page} DE ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      doc.setFontSize(5.5);
      doc.text('SOFTWARE BIOMÉDICO INBIHOSPITALARIO', margin, pageHeight - 5);
    };

    drawPageFrame(1);
    for (let index = 0; index < targets.length; index += 1) {
      if (operationId !== this.qrOperationId) return doc;
      const item = targets[index];
      const position = index % cardsPerPage;
      if (index > 0 && position === 0) {
        doc.addPage();
        drawPageFrame(Math.floor(index / cardsPerPage) + 1);
      }

      const col = position % columns;
      const row = Math.floor(position / columns);
      const x = margin + col * (cardWidth + gap);
      const y = 18 + row * (cardHeight + gap);
      const qr = await this.createQrDataUrl(item, 300);
      if (operationId !== this.qrOperationId) return doc;

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
      doc.addImage(qr, 'PNG', x + (cardWidth - qrSize) / 2, y + 2.5, qrSize, qrSize);
      doc.setTextColor(15, 23, 42);
      this.drawPdfSingleLine(doc, this.truncate(item.code || '-', 25), x + 3.5, y + 28, cardWidth - 7, 8, 6, true);
      this.drawPdfSingleLine(
        doc,
        this.truncate((item.name || '-').toUpperCase(), 38),
        x + 3.5,
        y + 32.5,
        cardWidth - 7,
        7,
        5.3,
        true
      );
      doc.setTextColor(71, 85, 105);
      this.drawPdfSingleLine(
        doc,
        this.truncate(`${item.brand || '-'} / ${item.model || '-'}`, 42),
        x + 3.5,
        y + 36.5,
        cardWidth - 7,
        6.5,
        5
      );
      this.drawPdfSingleLine(
        doc,
        this.truncate(`SERIE: ${item.serial || '-'}`, 42),
        x + 3.5,
        y + 40.5,
        cardWidth - 7,
        6.5,
        5
      );
      doc.setTextColor(15, 23, 42);
      this.drawPdfSingleLine(
        doc,
        this.truncate(clientName.toUpperCase(), 42),
        x + 3.5,
        y + 44.5,
        cardWidth - 7,
        6.2,
        4.8,
        true
      );
      doc.setTextColor(100, 116, 139);
      this.drawPdfSingleLine(
        doc,
        'SOFTWARE BIOMÉDICO INBIHOSPITALARIO',
        x + 3.5,
        y + 48,
        cardWidth - 7,
        4.4,
        3.6
      );

      await this.reportQrProgress(index, targets.length);
    }
    return doc;
  }

  private async buildBrotherQrPdf(
    JsPdfConstructor: any,
    targets: InventoryPanelItem[],
    operationId: number,
    clientName: string,
    format: QrExportFormatOption
  ): Promise<any> {
    const tapeWidth = format.tapeWidthMm;
    const minLabelLength = format.minLabelLengthMm;
    const maxLabelLength = format.maxLabelLengthMm;
    const qrSize = format.qrSizeMm;
    if (!tapeWidth || !minLabelLength || !maxLabelLength || !qrSize) {
      throw new Error('El formato Brother seleccionado no es válido.');
    }

    const compact = tapeWidth <= 12;
    const layout = this.brotherLabelLayout(tapeWidth);
    const qrX = 1.2;
    const textX = qrX + qrSize + (compact ? 1.4 : 2.2);
    const measurementDoc = new JsPdfConstructor({
      orientation: 'landscape',
      unit: 'mm',
      format: [maxLabelLength, tapeWidth],
      compress: true,
      precision: 4
    });
    const labelLengths = targets.map((item) => this.brotherLabelLength(
      measurementDoc,
      item,
      clientName,
      textX,
      minLabelLength,
      maxLabelLength,
      layout,
      compact
    ));

    const doc = new JsPdfConstructor({
      orientation: 'landscape',
      unit: 'mm',
      format: [labelLengths[0], tapeWidth],
      compress: true,
      precision: 4
    });
    doc.setProperties({
      title: `Etiquetas QR ${clientName}`,
      subject: `Brother PT-P700 - cinta TZe ${tapeWidth} mm`,
      creator: 'INBIHOSPITALARIO'
    });

    for (let index = 0; index < targets.length; index += 1) {
      if (operationId !== this.qrOperationId) return doc;
      const labelLength = labelLengths[index];
      if (index > 0) doc.addPage([labelLength, tapeWidth], 'landscape');

      const item = targets[index];
      const qr = await this.createQrDataUrl(item, 720, 'M', 2, '#000000');
      if (operationId !== this.qrOperationId) return doc;

      const qrY = (tapeWidth - qrSize) / 2;
      const textWidth = labelLength - textX - 1.8;
      const codeText = this.truncate((item.code || 'SIN CÓDIGO').toUpperCase(), layout.codeChars);
      const nameText = this.truncate((item.name || 'EQUIPO SIN NOMBRE').toUpperCase(), layout.nameChars);
      const brandModelText = this.truncate(
        `${item.brand || '-'} / ${item.model || '-'}`.toUpperCase(),
        layout.detailsChars
      );
      const serialText = this.truncate(
        `SERIE: ${(item.serial || '-').toUpperCase()}`,
        layout.detailsChars
      );
      const clientText = this.truncate(clientName.toUpperCase(), layout.clientChars);
      const softwareText = 'SOFTWARE BIOMÉDICO INBIHOSPITALARIO';

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, labelLength, tapeWidth, 'F');
      doc.setTextColor(0, 0, 0);
      doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.15);
      doc.line(textX - (compact ? 0.7 : 1.1), 1.2, textX - (compact ? 0.7 : 1.1), tapeWidth - 1.2);

      this.drawPdfSingleLine(
        doc,
        codeText,
        textX,
        layout.codeY,
        textWidth,
        layout.codeSize,
        layout.codeMinSize,
        true
      );
      this.drawPdfSingleLine(
        doc,
        nameText,
        textX,
        layout.nameY,
        textWidth,
        layout.nameSize,
        layout.nameMinSize,
        true
      );

      if (!compact) {
        this.drawPdfSingleLine(
          doc,
          brandModelText,
          textX,
          layout.brandY,
          textWidth,
          layout.detailsSize,
          layout.detailsMinSize
        );
      }
      this.drawPdfSingleLine(
        doc,
        serialText,
        textX,
        layout.serialY,
        textWidth,
        layout.detailsSize,
        layout.detailsMinSize
      );

      this.drawPdfSingleLine(
        doc,
        clientText,
        textX,
        layout.clientY,
        textWidth,
        layout.clientSize,
        layout.clientMinSize,
        true
      );
      this.drawPdfSingleLine(
        doc,
        softwareText,
        textX,
        layout.softwareY,
        textWidth,
        layout.softwareSize,
        Math.max(2, layout.softwareSize - 0.5)
      );

      await this.reportQrProgress(index, targets.length);
    }
    return doc;
  }

  private brotherLabelLayout(tapeWidth: number): BrotherLabelLayout {
    if (tapeWidth <= 12) {
      return {
        codeY: 3.2,
        codeSize: 6.5,
        codeMinSize: 5.4,
        codeChars: 24,
        nameY: 5.5,
        nameSize: 4.6,
        nameMinSize: 3.8,
        nameChars: 42,
        detailsSize: 3.8,
        detailsMinSize: 3.2,
        detailsChars: 40,
        brandY: 0,
        serialY: 7.4,
        clientY: 9,
        clientSize: 3.4,
        clientMinSize: 2.8,
        clientChars: 42,
        softwareY: 10.4,
        softwareSize: 2.4
      };
    }
    if (tapeWidth === 18) {
      return {
        codeY: 3.8,
        codeSize: 8.3,
        codeMinSize: 7,
        codeChars: 32,
        nameY: 6.7,
        nameSize: 5.8,
        nameMinSize: 4.8,
        nameChars: 68,
        detailsSize: 4.7,
        detailsMinSize: 4,
        detailsChars: 62,
        brandY: 9.2,
        serialY: 11.6,
        clientY: 14.1,
        clientSize: 4.2,
        clientMinSize: 3.5,
        clientChars: 62,
        softwareY: 16.2,
        softwareSize: 3
      };
    }
    return {
      codeY: 4.7,
      codeSize: 10,
      codeMinSize: 8.5,
      codeChars: 36,
      nameY: 7.7,
      nameSize: 7,
      nameMinSize: 5.6,
      nameChars: 76,
      detailsSize: 5.8,
      detailsMinSize: 4.8,
      detailsChars: 72,
      brandY: 10.8,
      serialY: 13.7,
      clientY: 17,
      clientSize: 5.1,
      clientMinSize: 4.3,
      clientChars: 72,
      softwareY: 19.8,
      softwareSize: 3.5
    };
  }

  private brotherLabelLength(
    measurementDoc: any,
    item: InventoryPanelItem,
    clientName: string,
    textX: number,
    minLength: number,
    maxLength: number,
    layout: BrotherLabelLayout,
    compact: boolean
  ): number {
    const lines = [
      {
        text: this.truncate((item.code || 'SIN CÓDIGO').toUpperCase(), layout.codeChars),
        size: layout.codeSize,
        bold: true
      },
      {
        text: this.truncate((item.name || 'EQUIPO SIN NOMBRE').toUpperCase(), layout.nameChars),
        size: layout.nameSize,
        bold: true
      },
      ...(!compact
        ? [{
            text: this.truncate(`${item.brand || '-'} / ${item.model || '-'}`.toUpperCase(), layout.detailsChars),
            size: layout.detailsSize,
            bold: false
          }]
        : []),
      {
        text: this.truncate(`SERIE: ${(item.serial || '-').toUpperCase()}`, layout.detailsChars),
        size: layout.detailsSize,
        bold: false
      },
      {
        text: this.truncate(clientName.toUpperCase(), layout.clientChars),
        size: layout.clientSize,
        bold: true
      },
      {
        text: 'SOFTWARE BIOMÉDICO INBIHOSPITALARIO',
        size: layout.softwareSize,
        bold: false
      }
    ];
    const contentWidth = Math.max(
      ...lines.map((line) => this.measuredPdfTextWidthMm(
        measurementDoc,
        line.text,
        line.size,
        line.bold
      ))
    );
    const desiredLength = textX + contentWidth + 1.8;
    const clampedLength = Math.min(maxLength, Math.max(minLength, desiredLength));
    return Math.ceil(clampedLength * 2) / 2;
  }

  private drawPdfSingleLine(
    doc: any,
    value: string,
    x: number,
    y: number,
    availableWidth: number,
    preferredSize: number,
    minimumSize: number,
    bold = false
  ): void {
    const line = this.fitPdfSingleLine(
      doc,
      value,
      preferredSize,
      minimumSize,
      availableWidth,
      bold
    );
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(line.fontSize);
    doc.text(line.text, x, y);
  }

  private fitPdfSingleLine(
    doc: any,
    value: string,
    preferredSize: number,
    minimumSize: number,
    availableWidth: number,
    bold: boolean
  ): PdfSingleLine {
    const preferredWidth = this.measuredPdfTextWidthMm(doc, value, preferredSize, bold);
    let fontSize = preferredSize;
    if (preferredWidth > availableWidth) {
      fontSize = Math.max(minimumSize, preferredSize * (availableWidth / preferredWidth) * 0.98);
      fontSize = Math.floor(fontSize * 10) / 10;
    }

    if (this.measuredPdfTextWidthMm(doc, value, fontSize, bold) <= availableWidth) {
      return { text: value, fontSize };
    }

    const source = value.endsWith('…') ? value.slice(0, -1) : value;
    let low = 0;
    let high = source.length;
    let fittedText = '…';
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = `${source.slice(0, middle).trimEnd()}…`;
      if (this.measuredPdfTextWidthMm(doc, candidate, fontSize, bold) <= availableWidth) {
        fittedText = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return { text: fittedText, fontSize };
  }

  private measuredPdfTextWidthMm(
    doc: any,
    value: string,
    fontSizePt: number,
    bold = false
  ): number {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSizePt);
    if (typeof doc.getTextWidth === 'function') {
      const measured = Number(doc.getTextWidth(value));
      if (Number.isFinite(measured) && measured >= 0) return measured;
    }
    return this.estimatedPdfTextWidthMm(value, fontSizePt, bold);
  }

  private estimatedPdfTextWidthMm(value: string, fontSizePt: number, bold = false): number {
    const units = Array.from(value).reduce((total, character) => {
      if (/\s/.test(character)) return total + 0.28;
      if (/[MW@%#ÁÉÍÓÚÜÑ]/i.test(character)) return total + 0.78;
      if (/[I1l|.,:;!'`/\\\-]/.test(character)) return total + 0.32;
      if (/[A-Z0-9]/i.test(character)) return total + 0.6;
      return total + 0.52;
    }, 0);
    return units * fontSizePt * 0.352778 * (bold ? 1.03 : 1);
  }

  private async reportQrProgress(index: number, total: number): Promise<void> {
    this.qrProgressCompleted = index + 1;
    this.cdr.detectChanges();
    if ((index + 1) % 8 === 0 && index + 1 < total) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  cancelQrGeneration(showMessage = true): void {
    if (!this.qrGenerating) return;
    this.qrOperationId += 1;
    this.qrGenerating = false;
    this.qrGenerationMode = null;
    if (showMessage) {
      this.qrSuccess = `Generación cancelada en ${this.qrProgressCompleted} de ${this.qrProgressTotal}.`;
    }
  }

  qrStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, string> = {
      activo: 'Activo',
      operativo: 'Operativo',
      operativo_observacion: 'Operativo con observaciones',
      pendiente_repuesto: 'Pendiente de repuesto',
      fuera_de_servicio: 'Fuera de servicio'
    };
    return labels[String(status || '').toLowerCase()] || status || 'Sin estado';
  }

  qrStatusClass(status: string | null | undefined): string {
    const value = String(status || '').toLowerCase();
    if (['activo', 'operativo'].includes(value)) return 'is-operational';
    if (value === 'fuera_de_servicio') return 'is-danger';
    if (['operativo_observacion', 'pendiente_repuesto'].includes(value)) return 'is-warning';
    return 'is-neutral';
  }

  trackQrItem(_: number, item: InventoryPanelItem): string {
    return item.id;
  }

  private resetQrWorkspace(): void {
    this.qrOperationId += 1;
    this.qrPreviewRequestId += 1;
    this.qrGenerating = false;
    this.qrGenerationMode = null;
    this.qrPreviewLoading = false;
    this.qrPreviewItemId = '';
    this.qrPreviewUrl = '';
    this.qrPage = 1;
    this.qrProgressCompleted = 0;
    this.qrProgressTotal = 0;
  }

  private async createQrDataUrl(
    item: InventoryPanelItem,
    width: number,
    errorCorrectionLevel: 'M' | 'Q' = 'Q',
    margin = 3,
    darkColor = '#0f172a'
  ): Promise<string> {
    const qrCode = await this.loadQrCodeApi();
    return qrCode.toDataURL(this.qrPayload(item), {
      errorCorrectionLevel,
      margin,
      width,
      color: {
        dark: darkColor,
        light: '#ffffff'
      }
    });
  }

  private loadQrCodeApi(): Promise<QrCodeApi> {
    if (!this.qrApiPromise) {
      this.qrApiPromise = import('qrcode').then((module) => {
        const candidate = typeof (module as any).toDataURL === 'function'
          ? module
          : (module as any).default;
        if (!candidate || typeof candidate.toDataURL !== 'function') {
          throw new Error('El generador QR no está disponible.');
        }
        return candidate as QrCodeApi;
      }).catch((error) => {
        this.qrApiPromise = null;
        throw error;
      });
    }
    return this.qrApiPromise;
  }

  private qrPayload(item: InventoryPanelItem): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/q/${encodeURIComponent(item.id)}`;
  }

  private normalize(value: string | null | undefined): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private safeFilename(value: string): string {
    return this.normalize(value)
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'equipo';
  }

  private downloadDataUrl(dataUrl: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
  }
}
