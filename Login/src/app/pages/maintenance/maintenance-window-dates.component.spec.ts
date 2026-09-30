import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';
import { MaintenanceRequestDto } from '../../maintenance/maintenance.service';

describe('preventive service window calendar dates', () => {
  afterEach(() => vi.restoreAllMocks());

  function windowLabel(planned_date?: string, deadline_date?: string): string {
    const component = new MaintenanceComponent(
      {} as never, {} as never, {} as never, {} as never, {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    return component.preventiveWindowLabel({ planned_date, deadline_date } as MaintenanceRequestDto);
  }

  it.each([
    ['2026-09-30T00:00:00.000Z', '2026-09-30T00:00:00.000Z', '30/9/2026 - 30/9/2026'],
    ['2026-09-29', '2026-09-30', '29/9/2026 - 30/9/2026'],
    ['2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', '1/10/2026 - 31/10/2026'],
    ['2027-01-01', '2027-01-31', '1/1/2027 - 31/1/2027'],
    ['2028-02-29', '2028-02-29', '29/2/2028 - 29/2/2028']
  ])('preserves %s through %s regardless of the browser timezone', (start, end, expected) => {
    const formatting = vi.spyOn(Date.prototype, 'toLocaleDateString');
    expect(windowLabel(start, end)).toBe(expected);
    expect(formatting).toHaveBeenNthCalledWith(1, 'es-CO', { timeZone: 'UTC' });
    expect(formatting).toHaveBeenNthCalledWith(2, 'es-CO', { timeZone: 'UTC' });
  });

  it('keeps the missing-date fallbacks', () => {
    expect(windowLabel()).toBe('Ventana no registrada');
    expect(windowLabel('2026-09-30')).toBe('30/9/2026 - -');
    expect(windowLabel(undefined, '2026-09-30')).toBe('- - 30/9/2026');
  });
});
