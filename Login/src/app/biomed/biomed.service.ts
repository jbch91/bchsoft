import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

interface AssetDto {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  status: string;
  photo_path?: string | null;
  invima_reg?: string | null;
  risk_class?: string | null;
  is_mobile?: boolean;
  manufacturer?: string | null;
  area_name?: string | null;
  location_name?: string | null;
  site_name?: string | null;
  site_id?: string | null;
  area_id?: string | null;
  location_id?: string | null;
  acquisition_type?: string | null;
  contract_text?: string | null;
  acquisition_date?: string | null;
  useful_life_years?: number | null;
  warranty_years?: number | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  supplier_email?: string | null;
  power_type?: string | null;
  voltage?: string | null;
  temp_min?: number | null;
  temp_max?: number | null;
  humidity_min?: number | null;
  humidity_max?: number | null;
  maintenance_frequency?: string | null;
  requires_calibration?: boolean | null;
  calibration_frequency?: string | null;
  created_at: string;
}

interface AreaDto {
  id: string;
  name: string;
  site_id: string | null;
  site_name?: string | null;
}

interface SiteDto {
  id: string;
  name: string;
  address: string | null;
}

interface LocationDto {
  id: string;
  name: string;
  area_id: string | null;
  site_id?: string | null;
  site_name?: string | null;
}

export interface AssetMovementDto {
  id: string;
  asset_id: string;
  from_code?: string | null;
  to_code?: string | null;
  from_site_name?: string | null;
  to_site_name?: string | null;
  from_area_name?: string | null;
  to_area_name?: string | null;
  from_location_name?: string | null;
  to_location_name?: string | null;
  moved_by_name?: string | null;
  moved_by_role?: string | null;
  notes?: string | null;
  pdf_path?: string | null;
  created_at: string;
}

export interface AssetHistoryItemDto {
  id: string;
  item_type: 'maintenance_report' | 'calibration_report' | 'movement_report' | 'legacy_pdf';
  subtype?: string | null;
  event_date: string;
  title: string;
  description?: string | null;
  pdf_path?: string | null;
  created_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BiomedService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async listAssets(clientId: string): Promise<AssetDto[]> {
    return firstValueFrom(this.http.get<AssetDto[]>(`${this.apiBase}/biomed/${clientId}/assets`));
  }

  async getAssetDetails(clientId: string, assetId: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`${this.apiBase}/biomed/${clientId}/assets/${assetId}`));
  }

  async downloadAssetPdf(clientId: string, assetId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/biomed/${clientId}/assets/${assetId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async listAreas(clientId: string): Promise<AreaDto[]> {
    return firstValueFrom(this.http.get<AreaDto[]>(`${this.apiBase}/biomed/${clientId}/areas`));
  }

  async listSites(clientId: string): Promise<SiteDto[]> {
    return firstValueFrom(this.http.get<SiteDto[]>(`${this.apiBase}/biomed/${clientId}/sites`));
  }

  async listLocations(clientId: string, areaId?: string): Promise<LocationDto[]> {
    const url = areaId
      ? `${this.apiBase}/biomed/${clientId}/locations?areaId=${areaId}`
      : `${this.apiBase}/biomed/${clientId}/locations`;
    return firstValueFrom(this.http.get<LocationDto[]>(url));
  }

  async createSite(clientId: string, name: string, address?: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/biomed/${clientId}/sites`, { name, address }));
  }

  async updateSite(clientId: string, siteId: string, payload: { name: string; address?: string | null }): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/biomed/${clientId}/sites/${siteId}`, payload));
  }

  async deleteSite(clientId: string, siteId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/biomed/${clientId}/sites/${siteId}`));
  }

  async createArea(clientId: string, name: string, siteId?: string | null): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/biomed/${clientId}/areas`, { name, siteId }));
  }

  async updateArea(clientId: string, areaId: string, name: string, siteId?: string | null): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/biomed/${clientId}/areas/${areaId}`, { name, siteId }));
  }

  async deleteArea(clientId: string, areaId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/biomed/${clientId}/areas/${areaId}`));
  }

  async createLocation(clientId: string, areaId: string, name: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/biomed/${clientId}/locations`, { areaId, name }));
  }

  async updateLocation(clientId: string, locationId: string, payload: { name: string; areaId?: string | null }): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiBase}/biomed/${clientId}/locations/${locationId}`, payload)
    );
  }

  async deleteLocation(clientId: string, locationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/biomed/${clientId}/locations/${locationId}`));
  }

  async createAsset(clientId: string, payload: {
    code: string;
    name: string;
    brand?: string;
    model?: string;
    serial?: string;
    invimaReg?: string;
    siteId?: string;
    areaId?: string;
    locationId?: string;
    riskClass?: string;
    isMobile?: boolean;
    manufacturer?: string;
    photo?: File | null;
    acquisitionType?: string;
    contractText?: string;
    acquisitionDate?: string;
    usefulLifeYears?: number;
    warrantyYears?: number;
    supplierName?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    powerType?: string;
    voltage?: string;
    tempMin?: number;
    tempMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    maintenanceFrequency?: string;
    requiresCalibration?: boolean;
    calibrationFrequency?: string;
    accessories?: any[];
    cleaning?: any[];
    recommendations?: any[];
    manualOperacion?: File | null;
    manualServicio?: File | null;
  }): Promise<void> {
    const form = new FormData();
    form.append('code', payload.code);
    form.append('name', payload.name);
    if (payload.brand) form.append('brand', payload.brand);
    if (payload.model) form.append('model', payload.model);
    if (payload.serial) form.append('serial', payload.serial);
    if (payload.invimaReg) form.append('invimaReg', payload.invimaReg);
    if (payload.siteId) form.append('siteId', payload.siteId);
    if (payload.areaId) form.append('areaId', payload.areaId);
    if (payload.locationId) form.append('locationId', payload.locationId);
    if (payload.riskClass) form.append('riskClass', payload.riskClass);
    if (payload.isMobile !== undefined) form.append('isMobile', String(payload.isMobile));
    if (payload.manufacturer) form.append('manufacturer', payload.manufacturer);
    if (payload.photo) form.append('photo', payload.photo);
    if (payload.acquisitionType) form.append('acquisitionType', payload.acquisitionType);
    if (payload.contractText) form.append('contractText', payload.contractText);
    if (payload.acquisitionDate) form.append('acquisitionDate', payload.acquisitionDate);
    if (payload.usefulLifeYears !== undefined) form.append('usefulLifeYears', String(payload.usefulLifeYears));
    if (payload.warrantyYears !== undefined) form.append('warrantyYears', String(payload.warrantyYears));
    if (payload.supplierName) form.append('supplierName', payload.supplierName);
    if (payload.supplierPhone) form.append('supplierPhone', payload.supplierPhone);
    if (payload.supplierEmail) form.append('supplierEmail', payload.supplierEmail);
    if (payload.powerType) form.append('powerType', payload.powerType);
    if (payload.voltage) form.append('voltage', payload.voltage);
    if (payload.tempMin !== undefined) form.append('tempMin', String(payload.tempMin));
    if (payload.tempMax !== undefined) form.append('tempMax', String(payload.tempMax));
    if (payload.humidityMin !== undefined) form.append('humidityMin', String(payload.humidityMin));
    if (payload.humidityMax !== undefined) form.append('humidityMax', String(payload.humidityMax));
    if (payload.maintenanceFrequency) form.append('maintenanceFrequency', payload.maintenanceFrequency);
    if (payload.requiresCalibration !== undefined) form.append('requiresCalibration', String(payload.requiresCalibration));
    if (payload.calibrationFrequency) form.append('calibrationFrequency', payload.calibrationFrequency);
    if (payload.accessories) form.append('accessories', JSON.stringify(payload.accessories));
    if (payload.cleaning) form.append('cleaning', JSON.stringify(payload.cleaning));
    if (payload.recommendations) form.append('recommendations', JSON.stringify(payload.recommendations));
    if (payload.manualOperacion) form.append('manualOperacion', payload.manualOperacion);
    if (payload.manualServicio) form.append('manualServicio', payload.manualServicio);

    await firstValueFrom(this.http.post(`${this.apiBase}/biomed/${clientId}/assets`, form));
  }

  async importAssets(clientId: string, assets: any[]): Promise<{ imported: number }> {
    return firstValueFrom(
      this.http.post<{ imported: number }>(`${this.apiBase}/biomed/${clientId}/assets/import`, { assets })
    );
  }

  async moveAsset(clientId: string, assetId: string, payload: {
    code: string;
    siteId: string;
    areaId: string;
    locationId: string;
    notes?: string;
  }): Promise<{ ok: boolean; movementId: string; pdfPath: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; movementId: string; pdfPath: string }>(
        `${this.apiBase}/biomed/${clientId}/assets/${assetId}/move`,
        payload
      )
    );
  }

  async listAssetMovements(clientId: string, assetId: string, limit = 4, offset = 0): Promise<AssetMovementDto[]> {
    return firstValueFrom(
      this.http.get<AssetMovementDto[]>(
        `${this.apiBase}/biomed/${clientId}/assets/${assetId}/movements?limit=${limit}&offset=${offset}`
      )
    );
  }

  async downloadAssetMovementPdf(clientId: string, movementId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/biomed/${clientId}/asset-movements/${movementId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async listAssetHistory(
    clientId: string,
    assetId: string,
    params?: { from?: string; to?: string; order?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<AssetHistoryItemDto[]> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.order) query.set('order', params.order);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query}` : '';
    return firstValueFrom(
      this.http.get<AssetHistoryItemDto[]>(`${this.apiBase}/biomed/${clientId}/assets/${assetId}/history${suffix}`)
    );
  }

  async uploadAssetHistoryFile(clientId: string, assetId: string, payload: {
    file: File;
    documentDate: string;
    title?: string;
    description?: string;
  }): Promise<void> {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('documentDate', payload.documentDate);
    if (payload.title) form.append('title', payload.title);
    if (payload.description) form.append('description', payload.description);
    await firstValueFrom(
      this.http.post(`${this.apiBase}/biomed/${clientId}/assets/${assetId}/history-files`, form)
    );
  }

  async downloadAssetHistoryFilePdf(clientId: string, fileId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/biomed/${clientId}/asset-history-files/${fileId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async deleteAssetHistoryFile(clientId: string, fileId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/biomed/${clientId}/asset-history-files/${fileId}`));
  }

  async updateAsset(clientId: string, assetId: string, payload: {
    code: string;
    name: string;
    brand?: string;
    model?: string;
    serial?: string;
    invimaReg?: string;
    siteId?: string;
    areaId?: string;
    locationId?: string;
    riskClass?: string;
    isMobile?: boolean;
    manufacturer?: string;
    photo?: File | null;
    acquisitionType?: string;
    contractText?: string;
    acquisitionDate?: string;
    usefulLifeYears?: number;
    warrantyYears?: number;
    supplierName?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    powerType?: string;
    voltage?: string;
    tempMin?: number;
    tempMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    maintenanceFrequency?: string;
    requiresCalibration?: boolean;
    calibrationFrequency?: string;
    accessories?: any[];
    cleaning?: any[];
    recommendations?: any[];
    manualOperacion?: File | null;
    manualServicio?: File | null;
  }): Promise<void> {
    const form = new FormData();
    form.append('code', payload.code);
    form.append('name', payload.name);
    if (payload.brand) form.append('brand', payload.brand);
    if (payload.model) form.append('model', payload.model);
    if (payload.serial) form.append('serial', payload.serial);
    if (payload.invimaReg) form.append('invimaReg', payload.invimaReg);
    if (payload.siteId) form.append('siteId', payload.siteId);
    if (payload.areaId) form.append('areaId', payload.areaId);
    if (payload.locationId) form.append('locationId', payload.locationId);
    if (payload.riskClass) form.append('riskClass', payload.riskClass);
    if (payload.isMobile !== undefined) form.append('isMobile', String(payload.isMobile));
    if (payload.manufacturer) form.append('manufacturer', payload.manufacturer);
    if (payload.photo) form.append('photo', payload.photo);
    if (payload.acquisitionType) form.append('acquisitionType', payload.acquisitionType);
    if (payload.contractText) form.append('contractText', payload.contractText);
    if (payload.acquisitionDate) form.append('acquisitionDate', payload.acquisitionDate);
    if (payload.usefulLifeYears !== undefined) form.append('usefulLifeYears', String(payload.usefulLifeYears));
    if (payload.warrantyYears !== undefined) form.append('warrantyYears', String(payload.warrantyYears));
    if (payload.supplierName) form.append('supplierName', payload.supplierName);
    if (payload.supplierPhone) form.append('supplierPhone', payload.supplierPhone);
    if (payload.supplierEmail) form.append('supplierEmail', payload.supplierEmail);
    if (payload.powerType) form.append('powerType', payload.powerType);
    if (payload.voltage) form.append('voltage', payload.voltage);
    if (payload.tempMin !== undefined) form.append('tempMin', String(payload.tempMin));
    if (payload.tempMax !== undefined) form.append('tempMax', String(payload.tempMax));
    if (payload.humidityMin !== undefined) form.append('humidityMin', String(payload.humidityMin));
    if (payload.humidityMax !== undefined) form.append('humidityMax', String(payload.humidityMax));
    if (payload.maintenanceFrequency) form.append('maintenanceFrequency', payload.maintenanceFrequency);
    if (payload.requiresCalibration !== undefined) form.append('requiresCalibration', String(payload.requiresCalibration));
    if (payload.calibrationFrequency) form.append('calibrationFrequency', payload.calibrationFrequency);
    if (payload.accessories) form.append('accessories', JSON.stringify(payload.accessories));
    if (payload.cleaning) form.append('cleaning', JSON.stringify(payload.cleaning));
    if (payload.recommendations) form.append('recommendations', JSON.stringify(payload.recommendations));
    if (payload.manualOperacion) form.append('manualOperacion', payload.manualOperacion);
    if (payload.manualServicio) form.append('manualServicio', payload.manualServicio);

    await firstValueFrom(this.http.put(`${this.apiBase}/biomed/${clientId}/assets/${assetId}`, form));
  }

  async deleteAsset(clientId: string, assetId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/biomed/${clientId}/assets/${assetId}`));
  }
}
