import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  areaName: string;
  siteName: string;
  assetCount: number;
  frequencies: string[];
  items: ScheduleItemDto[];
  dateGroups: MaintenanceAreaDateGroup[];
}

interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => Promise<void>;
}

type ViewMode = 'maintenance' | 'training' | 'calibration';
type NoticeKind = 'success' | 'error' | 'info';

@Component({
  selector: 'app-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './cronogramas.component.html',
  styleUrl: './cronogramas.component.scss'
})
export class CronogramasComponent implements OnInit {
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

  startDate = '';
  schedules: ScheduleDto[] = [];
  selectedScheduleId = '';
  items: ScheduleItemDto[] = [];
  maintenanceStatusFilter = '';
  maintenanceItemStatusFilter = '';
  maintenanceDetailSearch = '';
  maintenanceAreaFilter = '';
  maintenanceFrequencyFilter = '';
  editing = false;
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
  private trainingSnapshot = new Map<string, string>();

  calibrationStartDate = '';
  calibrationSchedules: CalibrationScheduleDto[] = [];
  selectedCalibrationScheduleId = '';
  calibrationItems: CalibrationItemDto[] = [];
  calibrationScheduleStatusFilter = '';
  calibrationItemStatusFilter = '';
  calibrationSearch = '';
  calibrationAreaFilter = '';

  constructor(
    private readonly admin: AdminService,
    private readonly schedulesService: SchedulesService,
    private readonly biomed: BiomedService,
    private readonly calibration: CalibrationService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.resetGeneratorDates();
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
      const rows = await this.schedulesService.listSchedules(this.selectedClientId, this.selectedYear);
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
      const rows = await this.schedulesService.listScheduleItems(scheduleId);
      this.items = rows.map((item) => ({
        ...item,
        planned_date: this.dateOnly(item.planned_date),
        deadline_date: this.dateOnly(item.deadline_date)
      }));
      this.editing = false;
      this.rangeMap.clear();
      this.maintenanceSnapshot.clear();
      for (const item of this.items) {
        const min = this.computeRangeMin(item);
        const max = item.deadline_date;
        this.rangeMap.set(item.id, { min, max });
        this.maintenanceSnapshot.set(item.id, item.planned_date);
      }
    } finally {
      this.detailLoading = false;
      this.refreshView();
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
        await this.schedulesService.generateSchedule(this.selectedClientId, this.selectedYear, this.startDate);
        await this.loadSchedules(false);
        this.showGenerator = false;
      },
      'Cronograma de mantenimiento generado en borrador.'
    );
  }

  canEditSelected(): boolean {
    const schedule = this.selectedSchedule;
    if (!schedule) return false;
    if (this.auth.hasRole('superuser')) return true;
    return schedule.status === 'draft' && !schedule.engineer_edited;
  }

  get maintenanceEditRestriction(): string {
    const schedule = this.selectedSchedule;
    if (!schedule || this.canEditSelected()) return '';
    if (schedule.status !== 'draft') return 'Las fechas quedan bloqueadas al aprobar el cronograma.';
    if (schedule.engineer_edited) return 'La edición permitida para el ingeniero ya fue utilizada.';
    return '';
  }

  startMaintenanceEdit(): void {
    if (!this.canEditSelected()) return;
    this.maintenanceSnapshot = new Map(this.items.map((item) => [item.id, item.planned_date]));
    this.editing = true;
  }

  cancelMaintenanceEdit(): void {
    for (const item of this.items) {
      item.planned_date = this.maintenanceSnapshot.get(item.id) ?? item.planned_date;
    }
    this.editing = false;
  }

  async saveEdits(): Promise<void> {
    if (!this.selectedScheduleId) return;
    await this.runAction(
      'save-maintenance',
      async () => {
        await this.schedulesService.updateScheduleItems(
          this.selectedScheduleId,
          this.items.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        await this.loadSchedules(true);
      },
      'Fechas de mantenimiento actualizadas.'
    );
  }

  requestApproveSchedule(schedule: ScheduleDto): void {
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

  get maintenanceSummary(): Record<'pending' | 'active' | 'done' | 'expired', number> {
    return this.countStatuses(this.items, (item) => item.status) as Record<
      'pending' | 'active' | 'done' | 'expired',
      number
    >;
  }

  get maintenanceAreaOptions(): string[] {
    return this.uniqueSorted(this.items.map((item) => item.area_name || '').filter(Boolean));
  }

  get maintenanceFrequencyOptions(): string[] {
    return this.uniqueSorted(this.items.map((item) => item.frequency).filter(Boolean));
  }

  get filteredMaintenanceItems(): ScheduleItemDto[] {
    const term = this.maintenanceDetailSearch.trim().toLowerCase();
    return this.items.filter((item) => {
      if (this.maintenanceAreaFilter && item.area_name !== this.maintenanceAreaFilter) return false;
      if (this.maintenanceFrequencyFilter && item.frequency !== this.maintenanceFrequencyFilter) return false;
      if (this.maintenanceItemStatusFilter && item.status !== this.maintenanceItemStatusFilter) return false;
      if (!term) return true;
      return `${item.code ?? ''} ${item.name ?? ''} ${item.brand ?? ''} ${item.model ?? ''} ${item.serial ?? ''} ${item.site_name ?? ''} ${item.area_name ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }

  get filteredGroupedItems(): MaintenanceItemGroup[] {
    const map = new Map<
      string,
      Omit<MaintenanceItemGroup, 'assetCount' | 'frequencies' | 'dateGroups'>
    >();
    for (const item of this.filteredMaintenanceItems) {
      const areaName = item.area_name || 'Sin área';
      const siteName = item.site_name || 'Sin sede';
      const key = `${item.site_id || 'no-site'}:${item.area_id || areaName.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { areaKey: key, areaName, siteName, items: [] });
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
      .sort((a, b) => `${a.siteName} ${a.areaName}`.localeCompare(`${b.siteName} ${b.areaName}`));
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

  areaStatusItems(group: MaintenanceItemGroup): { status: string; count: number }[] {
    const counts = this.countStatuses(group.items, (item) => item.status);
    return ['active', 'expired', 'pending', 'done']
      .filter((status) => counts[status] > 0)
      .map((status) => ({ status, count: counts[status] }));
  }

  onAreaPlannedDateChange(dateGroup: MaintenanceAreaDateGroup, value: string): void {
    const normalized = this.normalizeEditableDate(value, dateGroup.minDate, dateGroup.maxDate);
    for (const item of dateGroup.items) item.planned_date = normalized;
    dateGroup.plannedDate = normalized;
  }

  rangeMin(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.min ?? item.planned_date;
  }

  rangeMax(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.max ?? item.deadline_date;
  }

  private computeRangeMin(item: ScheduleItemDto): string {
    return item.deadline_date ? this.shiftBusinessDays(item.deadline_date, -10) : item.planned_date;
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
      const status = this.trainingItemStatusKey(item);
      if (this.trainingItemStatusFilter && status !== this.trainingItemStatusFilter) return false;
      if (!term) return true;
      return `${item.area_name ?? ''} ${this.formatDate(item.planned_date)}`.toLowerCase().includes(term);
    });
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
        await this.schedulesService.generateTrainingSchedule(this.selectedClientId, {
          year: this.selectedYear,
          startDate: this.trainingStartDate,
          periodicity: this.trainingPeriodicity,
          areaIds: this.selectedAreas
        });
        await this.loadTrainingSchedules(false);
        this.showGenerator = false;
      },
      'Cronograma de capacitaciones generado en borrador.'
    );
  }

  canEditTraining(): boolean {
    const schedule = this.selectedTrainingSchedule;
    if (!schedule) return false;
    return this.auth.hasRole('superuser') || schedule.status === 'draft';
  }

  startTrainingEdit(): void {
    if (!this.canEditTraining()) return;
    this.trainingSnapshot = new Map(this.trainingItems.map((item) => [item.id, item.planned_date]));
    this.trainingEditing = true;
  }

  cancelTrainingEdit(): void {
    for (const item of this.trainingItems) {
      item.planned_date = this.trainingSnapshot.get(item.id) ?? item.planned_date;
    }
    this.trainingEditing = false;
  }

  onTrainingDateChange(item: TrainingItemDto, value: string): void {
    item.planned_date = this.normalizeEditableDate(
      value,
      `${this.selectedYear}-01-01`,
      `${this.selectedYear}-12-31`
    );
  }

  async saveTrainingItems(): Promise<void> {
    if (!this.selectedTrainingScheduleId) return;
    await this.runAction(
      'save-training',
      async () => {
        await this.schedulesService.updateTrainingItems(
          this.selectedTrainingScheduleId,
          this.trainingItems.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
        );
        await this.loadTrainingSchedules(true);
      },
      'Fechas de capacitación actualizadas.'
    );
  }

  requestApproveTraining(schedule: TrainingScheduleDto): void {
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

  get filteredCalibrationItems(): CalibrationItemDto[] {
    const term = this.calibrationSearch.trim().toLowerCase();
    return this.calibrationItems.filter((item) => {
      if (this.calibrationAreaFilter && item.area_name !== this.calibrationAreaFilter) return false;
      if (
        this.calibrationItemStatusFilter &&
        this.calibrationItemStatusKey(item) !== this.calibrationItemStatusFilter
      ) {
        return false;
      }
      if (!term) return true;
      return `${item.code ?? ''} ${item.name ?? ''} ${item.brand ?? ''} ${item.model ?? ''} ${item.serial ?? ''} ${item.area_name ?? ''}`
        .toLowerCase()
        .includes(term);
    });
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
        await this.calibration.generateSchedule(this.selectedClientId, {
          year: this.selectedYear,
          startDate: this.calibrationStartDate
        });
        await this.loadCalibrationSchedules(false);
        this.showGenerator = false;
      },
      'Cronograma de calibración generado en borrador.'
    );
  }

  requestApproveCalibration(schedule: CalibrationScheduleDto): void {
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
      expired: 'Vencido'
    };
    return labels[String(status || '').toLowerCase()] ?? status;
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

  frequencyLabel(group: MaintenanceItemGroup): string {
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

  isBusy(key?: string): boolean {
    return key ? this.busyAction === key : Boolean(this.busyAction);
  }

  openGenerator(): void {
    if (this.loading || this.isBusy()) return;
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
    if (this.editing) this.cancelMaintenanceEdit();
    if (this.trainingEditing) this.cancelTrainingEdit();
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

  trackByAreaKey(_index: number, item: MaintenanceItemGroup): string {
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
    normalized = this.nextWeekday(normalized);
    if (normalized < min) normalized = min;
    if (normalized > max) normalized = max;
    if (this.isWeekend(normalized)) normalized = this.previousWeekday(normalized);
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

  private isWeekend(value: string): boolean {
    const day = this.fromDateOnly(value).getUTCDay();
    return day === 0 || day === 6;
  }

  private shiftBusinessDays(value: string, amount: number): string {
    const date = this.fromDateOnly(value);
    const direction = amount < 0 ? -1 : 1;
    let remaining = Math.abs(amount);
    while (remaining > 0) {
      date.setUTCDate(date.getUTCDate() + direction);
      const day = date.getUTCDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return this.toDateOnly(date);
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

  private countStatuses<T>(items: T[], selector: (item: T) => string): Record<string, number> {
    const counts: Record<string, number> = { pending: 0, active: 0, done: 0, expired: 0 };
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
    this.selectedScheduleId = '';
    this.items = [];
    this.selectedTrainingScheduleId = '';
    this.trainingItems = [];
    this.selectedCalibrationScheduleId = '';
    this.calibrationItems = [];
    this.editing = false;
    this.trainingEditing = false;
    this.detailModalOpen = false;
  }

  private clearActiveDetail(): void {
    if (this.viewMode === 'training') {
      this.selectedTrainingScheduleId = '';
      this.trainingItems = [];
      this.trainingEditing = false;
      return;
    }
    if (this.viewMode === 'calibration') {
      this.selectedCalibrationScheduleId = '';
      this.calibrationItems = [];
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
