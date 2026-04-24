import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

export interface QuickGuideDto {
  id: string;
  client_id: string;
  document_code: string | null;
  version: string;
  equipment_name: string;
  equipment_type: string | null;
  brand: string;
  model: string;
  status: 'borrador' | 'aprobada' | 'obsoleta';
  intended_use: string | null;
  responsible_use: string | null;
  placement_notes: string | null;
  prerequisites: string | null;
  startup_steps: string | null;
  shutdown_steps: string | null;
  basic_operation: string | null;
  alarms: string | null;
  cleaning_disinfection: string | null;
  emergency_actions: string | null;
  support_contact: string | null;
  visual_notes: string | null;
  visual_path: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  asset_count?: number;
}

export interface QuickGuidePayload {
  documentCode?: string | null;
  version: string;
  equipmentName: string;
  equipmentType?: string | null;
  brand: string;
  model: string;
  status?: 'borrador' | 'aprobada' | 'obsoleta';
  responsibleUse?: string | null;
  placementNotes?: string | null;
  prerequisites?: string | null;
  startupSteps?: string | null;
  shutdownSteps?: string | null;
  basicOperation: string;
  alarms?: string | null;
  cleaningDisinfection: string;
  emergencyActions: string;
  supportContact?: string | null;
  visualNotes?: string | null;
  visual?: File | null;
}

@Injectable({ providedIn: 'root' })
export class QuickGuidesService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async list(clientId: string, filters?: { search?: string; status?: string }): Promise<QuickGuideDto[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    const suffix = params.toString() ? `?${params}` : '';
    return firstValueFrom(this.http.get<QuickGuideDto[]>(`${this.apiBase}/quick-guides/${clientId}${suffix}`));
  }

  async create(clientId: string, payload: QuickGuidePayload): Promise<void> {
    const form = this.toFormData(payload);
    await firstValueFrom(this.http.post(`${this.apiBase}/quick-guides/${clientId}`, form));
  }

  async update(clientId: string, guideId: string, payload: QuickGuidePayload): Promise<void> {
    const form = this.toFormData(payload);
    await firstValueFrom(this.http.put(`${this.apiBase}/quick-guides/${clientId}/${guideId}`, form));
  }

  async approve(clientId: string, guideId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/quick-guides/${clientId}/${guideId}/approve`, {}));
  }

  async delete(clientId: string, guideId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/quick-guides/${clientId}/${guideId}`));
  }

  async downloadPdf(clientId: string, guideId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/quick-guides/${clientId}/${guideId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async downloadAssetGuidePdf(clientId: string, assetId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/quick-guides/${clientId}/assets/${assetId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  private toFormData(payload: QuickGuidePayload): FormData {
    const form = new FormData();
    const append = (key: string, value: unknown): void => {
      if (value === undefined || value === null) return;
      form.append(key, String(value));
    };

    append('documentCode', payload.documentCode);
    append('version', payload.version);
    append('equipmentName', payload.equipmentName);
    append('equipmentType', payload.equipmentType);
    append('brand', payload.brand);
    append('model', payload.model);
    append('status', payload.status || 'aprobada');
    append('responsibleUse', payload.responsibleUse);
    append('placementNotes', payload.placementNotes);
    append('prerequisites', payload.prerequisites);
    append('startupSteps', payload.startupSteps);
    append('shutdownSteps', payload.shutdownSteps);
    append('basicOperation', payload.basicOperation);
    append('alarms', payload.alarms);
    append('cleaningDisinfection', payload.cleaningDisinfection);
    append('emergencyActions', payload.emergencyActions);
    append('supportContact', payload.supportContact);
    append('visualNotes', payload.visualNotes);
    if (payload.visual) form.append('visual', payload.visual);
    return form;
  }
}
