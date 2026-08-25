import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotificationDto, NotificationsService } from '../../notifications/notifications.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.scss'
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  notifications: AppNotificationDto[] = [];
  loading = false;
  open = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      void this.load();
    }, 0);
    this.timer = setInterval(() => void this.load(false), 60000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get unreadCount(): number {
    return this.notifications.filter((notification) => !notification.read_at).length;
  }

  get recentNotifications(): AppNotificationDto[] {
    return this.notifications.filter((notification) => !notification.read_at).slice(0, 12);
  }

  async toggleOpen(): Promise<void> {
    this.open = !this.open;
    if (this.open) await this.load(false);
  }

  async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading = true;
    try {
      this.notifications = await this.notificationsService.list();
    } catch (error) {
      console.error(error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async openNotification(notification: AppNotificationDto): Promise<void> {
    const keepOpenUntilResolved = this.isMaintenanceActionNotification(notification);
    if (!notification.read_at && !keepOpenUntilResolved) {
      await this.notificationsService.markRead(notification.id);
      notification.read_at = new Date().toISOString();
    }
    this.open = false;
    const maintenanceRoute = notification.link?.startsWith('/mantenimiento-industrial')
      ? '/mantenimiento-industrial'
      : '/mantenimiento';
    if (notification.type === 'maintenance_request_created' || notification.type === 'maintenance_preventive_generated') {
      const requestId = String(notification.payload?.['requestId'] || '');
      if (requestId) {
        await this.router.navigate([maintenanceRoute], {
          queryParams: { view: 'reportes', requestId, source: 'notification' }
        });
        return;
      }
    }
    if (notification.type === 'maintenance_spare_part_requested') {
      const requestId = String(notification.payload?.['requestId'] || '');
      await this.router.navigate([maintenanceRoute], {
        queryParams: { view: 'repuestos', requestId: requestId || null, source: 'notification' }
      });
      return;
    }
    if (notification.type === 'maintenance_report_correction_requested') {
      await this.router.navigate([maintenanceRoute], {
        queryParams: { view: 'reportes', source: 'notification' }
      });
      return;
    }
    if (notification.link) {
      await this.router.navigateByUrl(notification.link);
    }
  }

  private isMaintenanceActionNotification(notification: AppNotificationDto): boolean {
    return [
      'maintenance_request_created',
      'maintenance_preventive_generated',
      'maintenance_spare_part_requested'
    ].includes(notification.type || '');
  }

  async markAllRead(event: Event): Promise<void> {
    event.stopPropagation();
    await this.notificationsService.markAllRead();
    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      read_at: notification.read_at || new Date().toISOString()
    }));
    this.cdr.detectChanges();
  }

  priorityLabel(priority?: string | null): string {
    if (priority === 'high') return 'Alta';
    if (priority === 'low') return 'Baja';
    return 'Normal';
  }

  typeLabel(type?: string | null): string {
    const labels: Record<string, string> = {
      maintenance_request_created: 'Solicitud mantenimiento',
      maintenance_report_ready: 'Reporte listo',
      maintenance_report_correction_requested: 'Corrección solicitada',
      maintenance_report_signed: 'Reporte firmado',
      maintenance_spare_part_requested: 'Solicitud de repuesto',
      odontology_inventory_low_stock: 'Stock bajo odontología',
      maintenance_preventive_generated: 'Preventivo',
      preventive_maintenance_start: 'Inicio preventivo',
      preventive_maintenance_reminder: 'Recordatorio preventivo',
      training_start: 'Capacitación',
      training_reminder: 'Recordatorio capacitación',
      calibration_start: 'Calibración',
      calibration_reminder: 'Recordatorio calibración',
      general: 'General'
    };
    return labels[type || 'general'] ?? 'Notificación';
  }
}
