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
  labelLengthMm?: number;
  qrSizeMm?: number;
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
      description: 'Etiqueta mínima. Imprime una unidad y confirma la lectura antes de generar el lote.',
      tapeWidthMm: 12,
      labelLengthMm: 52,
      qrSizeMm: 9.5
    },
    {
      value: 'brother-18',
      label: 'Brother TZe 18 mm · compacta',
      description: 'Compatible con PT-P700. Incluye QR, código, equipo, marca, modelo y serie.',
      tapeWidthMm: 18,
      labelLengthMm: 68,
      qrSizeMm: 14.5
    },
    {
      value: 'brother-24',
      label: 'Brother TZe 24 mm · recomendada',
      description: 'Mayor tamaño de QR y mejor tolerancia de lectura para uso hospitalario.',
      tapeWidthMm: 24,
      labelLengthMm: 78,
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
      doc.text('GENERADO POR INBIHOSPITALARIO', margin, pageHeight - 5);
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(this.truncate(item.code || '-', 25), x + 3.5, y + 28, { maxWidth: cardWidth - 7 });
      doc.setFontSize(7);
      doc.text(this.truncate((item.name || '-').toUpperCase(), 38), x + 3.5, y + 32.5, { maxWidth: cardWidth - 7 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(this.truncate(`${item.brand || '-'} / ${item.model || '-'}`, 42), x + 3.5, y + 36.5, { maxWidth: cardWidth - 7 });
      doc.text(this.truncate(`SERIE: ${item.serial || '-'}`, 42), x + 3.5, y + 40.5, { maxWidth: cardWidth - 7 });
      doc.text(this.truncate(`CLIENTE: ${clientName.toUpperCase()}`, 42), x + 3.5, y + 44.5, { maxWidth: cardWidth - 7 });
      doc.setFontSize(5.8);
      doc.setTextColor(143, 50, 55);
      doc.text('INBIHOSPITALARIO', x + 3.5, y + 48);

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
    const labelLength = format.labelLengthMm;
    const qrSize = format.qrSizeMm;
    if (!tapeWidth || !labelLength || !qrSize) {
      throw new Error('El formato Brother seleccionado no es válido.');
    }

    const doc = new JsPdfConstructor({
      orientation: 'landscape',
      unit: 'mm',
      format: [labelLength, tapeWidth],
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
      if (index > 0) doc.addPage([labelLength, tapeWidth], 'landscape');

      const item = targets[index];
      const qr = await this.createQrDataUrl(item, 720, 'M', 2, '#000000');
      if (operationId !== this.qrOperationId) return doc;

      const qrX = 1.2;
      const qrY = (tapeWidth - qrSize) / 2;
      const textX = qrX + qrSize + (tapeWidth <= 12 ? 1.4 : 2.2);
      const textWidth = labelLength - textX - 1.5;
      const compact = tapeWidth <= 12;
      const medium = tapeWidth === 18;

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, labelLength, tapeWidth, 'F');
      doc.setTextColor(0, 0, 0);
      doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.15);
      doc.line(textX - (compact ? 0.7 : 1.1), 1.2, textX - (compact ? 0.7 : 1.1), tapeWidth - 1.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 7.2 : medium ? 9 : 10.5);
      doc.text(this.truncate((item.code || 'SIN CÓDIGO').toUpperCase(), compact ? 20 : 28), textX, compact ? 3.7 : medium ? 4.6 : 4.9, { maxWidth: textWidth });
      doc.setFontSize(compact ? 5.1 : medium ? 6.5 : 7.3);
      doc.text(this.truncate((item.name || 'EQUIPO SIN NOMBRE').toUpperCase(), compact ? 31 : 42), textX, compact ? 6.4 : medium ? 8.1 : 8.3, { maxWidth: textWidth });

      doc.setFont('helvetica', 'normal');
      if (!compact) {
        doc.setFontSize(medium ? 5.3 : 6.1);
        doc.text(this.truncate(`${item.brand || '-'} / ${item.model || '-'}`.toUpperCase(), medium ? 46 : 55), textX, medium ? 11.2 : 11.6, { maxWidth: textWidth });
        doc.text(this.truncate(`SERIE: ${(item.serial || '-').toUpperCase()}`, medium ? 46 : 55), textX, medium ? 14 : 14.7, { maxWidth: textWidth });
      } else {
        doc.setFontSize(4.4);
        doc.text(this.truncate(`SERIE: ${(item.serial || '-').toUpperCase()}`, 33), textX, 8.8, { maxWidth: textWidth });
      }

      if (tapeWidth >= 24) {
        doc.setFontSize(4.8);
        doc.text(this.truncate(clientName.toUpperCase(), 62), textX, 17.6, { maxWidth: textWidth });
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 3.7 : medium ? 4.2 : 4.7);
      doc.text('INBIHOSPITALARIO', textX, compact ? 10.4 : medium ? 16.5 : 20.4, { maxWidth: textWidth });

      await this.reportQrProgress(index, targets.length);
    }
    return doc;
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
