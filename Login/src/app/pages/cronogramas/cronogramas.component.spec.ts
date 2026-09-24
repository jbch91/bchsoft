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

describe('Calibraciones: programacion, sedes y aprobacion', () => {
  function draftComponent(): CronogramasComponent {
    const component = createComponent();
    Object.assign(component.auth, { currentUser: () => ({ clientId: 'client' }), hasPermission: () => true });
    component.selectedYear = 2026;
    component.selectedCalibrationScheduleId = 'calibration-schedule';
    component.calibrationSchedules = [{ id: 'calibration-schedule', client_id: 'client', year: 2026,
      start_date: '2026-09-01', status: 'draft', created_at: '', total_items: 2, programmed_items: 0 }];
    component.calibrationItems = ['1', '2'].map((id) => ({ ...calibrationItem(id, 'URGENCIAS', `SALA ${id}`),
      site_id: `site-${id}`, site_name: `SEDE ${id}`, planned_date: '2026-09-01', deadline_date: '2026-10-01' }));
    return component;
  }

  it('abre la ruta Calibraciones sin habilitar las otras clases de cronograma', async () => {
    const component = new CronogramasComponent({} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, { snapshot: { data: { calibrationOnly: true } } } as never);
    expect(component.viewMode).toBe('calibration');
    expect(component.scheduleModuleTitle).toBe('Calibraciones');
    await component.switchView('maintenance');
    expect(component.viewMode).toBe('calibration');
  });

  it('filtra sedes por id y restringe las ubicaciones incluso con areas del mismo nombre', () => {
    const component = draftComponent();
    component.onCalibrationSiteFilterChange('site-2');
    component.onCalibrationAreaFilterChange('URGENCIAS');
    expect(component.filteredCalibrationItems.map((row) => row.id)).toEqual(['2']);
    expect(component.calibrationLocationOptions).toEqual(['SALA 2']);
    component.onCalibrationSiteFilterChange('site-1');
    expect(component.calibrationAreaFilter).toBe('');
    expect(component.calibrationLocationFilter).toBe('');
  });

  it('agrupa la programacion por sede sin mezclar equipos', () => {
    const component = draftComponent();
    component.calibrationEditing = true;
    component.calibrationEditLevel = 'site';
    expect(component.filteredCalibrationGroups.map((group) => group.assetCount)).toEqual([1, 1]);
    expect(component.calibrationSectionLabel()).toBe('Sede');
  });

  it('mover el inicio conserva el cierre contractual y detecta cambios independientes', () => {
    const component = draftComponent();
    component.startCalibrationEdit();
    component.onCalibrationItemDateChange(component.calibrationItems[0], '2026-09-24');
    expect(component.calibrationItems[0].planned_date).toBe('2026-09-24');
    expect(component.calibrationItems[0].deadline_date).toBe('2026-10-01');
    expect(component.calibrationItems[1].planned_date).toBe('2026-09-01');
    expect(component.hasCalibrationChanges()).toBe(true);
    expect(component.calibrationDeadline('2026-12-24')).toBe('2026-12-31');
  });

  it('edita la finalizacion entre meses, admite fines de semana y restaura al cancelar', () => {
    const component = draftComponent();
    component.startCalibrationEdit();
    const group = component.filteredCalibrationGroups[0].dateGroups[0];
    component.openCalibrationDatePicker(group, 'end');
    component.moveCalendarMonth(1);
    expect(component.calendarPickerMonthLabel).toContain('Noviembre');
    component.selectCalendarDate('2026-11-07');
    expect(component.calibrationItems[0].deadline_date).toBe('2026-11-07');
    expect(component.hasCalibrationChanges()).toBe(true);
    expect(component.calibrationSectionHasChanges(component.filteredCalibrationGroups[0])).toBe(true);
    component.cancelCalibrationEdit();
    expect(component.calibrationItems[0].deadline_date).toBe('2026-10-01');
    expect(component.hasCalibrationChanges()).toBe(false);
  });

  it('no mezcla ventanas que tengan diferente finalizacion', () => {
    const component = draftComponent();
    component.calibrationItems[1].site_id = 'site-1';
    component.calibrationItems[1].deadline_date = '2026-11-01';
    component.startCalibrationEdit();
    expect(component.filteredCalibrationGroups[0].dateGroups.length).toBe(2);
  });

  it('muestra progreso por actas y por sede, sin alterar el total al cambiar de fase', () => {
    const component = draftComponent();
    component.calibrationSchedules[0].status = 'approved';
    component.calibrationItems[0].pdf_path = '/qa.pdf';
    expect(component.calibrationEvidenceProgress.percent).toBe(50);
    expect(component.filteredCalibrationItems.map((item) => item.id)).toEqual(['2']);
    component.calibrationEvidenceView = 'with';
    expect(component.filteredCalibrationItems.map((item) => item.id)).toEqual(['1']);
    expect(component.calibrationEvidenceProgress.total).toBe(2);
    component.onCalibrationSiteFilterChange('site-1');
    expect(component.calibrationEvidenceProgress.percent).toBe(100);
    component.onCalibrationSiteFilterChange('inexistente');
    expect(component.calibrationEvidenceProgress.percent).toBe(0);
    expect(component.calibrationCompletionPercent(999, 1000)).toBe(99);
  });

  it('permite cargar actas futuras al aprobar, solo con permiso de calibracion', () => {
    const component = draftComponent();
    component.calibrationSchedules[0].status = 'approved';
    component.calibrationItems[0].display_status = 'pending';
    expect(component.canUploadCalibration(component.calibrationItems[0])).toBe(true);
    component.auth.hasPermission = (permission) => permission === 'calibration:schedule:manage';
    expect(component.canUploadCalibration(component.calibrationItems[0])).toBe(false);
    component.calibrationSchedules[0].status = 'closed';
    expect(component.canUploadCalibration(component.calibrationItems[0])).toBe(false);
  });

  it('eliminar requiere permiso de gestionar y cronograma sin aprobar', () => {
    const component = draftComponent();
    component.requestDeleteCalibrationSchedule(component.calibrationSchedules[0]);
    expect(component.confirmDialog?.danger).toBe(true);
    component.confirmDialog = null;
    component.calibrationSchedules[0].status = 'approved';
    component.requestDeleteCalibrationSchedule(component.calibrationSchedules[0]);
    expect(component.confirmDialog).toBeNull();
    component.calibrationSchedules[0].status = 'draft';
    component.auth.hasPermission = () => false;
    component.requestDeleteCalibrationSchedule(component.calibrationSchedules[0]);
    expect(component.confirmDialog).toBeNull();
  });

  it('aprobar requiere datos guardados y cargar evidencia requiere aprobacion', () => {
    const component = draftComponent();
    expect(component.canApproveCalibrationDraft()).toBe(false);
    component.calibrationItems.forEach((item) => { item.programming_confirmed = true; item.display_status = 'active'; });
    component.startCalibrationEdit();
    expect(component.canApproveCalibrationDraft()).toBe(true);
    expect(component.canUploadCalibration(component.calibrationItems[0])).toBe(false);
    component.onCalibrationItemDateChange(component.calibrationItems[0], '2026-09-24');
    expect(component.canApproveCalibrationDraft()).toBe(false);
    component.calibrationSchedules[0].status = 'approved';
    expect(component.canUploadCalibration(component.calibrationItems[0])).toBe(true);
    expect(component.canEditCalibration()).toBe(false);
  });

  it('guardar todas informa y guarda tambien las calibraciones ocultas por filtros', async () => {
    const component = draftComponent();
    const saved: unknown[] = [];
    (component as any).calibration.updateScheduleItems = async (_id: string, items: unknown[]) => saved.push(...items);
    component.loadCalibrationSchedules = async () => {};
    component.calibrationSiteFilter = 'site-1';
    component.requestSaveAllCalibration();
    expect(component.confirmDialog?.message).toContain('2 calibraciones');
    await component.confirmDialog!.action();
    expect(saved.length).toBe(2);
    expect(saved[0]).toEqual({ id: '1', plannedDate: '2026-09-01', deadlineDate: '2026-10-01' });
  });

  it('reprogramar exige confirmacion y conserva sede, fecha y periodicidad elegidas', async () => {
    const component = draftComponent();
    let sent: unknown;
    (component as any).calibration.reprogramDraft = async (_id: string, payload: unknown) => { sent = payload; };
    component.loadCalibrationSchedules = async () => {};
    component.calibrationReprogramSite = 'site-2';
    component.calibrationReprogramDate = '2026-09-24';
    component.calibrationReprogramFrequency = 'semestral';
    component.requestReprogramCalibration();
    expect(sent).toBeUndefined();
    expect(component.confirmDialog?.message).toContain('SEDE 2');
    await component.confirmDialog!.action();
    expect(sent).toEqual({ siteId: 'site-2', startDate: '2026-09-24', frequency: 'semestral' });
    expect(component.calibrationProgrammingView).toBe('pending');
    expect(component.calibrationReprogramSite).toBe('site-2');
    expect(component.calibrationReprogramDate).toBe('2026-09-24');
  });
});

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

  it('abre el editor de fechas del equipo filtrado sin cambiar su periodicidad', () => {
    const component = createComponent();
    component.items = [1, 4, 7, 10].map((month, index) => {
      const item = maintenanceItem(`n7r-${index}`, 'VACUNACIÓN', 'CADENA DE FRÍO');
      const monthValue = String(month).padStart(2, '0');
      item.asset_id = 'asset-nevera';
      item.code = 'N7R';
      item.name = 'NEVERA HORIZONTAL';
      item.frequency = 'trimestral';
      item.planned_date = `2026-${monthValue}-15`;
      item.deadline_date = `2026-${monthValue}-${month === 4 ? '30' : '31'}`;
      item.programming_confirmed = true;
      return item;
    });
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-01-15',
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

    const group = component.maintenanceFilteredDateAssetGroup;
    component.openMaintenanceDates(group!);
    component.onAreaPlannedDateChange(component.maintenanceDatesDialog!.dateGroups[0], '2026-01-20');

    expect(component.maintenanceDatesDialog?.dateGroups).toHaveLength(4);
    expect(component.maintenanceDatesHaveChanges()).toBe(true);
    expect(component.items.every((item) => item.frequency === 'trimestral')).toBe(true);

    component.closeMaintenanceDates();

    expect(component.items[0].planned_date).toBe('2026-01-15');
    expect(component.maintenanceDatesDialog).toBeNull();
  });

  it('guarda las fechas del equipo sin invocar la reprogramación', async () => {
    const updateCalls: unknown[][] = [];
    const schedulesService = {
      updateScheduleItems: async (...args: unknown[]) => {
        updateCalls.push(args);
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
    const january = maintenanceItem('jan', 'VACUNACIÓN', 'CADENA DE FRÍO');
    january.asset_id = 'asset-nevera';
    january.code = 'N7R';
    january.name = 'NEVERA HORIZONTAL';
    january.frequency = 'mensual';
    january.programming_confirmed = true;
    const february = maintenanceItem('feb', 'VACUNACIÓN', 'CADENA DE FRÍO');
    february.asset_id = 'asset-nevera';
    february.code = 'N7R';
    february.name = 'NEVERA HORIZONTAL';
    february.frequency = 'mensual';
    february.planned_date = '2026-02-16';
    february.deadline_date = '2026-02-28';
    february.programming_confirmed = true;
    component.items = [january, february];
    component.schedules = [
      {
        id: 'maintenance-schedule',
        client_id: 'client-id',
        asset_category: 'biomedical',
        year: 2026,
        start_date: '2026-01-15',
        status: 'draft',
        engineer_edited: false,
        engineer_edit_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
        total_items: 2,
        programmed_items: 2
      }
    ];
    component.selectedScheduleId = 'maintenance-schedule';
    component.editing = true;
    component.maintenanceEditLevel = 'equipment';
    component.maintenanceProgrammingView = 'all';

    const group = component.filteredGroupedItems[0];
    component.openMaintenanceDates(group);
    component.onAreaPlannedDateChange(component.maintenanceDatesDialog!.dateGroups[0], '2026-01-20');
    await component.applyMaintenanceDates();

    expect(updateCalls).toEqual([
      [
        'maintenance-schedule',
        [
          { id: 'jan', plannedDate: '2026-01-20' },
          { id: 'feb', plannedDate: '2026-02-16' }
        ]
      ]
    ]);
    expect(component.items.every((item) => item.frequency === 'mensual')).toBe(true);
    expect(component.maintenanceDatesDialog).toBeNull();
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
