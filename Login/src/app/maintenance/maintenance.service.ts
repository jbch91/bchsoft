import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

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
  status: string;
  planned_date?: string | null;
  deadline_date?: string | null;
  source?: string | null;
  created_at: string;
  updated_at?: string;
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
  asset_status_after?: string | null;
  requires_spare_parts?: boolean;
  spare_parts_needed?: string | null;
  spare_parts_status?: string | null;
  created_by: string;
  created_at: string;
  engineer_name?: string | null;
  request_status?: string | null;
  signed_by_me?: boolean;
  is_fully_signed?: boolean;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async listRequests(clientId: string): Promise<MaintenanceRequestDto[]> {
    return firstValueFrom(
      this.http.get<MaintenanceRequestDto[]>(`${this.apiBase}/maintenance/requests/${clientId}`)
    );
  }

  async createRequest(payload: {
    clientId: string;
    assetId: string;
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
    params?: { assetId?: string; from?: string; to?: string; order?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<MaintenanceReportDto[]> {
    const query = new URLSearchParams();
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
    assetStatusAfter?: string;
    assetLifecycleAction?: 'retire' | null;
    requiresSpareParts?: boolean;
    sparePartsNeeded?: string;
    sparePartsStatus?: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/maintenance/reports`, payload));
  }

  async signReport(reportId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/maintenance/reports/${reportId}/sign`, {}));
  }

  async downloadReportPdf(reportId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/maintenance/reports/${reportId}/pdf`, {
        responseType: 'blob'
      })
    );
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
