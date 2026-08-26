import { describe, expect, it, vi } from 'vitest';
import { NotificationCenterComponent } from './notification-center.component';

describe('maintenance report notifications', () => {
  it('abre el reporte pendiente de aval y conserva la notificación hasta resolverlo', async () => {
    const notifications = {
      markRead: vi.fn().mockResolvedValue(undefined)
    };
    const router = {
      navigate: vi.fn().mockResolvedValue(true),
      navigateByUrl: vi.fn().mockResolvedValue(true)
    };
    const component = new NotificationCenterComponent(
      notifications as never,
      router as never,
      { detectChanges: vi.fn() } as never
    );

    await component.openNotification({
      id: 'notification-1',
      title: 'Mantenimiento preventivo pendiente de aval',
      message: 'Revisa y firma el reporte.',
      link: '/mantenimiento',
      type: 'maintenance_report_ready',
      priority: 'high',
      payload: { reportId: 'report-1', requestId: 'request-1' },
      created_at: '2026-08-26T10:00:00.000Z'
    });

    expect(notifications.markRead).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: { view: 'reportes', reportId: 'report-1', source: 'notification' }
    });
  });
});
