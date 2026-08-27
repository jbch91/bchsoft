import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import {
  ScheduleDto,
  ScheduleItemDto,
  SchedulesService,
  TrainingItemDto,
  TrainingScheduleDto
} from '../../schedules/schedules.service';
import {
  CalibrationItemDto,
  CalibrationScheduleDto,
  CalibrationService
} from '../../calibration/calibration.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import type { AssetCategory } from '../../biomed/biomed.service';

interface ClientOption {
  id: string;
  name: string;
  nit: string;
  city: string;
  address?: string | null;
  email: string;
}

interface AreaOption {
  id: string;
  name: string;
}

interface MaintenanceAreaDateGroup {
  key: string;
  plannedDate: string;
  minDate: string;
  maxDate: string;
  items: ScheduleItemDto[];
}

interface MaintenanceItemGroup {
  areaKey: string;
  assetId: string;
  areaName: string;
  siteName: string;
  locationName: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  assetCount: number;
  frequencies: string[];
  items: ScheduleItemDto[];
  dateGroups: MaintenanceAreaDateGroup[];
}

interface TrainingItemGroup {
  areaKey: string;
  areaName: string;
  items: TrainingItemDto[];
}

interface CalibrationDateGroup {
  key: string;
  plannedDate: string;
  minDate: string;
  maxDate: string;
  items: CalibrationItemDto[];
}

interface CalibrationItemGroup {
  areaKey: string;
  areaName: string;
  siteName: string;
  locationName: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  assetCount: number;
  frequencies: string[];
  items: CalibrationItemDto[];
  dateGroups: CalibrationDateGroup[];
}

type CalendarPickerState =
  | { kind: 'maintenance'; group: MaintenanceAreaDateGroup }
  | { kind: 'calibration'; group: CalibrationDateGroup };

interface CalendarPickerDay {
  date: string;
  day: number;
  disabled: boolean;
  selected: boolean;
  today: boolean;
}

interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => Promise<void>;
}

interface MaintenanceRescheduleDialog {
  assetId: string;
  code: string;
  name: string;
  currentFrequency: string;
  frequency: string;
}

interface MaintenanceDatesDialog {
  assetId: string;
  code: string;
  name: string;
  frequency: string;
  dateGroups: MaintenanceAreaDateGroup[];
  originalDates: Record<string, string>;
}

type ViewMode = 'maintenance' | 'training' | 'calibration';
type NoticeKind = 'success' | 'error' | 'info';
type AssetEditLevel = 'area' | 'location' | 'equipment';
type ProgrammingView = 'pending' | 'programmed' | 'all';

@Component({
  selector: 'app-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './cronogramas.component.html',
  styleUrl: './cronogramas.component.scss'
})
export class CronogramasComponent implements OnInit {
  readonly assetCategory: AssetCategory;
  readonly minimumYear = 1900;
  readonly maximumYear = 2200;
  readonly trainingPeriodOptions = [
    'mensual',
    'bimensual',
    'trimestral',
    'cuatrimestral',
    'semestral',
    'anual'
  ];
  readonly maintenancePeriodOptions = [...this.trainingPeriodOptions];

  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  selectedYear = new Date().getFullYear();
  areas: AreaOption[] = [];
  areaSearch = '';
  selectedAreas: string[] = [];

  viewMode: ViewMode = 'maintenance';
  showGenerator = false;
  detailModalOpen = false;
  loading = false;
  detailLoading = false;
  busyAction = '';
  lastUpdatedLabel = 'Sin actualizar';
  noticeMessage = '';
  noticeKind: NoticeKind = 'info';
  confirmDialog: ConfirmDialog | null = null;
  confirmBusy = false;
  maintenanceDatesDialog: MaintenanceDatesDialog | null = null;
  maintenanceRescheduleDialog: MaintenanceRescheduleDialog | null = null;
  calendarPicker: CalendarPickerState | null = null;
  readonly calendarWeekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  startDate = '';
  schedules: ScheduleDto[] = [];
  selectedScheduleId = '';
  items: ScheduleItemDto[] = [];
  maintenanceStatusFilter = '';
  maintenanceItemStatusFilter = '';
  maintenanceDetailSearch = '';
  maintenanceAreaFilter = '';
  maintenanceLocationFilter = '';
  maintenanceFrequencyFilter = '';
  editing = false;
  maintenanceEditLevel: AssetEditLevel = 'area';
  maintenanceProgrammingView: ProgrammingView = 'pending';
  private readonly rangeMap = new Map<string, { min: string; max: string }>();
  private maintenanceSnapshot = new Map<string, string>();

  trainingStartDate = '';
  trainingPeriodicity = 'semestral';
  trainingSchedules: TrainingScheduleDto[] = [];
  selectedTrainingScheduleId = '';
  trainingItems: TrainingItemDto[] = [];
  trainingStatusFilter = '';
  trainingItemStatusFilter = '';
  trainingSearch = '';
  trainingEditing = false;
  trainingProgrammingView: ProgrammingView = 'pending';
  private trainingSnapshot = new Map<string, string>();

  calibrationStartDate = '';
  calibrationSchedules: CalibrationScheduleDto[] = [];
  selectedCalibrationScheduleId = '';
  calibrationItems: CalibrationItemDto[] = [];
  calibrationScheduleStatusFilter = '';
  calibrationItemStatusFilter = '';
  calibrationSearch = '';
  calibrationAreaFilter = '';
  calibrationLocationFilter = '';
  calibrationEditing = false;
  calibrationEditLevel: AssetEditLevel = 'area';
  calibrationProgrammingView: ProgrammingView = 'pending';
  private calibrationSnapshot = new Map<string, string>();
  private readonly calibrationRangeMap = new Map<string, { min: string; max: string }>();

  constructor(
    private readonly admin: AdminService,
    private readonly schedulesService: SchedulesService,
    private readonly biomed: BiomedService,
    private readonly calibration: CalibrationService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route?: ActivatedRoute
  ) {
    this.assetCategory = this.route?.snapshot.data['assetCategory'] === 'industrial'
      ? 'industrial'
      : 'biomedical';
    this.resetGeneratorDates();
  }

  get isIndustrialSchedule(): boolean {
    return this.assetCategory === 'industrial';
  }

  get scheduleModuleTitle(): string {
    return this.isIndustrialSchedule ? 'Cronogramas industriales' : 'Cronogramas';
  }

  get maintenanceSectionTitle(): string {
    return this.isIndustrialSchedule
      ? 'Cronogramas de mantenimiento industrial'
      : 'Cronogramas de mantenimiento';
  }

  async ngOnInit(): Promise<void> {
    try {
      const userClient = this.auth.currentUser()?.clientId ?? '';
      if (userClient) {
        this.selectedClientId = userClient;
      } else {
        const rows = await this.admin.listClients();
        this.clients = rows.map((row) => ({
          id: row.id,
          name: row.name,
          nit: row.nit,
          city: row.city,
          address: row.address,
          email: row.email
        }));
        this.selectedClientId = this.clients[0]?.id ?? '';
      }
      if (!this.selectedClientId) {
        this.setNotice('error', 'No hay un cliente disponible para consultar cronogramas.');
        return;
      }
      await Promise.all([this.loadAreas(), this.loadActiveView(false)]);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, 'No se pudo iniciar el módulo de cronogramas.'));
    } finally {
      this.refreshView();
    }
  }

  get selectedClient(): ClientOption | null {
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  get currentClientLabel(): string {
    return this.selectedClient?.name ?? (this.auth.currentUser()?.clientId ? 'Cliente asignado' : 'Sin cliente');
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.trim().toLowerCase();
    if (!term) return this.clients;
    return this.clients.filter((client) =>
      `${client.name} ${client.nit} ${client.city}`.toLowerCase().includes(term)
    );
  }

  get filteredAreas(): AreaOption[] {
    const term = this.areaSearch.trim().toLowerCase();
    if (!term) return this.areas;
    return this.areas.filter((area) => area.name.toLowerCase().includes(term));
  }

  async onClientChange(): Promise<void> {
    this.clearSelections();
    this.showGenerator = false;
    try {
      await Promise.all([this.loadAreas(), this.loadActiveView(false)]);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, 'No se pudieron cargar los cronogramas del cliente.'));
    }
  }

  async onYearChange(): Promise<void> {
    const year = Math.trunc(Number(this.selectedYear));
    this.selectedYear = Math.min(
      this.maximumYear,
      Math.max(this.minimumYear, year || new Date().getFullYear())
    );
    this.resetGeneratorDates();
    this.clearSelections();
    this.showGenerator = false;
    try {
      await this.loadActiveView(false);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, 'No se pudieron cargar los cronogramas del año.'));
    }
  }

  async switchView(mode: ViewMode): Promise<void> {
    if (this.isIndustrialSchedule && mode !== 'maintenance') return;
    if (mode === 'training' && !this.canManageMaintenanceSchedules()) return;
    if (mode === 'calibration' && !this.canAccessCalibrationModule()) return;
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.showGenerator = false;
    this.clearSelections();
    this.clearNotice();
    try {
      await this.loadActiveView(false);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, 'No se pudo cargar la vista seleccionada.'));
    }
  }

  async refreshActive(): Promise<void> {
    await this.runAction(
      'refresh',
      async () => this.loadActiveView(this.detailModalOpen),
      'Información actualizada.'
    );
  }

  private async loadActiveView(preserveSelection: boolean): Promise<void> {
    if (!this.selectedClientId) return;
    if (this.viewMode === 'training') {
      await this.loadTrainingSchedules(preserveSelection);
    } else if (this.viewMode === 'calibration') {
      await this.loadCalibrationSchedules(preserveSelection);
    } else {
      await this.loadSchedules(preserveSelection);
    }
    this.lastUpdatedLabel = new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date());
  }

  private async loadAreas(): Promise<void> {
    if (!this.selectedClientId) return;
    const rows = await this.biomed.listAreas(this.selectedClientId);
    this.areas = rows
      .map((row) => ({ id: row.id, name: row.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.selectedAreas = this.selectedAreas.filter((id) => this.areas.some((area) => area.id === id));
  }

  async loadSchedules(preserveSelection = true): Promise<void> {
    if (!this.selectedClientId) return;
    this.loading = true;
    try {
      const rows = await this.schedulesService.listSchedules(
        this.selectedClientId,
        this.selectedYear,
        this.assetCategory
      );
      this.schedules = rows;
      const previous = preserveSelection && this.detailModalOpen ? this.selectedScheduleId : '';
      this.selectedScheduleId = rows.some((row) => row.id === previous) ? previous : '';
      if (this.selectedScheduleId) {
        await this.loadItems(this.selectedScheduleId);
      } else {
        this.items = [];
        this.editing = false;
        this.detailModalOpen = false;
      }
    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  async selectSchedule(scheduleId: string): Promise<void> {
    this.showGenerator = false;
    this.detailModalOpen = true;
    if (this.selectedScheduleId === scheduleId && this.items.length) return;
    this.selectedScheduleId = scheduleId;
    this.items = [];
    try {
      await this.loadItems(scheduleId);
    } catch (error: any) {
      console.error(error);
      this.detailModalOpen = false;
      this.selectedScheduleId = '';
      this.setNotice('error', this.errorText(error, 'No se pudo cargar el detalle del cronograma.'));
    }
  }

  private async loadItems(scheduleId: string): Promise<void> {
    this.detailLoading = true;
    try {
      let rows = await this.schedulesService.listScheduleItems(scheduleId);
      rows = await this.syncUnprogrammedDraftFrequencies(scheduleId, rows);
      this.items = rows.map((item) => ({
        ...item,
        planned_date: this.dateOnly(item.planned_date),
        deadline_date: this.dateOnly(item.deadline_date)
      }));
      this.maintenanceDatesDialog = null;
      if (this.selectedSchedule) {
        this.selectedSchedule.total_items = this.items.length;
        this.selectedSchedule.programmed_items = this.items.filter(
          (item) => item.programming_confirmed
        ).length;
      }
      this.editing = false;
      this.rangeMap.clear();
      this.maintenanceSnapshot.clear();
      for (const item of this.items) {
        const min = this.computeRangeMin(item);
        const max = item.deadline_date;
        this.rangeMap.set(item.id, { min, max });
        this.maintenanceSnapshot.set(item.id, item.planned_date);
      }
      this.maintenanceProgrammingView =
        this.selectedSchedule?.status === 'draft'
          ? this.items.some((item) => !item.programming_confirmed)
            ? 'pending'
            : 'programmed'
          : 'all';
    } finally {
      this.detailLoading = false;
      this.refreshView();
    }
  }

  private async syncUnprogrammedDraftFrequencies(
    scheduleId: string,
    rows: ScheduleItemDto[]
  ): Promise<ScheduleItemDto[]> {
    if (this.selectedSchedule?.status !== 'draft' || !this.canManageMaintenanceSchedules()) {
      return rows;
    }

    const itemsByAsset = new Map<string, ScheduleItemDto[]>();
    for (const item of rows) {
      const grouped = itemsByAsset.get(item.asset_id) ?? [];
      grouped.push(item);
      itemsByAsset.set(item.asset_id, grouped);
    }

    const candidates: { assetId: string; frequency: string }[] = [];
    for (const [assetId, assetItems] of itemsByAsset) {
      const frequency = String(assetItems[0]?.asset_maintenance_frequency || '')
        .trim()
        .toLowerCase();
      const frequencyChanged = assetItems.some(
        (item) => String(item.frequency || '').trim().toLowerCase() !== frequency
      );
      const canSynchronize = assetItems.every(
        (item) =>
          item.status === 'pending' &&
          !item.programming_confirmed &&
          !item.report_id &&
          !item.completion_source &&
          !item.legacy_history_file_id
      );
      if (
        assetId &&
        this.maintenancePeriodOptions.includes(frequency) &&
        frequencyChanged &&
        canSynchronize
      ) {
        candidates.push({ assetId, frequency });
      }
    }
    if (!candidates.length) return rows;

    try {
      for (const candidate of candidates) {
        await this.schedulesService.rescheduleAsset(
          scheduleId,
          candidate.assetId,
          candidate.frequency
        );
      }
      this.setNotice(
        'success',
        candidates.length === 1
          ? 'Se sincronizó 1 equipo no guardado con su hoja de vida.'
          : `Se sincronizaron ${candidates.length} equipos no guardados con sus hojas de vida.`
      );
      return this.schedulesService.listScheduleItems(scheduleId);
    } catch (error: any) {
      console.error(error);
      this.setNotice(
        'error',
        this.errorText(error, 'No se pudo sincronizar la periodicidad del equipo no guardado.')
      );
      return rows;
    }
  }

  get selectedSchedule(): ScheduleDto | null {
    return this.schedules.find((schedule) => schedule.id === this.selectedScheduleId) ?? null;
  }

  get filteredSchedules(): ScheduleDto[] {
    return this.maintenanceStatusFilter
      ? this.schedules.filter((schedule) => schedule.status === this.maintenanceStatusFilter)
      : this.schedules;
  }

  get hasMaintenanceSchedule(): boolean {
    return this.schedules.length > 0;
  }

  async generateSchedule(): Promise<void> {
    if (!this.validGeneratorDate(this.startDate)) {
      this.setNotice('error', 'Selecciona una fecha inicial válida dentro del año del cronograma.');
      return;
    }
    await this.runAction(
      'generate-maintenance',
      async () => {
        const scheduleId = await this.schedulesService.generateSchedule(
          this.selectedClientId,
          this.selectedYear,
          this.startDate,
          this.assetCategory
        );
        await this.loadSchedules(false);
        this.showGenerator = false;
        await this.selectSchedule(scheduleId);
        this.maintenanceEditLevel = 'area';
        this.startMaintenanceEdit();
      },
      'Borrador generado. Ajusta las fechas y apruébalo cuando esté listo.'
    );
  }

  canManageMaintenanceSchedules(): boolean {
    return this.auth.hasPermission('schedules:manage');
  }

  canEditSchedule(schedule: ScheduleDto | null): boolean {
    if (!schedule || !this.canManageMaintenanceSchedules()) return false;
    if (schedule.status === 'draft') return true;
    return (
      schedule.status === 'approved' &&
      schedule.engineer_edit_enabled &&
      this.auth.hasRole('ingeniero_biomedico')
    );
  }

  canEditSelected(): boolean {
    return this.canEditSchedule(this.selectedSchedule);
  }

  canDeleteMaintenanceSchedule(schedule: ScheduleDto): boolean {
    return schedule.status === 'draft' && this.canManageMaintenanceSchedules();
  }

  canAuthorizeMaintenanceEdit(schedule: ScheduleDto | null): boolean {
    return Boolean(
      schedule &&
      schedule.status === 'approved' &&
      this.auth.hasRole('client_admin') &&
      this.auth.hasPermission('schedules:unlock_approved')
    );
  }

  maintenanceEditAccessLabel(schedule: ScheduleDto): string {
    if (schedule.status === 'draft') return 'Editable';
    if (schedule.status === 'approved' && schedule.engineer_edit_enabled) return 'Habilitada';
    if (schedule.status === 'approved') return 'Bloqueada';
    return 'Cerrada';
  }

  maintenanceEditAccessClass(schedule: ScheduleDto): string {
    if (schedule.status === 'draft') return 'edit-ready';
    if (schedule.status === 'approved' && schedule.engineer_edit_enabled) return 'edit-enabled';
    return 'edit-locked';
  }

  get maintenanceEditRestriction(): string {
    const schedule = this.selectedSchedule;
    if (!schedule || this.canEditSelected()) return '';
    if (schedule.status === 'closed') return 'El cronograma cerrado no admite modificaciones.';
    if (schedule.status === 'approved' && schedule.engineer_edit_enabled) {
      return 'La edición está habilitada exclusivamente para el ingeniero biomédico.';
    }
    if (schedule.status === 'approved' && this.canAuthorizeMaintenanceEdit(schedule)) {
      return 'Puedes habilitar una edición controlada para el ingeniero biomédico.';
    }
    if (schedule.status === 'approved') {
      return 'El administrador del cliente debe habilitar una edición para modificar las fechas.';
    }
    return 'No tienes permiso para modificar este cronograma.';
  }

  async openMaintenanceEdit(schedule: ScheduleDto): Promise<void> {
    if (!this.canEditSchedule(schedule)) return;
    await this.selectSchedule(schedule.id);
    if (this.selectedScheduleId === schedule.id && this.canEditSelected()) {
      this.maintenanceEditLevel = 'area';
      this.startMaintenanceEdit();
    }
  }

  startMaintenanceEdit(): void {
    if (!this.canEditSelected()) return;
    this.maintenanceSnapshot = new Map(this.items.map((item) => [item.id, item.planned_date]));
    if (this.selectedSchedule?.status === 'draft') {
      this.maintenanceProgrammingView = this.maintenanceUnprogrammedCount ? 'pending' : 'programmed';
    }
    this.editing = true;
  }

  cancelMaintenanceEdit(): void {
    if (this.maintenanceDatesDialog) this.closeMaintenanceDates();
    this.closeDatePicker();
    for (const item of this.items) {
      item.planned_date = this.maintenanceSnapshot.get(item.id) ?? item.planned_date;
    }
    this.editing = false;
  }

  hasMaintenanceChanges(): boolean {
    return this.items.some(
      (item) => item.planned_date !== (this.maintenanceSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  get maintenanceProgrammedCount(): number {
    return this.items.filter((item) => item.programming_confirmed).length;
  }

  get maintenanceUnprogrammedCount(): number {
    return this.items.length - this.maintenanceProgrammedCount;
  }

  get maintenanceProgrammingPercent(): number {
    return this.programmingPercent(this.maintenanceProgrammedCount, this.items.length);
  }

  canApproveMaintenanceDraft(): boolean {
    return Boolean(
      this.selectedSchedule?.status === 'draft' &&
      this.maintenanceUnprogrammedCount === 0 &&
      !this.hasMaintenanceChanges()
    );
  }

  maintenanceDateGroupEditable(dateGroup: MaintenanceAreaDateGroup): boolean {
    return dateGroup.items.every(
      (item) =>
        item.status === 'pending' &&
        !item.report_id &&
        !item.completion_source &&
        !item.legacy_history_file_id
    );
  }

  maintenanceSectionHasChanges(group: MaintenanceItemGroup): boolean {
    return group.items.some(
      (item) => item.planned_date !== (this.maintenanceSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  maintenanceSectionNeedsSave(group: MaintenanceItemGroup): boolean {
    if (this.selectedSchedule?.status === 'approved') {
      return this.maintenanceSectionHasChanges(group);
    }
    return (
      group.items.some((item) => !item.programming_confirmed) ||
      this.maintenanceSectionHasChanges(group)
    );
  }

  async saveMaintenanceSection(group: MaintenanceItemGroup): Promise<void> {
    if (!this.selectedScheduleId || !this.editing) return;
    const approvedEdit = this.selectedSchedule?.status === 'approved';
    const sectionItems = approvedEdit
      ? group.items.filter(
          (item) => item.planned_date !== (this.maintenanceSnapshot.get(item.id) ?? item.planned_date)
        )
      : group.items;
    if (!sectionItems.length) {
      this.setNotice('info', 'No hay cambios en esta sección para guardar.');
      return;
    }
    await this.runAction(
      `save-maintenance-${group.areaKey}`,
      async () => {
        await this.schedulesService.updateScheduleItems(
          this.selectedScheduleId,
          sectionItems.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        if (approvedEdit) {
          await this.loadSchedules(true);
          return;
        }
        const programmedAt = new Date().toISOString();
        for (const item of sectionItems) {
          item.programming_confirmed = true;
          item.programmed_at = programmedAt;
          this.maintenanceSnapshot.set(item.id, item.planned_date);
        }
        if (this.selectedSchedule) {
          this.selectedSchedule.programmed_items = this.maintenanceProgrammedCount;
          this.selectedSchedule.total_items = this.items.length;
        }
      },
      approvedEdit
        ? 'Fechas actualizadas. La autorización fue utilizada y el cronograma volvió a quedar bloqueado.'
        : `Programación por ${this.maintenanceSectionLabel().toLowerCase()} guardada. El avance quedó registrado.`
    );
  }

  requestMaintenanceEditAccess(schedule: ScheduleDto | null, enabled: boolean): void {
    if (!schedule) return;
    if (!this.canAuthorizeMaintenanceEdit(schedule)) return;
    this.openConfirm(
      enabled ? 'Habilitar edición del cronograma' : 'Revocar edición del cronograma',
      enabled
        ? `El ingeniero biomédico podrá realizar una modificación de fechas en el cronograma ${schedule.year}. La autorización se consumirá al guardar.`
        : `Se retirará la autorización de edición del cronograma ${schedule.year}.`,
      enabled ? 'Habilitar edición' : 'Revocar edición',
      false,
      async () => {
        await this.schedulesService.setEngineerEditAccess(schedule.id, enabled);
        await this.loadSchedules(this.detailModalOpen);
        this.setNotice(
          'success',
          enabled
            ? 'Edición habilitada para el ingeniero biomédico.'
            : 'Autorización de edición revocada.'
        );
      }
    );
  }

  requestApproveSchedule(schedule: ScheduleDto): void {
    const unprogrammed = this.maintenanceScheduleUnprogrammed(schedule);
    if (schedule.status === 'draft' && unprogrammed) {
      this.setNotice(
        'info',
        unprogrammed === 1
          ? 'Falta 1 mantenimiento por revisar y guardar.'
          : `Faltan ${unprogrammed} mantenimientos por revisar y guardar.`
      );
      return;
    }
    this.openConfirm(
      'Aprobar cronograma de mantenimiento',
      `Se aprobará el cronograma ${schedule.year} y sus mantenimientos podrán generar solicitudes operativas.`,
      'Aprobar cronograma',
      false,
      async () => {
        this.selectedScheduleId = schedule.id;
        await this.schedulesService.approveSchedule(schedule.id);
        await this.loadSchedules(true);
        this.setNotice('success', 'Cronograma de mantenimiento aprobado.');
      }
    );
  }

  requestDeleteSchedule(schedule: ScheduleDto): void {
    this.openConfirm(
      'Eliminar cronograma de mantenimiento',
      `Se eliminará definitivamente el cronograma ${schedule.year}.`,
      'Eliminar cronograma',
      true,
      async () => {
        await this.schedulesService.deleteSchedule(schedule.id);
        await this.loadSchedules(false);
        this.setNotice('success', 'Cronograma de mantenimiento eliminado.');
      }
    );
  }

  async openPdf(scheduleId: string): Promise<void> {
    await this.openPdfAction(
      `maintenance-pdf-${scheduleId}`,
      () => this.schedulesService.downloadSchedulePdf(scheduleId),
      'No se pudo abrir el PDF del cronograma.'
    );
  }

  get maintenanceSummary(): Record<'pending' | 'active' | 'done' | 'expired' | 'warranty' | 'not_performed', number> {
    return this.countStatuses(this.items, (item) => this.maintenanceItemStatusKey(item)) as Record<
      'pending' | 'active' | 'done' | 'expired' | 'warranty' | 'not_performed',
      number
    >;
  }

  get maintenanceAreaOptions(): string[] {
    return this.uniqueSorted(this.items.map((item) => item.area_name || '').filter(Boolean));
  }

  get maintenanceFrequencyOptions(): string[] {
    return this.uniqueSorted(this.items.map((item) => item.frequency).filter(Boolean));
  }

  get maintenanceLocationOptions(): string[] {
    if (!this.maintenanceAreaFilter) return [];
    return this.uniqueSorted(
      this.items
        .filter((item) => item.area_name === this.maintenanceAreaFilter)
        .map((item) => item.location_name || '')
        .filter(Boolean)
    );
  }

  onMaintenanceAreaFilterChange(areaName: string): void {
    this.maintenanceAreaFilter = areaName;
    this.maintenanceLocationFilter = '';
  }

  get filteredMaintenanceItems(): ScheduleItemDto[] {
    const term = this.maintenanceDetailSearch.trim().toLowerCase();
    return this.items.filter((item) => {
      if (
        this.selectedSchedule?.status === 'draft' &&
        !this.matchesProgrammingView(item.programming_confirmed, this.maintenanceProgrammingView)
      ) {
        return false;
      }
      if (this.maintenanceAreaFilter && item.area_name !== this.maintenanceAreaFilter) return false;
      if (this.maintenanceLocationFilter && item.location_name !== this.maintenanceLocationFilter) return false;
      if (this.maintenanceFrequencyFilter && item.frequency !== this.maintenanceFrequencyFilter) return false;
      if (
        this.maintenanceItemStatusFilter
        && this.maintenanceItemStatusKey(item) !== this.maintenanceItemStatusFilter
      ) return false;
      if (!term) return true;
      return `${item.code ?? ''} ${item.name ?? ''} ${item.brand ?? ''} ${item.model ?? ''} ${item.serial ?? ''} ${item.site_name ?? ''} ${item.area_name ?? ''} ${item.location_name ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }

  get maintenanceHasActiveDetailFilter(): boolean {
    return Boolean(
      this.maintenanceDetailSearch.trim() ||
      this.maintenanceAreaFilter ||
      this.maintenanceLocationFilter ||
      this.maintenanceFrequencyFilter ||
      this.maintenanceItemStatusFilter
    );
  }

  setMaintenanceEditLevel(level: AssetEditLevel): void {
    this.maintenanceEditLevel = level;
  }

  get filteredGroupedItems(): MaintenanceItemGroup[] {
    const groupByLocation = this.editing && this.maintenanceEditLevel === 'location';
    const groupByEquipment = this.editing && this.maintenanceEditLevel === 'equipment';
    const map = new Map<
      string,
      Omit<MaintenanceItemGroup, 'assetCount' | 'frequencies' | 'dateGroups'>
    >();
    for (const item of this.filteredMaintenanceItems) {
      const areaName = item.area_name || 'Sin área';
      const siteName = item.site_name || 'Sin sede';
      const locationName = item.location_name || 'Sin ubicación';
      const areaKey = `${item.site_id || 'no-site'}:${item.area_id || areaName.toLowerCase()}`;
      const key = groupByEquipment
        ? `equipment:${item.asset_id}`
        : groupByLocation
          ? `${areaKey}:${item.location_id || locationName.toLowerCase()}`
          : areaKey;
      if (!map.has(key)) {
        map.set(key, {
          areaKey: key,
          assetId: item.asset_id,
          areaName,
          siteName,
          locationName: groupByLocation || groupByEquipment ? locationName : 'Todas las ubicaciones',
          code: item.code || '-',
          name: item.name || '-',
          brand: item.brand || 'Sin marca',
          model: item.model || 'Sin modelo',
          serial: item.serial || 'NR',
          items: []
        });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        assetCount: new Set(group.items.map((item) => item.asset_id)).size,
        frequencies: this.uniqueSorted(group.items.map((item) => item.frequency).filter(Boolean)),
        dateGroups: this.buildAreaDateGroups(group.items)
      }))
      .sort((a, b) =>
        `${groupByEquipment ? `${a.code} ${a.name}` : `${a.siteName} ${a.areaName} ${a.locationName}`}`.localeCompare(
          groupByEquipment ? `${b.code} ${b.name}` : `${b.siteName} ${b.areaName} ${b.locationName}`
        )
      );
  }

  maintenanceSectionLabel(): string {
    if (this.maintenanceEditLevel === 'equipment') return 'Equipo';
    if (this.maintenanceEditLevel === 'location') return 'Ubicación';
    return 'Área';
  }

  sectionProgrammingConfirmed(items: { programming_confirmed: boolean }[]): boolean {
    return Boolean(items.length) && items.every((item) => item.programming_confirmed);
  }

  maintenanceGroupSupportsReschedule(group: MaintenanceItemGroup): boolean {
    return Boolean(
      this.selectedSchedule?.status === 'draft' &&
      this.editing &&
      group.assetCount === 1 &&
      (this.maintenanceEditLevel === 'equipment' || this.maintenanceHasActiveDetailFilter)
    );
  }

  maintenanceGroupCanReschedule(group: MaintenanceItemGroup): boolean {
    return Boolean(
      this.maintenanceGroupSupportsReschedule(group) &&
      group.items.length &&
      group.items.every(
        (item) =>
          item.status === 'pending' &&
          !item.report_id &&
          !item.completion_source &&
          !item.legacy_history_file_id
      )
    );
  }

  maintenanceGroupSupportsDateEdit(group: MaintenanceItemGroup): boolean {
    return Boolean(
      this.selectedSchedule &&
      this.editing &&
      group.assetCount === 1 &&
      group.dateGroups.some((dateGroup) => this.maintenanceDateGroupEditable(dateGroup))
    );
  }

  get maintenanceFilteredDateAssetGroup(): MaintenanceItemGroup | null {
    if (!this.maintenanceHasActiveDetailFilter || !this.editing) return null;
    const assetIds = new Set(this.filteredMaintenanceItems.map((item) => item.asset_id));
    if (assetIds.size !== 1) return null;
    const group = this.buildMaintenanceAssetGroup(Array.from(assetIds)[0]);
    return group && this.maintenanceGroupSupportsDateEdit(group) ? group : null;
  }

  get maintenanceFilteredAssetGroup(): MaintenanceItemGroup | null {
    const group = this.maintenanceFilteredDateAssetGroup;
    return group && this.maintenanceGroupCanReschedule(group) ? group : null;
  }

  openMaintenanceDates(group: MaintenanceItemGroup): void {
    const assetGroup = this.buildMaintenanceAssetGroup(group.assetId);
    if (!assetGroup || !this.maintenanceGroupSupportsDateEdit(assetGroup)) return;
    this.closeDatePicker();
    this.maintenanceRescheduleDialog = null;
    this.maintenanceDatesDialog = {
      assetId: assetGroup.assetId,
      code: assetGroup.code,
      name: assetGroup.name,
      frequency: assetGroup.frequencies[0] || 'anual',
      dateGroups: assetGroup.dateGroups,
      originalDates: Object.fromEntries(
        assetGroup.items.map((item) => [item.id, item.planned_date])
      )
    };
  }

  maintenanceDatesHaveChanges(dialog = this.maintenanceDatesDialog): boolean {
    if (!dialog) return false;
    return dialog.dateGroups.some((dateGroup) =>
      dateGroup.items.some(
        (item) => item.planned_date !== (dialog.originalDates[item.id] ?? item.planned_date)
      )
    );
  }

  closeMaintenanceDates(): void {
    const dialog = this.maintenanceDatesDialog;
    if (!dialog || this.isBusy()) return;
    this.closeDatePicker();
    for (const dateGroup of dialog.dateGroups) {
      for (const item of dateGroup.items) {
        item.planned_date = dialog.originalDates[item.id] ?? item.planned_date;
      }
    }
    this.maintenanceDatesDialog = null;
  }

  async applyMaintenanceDates(): Promise<void> {
    const dialog = this.maintenanceDatesDialog;
    if (!dialog || !this.selectedScheduleId || !this.maintenanceDatesHaveChanges(dialog)) return;
    const approvedEdit = this.selectedSchedule?.status === 'approved';
    const items = dialog.dateGroups.flatMap((dateGroup) => dateGroup.items);
    const uniqueItems = Array.from(new Map(items.map((item) => [item.id, item])).values());
    const itemsToPersist = approvedEdit
      ? uniqueItems.filter(
          (item) => item.planned_date !== (dialog.originalDates[item.id] ?? item.planned_date)
        )
      : uniqueItems;

    await this.runAction(
      `save-maintenance-dates-${dialog.assetId}`,
      async () => {
        await this.schedulesService.updateScheduleItems(
          this.selectedScheduleId,
          itemsToPersist.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        this.maintenanceDatesDialog = null;
        if (approvedEdit) {
          await this.loadSchedules(true);
          return;
        }
        const programmedAt = new Date().toISOString();
        for (const item of uniqueItems) {
          item.programming_confirmed = true;
          item.programmed_at = programmedAt;
          this.maintenanceSnapshot.set(item.id, item.planned_date);
        }
        if (this.selectedSchedule) {
          this.selectedSchedule.programmed_items = this.maintenanceProgrammedCount;
          this.selectedSchedule.total_items = this.items.length;
        }
      },
      approvedEdit
        ? 'Fechas actualizadas sin cambiar la periodicidad. La autorización quedó utilizada.'
        : 'Fechas del equipo actualizadas sin cambiar la periodicidad.'
    );
  }

  openMaintenanceReschedule(group: MaintenanceItemGroup): void {
    if (!this.maintenanceGroupCanReschedule(group)) return;
    if (this.maintenanceDatesDialog) this.closeMaintenanceDates();
    const currentFrequency = group.frequencies[0] || 'anual';
    this.maintenanceRescheduleDialog = {
      assetId: group.assetId,
      code: group.code,
      name: group.name,
      currentFrequency,
      frequency: currentFrequency
    };
  }

  closeMaintenanceReschedule(): void {
    if (!this.isBusy()) {
      this.maintenanceRescheduleDialog = null;
    }
  }

  async applyMaintenanceReschedule(): Promise<void> {
    const dialog = this.maintenanceRescheduleDialog;
    if (!dialog || !this.selectedScheduleId) return;
    if (!this.maintenancePeriodOptions.includes(dialog.frequency)) {
      this.setNotice('error', 'Selecciona una periodicidad válida.');
      return;
    }
    await this.runAction(
      `reschedule-maintenance-${dialog.assetId}`,
      async () => {
        await this.schedulesService.rescheduleAsset(
          this.selectedScheduleId,
          dialog.assetId,
          dialog.frequency
        );
        this.maintenanceRescheduleDialog = null;
        await this.loadSchedules(true);
        if (this.selectedSchedule) {
          this.maintenanceEditLevel = 'equipment';
          this.startMaintenanceEdit();
          this.maintenanceProgrammingView = 'pending';
        }
      },
      'Equipo reprogramado. La hoja de vida quedó actualizada y sus fechas volvieron a pendientes.'
    );
  }

  private buildAreaDateGroups(items: ScheduleItemDto[]): MaintenanceAreaDateGroup[] {
    const map = new Map<string, MaintenanceAreaDateGroup>();
    for (const item of items) {
      const minDate = this.rangeMin(item);
      const maxDate = this.rangeMax(item);
      const key = `${item.planned_date}:${maxDate}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          plannedDate: item.planned_date,
          minDate,
          maxDate,
          items: []
        });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values()).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  }

  private buildMaintenanceAssetGroup(assetId: string): MaintenanceItemGroup | null {
    const items = this.items.filter((item) => item.asset_id === assetId);
    const first = items[0];
    if (!first) return null;
    return {
      areaKey: `equipment:${assetId}`,
      assetId,
      areaName: first.area_name || 'Sin área',
      siteName: first.site_name || 'Sin sede',
      locationName: first.location_name || 'Sin ubicación',
      code: first.code || '-',
      name: first.name || '-',
      brand: first.brand || 'Sin marca',
      model: first.model || 'Sin modelo',
      serial: first.serial || 'NR',
      assetCount: 1,
      frequencies: this.uniqueSorted(items.map((item) => item.frequency).filter(Boolean)),
      items,
      dateGroups: this.buildAreaDateGroups(items)
    };
  }

  areaStatusItems(group: MaintenanceItemGroup): { status: string; count: number }[] {
    const counts = this.countStatuses(group.items, (item) => this.maintenanceItemStatusKey(item));
    return ['active', 'expired', 'warranty', 'not_performed', 'pending', 'done']
      .filter((status) => counts[status] > 0)
      .map((status) => ({ status, count: counts[status] }));
  }

  onAreaPlannedDateChange(dateGroup: MaintenanceAreaDateGroup, value: string): void {
    const normalized = this.normalizeEditableDate(value, dateGroup.minDate, dateGroup.maxDate);
    for (const item of dateGroup.items) item.planned_date = normalized;
    dateGroup.plannedDate = normalized;
  }

  onMaintenanceItemDateChange(item: ScheduleItemDto, value: string): void {
    item.planned_date = this.normalizeEditableDate(value, this.rangeMin(item), this.rangeMax(item));
  }

  maintenanceItemEditable(item: ScheduleItemDto): boolean {
    return this.selectedSchedule?.status !== 'approved' || item.status === 'pending';
  }

  rangeMin(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.min ?? this.computeRangeMin(item);
  }

  rangeMax(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.max ?? item.deadline_date;
  }

  private computeRangeMin(item: ScheduleItemDto): string {
    const anchor = item.deadline_date || item.planned_date;
    return anchor ? `${anchor.slice(0, 7)}-01` : item.planned_date;
  }

  openMaintenanceDatePicker(group: MaintenanceAreaDateGroup): void {
    this.calendarPicker = { kind: 'maintenance', group };
  }

  openCalibrationDatePicker(group: CalibrationDateGroup): void {
    this.calendarPicker = { kind: 'calibration', group };
  }

  closeDatePicker(): void {
    this.calendarPicker = null;
  }

  get calendarPickerMonthLabel(): string {
    const anchor = this.calendarPicker?.group.minDate;
    if (!anchor) return '';
    const [year, month] = anchor.split('-').map(Number);
    if (!year || !month) return '';
    const label = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get calendarPickerDays(): Array<CalendarPickerDay | null> {
    const picker = this.calendarPicker;
    if (!picker) return [];
    const [year, month] = picker.group.minDate.split('-').map(Number);
    if (!year || !month) return [];

    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const days: Array<CalendarPickerDay | null> = Array.from(
      { length: firstWeekday },
      () => null
    );

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      days.push({
        date,
        day,
        disabled:
          date < picker.group.minDate || date > picker.group.maxDate || weekday === 0 || weekday === 6,
        selected: date === picker.group.plannedDate,
        today: date === todayKey
      });
    }
    while (days.length < 42) days.push(null);
    return days;
  }

  selectCalendarDate(date: string): void {
    const picker = this.calendarPicker;
    if (!picker || date < picker.group.minDate || date > picker.group.maxDate) return;
    if (picker.kind === 'maintenance') {
      this.onAreaPlannedDateChange(picker.group, date);
    } else {
      this.onCalibrationDateGroupChange(picker.group, date);
    }
    this.closeDatePicker();
  }

  async loadTrainingSchedules(preserveSelection = true): Promise<void> {
    if (!this.selectedClientId) return;
    this.loading = true;
    try {
      this.trainingSchedules = await this.schedulesService.listTrainingSchedules(
        this.selectedClientId,
        this.selectedYear
      );
      const previous = preserveSelection && this.detailModalOpen ? this.selectedTrainingScheduleId : '';
      this.selectedTrainingScheduleId = this.trainingSchedules.some((row) => row.id === previous)
        ? previous
        : '';
      if (this.selectedTrainingScheduleId) {
        await this.loadTrainingItems(this.selectedTrainingScheduleId);
      } else {
        this.trainingItems = [];
        this.trainingEditing = false;
        this.detailModalOpen = false;
      }
    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  async selectTrainingSchedule(scheduleId: string): Promise<void> {
    this.showGenerator = false;
    this.detailModalOpen = true;
    if (this.selectedTrainingScheduleId === scheduleId && this.trainingItems.length) return;
    this.selectedTrainingScheduleId = scheduleId;
    this.trainingItems = [];
    try {
      await this.loadTrainingItems(scheduleId);
    } catch (error: any) {
      console.error(error);
      this.detailModalOpen = false;
      this.selectedTrainingScheduleId = '';
      this.setNotice('error', this.errorText(error, 'No se pudo cargar el detalle de capacitaciones.'));
    }
  }

  private async loadTrainingItems(scheduleId: string): Promise<void> {
    this.detailLoading = true;
    try {
      const rows = await this.schedulesService.listTrainingItems(scheduleId);
      this.trainingItems = rows.map((item) => ({ ...item, planned_date: this.dateOnly(item.planned_date) }));
      this.trainingSnapshot = new Map(this.trainingItems.map((item) => [item.id, item.planned_date]));
      this.trainingProgrammingView =
        this.selectedTrainingSchedule?.status === 'draft'
          ? this.trainingItems.some((item) => !item.programming_confirmed)
            ? 'pending'
            : 'programmed'
          : 'all';
      this.trainingEditing = false;
    } finally {
      this.detailLoading = false;
      this.refreshView();
    }
  }

  get selectedTrainingSchedule(): TrainingScheduleDto | null {
    return this.trainingSchedules.find((schedule) => schedule.id === this.selectedTrainingScheduleId) ?? null;
  }

  get filteredTrainingSchedules(): TrainingScheduleDto[] {
    return this.trainingStatusFilter
      ? this.trainingSchedules.filter((schedule) => schedule.status === this.trainingStatusFilter)
      : this.trainingSchedules;
  }

  get hasTrainingSchedule(): boolean {
    return this.trainingSchedules.length > 0;
  }

  get filteredTrainingItems(): TrainingItemDto[] {
    const term = this.trainingSearch.trim().toLowerCase();
    return this.trainingItems.filter((item) => {
      if (
        this.selectedTrainingSchedule?.status === 'draft' &&
        !this.matchesProgrammingView(item.programming_confirmed, this.trainingProgrammingView)
      ) {
        return false;
      }
      const status = this.trainingItemStatusKey(item);
      if (this.trainingItemStatusFilter && status !== this.trainingItemStatusFilter) return false;
      if (!term) return true;
      return `${item.area_name ?? ''} ${this.formatDate(item.planned_date)}`.toLowerCase().includes(term);
    });
  }

  get filteredTrainingGroups(): TrainingItemGroup[] {
    const groups = new Map<string, TrainingItemGroup>();
    for (const item of this.filteredTrainingItems) {
      const areaKey = item.area_id || (item.area_name || 'Sin área').toLowerCase();
      if (!groups.has(areaKey)) {
        groups.set(areaKey, {
          areaKey,
          areaName: item.area_name || 'Sin área',
          items: []
        });
      }
      groups.get(areaKey)!.items.push(item);
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => a.planned_date.localeCompare(b.planned_date))
      }))
      .sort((a, b) => a.areaName.localeCompare(b.areaName));
  }

  get trainingSummary(): Record<'pending' | 'active' | 'done' | 'expired', number> {
    return this.countStatuses(this.trainingItems, (item) => this.trainingItemStatusKey(item)) as Record<
      'pending' | 'active' | 'done' | 'expired',
      number
    >;
  }

  async generateTrainingSchedule(): Promise<void> {
    if (!this.validGeneratorDate(this.trainingStartDate)) {
      this.setNotice('error', 'Selecciona una fecha inicial válida dentro del año del cronograma.');
      return;
    }
    if (!this.selectedAreas.length) {
      this.setNotice('error', 'Selecciona al menos un área para el cronograma de capacitaciones.');
      return;
    }
    await this.runAction(
      'generate-training',
      async () => {
        const scheduleId = await this.schedulesService.generateTrainingSchedule(this.selectedClientId, {
          year: this.selectedYear,
          startDate: this.trainingStartDate,
          periodicity: this.trainingPeriodicity,
          areaIds: this.selectedAreas
        });
        await this.loadTrainingSchedules(false);
        this.showGenerator = false;
        await this.selectTrainingSchedule(scheduleId);
        this.startTrainingEdit();
      },
      'Borrador generado. Ajusta las fechas y apruébalo cuando esté listo.'
    );
  }

  canEditTraining(schedule: TrainingScheduleDto | null = this.selectedTrainingSchedule): boolean {
    if (!schedule) return false;
    return Boolean(
      this.auth.currentUser()?.clientId &&
      this.auth.hasPermission('schedules:manage') &&
      schedule.status === 'draft'
    );
  }

  async openTrainingEdit(schedule: TrainingScheduleDto): Promise<void> {
    if (!this.canEditTraining(schedule)) return;
    await this.selectTrainingSchedule(schedule.id);
    if (this.selectedTrainingScheduleId === schedule.id) this.startTrainingEdit();
  }

  startTrainingEdit(): void {
    if (!this.canEditTraining()) return;
    this.trainingSnapshot = new Map(this.trainingItems.map((item) => [item.id, item.planned_date]));
    this.trainingProgrammingView = this.trainingUnprogrammedCount ? 'pending' : 'programmed';
    this.trainingEditing = true;
  }

  cancelTrainingEdit(): void {
    for (const item of this.trainingItems) {
      item.planned_date = this.trainingSnapshot.get(item.id) ?? item.planned_date;
    }
    this.trainingEditing = false;
  }

  hasTrainingChanges(): boolean {
    return this.trainingItems.some(
      (item) => item.planned_date !== (this.trainingSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  get trainingProgrammedCount(): number {
    return this.trainingItems.filter((item) => item.programming_confirmed).length;
  }

  get trainingUnprogrammedCount(): number {
    return this.trainingItems.length - this.trainingProgrammedCount;
  }

  get trainingProgrammingPercent(): number {
    return this.programmingPercent(this.trainingProgrammedCount, this.trainingItems.length);
  }

  canApproveTrainingDraft(): boolean {
    return Boolean(
      this.selectedTrainingSchedule?.status === 'draft' &&
      this.trainingUnprogrammedCount === 0 &&
      !this.hasTrainingChanges()
    );
  }

  trainingSectionHasChanges(group: TrainingItemGroup): boolean {
    return group.items.some(
      (item) => item.planned_date !== (this.trainingSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  trainingSectionNeedsSave(group: TrainingItemGroup): boolean {
    return (
      group.items.some((item) => !item.programming_confirmed) ||
      this.trainingSectionHasChanges(group)
    );
  }

  onTrainingDateChange(item: TrainingItemDto, value: string): void {
    item.planned_date = this.normalizeEditableDate(
      value,
      `${this.selectedYear}-01-01`,
      `${this.selectedYear}-12-31`
    );
  }

  async saveTrainingSection(group: TrainingItemGroup): Promise<void> {
    if (!this.selectedTrainingScheduleId || !this.trainingEditing) return;
    await this.runAction(
      `save-training-${group.areaKey}`,
      async () => {
        await this.schedulesService.updateTrainingItems(
          this.selectedTrainingScheduleId,
          group.items.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        const programmedAt = new Date().toISOString();
        for (const item of group.items) {
          item.programming_confirmed = true;
          item.programmed_at = programmedAt;
          this.trainingSnapshot.set(item.id, item.planned_date);
        }
        if (this.selectedTrainingSchedule) {
          this.selectedTrainingSchedule.programmed_items = this.trainingProgrammedCount;
          this.selectedTrainingSchedule.total_items = this.trainingItems.length;
        }
      },
      'Área de capacitación guardada. El avance quedó registrado.'
    );
  }

  requestApproveTraining(schedule: TrainingScheduleDto): void {
    const unprogrammed = this.trainingScheduleUnprogrammed(schedule);
    if (unprogrammed) {
      this.setNotice(
        'info',
        unprogrammed === 1
          ? 'Falta 1 capacitación por revisar y guardar.'
          : `Faltan ${unprogrammed} capacitaciones por revisar y guardar.`
      );
      return;
    }
    this.openConfirm(
      'Aprobar cronograma de capacitaciones',
      `Se aprobarán las capacitaciones programadas para ${schedule.year}.`,
      'Aprobar cronograma',
      false,
      async () => {
        this.selectedTrainingScheduleId = schedule.id;
        await this.schedulesService.approveTrainingSchedule(schedule.id);
        await this.loadTrainingSchedules(true);
        this.setNotice('success', 'Cronograma de capacitaciones aprobado.');
      }
    );
  }

  requestDeleteTrainingSchedule(schedule: TrainingScheduleDto): void {
    this.openConfirm(
      'Eliminar cronograma de capacitaciones',
      `Se eliminará definitivamente el cronograma ${schedule.year}.`,
      'Eliminar cronograma',
      true,
      async () => {
        await this.schedulesService.deleteTrainingSchedule(schedule.id);
        await this.loadTrainingSchedules(false);
        this.setNotice('success', 'Cronograma de capacitaciones eliminado.');
      }
    );
  }

  async openTrainingSchedulePdf(scheduleId: string): Promise<void> {
    await this.openPdfAction(
      `training-schedule-pdf-${scheduleId}`,
      () => this.schedulesService.downloadTrainingSchedulePdf(scheduleId),
      'No se pudo abrir el PDF del cronograma de capacitaciones.'
    );
  }

  async uploadTrainingPdf(item: TrainingItemDto, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.validatePdf(file)) {
      input.value = '';
      return;
    }
    await this.runAction(
      `training-upload-${item.id}`,
      async () => {
        await this.schedulesService.uploadTrainingPdf(item.id, file);
        await this.loadTrainingSchedules(true);
      },
      'Acta de capacitación cargada correctamente.'
    );
    input.value = '';
  }

  async openTrainingPdf(item: TrainingItemDto): Promise<void> {
    if (!item.pdf_path) return;
    await this.openPdfAction(
      `training-pdf-${item.id}`,
      () => this.schedulesService.downloadTrainingPdf(item.id),
      'No se pudo abrir el acta de capacitación.'
    );
  }

  requestDeleteTrainingPdf(item: TrainingItemDto): void {
    this.openConfirm(
      'Eliminar acta de capacitación',
      `Se eliminará el acta de ${item.area_name || 'la capacitación seleccionada'}.`,
      'Eliminar acta',
      true,
      async () => {
        await this.schedulesService.deleteTrainingPdf(item.id);
        await this.loadTrainingSchedules(true);
        this.setNotice('success', 'Acta de capacitación eliminada.');
      }
    );
  }

  canUploadTrainingPdf(item: TrainingItemDto): boolean {
    return (
      this.auth.hasPermission('schedules:manage') &&
      this.selectedTrainingSchedule?.status === 'approved' &&
      this.trainingItemStatusKey(item) === 'active' &&
      !item.pdf_path
    );
  }

  toggleAreaSelection(areaId: string, checked: boolean): void {
    this.selectedAreas = checked
      ? Array.from(new Set([...this.selectedAreas, areaId]))
      : this.selectedAreas.filter((id) => id !== areaId);
  }

  selectVisibleAreas(): void {
    this.selectedAreas = Array.from(
      new Set([...this.selectedAreas, ...this.filteredAreas.map((area) => area.id)])
    );
  }

  clearAreaSelection(): void {
    this.selectedAreas = [];
  }

  async loadCalibrationSchedules(preserveSelection = true): Promise<void> {
    if (!this.selectedClientId || !this.canAccessCalibrationModule()) return;
    this.loading = true;
    try {
      this.calibrationSchedules = await this.calibration.listSchedules(
        this.selectedClientId,
        this.selectedYear
      );
      const previous = preserveSelection && this.detailModalOpen ? this.selectedCalibrationScheduleId : '';
      this.selectedCalibrationScheduleId = this.calibrationSchedules.some((row) => row.id === previous)
        ? previous
        : '';
      if (this.selectedCalibrationScheduleId) {
        await this.loadCalibrationItems(this.selectedCalibrationScheduleId);
      } else {
        this.calibrationItems = [];
        this.calibrationEditing = false;
        this.detailModalOpen = false;
      }
    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  async selectCalibrationSchedule(scheduleId: string): Promise<void> {
    this.showGenerator = false;
    this.detailModalOpen = true;
    if (this.selectedCalibrationScheduleId === scheduleId && this.calibrationItems.length) return;
    this.selectedCalibrationScheduleId = scheduleId;
    this.calibrationItems = [];
    try {
      await this.loadCalibrationItems(scheduleId);
    } catch (error: any) {
      console.error(error);
      this.detailModalOpen = false;
      this.selectedCalibrationScheduleId = '';
      this.setNotice('error', this.errorText(error, 'No se pudo cargar el detalle de calibraciones.'));
    }
  }

  private async loadCalibrationItems(scheduleId: string): Promise<void> {
    this.detailLoading = true;
    try {
      const rows = await this.calibration.listItems(scheduleId);
      this.calibrationItems = rows.map((item) => ({
        ...item,
        planned_date: this.dateOnly(item.planned_date),
        deadline_date: this.dateOnly(item.deadline_date)
      }));
      this.calibrationEditing = false;
      this.calibrationSnapshot = new Map(
        this.calibrationItems.map((item) => [item.id, item.planned_date])
      );
      this.calibrationRangeMap.clear();
      for (const item of this.calibrationItems) {
        this.calibrationRangeMap.set(item.id, {
          min: this.shiftMonths(item.deadline_date, -1),
          max: item.deadline_date
        });
      }
      this.calibrationProgrammingView =
        this.selectedCalibrationSchedule?.status === 'draft'
          ? this.calibrationItems.some((item) => !item.programming_confirmed)
            ? 'pending'
            : 'programmed'
          : 'all';
    } finally {
      this.detailLoading = false;
      this.refreshView();
    }
  }

  get selectedCalibrationSchedule(): CalibrationScheduleDto | null {
    return this.calibrationSchedules.find((schedule) => schedule.id === this.selectedCalibrationScheduleId) ?? null;
  }

  get filteredCalibrationSchedules(): CalibrationScheduleDto[] {
    return this.calibrationScheduleStatusFilter
      ? this.calibrationSchedules.filter((schedule) => schedule.status === this.calibrationScheduleStatusFilter)
      : this.calibrationSchedules;
  }

  get hasCalibrationSchedule(): boolean {
    return this.calibrationSchedules.length > 0;
  }

  get calibrationAreaOptions(): string[] {
    return this.uniqueSorted(this.calibrationItems.map((item) => item.area_name || '').filter(Boolean));
  }

  get calibrationLocationOptions(): string[] {
    if (!this.calibrationAreaFilter) return [];
    return this.uniqueSorted(
      this.calibrationItems
        .filter((item) => item.area_name === this.calibrationAreaFilter)
        .map((item) => item.location_name || '')
        .filter(Boolean)
    );
  }

  onCalibrationAreaFilterChange(areaName: string): void {
    this.calibrationAreaFilter = areaName;
    this.calibrationLocationFilter = '';
  }

  get filteredCalibrationItems(): CalibrationItemDto[] {
    const term = this.calibrationSearch.trim().toLowerCase();
    return this.calibrationItems.filter((item) => {
      if (
        this.selectedCalibrationSchedule?.status === 'draft' &&
        !this.matchesProgrammingView(item.programming_confirmed, this.calibrationProgrammingView)
      ) {
        return false;
      }
      if (this.calibrationAreaFilter && item.area_name !== this.calibrationAreaFilter) return false;
      if (this.calibrationLocationFilter && item.location_name !== this.calibrationLocationFilter) return false;
      if (
        this.calibrationItemStatusFilter &&
        this.calibrationItemStatusKey(item) !== this.calibrationItemStatusFilter
      ) {
        return false;
      }
      if (!term) return true;
      return `${item.code ?? ''} ${item.name ?? ''} ${item.brand ?? ''} ${item.model ?? ''} ${item.serial ?? ''} ${item.site_name ?? ''} ${item.area_name ?? ''} ${item.location_name ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }

  get filteredCalibrationGroups(): CalibrationItemGroup[] {
    const groupByLocation = this.calibrationEditing && this.calibrationEditLevel === 'location';
    const groupByEquipment = this.calibrationEditing && this.calibrationEditLevel === 'equipment';
    const map = new Map<
      string,
      Omit<CalibrationItemGroup, 'assetCount' | 'frequencies' | 'dateGroups'>
    >();
    for (const item of this.filteredCalibrationItems) {
      const areaName = item.area_name || 'Sin área';
      const siteName = item.site_name || 'Sin sede';
      const locationName = item.location_name || 'Sin ubicación';
      const baseKey = `${item.site_id || 'no-site'}:${item.area_id || areaName.toLowerCase()}`;
      const key = groupByEquipment
        ? `equipment:${item.asset_id}`
        : groupByLocation
          ? `${baseKey}:${item.location_id || locationName.toLowerCase()}`
          : baseKey;
      if (!map.has(key)) {
        map.set(key, {
          areaKey: key,
          areaName,
          siteName,
          locationName: groupByLocation || groupByEquipment ? locationName : 'Todas las ubicaciones',
          code: item.code || '-',
          name: item.name || '-',
          brand: item.brand || 'Sin marca',
          model: item.model || 'Sin modelo',
          serial: item.serial || 'NR',
          items: []
        });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        assetCount: new Set(group.items.map((item) => item.asset_id)).size,
        frequencies: this.uniqueSorted(group.items.map((item) => item.frequency).filter(Boolean)),
        dateGroups: this.buildCalibrationDateGroups(group.items)
      }))
      .sort((a, b) =>
        `${groupByEquipment ? `${a.code} ${a.name}` : `${a.siteName} ${a.areaName} ${a.locationName}`}`.localeCompare(
          groupByEquipment ? `${b.code} ${b.name}` : `${b.siteName} ${b.areaName} ${b.locationName}`
        )
      );
  }

  private buildCalibrationDateGroups(items: CalibrationItemDto[]): CalibrationDateGroup[] {
    const map = new Map<string, CalibrationDateGroup>();
    for (const item of items) {
      const minDate = this.calibrationRangeMin(item);
      const maxDate = this.calibrationRangeMax(item);
      const key = `${item.planned_date}:${maxDate}`;
      if (!map.has(key)) {
        map.set(key, { key, plannedDate: item.planned_date, minDate, maxDate, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values()).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  }

  get calibrationSummary(): Record<'pending' | 'active' | 'done' | 'expired', number> {
    return this.countStatuses(this.calibrationItems, (item) => this.calibrationItemStatusKey(item)) as Record<
      'pending' | 'active' | 'done' | 'expired',
      number
    >;
  }

  async generateCalibrationSchedule(): Promise<void> {
    if (!this.validGeneratorDate(this.calibrationStartDate)) {
      this.setNotice('error', 'Selecciona una fecha inicial válida dentro del año del cronograma.');
      return;
    }
    await this.runAction(
      'generate-calibration',
      async () => {
        const scheduleId = await this.calibration.generateSchedule(this.selectedClientId, {
          year: this.selectedYear,
          startDate: this.calibrationStartDate
        });
        await this.loadCalibrationSchedules(false);
        this.showGenerator = false;
        await this.selectCalibrationSchedule(scheduleId);
        this.calibrationEditLevel = 'area';
        this.startCalibrationEdit();
      },
      'Borrador generado. Ajusta las fechas y apruébalo cuando esté listo.'
    );
  }

  canEditCalibration(schedule: CalibrationScheduleDto | null = this.selectedCalibrationSchedule): boolean {
    return Boolean(
      schedule &&
      this.auth.currentUser()?.clientId &&
      this.canManageCalibrationSchedules() &&
      schedule.status === 'draft'
    );
  }

  async openCalibrationEdit(schedule: CalibrationScheduleDto): Promise<void> {
    if (!this.canEditCalibration(schedule)) return;
    await this.selectCalibrationSchedule(schedule.id);
    if (this.selectedCalibrationScheduleId === schedule.id) {
      this.calibrationEditLevel = 'area';
      this.startCalibrationEdit();
    }
  }

  startCalibrationEdit(): void {
    if (!this.canEditCalibration()) return;
    this.calibrationSnapshot = new Map(
      this.calibrationItems.map((item) => [item.id, item.planned_date])
    );
    this.calibrationProgrammingView = this.calibrationUnprogrammedCount ? 'pending' : 'programmed';
    this.calibrationEditing = true;
  }

  cancelCalibrationEdit(): void {
    this.closeDatePicker();
    for (const item of this.calibrationItems) {
      item.planned_date = this.calibrationSnapshot.get(item.id) ?? item.planned_date;
    }
    this.calibrationEditing = false;
  }

  hasCalibrationChanges(): boolean {
    return this.calibrationItems.some(
      (item) => item.planned_date !== (this.calibrationSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  get calibrationProgrammedCount(): number {
    return this.calibrationItems.filter((item) => item.programming_confirmed).length;
  }

  get calibrationUnprogrammedCount(): number {
    return this.calibrationItems.length - this.calibrationProgrammedCount;
  }

  get calibrationProgrammingPercent(): number {
    return this.programmingPercent(this.calibrationProgrammedCount, this.calibrationItems.length);
  }

  canApproveCalibrationDraft(): boolean {
    return Boolean(
      this.selectedCalibrationSchedule?.status === 'draft' &&
      this.calibrationUnprogrammedCount === 0 &&
      !this.hasCalibrationChanges()
    );
  }

  calibrationSectionHasChanges(group: CalibrationItemGroup): boolean {
    return group.items.some(
      (item) => item.planned_date !== (this.calibrationSnapshot.get(item.id) ?? item.planned_date)
    );
  }

  calibrationSectionNeedsSave(group: CalibrationItemGroup): boolean {
    return (
      group.items.some((item) => !item.programming_confirmed) ||
      this.calibrationSectionHasChanges(group)
    );
  }

  onCalibrationDateGroupChange(dateGroup: CalibrationDateGroup, value: string): void {
    const normalized = this.normalizeEditableDate(value, dateGroup.minDate, dateGroup.maxDate);
    for (const item of dateGroup.items) item.planned_date = normalized;
    dateGroup.plannedDate = normalized;
  }

  onCalibrationItemDateChange(item: CalibrationItemDto, value: string): void {
    item.planned_date = this.normalizeEditableDate(
      value,
      this.calibrationRangeMin(item),
      this.calibrationRangeMax(item)
    );
  }

  calibrationRangeMin(item: CalibrationItemDto): string {
    return this.calibrationRangeMap.get(item.id)?.min ?? item.planned_date;
  }

  calibrationRangeMax(item: CalibrationItemDto): string {
    return this.calibrationRangeMap.get(item.id)?.max ?? item.deadline_date;
  }

  calibrationGroupStatusItems(group: CalibrationItemGroup): { status: string; count: number }[] {
    const counts = this.countStatuses(group.items, (item) => this.calibrationItemStatusKey(item));
    return ['active', 'expired', 'pending', 'done']
      .filter((status) => counts[status] > 0)
      .map((status) => ({ status, count: counts[status] }));
  }

  async saveCalibrationSection(group: CalibrationItemGroup): Promise<void> {
    if (!this.selectedCalibrationScheduleId || !this.calibrationEditing) return;
    await this.runAction(
      `save-calibration-${group.areaKey}`,
      async () => {
        await this.calibration.updateScheduleItems(
          this.selectedCalibrationScheduleId,
          group.items.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        const programmedAt = new Date().toISOString();
        for (const item of group.items) {
          item.programming_confirmed = true;
          item.programmed_at = programmedAt;
          this.calibrationSnapshot.set(item.id, item.planned_date);
        }
        if (this.selectedCalibrationSchedule) {
          this.selectedCalibrationSchedule.programmed_items = this.calibrationProgrammedCount;
          this.selectedCalibrationSchedule.total_items = this.calibrationItems.length;
        }
      },
      `Programación de calibración por ${this.calibrationSectionLabel().toLowerCase()} guardada. El avance quedó registrado.`
    );
  }

  requestApproveCalibration(schedule: CalibrationScheduleDto): void {
    const unprogrammed = this.calibrationScheduleUnprogrammed(schedule);
    if (unprogrammed) {
      this.setNotice(
        'info',
        unprogrammed === 1
          ? 'Falta 1 calibración por revisar y guardar.'
          : `Faltan ${unprogrammed} calibraciones por revisar y guardar.`
      );
      return;
    }
    this.openConfirm(
      'Aprobar cronograma de calibración',
      `Se aprobarán las calibraciones programadas para ${schedule.year}.`,
      'Aprobar cronograma',
      false,
      async () => {
        this.selectedCalibrationScheduleId = schedule.id;
        await this.calibration.approveSchedule(schedule.id);
        await this.loadCalibrationSchedules(true);
        this.setNotice('success', 'Cronograma de calibración aprobado.');
      }
    );
  }

  requestDeleteCalibrationSchedule(schedule: CalibrationScheduleDto): void {
    this.openConfirm(
      'Eliminar cronograma de calibración',
      `Se eliminará definitivamente el cronograma ${schedule.year}.`,
      'Eliminar cronograma',
      true,
      async () => {
        await this.calibration.deleteSchedule(schedule.id);
        await this.loadCalibrationSchedules(false);
        this.setNotice('success', 'Cronograma de calibración eliminado.');
      }
    );
  }

  async openCalibrationSchedulePdf(scheduleId: string): Promise<void> {
    await this.openPdfAction(
      `calibration-schedule-pdf-${scheduleId}`,
      () => this.calibration.downloadSchedulePdf(scheduleId),
      'No se pudo abrir el PDF del cronograma de calibración.'
    );
  }

  async uploadCalibrationPdf(item: CalibrationItemDto, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.validatePdf(file)) {
      input.value = '';
      return;
    }
    await this.runAction(
      `calibration-upload-${item.id}`,
      async () => {
        await this.calibration.uploadPdf(item.id, file);
        await this.loadCalibrationSchedules(true);
      },
      'Certificado de calibración cargado correctamente.'
    );
    input.value = '';
  }

  async openCalibrationPdf(item: CalibrationItemDto): Promise<void> {
    if (!item.pdf_path) return;
    await this.openPdfAction(
      `calibration-pdf-${item.id}`,
      () => this.calibration.downloadPdf(item.id),
      'No se pudo abrir el certificado de calibración.'
    );
  }

  requestDeleteCalibrationPdf(item: CalibrationItemDto): void {
    this.openConfirm(
      'Eliminar certificado de calibración',
      `Se eliminará el certificado de ${item.code || item.name || 'la calibración seleccionada'}.`,
      'Eliminar certificado',
      true,
      async () => {
        await this.calibration.deletePdf(item.id);
        await this.loadCalibrationSchedules(true);
        this.setNotice('success', 'Certificado de calibración eliminado.');
      }
    );
  }

  canUploadCalibration(item: CalibrationItemDto): boolean {
    const status = this.calibrationItemStatusKey(item);
    return (
      this.auth.hasPermission('calibration:report:upload') &&
      this.selectedCalibrationSchedule?.status === 'approved' &&
      (status === 'active' || status === 'expired') &&
      !item.pdf_path
    );
  }

  canAccessCalibrationModule(): boolean {
    return (
      this.auth.hasPermission('calibration:schedule:manage') ||
      this.auth.hasPermission('calibration:report:upload')
    );
  }

  canManageCalibrationSchedules(): boolean {
    return this.auth.hasPermission('calibration:schedule:manage');
  }

  calibrationSectionLabel(): string {
    if (this.calibrationEditLevel === 'equipment') return 'Equipo';
    if (this.calibrationEditLevel === 'location') return 'Ubicación';
    return 'Área';
  }

  maintenanceScheduleUnprogrammed(schedule: ScheduleDto): number {
    if (schedule.id === this.selectedScheduleId && this.items.length === Number(schedule.total_items)) {
      return this.maintenanceUnprogrammedCount;
    }
    return Math.max(0, Number(schedule.total_items || 0) - Number(schedule.programmed_items || 0));
  }

  trainingScheduleUnprogrammed(schedule: TrainingScheduleDto): number {
    if (
      schedule.id === this.selectedTrainingScheduleId &&
      this.trainingItems.length === Number(schedule.total_items)
    ) {
      return this.trainingUnprogrammedCount;
    }
    return Math.max(0, Number(schedule.total_items || 0) - Number(schedule.programmed_items || 0));
  }

  calibrationScheduleUnprogrammed(schedule: CalibrationScheduleDto): number {
    if (
      schedule.id === this.selectedCalibrationScheduleId &&
      this.calibrationItems.length === Number(schedule.total_items)
    ) {
      return this.calibrationUnprogrammedCount;
    }
    return Math.max(0, Number(schedule.total_items || 0) - Number(schedule.programmed_items || 0));
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      approved: 'Aprobado',
      closed: 'Cerrado'
    };
    return labels[String(status || '').toLowerCase()] ?? status;
  }

  itemStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Programado',
      active: 'Activo',
      done: 'Realizado',
      expired: 'Vencido',
      warranty: 'En garantía',
      not_performed: 'No realizado'
    };
    return labels[String(status || '').toLowerCase()] ?? status;
  }

  maintenanceItemStatusKey(item: ScheduleItemDto): string {
    return item.historical_resolution === 'not_performed'
      ? 'not_performed'
      : item.status;
  }

  trainingItemStatusKey(item: TrainingItemDto): string {
    return item.display_status ?? item.status ?? 'pending';
  }

  trainingItemStatusLabel(item: TrainingItemDto): string {
    const labels: Record<string, string> = {
      pending: 'Programada',
      active: 'Activa',
      done: 'Completada'
    };
    const status = this.trainingItemStatusKey(item);
    return labels[status] ?? this.itemStatusLabel(status);
  }

  calibrationItemStatusKey(item: CalibrationItemDto): string {
    return item.display_status ?? item.status ?? 'pending';
  }

  calibrationItemStatusLabel(item: CalibrationItemDto): string {
    const labels: Record<string, string> = {
      pending: 'Programada',
      active: 'Activa',
      done: 'Completada',
      expired: 'Vencida'
    };
    const status = this.calibrationItemStatusKey(item);
    return labels[status] ?? this.itemStatusLabel(status);
  }

  frequencyLabel(group: { frequencies: string[] }): string {
    return group.frequencies.length
      ? group.frequencies.map((value) => this.titleCase(value)).join(', ')
      : '-';
  }

  titleCase(value: string): string {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    const normalized = this.dateOnly(value);
    if (!normalized) return '-';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  }

  formatMonthYear(value: string | null | undefined): string {
    const normalized = this.dateOnly(value);
    if (!normalized) return '-';
    const [year, month] = normalized.split('-').map(Number);
    const label = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  isBusy(key?: string): boolean {
    return key ? this.busyAction === key : Boolean(this.busyAction);
  }

  openGenerator(): void {
    if (this.loading || this.isBusy()) return;
    const generatorDate =
      this.viewMode === 'maintenance'
        ? this.startDate
        : this.viewMode === 'training'
          ? this.trainingStartDate
          : this.calibrationStartDate;
    if (!this.validGeneratorDate(generatorDate)) {
      const defaultDate = this.firstWeekdayOfYear(this.selectedYear);
      if (this.viewMode === 'maintenance') this.startDate = defaultDate;
      if (this.viewMode === 'training') this.trainingStartDate = defaultDate;
      if (this.viewMode === 'calibration') this.calibrationStartDate = defaultDate;
    }
    this.detailModalOpen = false;
    this.clearActiveDetail();
    this.showGenerator = true;
    this.clearNotice();
  }

  closeGenerator(): void {
    if (!this.isBusy()) this.showGenerator = false;
  }

  closeDetailModal(): void {
    if (this.detailLoading || this.isBusy()) return;
    this.closeDatePicker();
    if (this.editing) this.cancelMaintenanceEdit();
    if (this.trainingEditing) this.cancelTrainingEdit();
    if (this.calibrationEditing) this.cancelCalibrationEdit();
    this.detailModalOpen = false;
    this.clearActiveDetail();
  }

  closeConfirm(): void {
    if (!this.confirmBusy) this.confirmDialog = null;
  }

  async confirmCurrentAction(): Promise<void> {
    const dialog = this.confirmDialog;
    if (!dialog || this.confirmBusy) return;
    this.confirmBusy = true;
    this.clearNotice();
    try {
      await dialog.action();
      this.confirmDialog = null;
    } catch (error: any) {
      console.error(error);
      this.confirmDialog = null;
      this.setNotice('error', this.errorText(error, 'No se pudo completar la acción.'));
    } finally {
      this.confirmBusy = false;
      this.refreshView();
    }
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  trackByAreaKey(_index: number, item: { areaKey: string }): string {
    return item.areaKey;
  }

  private openConfirm(
    title: string,
    message: string,
    confirmLabel: string,
    danger: boolean,
    action: () => Promise<void>
  ): void {
    this.confirmDialog = { title, message, confirmLabel, danger, action };
  }

  private async runAction(key: string, action: () => Promise<void>, successMessage: string): Promise<void> {
    if (this.busyAction) return;
    this.busyAction = key;
    this.clearNotice();
    try {
      await action();
      this.setNotice('success', successMessage);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, 'No se pudo completar la acción.'));
    } finally {
      this.busyAction = '';
      this.refreshView();
    }
  }

  private async openPdfAction(key: string, fetcher: () => Promise<Blob>, fallback: string): Promise<void> {
    if (this.busyAction) return;
    this.busyAction = key;
    this.clearNotice();
    try {
      const blob = await fetcher();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      console.error(error);
      this.setNotice('error', this.errorText(error, fallback));
    } finally {
      this.busyAction = '';
      this.refreshView();
    }
  }

  private validatePdf(file: File): boolean {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.setNotice('error', 'Selecciona un archivo PDF.');
      return false;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.setNotice('error', 'El PDF supera el límite de 15 MB.');
      return false;
    }
    return true;
  }

  private validGeneratorDate(value: string): boolean {
    return this.dateOnly(value).startsWith(`${this.selectedYear}-`);
  }

  private resetGeneratorDates(): void {
    const date = this.firstWeekdayOfYear(this.selectedYear);
    this.startDate = date;
    this.trainingStartDate = date;
    this.calibrationStartDate = date;
  }

  private firstWeekdayOfYear(year: number): string {
    const date = new Date(Date.UTC(year, 0, 2));
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return this.toDateOnly(date);
  }

  private normalizeEditableDate(value: string, min: string, max: string): string {
    let normalized = this.dateOnly(value) || min;
    if (normalized < min) normalized = min;
    if (normalized > max) normalized = max;
    normalized = this.nextWeekday(normalized);
    if (normalized > max) normalized = this.previousWeekday(max);
    if (normalized < min) normalized = this.nextWeekday(min);
    return normalized;
  }

  private nextWeekday(value: string): string {
    const date = this.fromDateOnly(value);
    if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 2);
    if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
    return this.toDateOnly(date);
  }

  private previousWeekday(value: string): string {
    const date = this.fromDateOnly(value);
    if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
    if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() - 2);
    return this.toDateOnly(date);
  }

  private shiftMonths(value: string, amount: number): string {
    const source = this.fromDateOnly(value);
    const targetMonthIndex = source.getUTCMonth() + amount;
    const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return this.toDateOnly(
      new Date(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), lastDay)))
    );
  }

  private fromDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toDateOnly(value: Date): string {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }

  private dateOnly(value: string | null | undefined): string {
    return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  }

  private matchesProgrammingView(confirmed: boolean, view: ProgrammingView): boolean {
    if (view === 'pending') return !confirmed;
    if (view === 'programmed') return confirmed;
    return true;
  }

  private programmingPercent(programmed: number, total: number): number {
    if (!total) return 100;
    return Math.round((programmed / total) * 100);
  }

  private countStatuses<T>(items: T[], selector: (item: T) => string): Record<string, number> {
    const counts: Record<string, number> = {
      pending: 0,
      active: 0,
      done: 0,
      expired: 0,
      warranty: 0,
      not_performed: 0
    };
    for (const item of items) {
      const status = selector(item) || 'pending';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }

  private uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }

  private clearSelections(): void {
    this.closeDatePicker();
    this.selectedScheduleId = '';
    this.items = [];
    this.selectedTrainingScheduleId = '';
    this.trainingItems = [];
    this.selectedCalibrationScheduleId = '';
    this.calibrationItems = [];
    this.editing = false;
    this.trainingEditing = false;
    this.calibrationEditing = false;
    this.detailModalOpen = false;
  }

  private clearActiveDetail(): void {
    this.closeDatePicker();
    this.maintenanceDatesDialog = null;
    this.maintenanceRescheduleDialog = null;
    if (this.viewMode === 'training') {
      this.selectedTrainingScheduleId = '';
      this.trainingItems = [];
      this.trainingEditing = false;
      return;
    }
    if (this.viewMode === 'calibration') {
      this.selectedCalibrationScheduleId = '';
      this.calibrationItems = [];
      this.calibrationEditing = false;
      return;
    }
    this.selectedScheduleId = '';
    this.items = [];
    this.editing = false;
  }

  private setNotice(kind: NoticeKind, message: string): void {
    this.noticeKind = kind;
    this.noticeMessage = message;
  }

  private clearNotice(): void {
    this.noticeMessage = '';
  }

  private errorText(error: any, fallback: string): string {
    return error?.error?.message ?? error?.message ?? fallback;
  }

  private refreshView(): void {
    this.cdr.markForCheck();
  }
}
