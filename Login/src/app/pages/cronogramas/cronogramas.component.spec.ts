import { CalibrationItemDto } from '../../calibration/calibration.service';
import { ScheduleItemDto } from '../../schedules/schedules.service';
import { CronogramasComponent } from './cronogramas.component';

function createComponent(): CronogramasComponent {
  return new CronogramasComponent(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
}

function maintenanceItem(
  id: string,
  areaName: string,
  locationName: string
): ScheduleItemDto {
  return {
    id,
    schedule_id: 'maintenance-schedule',
    asset_id: `asset-${id}`,
    frequency: 'anual',
    planned_date: '2026-01-15',
    deadline_date: '2026-01-31',
    status: 'pending',
    area_name: areaName,
    location_name: locationName,
    programming_confirmed: false
  };
}

function calibrationItem(
  id: string,
  areaName: string,
  locationName: string
): CalibrationItemDto {
  return {
    id,
    schedule_id: 'calibration-schedule',
    asset_id: `asset-${id}`,
    frequency: 'anual',
    planned_date: '2026-01-15',
    deadline_date: '2026-01-31',
    status: 'pending',
    area_name: areaName,
    location_name: locationName,
    programming_confirmed: false
  };
}

describe('CronogramasComponent filtros dependientes', () => {
  it('limita las ubicaciones de mantenimiento al área seleccionada', () => {
    const component = createComponent();
    component.items = [
      maintenanceItem('1', 'URGENCIAS', 'REANIMACIÓN'),
      maintenanceItem('2', 'URGENCIAS', 'SALA DE PARTOS'),
      maintenanceItem('3', 'HOSPITALIZACIÓN', 'HABITACIÓN 201')
    ];
    component.maintenanceLocationFilter = 'HABITACIÓN 201';

    expect(component.maintenanceLocationOptions).toEqual([]);

    component.onMaintenanceAreaFilterChange('URGENCIAS');

    expect(component.maintenanceLocationFilter).toBe('');
    expect(component.maintenanceLocationOptions).toEqual(['REANIMACIÓN', 'SALA DE PARTOS']);
  });

  it('limita las ubicaciones de calibración al área seleccionada', () => {
    const component = createComponent();
    component.calibrationItems = [
      calibrationItem('1', 'URGENCIAS', 'REANIMACIÓN'),
      calibrationItem('2', 'URGENCIAS', 'SALA DE PARTOS'),
      calibrationItem('3', 'HOSPITALIZACIÓN', 'HABITACIÓN 201')
    ];
    component.calibrationLocationFilter = 'HABITACIÓN 201';

    expect(component.calibrationLocationOptions).toEqual([]);

    component.onCalibrationAreaFilterChange('URGENCIAS');

    expect(component.calibrationLocationFilter).toBe('');
    expect(component.calibrationLocationOptions).toEqual(['REANIMACIÓN', 'SALA DE PARTOS']);
  });

  it('mantiene la edición de mantenimiento dentro del mes periódico', () => {
    const component = createComponent();
    const item = maintenanceItem('1', 'URGENCIAS', 'REANIMACIÓN');
    item.frequency = 'trimestral';
    item.planned_date = '2026-05-04';
    item.deadline_date = '2026-05-31';

    expect((component as any).computeRangeMin(item)).toBe('2026-05-01');
  });

  it('abre un calendario propio limitado al mes del mantenimiento', () => {
    const component = createComponent();
    const item = maintenanceItem('1', 'URGENCIAS', 'REANIMACIÓN');
    item.planned_date = '2026-08-25';
    item.deadline_date = '2026-08-31';
    const group = {
      key: '2026-08-25:2026-08-31',
      plannedDate: '2026-08-25',
      minDate: '2026-08-01',
      maxDate: '2026-08-31',
      items: [item]
    };

    component.openMaintenanceDatePicker(group);

    expect(component.calendarPicker?.kind).toBe('maintenance');
    expect(component.calendarPickerMonthLabel.toLowerCase()).toContain('agosto');
    expect(component.calendarPickerDays).toHaveLength(42);
    expect(component.calendarPickerDays.find((day) => day?.date === '2026-08-27')?.disabled).toBe(false);
    expect(component.calendarPickerDays.find((day) => day?.date === '2026-08-29')?.disabled).toBe(true);
  });

  it('aplica el día elegido al grupo y cierra el calendario', () => {
    const component = createComponent();
    const item = maintenanceItem('1', 'URGENCIAS', 'REANIMACIÓN');
    item.planned_date = '2026-08-25';
    item.deadline_date = '2026-08-31';
    const group = {
      key: '2026-08-25:2026-08-31',
      plannedDate: '2026-08-25',
      minDate: '2026-08-01',
      maxDate: '2026-08-31',
      items: [item]
    };
    component.openMaintenanceDatePicker(group);

    component.selectCalendarDate('2026-08-27');

    expect(group.plannedDate).toBe('2026-08-27');
    expect(item.planned_date).toBe('2026-08-27');
    expect(component.calendarPicker).toBeNull();
  });

  it('impide seleccionar una fecha por fuera de la ventana permitida', () => {
    const component = createComponent();
    const item = maintenanceItem('1', 'URGENCIAS', 'REANIMACIÓN');
    item.planned_date = '2026-08-25';
    item.deadline_date = '2026-08-31';
    const group = {
      key: '2026-08-25:2026-08-31',
      plannedDate: '2026-08-25',
      minDate: '2026-08-20',
      maxDate: '2026-08-31',
      items: [item]
    };
    component.openMaintenanceDatePicker(group);

    component.selectCalendarDate('2026-08-19');

    expect(group.plannedDate).toBe('2026-08-25');
    expect(component.calendarPickerDays.find((day) => day?.date === '2026-08-19')?.disabled).toBe(true);
    expect(component.calendarPicker).not.toBeNull();
  });

  it('permite reprogramar por equipo un mantenimiento guardado en borrador', () => {
    const component = createComponent();
    const item = maintenanceItem('1', 'VACUNACIÓN', 'CADENA DE FRÍO');
    item.asset_id = 'asset-nevera';
    item.code = 'N7R';
    item.name = 'NEVERA HORIZONTAL';
    item.frequency = 'trimestral';
    item.programming_confirmed = true;
    component.items = [item];
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-02-16',
        status: 'draft',
        engineer_edited: false,
        engineer_edit_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
        total_items: 4,
        programmed_items: 4
      }
    ];
    component.selectedScheduleId = 'maintenance-schedule';
    component.editing = true;
    component.maintenanceEditLevel = 'equipment';
    component.maintenanceProgrammingView = 'all';

    const group = component.filteredGroupedItems[0];
    component.openMaintenanceReschedule(group);

    expect(component.maintenanceRescheduleDialog).toEqual({
      assetId: 'asset-nevera',
      code: 'N7R',
      name: 'NEVERA HORIZONTAL',
      currentFrequency: 'trimestral',
      frequency: 'trimestral'
    });
  });

  it('habilita reprogramar cuando el filtro identifica un único equipo', () => {
    const component = createComponent();
    component.items = Array.from({ length: 4 }, (_, index) => {
      const item = maintenanceItem(`n7r-${index}`, 'VACUNACIÓN', 'CADENA DE FRÍO');
      item.asset_id = 'asset-nevera';
      item.code = 'N7R';
      item.name = 'NEVERA HORIZONTAL';
      item.frequency = 'trimestral';
      item.programming_confirmed = true;
      return item;
    });
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-02-16',
        status: 'draft',
        engineer_edited: false,
        engineer_edit_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
        total_items: 4,
        programmed_items: 4
      }
    ];
    component.selectedScheduleId = 'maintenance-schedule';
    component.editing = true;
    component.maintenanceEditLevel = 'area';
    component.maintenanceProgrammingView = 'programmed';
    component.maintenanceDetailSearch = 'N7R';

    const group = component.maintenanceFilteredAssetGroup;

    expect(group?.assetId).toBe('asset-nevera');
    expect(component.maintenanceGroupCanReschedule(group!)).toBe(true);
    component.openMaintenanceReschedule(group!);
    expect(component.maintenanceRescheduleDialog?.assetId).toBe('asset-nevera');
  });

  it('sincroniza desde la hoja de vida un equipo pendiente sin guardar', async () => {
    const original = [2, 5, 8, 11].map((month, index) => {
      const item = maintenanceItem(`old-${index}`, 'VACUNACIÓN', 'CADENA DE FRÍO');
      item.asset_id = 'asset-congelador';
      item.frequency = 'trimestral';
      item.asset_maintenance_frequency = 'mensual';
      item.planned_date = `2026-${String(month).padStart(2, '0')}-16`;
      item.deadline_date = `2026-${String(month).padStart(2, '0')}-28`;
      return item;
    });
    const synchronized = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      const item = maintenanceItem(`new-${index}`, 'VACUNACIÓN', 'CADENA DE FRÍO');
      item.asset_id = 'asset-congelador';
      item.frequency = 'mensual';
      item.asset_maintenance_frequency = 'mensual';
      item.planned_date = `2026-${month}-16`;
      item.deadline_date = `2026-${month}-28`;
      return item;
    });
    let listCalls = 0;
    const rescheduleCalls: unknown[][] = [];
    const schedulesService = {
      listScheduleItems: async () => {
        listCalls += 1;
        return listCalls === 1 ? original : synchronized;
      },
      rescheduleAsset: async (...args: unknown[]) => {
        rescheduleCalls.push(args);
        return {
          oldFrequency: 'trimestral',
          frequency: 'mensual',
          oldItemCount: 4,
          newItemCount: 12
        };
      }
    };
    const component = new CronogramasComponent(
      {} as never,
      schedulesService as never,
      {} as never,
      {} as never,
      { hasPermission: () => true } as never,
      { markForCheck: () => undefined } as never
    );
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-02-16',
        status: 'draft',
        engineer_edited: false,
        engineer_edit_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
        total_items: 4,
        programmed_items: 0
      }
    ];
    component.selectedScheduleId = 'maintenance-schedule';

    await (component as any).loadItems('maintenance-schedule');

    expect(rescheduleCalls).toEqual([
      ['maintenance-schedule', 'asset-congelador', 'mensual']
    ]);
    expect(listCalls).toBe(2);
    expect(component.items).toHaveLength(12);
    expect(component.items.every((item) => item.frequency === 'mensual')).toBe(true);
    expect(component.selectedSchedule?.total_items).toBe(12);
    expect(component.selectedSchedule?.programmed_items).toBe(0);
    expect(component.noticeMessage).toContain('Se sincronizó 1 equipo');
  });

  it('no sincroniza automáticamente un equipo que ya tiene programación guardada', async () => {
    const item = maintenanceItem('saved', 'VACUNACIÓN', 'CADENA DE FRÍO');
    item.asset_id = 'asset-congelador';
    item.frequency = 'trimestral';
    item.asset_maintenance_frequency = 'mensual';
    item.programming_confirmed = true;
    let rescheduleCalls = 0;
    const schedulesService = {
      listScheduleItems: async () => [item],
      rescheduleAsset: async () => {
        rescheduleCalls += 1;
      }
    };
    const component = new CronogramasComponent(
      {} as never,
      schedulesService as never,
      {} as never,
      {} as never,
      { hasPermission: () => true } as never,
      { markForCheck: () => undefined } as never
    );
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-02-16',
        status: 'draft',
        engineer_edited: false,
        engineer_edit_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
        total_items: 1,
        programmed_items: 1
      }
    ];
    component.selectedScheduleId = 'maintenance-schedule';

    await (component as any).loadItems('maintenance-schedule');

    expect(rescheduleCalls).toBe(0);
    expect(component.items).toHaveLength(1);
  });
});
