import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';
import type { AssetCategory } from '../biomed/biomed.service';

export interface ScheduleDto {
  id: string;
  client_id: string;
  asset_category: AssetCategory;
  year: number;
  start_date: string;
  status: string;
  engineer_edited: boolean;
  engineer_edit_enabled: boolean;
  engineer_edit_enabled_by?: string | null;
  engineer_edit_enabled_at?: string | null;
  created_at: string;
  approved_at?: string | null;
  pdf_path?: string | null;
  total_items: number;
  programmed_items: number;
}

export interface ScheduleItemDto {
  id: string;
  schedule_id: string;
  asset_id: string;
  frequency: string;
  asset_maintenance_frequency?: string | null;
  planned_date: string;
  deadline_date: string;
  status: string;
  code?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  area_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  site_name?: string | null;
  area_name?: string | null;
  location_name?: string | null;
  programming_confirmed: boolean;
  programmed_at?: string | null;
  programmed_by?: string | null;
  report_id?: string | null;
  completion_source?: string | null;
  legacy_history_file_id?: string | null;
  historical_resolution?: 'pending_evidence' | 'not_performed' | 'evidence_uploaded' | null;
  non_execution_reason?: string | null;
  non_execution_recorded_at?: string | null;
  non_execution_recorded_by?: string | null;
}

export interface AssetRescheduleResultDto {
  oldFrequency: string | null;
  frequency: string;
  oldItemCount: number;
  newItemCount: number;
}

export interface TrainingScheduleDto {
  id: string;
  client_id: string;
  year: number;
  start_date: string;
  periodicity: string;
  status: string;
  created_at: string;
  approved_at?: string | null;
  pdf_path?: string | null;
  total_items: number;
  programmed_items: number;
}

export interface TrainingItemDto {
  id: string;
  schedule_id: string;
  area_id: string;
  area_name?: string | null;
  planned_date: string;
  status: string;
  pdf_path?: string | null;
  completed_at?: string | null;
  display_status?: string;
  programming_confirmed: boolean;
  programmed_at?: string | null;
  programmed_by?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async listSchedules(
    clientId: string,
    year?: number,
    assetCategory: AssetCategory = 'biomedical'
  ): Promise<ScheduleDto[]> {
    const query = new URLSearchParams({ category: assetCategory });
    if (year) query.set('year', String(year));
    return firstValueFrom(
      this.http.get<ScheduleDto[]>(`${this.apiBase}/maintenance/schedules/${clientId}?${query}`)
    );
  }

  async generateSchedule(
    clientId: string,
    year: number,
    startDate: string,
    assetCategory: AssetCategory = 'biomedical'
  ): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ id: string }>(`${this.apiBase}/maintenance/schedules/${clientId}/generate`, {
        year,
        startDate,
        assetCategory
      })
    );
    return response.id;
  }

  async listScheduleItems(scheduleId: string): Promise<ScheduleItemDto[]> {
    return firstValueFrom(
      this.http.get<ScheduleItemDto[]>(`${this.apiBase}/maintenance/schedules/${scheduleId}/items`)
    );
  }

  async updateScheduleItems(scheduleId: string, items: { id: string; plannedDate: string }[]): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/maintenance/schedules/${scheduleId}/items`, { items })
    );
  }

  async rescheduleAsset(
    scheduleId: string,
    assetId: string,
    frequency: string
  ): Promise<AssetRescheduleResultDto> {
    return firstValueFrom(
      this.http.post<AssetRescheduleResultDto>(
        `${this.apiBase}/maintenance/schedules/${scheduleId}/assets/${assetId}/reschedule`,
        { frequency }
      )
    );
  }

  async approveSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/maintenance/schedules/${scheduleId}/approve`, {})
    );
  }

  async setEngineerEditAccess(scheduleId: string, enabled: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/maintenance/schedules/${scheduleId}/engineer-edit-access`, {
        enabled
      })
    );
  }

  async downloadSchedulePdf(scheduleId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/maintenance/schedules/${scheduleId}/pdf`, {
        responseType: 'blob'
      })
    );
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/maintenance/schedules/${scheduleId}`));
  }

  async listTrainingSchedules(clientId: string, year?: number): Promise<TrainingScheduleDto[]> {
    const suffix = year ? `?year=${year}` : '';
    return firstValueFrom(
      this.http.get<TrainingScheduleDto[]>(`${this.apiBase}/training/schedules/${clientId}${suffix}`)
    );
  }

  async downloadTrainingSchedulePdf(scheduleId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/training/schedules/${scheduleId}/pdf`, { responseType: 'blob' })
    );
  }

  async generateTrainingSchedule(clientId: string, payload: { year: number; startDate: string; periodicity: string; areaIds: string[] }): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ id: string }>(`${this.apiBase}/training/schedules/${clientId}/generate`, payload)
    );
    return response.id;
  }

  async listTrainingItems(scheduleId: string): Promise<TrainingItemDto[]> {
    return firstValueFrom(
      this.http.get<TrainingItemDto[]>(`${this.apiBase}/training/schedules/${scheduleId}/items`)
    );
  }

  async updateTrainingItems(scheduleId: string, items: { id: string; plannedDate: string }[]): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/training/schedules/${scheduleId}/items`, { items })
    );
  }

  async listTrainingItemsByClient(clientId: string, year?: number): Promise<TrainingItemDto[]> {
    const suffix = year ? `?year=${year}` : '';
    return firstValueFrom(
      this.http.get<TrainingItemDto[]>(`${this.apiBase}/training/items/by-client/${clientId}${suffix}`)
    );
  }

  async approveTrainingSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/training/schedules/${scheduleId}/approve`, {})
    );
  }

  async uploadTrainingPdf(itemId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('pdf', file);
    await firstValueFrom(
      this.http.post(`${this.apiBase}/training/items/${itemId}/upload`, form)
    );
  }

  async downloadTrainingPdf(itemId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.apiBase}/training/items/${itemId}/pdf`, { responseType: 'blob' })
    );
  }

  async deleteTrainingPdf(itemId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/training/items/${itemId}/pdf`));
  }

  async deleteTrainingSchedule(scheduleId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/training/schedules/${scheduleId}`));
  }
}
