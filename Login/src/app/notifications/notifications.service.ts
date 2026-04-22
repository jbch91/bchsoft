import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';

export interface AppNotificationDto {
  id: string;
  client_id?: string | null;
  title: string;
  message: string;
  link?: string | null;
  type?: string | null;
  priority?: 'low' | 'normal' | 'high' | string | null;
  payload?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly apiBase = getApiBase();

  constructor(private readonly http: HttpClient) {}

  async list(): Promise<AppNotificationDto[]> {
    return firstValueFrom(this.http.get<AppNotificationDto[]>(`${this.apiBase}/notifications`));
  }

  async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/notifications/${notificationId}/read`, {}));
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/notifications/read-all`, {}));
  }
}
