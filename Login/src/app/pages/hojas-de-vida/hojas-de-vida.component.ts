import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BiomedService } from '../../biomed/biomed.service';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

interface AssetView {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  status: string;
  photoPath?: string | null;
  invimaReg?: string | null;
  riskClass?: string | null;
  isMobile?: boolean;
  manufacturer?: string | null;
  areaName?: string | null;
  locationName?: string | null;
  areaId?: string | null;
  locationId?: string | null;
}

@Component({
  selector: 'app-hojas-de-vida',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './hojas-de-vida.component.html',
  styleUrl: './hojas-de-vida.component.scss'
})
export class HojasDeVidaComponent {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  private readonly maxImageSizeMb = 5;
  private readonly maxPdfSizeMb = 10;
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  assets: AssetView[] = [];
  areas: { id: string; name: string }[] = [];
  locations: { id: string; name: string; areaId: string | null }[] = [];
  locationsAll: { id: string; name: string; areaId: string | null }[] = [];
  areaEdits: Record<string, string> = {};
  locationEdits: Record<string, string> = {};
  areasOpen = true;
  areasFormOpen = false;
  areasView: 'list' | 'create-area' | 'create-location' = 'list';
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

  editingAreaId: string | null = null;
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

  newAreaName = '';
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
    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await this.loadAssets();
      await this.loadAreas();
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
        await this.loadAssets();
        await this.loadAreas();
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

  async loadAreas(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    try {
      const rows = await this.biomed.listAreas(this.selectedClientId);
      this.areas = rows.map((row) => ({ id: row.id, name: row.name }));
      this.areaEdits = Object.fromEntries(this.areas.map((area) => [area.id, area.name]));
      this.areaId = this.areas[0]?.id ?? '';
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
    this.locationsAll = rows.map((row) => ({ id: row.id, name: row.name, areaId: row.area_id ?? null }));
    this.locationEdits = Object.fromEntries(this.locationsAll.map((loc) => [loc.id, loc.name]));
  }

  async loadLocationsForForm(): Promise<void> {
    if (!this.selectedClientId) {
      return;
    }
    const rows = await this.biomed.listLocations(this.selectedClientId, this.areaId || undefined);
    this.locations = rows.map((row) => ({ id: row.id, name: row.name, areaId: row.area_id ?? null }));
    if (!this.locations.find((loc) => loc.id === this.locationId)) {
      this.locationId = this.locations[0]?.id ?? '';
    }
  }

  async onCreateArea(): Promise<void> {
    if (!this.newAreaName || !this.selectedClientId) {
      return;
    }
    const name = this.newAreaName.trim();
    if (this.areas.some((area) => area.name.toLowerCase() === name.toLowerCase())) {
      this.errorMessage = 'Esta área ya existe para este cliente.';
      this.newAreaName = '';
      alert('Esta área ya existe para este cliente.');
      return;
    }
    await this.biomed.createArea(this.selectedClientId, name);
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
    await this.biomed.updateArea(this.selectedClientId, areaId, name);
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
    await this.biomed.updateLocation(this.selectedClientId, locationId, { name, areaId: this.areaId || null });
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

  cancelEditArea(): void {
    this.editingAreaId = null;
  }

  startEditLocation(locationId: string): void {
    this.editingLocationId = locationId;
  }

  cancelEditLocation(): void {
    this.editingLocationId = null;
  }

  locationsByArea(areaId: string): { id: string; name: string; areaId: string | null }[] {
    return this.locationsAll.filter((loc) => loc.areaId === areaId);
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

  startEdit(asset: AssetView): void {
    void this.loadAssetDetails(asset.id);
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
    this.calibrationFrequency = data.calibration_frequency ?? 'mensual';
    this.riskClass = data.risk_class ?? 'Clase I';
    this.isMobile = data.is_mobile ?? false;
    this.manufacturer = data.manufacturer ?? '';
    this.areaId = data.area_id ?? this.areaId;
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

  async deleteAsset(asset: AssetView): Promise<void> {
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
