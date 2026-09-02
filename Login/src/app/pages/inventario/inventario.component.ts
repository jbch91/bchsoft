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

      const doc = new JsPdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
      const clientName = this.selectedClientInfo?.name || 'CLIENTE';

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
        if (operationId !== this.qrOperationId) return;
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
        if (operationId !== this.qrOperationId) return;

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
        doc.text(this.truncate(`ÁREA: ${item.areaName || '-'}`, 42), x + 3.5, y + 44.5, { maxWidth: cardWidth - 7 });
        doc.setFontSize(5.8);
        doc.setTextColor(143, 50, 55);
        doc.text('INBIHOSPITALARIO', x + 3.5, y + 48);

        this.qrProgressCompleted = index + 1;
        this.cdr.detectChanges();
        if ((index + 1) % 8 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      if (operationId !== this.qrOperationId) return;
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
      const clientPart = this.safeFilename(clientName);
      doc.save(`codigos-qr-${clientPart}-${date}.pdf`);
      this.qrSuccess = `PDF generado con ${targets.length} código${targets.length === 1 ? '' : 's'} QR.`;
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

  private async createQrDataUrl(item: InventoryPanelItem, width: number): Promise<string> {
    const qrCode = await this.loadQrCodeApi();
    return qrCode.toDataURL(this.qrPayload(item), {
      errorCorrectionLevel: 'Q',
      margin: 3,
      width,
      color: {
        dark: '#0f172a',
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
    const params = new URLSearchParams({
      clientId: this.selectedClientId,
      assetId: item.id,
      code: item.code || '',
      source: 'qr'
    });
    return `${origin}/mantenimiento?${params.toString()}`;
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
