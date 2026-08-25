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
});
