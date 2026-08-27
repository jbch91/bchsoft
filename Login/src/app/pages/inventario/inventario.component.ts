import { ChangeDetectorRef, Component } from '@angular/core';
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
  clientSearchTerm = '';
  selectedClientId = '';
  items: InventoryPanelItem[] = [];
  loading = false;
  errorMessage = '';
  qrModalOpen = false;
  qrSearchTerm = '';
  qrAreaFilter = '';
  qrStatusFilter = '';
  qrCodes: Record<string, string> = {};
  qrSelectedIds = new Set<string>();
  qrGenerating = false;
  qrError = '';
  qrSuccess = '';
  requestModalItem: InventoryPanelItem | null = null;
  requestDescription = '';
  requestSaving = false;
  requestError = '';
  requestSuccess = '';

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
      this.qrCodes = {};
      this.qrSelectedIds.clear();
      if (this.qrModalOpen) {
        await this.generateQrCodes(this.qrFilteredItems);
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
    void this.generateQrCodes(this.qrFilteredItems);
  }

  closeQrModal(): void {
    this.qrModalOpen = false;
    this.qrError = '';
    this.qrSuccess = '';
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
    return Array.from(new Set(this.items.map((item) => item.areaName || '').filter(Boolean))).sort();
  }

  get qrStatusOptions(): string[] {
    return Array.from(new Set(this.items.map((item) => item.status || '').filter(Boolean))).sort();
  }

  get qrFilteredItems(): InventoryPanelItem[] {
    const term = this.normalize(this.qrSearchTerm);
    return this.items.filter((item) => {
      if (item.status === 'dado_de_baja') return false;
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
    return this.qrFilteredItems.filter((item) => this.qrSelectedIds.has(item.id));
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
    void this.generateQrCodes(this.qrFilteredItems);
  }

  async generateVisibleQrCodes(): Promise<void> {
    await this.generateQrCodes(this.qrFilteredItems, true);
  }

  async downloadQrPng(item: InventoryPanelItem): Promise<void> {
    const dataUrl = await this.ensureQrCode(item);
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${this.safeFilename(item.code || item.name)}-qr.png`;
    anchor.click();
  }

  async downloadQrPdf(): Promise<void> {
    const targets = this.qrSelectedItems.length ? this.qrSelectedItems : this.qrFilteredItems;
    if (!targets.length) {
      this.qrError = 'No hay equipos para generar el PDF de códigos QR.';
      return;
    }

    await this.generateQrCodes(targets);
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const gap = 4;
    const columns = 3;
    const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
    const cardHeight = 54;
    const qrSize = 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(143, 50, 55);
    doc.text('Códigos QR de inventario biomédico', margin, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Cada QR identifica un equipo para solicitudes, reportes e historial.', margin, 15);

    targets.forEach((item, index) => {
      const position = index % (columns * 5);
      if (index > 0 && position === 0) {
        doc.addPage();
      }
      const col = position % columns;
      const row = Math.floor(position / columns);
      const x = margin + col * (cardWidth + gap);
      const y = 20 + row * (cardHeight + gap);
      const qr = this.qrCodes[item.id];

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');
      if (qr) {
        doc.addImage(qr, 'PNG', x + (cardWidth - qrSize) / 2, y + 4, qrSize, qrSize);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(this.truncate(item.code || '-', 24), x + 4, y + 33, { maxWidth: cardWidth - 8 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(this.truncate(item.name || '-', 32), x + 4, y + 38, { maxWidth: cardWidth - 8 });
      doc.setTextColor(71, 85, 105);
      doc.text(this.truncate(`Serie: ${item.serial || '-'}`, 34), x + 4, y + 43, { maxWidth: cardWidth - 8 });
      doc.text(this.truncate(`Área: ${item.areaName || '-'}`, 34), x + 4, y + 48, { maxWidth: cardWidth - 8 });
    });

    doc.save('codigos-qr-inventario.pdf');
  }

  async generateQrCodes(items: InventoryPanelItem[], force = false): Promise<void> {
    if (!items.length) return;
    this.qrGenerating = true;
    this.qrError = '';
    this.qrSuccess = '';
    try {
      await Promise.all(items.map((item) => this.ensureQrCode(item, force)));
      this.qrSuccess = `Códigos QR listos para ${items.length} equipo${items.length === 1 ? '' : 's'}.`;
    } catch (error) {
      console.error(error);
      this.qrError = 'No se pudieron generar los códigos QR.';
    } finally {
      this.qrGenerating = false;
      this.cdr.detectChanges();
    }
  }

  private async ensureQrCode(item: InventoryPanelItem, force = false): Promise<string> {
    if (!force && this.qrCodes[item.id]) return this.qrCodes[item.id];
    const QRCode = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(this.qrPayload(item), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    this.qrCodes[item.id] = dataUrl;
    return dataUrl;
  }

  private qrPayload(item: InventoryPanelItem): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      clientId: this.selectedClientId,
      assetId: item.id,
      code: item.code || ''
    });
    return `${origin}/mantenimiento?${params.toString()}`;
  }

  private normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
  }

  private safeFilename(value: string): string {
    return this.normalize(value)
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'equipo';
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
  }
}
