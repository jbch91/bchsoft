import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';
import type { AssetCategory } from '../biomed/biomed.service';

export interface MaintenanceRequestDto {
  id: string;
  client_id: string;
  asset_id: string;
  type: 'preventivo' | 'correctivo';
  description?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requested_by: string;
  assigned_to?: string | null;
  assigned_name?: string | null;
  status: string;
  planned_date?: string | null;
  deadline_date?: string | null;
  source?: string | null;
  schedule_id?: string | null;
  schedule_item_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PreventiveProgressSummaryDto {
  total: number;
  not_started: number;
  in_progress: number;
  pending_signature: number;
  waiting_spare: number;
  warranty: number;
  completed: number;
  overdue: number;
  completion_percent: number;
}

export type PreventiveProgressPhase =
  | 'not_started'
  | 'in_progress'
  | 'pending_signature'
  | 'waiting_spare'
  | 'warranty'
  | 'completed';

export interface PreventiveProgressItemDto {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  asset_brand?: string | null;
  asset_model?: string | null;
  asset_serial?: string | null;
  site_name?: string | null;
  area_name?: string | null;
  location_name?: string | null;
  planned_date: string;
  deadline_date: string;
  phase: PreventiveProgressPhase;
  is_overdue: boolean;
  warranty_resolution?: 'covered' | 'perform' | null;
  warranty_resolved_at?: string | null;
  warranty_release_date?: string | null;
  is_under_warranty?: boolean;
  can_perform_protocol?: boolean;
  request_id?: string | null;
  request_status?: string | null;
  assigned_to?: string | null;
  assigned_name?: string | null;
  report_id?: string | null;
  report_created_at?: string | null;
  pdf_available: boolean;
  has_pending_spare?: boolean;
  legacy_history_file_id?: string | null;
  completion_source?: string | null;
}

export interface PreventiveMaintenanceProgressDto {
  schedule_id?: string | null;
  schedule_status?: string | null;
  asset_category: AssetCategory;
  year: number;
  month: number;
  annual: PreventiveProgressSummaryDto;
  monthly: PreventiveProgressSummaryDto;
  items: PreventiveProgressItemDto[];
  generated_at: string;
}

export interface MaintenanceReportDto {
  id: string;
  client_id: string;
  request_id: string;
  asset_id: string;
  type: 'preventivo' | 'correctivo';
  summary?: string | null;
  findings?: string | null;
  actions_taken?: string | null;
  failure_cause?: string | null;
  maintenance_checks?: string[];
  maintenance_activities?: string[];
  maintenance_tests?: string[];
  asset_status_after?: string | null;
  asset_status_observations?: string | null;
  area_responsible_required?: boolean;
  requires_spare_parts?: boolean;
  spare_parts_needed?: string | null;
  spare_parts_status?: string | null;
  created_by: string;
  created_at: string;
  engineer_name?: string | null;
  request_status?: string | null;
  signed_by_me?: boolean;
  is_fully_signed?: boolean;
  correction_requested?: boolean;
  correction_reason?: string | null;
  correction_requested_at?: string | null;
  correction_requested_by_name?: string | null;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface BlankMaintenanceProtocolResult {
  blob: Blob;
  batchCode: string;
  assetCount: number;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async getPreventiveProgress(
    clientId: string,
    year: number,
    month: number,
    assetCategory: AssetCategory = 'biomedical'
  ): Promise<PreventiveMaintenanceProgressDto> {
    const query = new URLSearchParams({
      year: String(year),
      month: String(month),
      category: assetCategory
    });
    return firstValueFrom(
      this.http.get<PreventiveMaintenanceProgressDto>(
        `${this.apiBase}/maintenance/preventive-progress/${clientId}?${query}`
      )
    );
  }

  async resolvePreventiveWarranty(
    clientId: string,
    itemId: string,
    decision: 'covered' | 'perform'
  ): Promise<{ ok: boolean; decision: 'covered' | 'perform'; message: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; decision: 'covered' | 'perform'; message: string }>(
        `${this.apiBase}/maintenance/preventive-progress/${clientId}/items/${itemId}/warranty`,
        { decision }
      )
    );
  }

  async listRequests(
    clientId: string,
    assetCategory: AssetCategory = 'biomedical'
  ): Promise<MaintenanceRequestDto[]> {
    return firstValueFrom(
      this.http.get<MaintenanceRequestDto[]>(
        `${this.apiBase}/maintenance/requests/${clientId}?category=${assetCategory}`
      )
    );
  }

  async createRequest(payload: {
    clientId: string;
    assetId: string;
    assetCategory?: AssetCategory;
    type: 'preventivo' | 'correctivo';
    description?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/maintenance/requests`, payload));
  }

  async assignRequest(requestId: string, assignedTo?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/requests/${requestId}/assign`, { assignedTo })
    );
  }

  async deleteRequest(requestId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/maintenance/requests/${requestId}`));
  }

  async listReports(
    clientId: string,
    params?: {
      assetId?: string;
      assetCategory?: AssetCategory;
      from?: string;
      to?: string;
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<MaintenanceReportDto[]> {
    const query = new URLSearchParams({ category: params?.assetCategory ?? 'biomedical' });
    if (params?.assetId) query.set('assetId', params.assetId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.order) query.set('order', params.order);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query}` : '';
    return firstValueFrom(
      this.http.get<MaintenanceReportDto[]>(`${this.apiBase}/maintenance/reports/${clientId}${suffix}`)
    );
  }

  async createReport(payload: {
    requestId: string;
    summary?: string;
    findings?: string;
    actionsTaken?: string;
    maintenanceChecks?: string[];
    maintenanceActivities?: string[];
    maintenanceTests?: string[];
    assetStatusAfter?: string;
    assetStatusObservations?: string;
    assetLifecycleAction?: 'retire' | null;
    requiresSpareParts?: boolean;
    sparePartsNeeded?: string;
    sparePartsStatus?: string;
    sparePartsInstalledNow?: boolean;
  }): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/maintenance/reports`, payload));
  }

  async signReport(reportId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/maintenance/reports/${reportId}/sign`, {}));
  }

  async requestReportCorrection(reportId: string, reason: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/reports/${reportId}/correction`, { reason })
    );
  }

  async reopenReportForCorrection(reportId: string, reason: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/reports/${reportId}/reopen`, { reason })
    );
  }

  async downloadReportPdf(reportId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/maintenance/reports/${reportId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async generateBlankProtocols(payload: {
    scope: 'selected' | 'all_active';
    assetIds?: string[];
    reason: string;
    assetCategory?: AssetCategory;
  }): Promise<BlankMaintenanceProtocolResult> {
    const response = await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/protocols/blank-pdf`, payload, {
        observe: 'response',
        responseType: 'blob'
      })
    );
    if (!response.body) {
      throw new Error('El servidor no devolvió el PDF.');
    }
    return {
      blob: response.body,
      batchCode: response.headers.get('X-Protocol-Batch-Code') || 'PMF',
      assetCount: Number(response.headers.get('X-Protocol-Asset-Count') || 0)
    };
  }

  async deleteReport(reportId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/maintenance/reports/${reportId}`));
  }

  async listNotifications(): Promise<NotificationDto[]> {
    return firstValueFrom(this.http.get<NotificationDto[]>(`${this.apiBase}/maintenance/notifications`));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/notifications/${notificationId}/read`, {})
    );
  }
}
