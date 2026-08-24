import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

export interface CalibrationScheduleDto {
  id: string;
  client_id: string;
  year: number;
  start_date: string;
  status: string;
  created_at: string;
  approved_at?: string | null;
}

export interface CalibrationItemDto {
  id: string;
  schedule_id: string;
  asset_id: string;
  frequency: string;
  planned_date: string;
  deadline_date: string;
  status: string;
  pdf_path?: string | null;
  area_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  area_name?: string | null;
  site_name?: string | null;
  location_name?: string | null;
  code?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  display_status?: string;
}

export interface CalibrationReportDto {
  id: string;
  planned_date: string;
  completed_at?: string | null;
  pdf_path: string;
  frequency: string;
}

@Injectable({ providedIn: 'root' })
export class CalibrationService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async listSchedules(clientId: string, year?: number): Promise<CalibrationScheduleDto[]> {
    const suffix = year ? `?year=${year}` : '';
    return firstValueFrom(
      this.http.get<CalibrationScheduleDto[]>(`${this.apiBase}/calibration/schedules/${clientId}${suffix}`)
    );
  }

  async downloadSchedulePdf(scheduleId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/calibration/schedules/${scheduleId}/pdf`, { responseType: 'blob' })
    );
  }

  async generateSchedule(clientId: string, payload: { year: number; startDate: string }): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ id: string }>(`${this.apiBase}/calibration/schedules/${clientId}/generate`, payload)
    );
    return response.id;
  }

  async listItems(scheduleId: string): Promise<CalibrationItemDto[]> {
    return firstValueFrom(
      this.http.get<CalibrationItemDto[]>(`${this.apiBase}/calibration/schedules/${scheduleId}/items`)
    );
  }

  async updateScheduleItems(
    scheduleId: string,
    items: { id: string; plannedDate: string }[]
  ): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/calibration/schedules/${scheduleId}/items`, { items })
    );
  }

  async approveSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/calibration/schedules/${scheduleId}/approve`, {})
    );
  }

  async uploadPdf(itemId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('pdf', file);
    await firstValueFrom(
      this.http.post(`${this.apiBase}/calibration/items/${itemId}/upload`, form)
    );
  }

  async downloadPdf(itemId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/calibration/items/${itemId}/pdf`, { responseType: 'blob' })
    );
  }

  async deletePdf(itemId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/calibration/items/${itemId}/pdf`));
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/calibration/schedules/${scheduleId}`));
  }

  async listReports(clientId: string, assetId: string, limit?: number, offset?: number): Promise<CalibrationReportDto[]> {
    const params = new URLSearchParams();
    params.set('assetId', assetId);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    return firstValueFrom(
      this.http.get<CalibrationReportDto[]>(`${this.apiBase}/calibration/reports/${clientId}?${params}`)
    );
  }
}
