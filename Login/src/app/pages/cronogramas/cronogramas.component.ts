import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import {
  SchedulesService,
  ScheduleDto,
  ScheduleItemDto,
  TrainingScheduleDto,
  TrainingItemDto
} from '../../schedules/schedules.service';
import {
  CalibrationService,
  CalibrationScheduleDto,
  CalibrationItemDto
} from '../../calibration/calibration.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface ClientOption {
  id: string;
  name: string;
  nit: string;
  city: string;
  address?: string | null;
  email: string;
  logoPath?: string | null;
}

interface AreaOption {
  id: string;
  name: string;
}
@Component({
  selector: 'app-cronogramas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './cronogramas.component.html',
  styleUrl: './cronogramas.component.scss'
})
export class CronogramasComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  selectedYear = new Date().getFullYear();
  startDate = '';
  schedules: ScheduleDto[] = [];
  selectedScheduleId = '';
  items: ScheduleItemDto[] = [];
  private readonly rangeMap = new Map<string, { min: string; max: string }>();
  editing = false;
  errorMessage = '';
  successMessage = '';
  loading = false;

  areas: AreaOption[] = [];
  trainingPeriodicity = 'semestral';
  readonly trainingPeriodOptions = [
    'mensual',
    'bimensual',
    'trimestral',
    'cuatrimestral',
    'semestral',
    'anual'
  ];
  trainingStartDate = '';
  selectedAreas: string[] = [];
  trainingSchedules: TrainingScheduleDto[] = [];
  trainingItemsBySchedule: Record<string, TrainingItemDto[]> = {};
  trainingLoading = false;
  maintenanceStatusFilter = '';
  trainingStatusFilter = '';
  maintenanceDetailSearch = '';
  maintenanceAreaFilter = '';
  maintenanceFrequencyFilter = '';
  viewMode: 'maintenance' | 'training' | 'calibration' = 'maintenance';
  calibrationSchedules: CalibrationScheduleDto[] = [];
  selectedCalibrationScheduleId = '';
  calibrationItems: CalibrationItemDto[] = [];
  calibrationStartDate = '';
  calibrationSearch = '';
  calibrationAreaFilter = '';
  calibrationStatusFilter = '';

  constructor(
    private readonly admin: AdminService,
    private readonly schedulesService: SchedulesService,
    private readonly biomed: BiomedService,
    private readonly calibration: CalibrationService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await this.loadSchedules();
      await this.loadAreas();
      await this.loadTrainingSchedules();
      await this.loadCalibrationSchedules();
      return;
    }
    const rows = await this.admin.listClients();
    this.clients = rows.map((row) => ({
      id: row.id,
      name: row.name,
      nit: row.nit,
      city: row.city,
      address: row.address,
      email: row.email,
      logoPath: row.logo_path
    }));
    this.selectedClientId = this.clients[0]?.id ?? '';
    await this.loadSchedules();
    await this.loadAreas();
    await this.loadTrainingSchedules();
    await this.loadCalibrationSchedules();
  }

  async loadSchedules(): Promise<void> {
    if (!this.selectedClientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      this.schedules = await this.schedulesService.listSchedules(this.selectedClientId, this.selectedYear);
      this.selectedScheduleId = this.schedules[0]?.id ?? '';
      if (this.selectedScheduleId) {
        await this.loadItems();
      } else {
        this.items = [];
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los cronogramas.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onClientChange(): Promise<void> {
    await this.loadSchedules();
    await this.loadAreas();
    await this.loadTrainingSchedules();
    await this.loadCalibrationSchedules();
  }

  async loadCalibrationSchedules(): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      this.calibrationSchedules = await this.calibration.listSchedules(this.selectedClientId, this.selectedYear);
      this.selectedCalibrationScheduleId = this.calibrationSchedules[0]?.id ?? '';
      if (this.selectedCalibrationScheduleId) {
        await this.loadCalibrationItems();
      } else {
        this.calibrationItems = [];
      }
    } catch (error) {
      console.error(error);
      this.calibrationSchedules = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  async loadCalibrationItems(): Promise<void> {
    if (!this.selectedCalibrationScheduleId) return;
    try {
      this.calibrationItems = await this.calibration.listItems(this.selectedCalibrationScheduleId);
    } catch (error) {
      console.error(error);
      this.calibrationItems = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  async generateCalibrationSchedule(): Promise<void> {
    if (!this.selectedClientId || !this.calibrationStartDate) {
      this.errorMessage = 'Selecciona cliente y fecha inicial.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.calibration.generateSchedule(this.selectedClientId, {
        year: this.selectedYear,
        startDate: this.calibrationStartDate
      });
      this.successMessage = 'Cronograma de calibración generado.';
      await this.loadCalibrationSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo generar el cronograma.';
    }
  }

  async approveCalibrationSchedule(): Promise<void> {
    if (!this.selectedCalibrationScheduleId) return;
    try {
      await this.calibration.approveSchedule(this.selectedCalibrationScheduleId);
      await this.loadCalibrationSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aprobar el cronograma.';
    }
  }

  async openCalibrationSchedulePdf(scheduleId: string): Promise<void> {
    try {
      const blob = await this.calibration.downloadSchedulePdf(scheduleId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async deleteCalibrationSchedule(scheduleId: string): Promise<void> {
    if (!confirm('¿Eliminar cronograma de calibración?')) return;
    try {
      await this.calibration.deleteSchedule(scheduleId);
      await this.loadCalibrationSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el cronograma.';
    }
  }

  async uploadCalibrationPdf(item: CalibrationItemDto, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    try {
      await this.calibration.uploadPdf(item.id, file);
      await this.loadCalibrationItems();
      this.successMessage = 'Acta cargada correctamente.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo subir el PDF.';
    } finally {
      input.value = '';
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  async openCalibrationPdf(item: CalibrationItemDto): Promise<void> {
    if (!item.pdf_path) return;
    try {
      const blob = await this.calibration.downloadPdf(item.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async deleteCalibrationPdf(item: CalibrationItemDto): Promise<void> {
    if (!confirm('¿Eliminar acta cargada?')) return;
    try {
      await this.calibration.deletePdf(item.id);
      await this.loadCalibrationItems();
      this.successMessage = 'Acta eliminada. Puedes cargar una nueva.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el acta.';
    } finally {
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  calibrationStatusLabel(status: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'draft') return 'Borrador';
    if (value === 'approved') return 'Aprobado';
    if (value === 'closed') return 'Cerrado';
    return status;
  }

  calibrationItemStatus(item: CalibrationItemDto): string {
    const status = item.display_status ?? item.status;
    if (status === 'done') return 'Completado';
    if (status === 'active') return 'Activo';
    return 'Programado';
  }

  get calibrationAreaOptions(): string[] {
    const areas = new Set<string>();
    for (const item of this.calibrationItems) {
      if (item.area_name) areas.add(item.area_name);
    }
    return Array.from(areas).sort((a, b) => a.localeCompare(b));
  }

  get filteredCalibrationItems(): CalibrationItemDto[] {
    const term = this.calibrationSearch.trim().toLowerCase();
    return this.calibrationItems.filter((item) => {
      if (this.calibrationAreaFilter && item.area_name !== this.calibrationAreaFilter) return false;
      const statusKey = this.calibrationItemStatus(item);
      if (this.calibrationStatusFilter && statusKey !== this.calibrationStatusFilter) return false;
      if (!term) return true;
      const haystack = `${item.code ?? ''} ${item.name ?? ''} ${item.area_name ?? ''} ${item.serial ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  canUploadCalibration(item: CalibrationItemDto): boolean {
    return this.auth.hasPermission('calibration:report:upload') && this.calibrationItemStatus(item) === 'Activo';
  }

  get selectedClient(): ClientOption | null {
    if (!this.selectedClientId) return null;
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) => client.name.toLowerCase().includes(term));
  }

  async loadAreas(): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      const rows = await this.biomed.listAreas(this.selectedClientId);
      this.areas = rows.map((row) => ({ id: row.id, name: row.name }));
      this.selectedAreas = this.selectedAreas.filter((id) => this.areas.some((area) => area.id === id));
    } catch (error) {
      console.error(error);
      this.areas = [];
    }
  }

  async loadItems(): Promise<void> {
    if (!this.selectedScheduleId) return;
    try {
      this.items = await this.schedulesService.listScheduleItems(this.selectedScheduleId);
      this.editing = false;
      this.rangeMap.clear();
      for (const item of this.items) {
        if (item.planned_date) {
          item.planned_date = this.toDateOnly(item.planned_date);
        }
        if (item.deadline_date) {
          item.deadline_date = this.toDateOnly(item.deadline_date);
        }
        const min = this.computeRangeMin(item);
        const max = this.toDateOnly(item.deadline_date);
        this.rangeMap.set(item.id, {
          min,
          max
        });
        if (min && max) {
          const planned = new Date(item.planned_date);
          const minDate = new Date(min);
          const maxDate = new Date(max);
          if (planned < minDate || planned > maxDate) {
            item.planned_date = min;
          }
        }
      }
    } catch (error) {
      console.error(error);
      this.items = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  async generateSchedule(): Promise<void> {
    if (!this.selectedClientId || !this.startDate) {
      this.errorMessage = 'Selecciona cliente y fecha inicial.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.schedulesService.generateSchedule(this.selectedClientId, this.selectedYear, this.startDate);
      this.successMessage = 'Cronograma generado.';
      await this.loadSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo generar el cronograma.';
    }
  }

  async loadTrainingSchedules(): Promise<void> {
    if (!this.selectedClientId) return;
    this.trainingLoading = true;
    try {
      this.trainingSchedules = await this.schedulesService.listTrainingSchedules(this.selectedClientId, this.selectedYear);
      await this.loadTrainingItemsForClient();
    } catch (error) {
      console.error(error);
    } finally {
      this.trainingLoading = false;
      this.cdr.detectChanges();
    }
  }

  async generateTrainingSchedule(): Promise<void> {
    if (!this.selectedClientId || !this.trainingStartDate || !this.trainingPeriodicity || !this.selectedAreas.length) {
      this.errorMessage = 'Selecciona fecha inicial, periodicidad y áreas.';
      return;
    }
    try {
      await this.schedulesService.generateTrainingSchedule(this.selectedClientId, {
        year: this.selectedYear,
        startDate: this.trainingStartDate,
        periodicity: this.trainingPeriodicity,
        areaIds: this.selectedAreas
      });
      this.successMessage = 'Cronograma de capacitaciones generado.';
      await this.loadTrainingSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo generar el cronograma de capacitaciones.';
    }
  }

  async loadTrainingItemsForClient(): Promise<void> {
    if (!this.selectedClientId) return;
    try {
      const items = await this.schedulesService.listTrainingItemsByClient(this.selectedClientId, this.selectedYear);
      const grouped: Record<string, TrainingItemDto[]> = {};
      for (const item of items) {
        if (item.planned_date) {
          item.planned_date = this.toDateOnly(item.planned_date);
        }
        if (!grouped[item.schedule_id]) {
          grouped[item.schedule_id] = [];
        }
        grouped[item.schedule_id].push(item);
      }
      this.trainingItemsBySchedule = grouped;
    } catch (error) {
      console.error(error);
      this.trainingItemsBySchedule = {};
    }
  }

  async approveTrainingSchedule(scheduleId: string): Promise<void> {
    if (!scheduleId) return;
    try {
      await this.schedulesService.approveTrainingSchedule(scheduleId);
      await this.loadTrainingSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aprobar el cronograma de capacitaciones.';
    }
  }

  async openTrainingSchedulePdf(scheduleId: string): Promise<void> {
    try {
      const blob = await this.schedulesService.downloadTrainingSchedulePdf(scheduleId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async uploadTrainingPdf(item: TrainingItemDto, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    try {
      await this.schedulesService.uploadTrainingPdf(item.id, file);
      const scheduleId = item.schedule_id;
      if (scheduleId) {
        const items = await this.schedulesService.listTrainingItems(scheduleId);
        this.trainingItemsBySchedule[scheduleId] = items.map((row) => ({
          ...row,
          planned_date: row.planned_date ? this.toDateOnly(row.planned_date) : row.planned_date
        }));
      }
      this.successMessage = 'Acta cargada correctamente.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo subir el PDF.';
    } finally {
      input.value = '';
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  async saveTrainingItems(scheduleId: string): Promise<void> {
    const items = this.trainingItemsBySchedule[scheduleId] ?? [];
    if (!items.length) return;
    try {
      await this.schedulesService.updateTrainingItems(
        scheduleId,
        items.map((item) => ({ id: item.id, plannedDate: item.planned_date }))
      );
      await this.loadTrainingSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudieron guardar las fechas.';
    }
  }

  async openTrainingPdf(item: TrainingItemDto): Promise<void> {
    if (!item.pdf_path) return;
    try {
      const blob = await this.schedulesService.downloadTrainingPdf(item.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async deleteTrainingPdf(item: TrainingItemDto): Promise<void> {
    if (!confirm('¿Eliminar acta cargada?')) return;
    try {
      await this.schedulesService.deleteTrainingPdf(item.id);
      const scheduleId = item.schedule_id;
      if (scheduleId) {
        const items = await this.schedulesService.listTrainingItems(scheduleId);
        this.trainingItemsBySchedule[scheduleId] = items.map((row) => ({
          ...row,
          planned_date: row.planned_date ? this.toDateOnly(row.planned_date) : row.planned_date
        }));
      }
      this.successMessage = 'Acta eliminada. Puedes cargar una nueva.';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el acta.';
    } finally {
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  async deleteTrainingSchedule(scheduleId: string): Promise<void> {
    if (!confirm('¿Eliminar cronograma de capacitaciones?')) return;
    try {
      await this.schedulesService.deleteTrainingSchedule(scheduleId);
      await this.loadTrainingSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el cronograma.';
    }
  }

  trainingStatusLabel(status: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'draft') return 'Borrador';
    if (value === 'approved') return 'Aprobado';
    if (value === 'closed') return 'Cerrado';
    return status;
  }

  trainingItemStatus(item: TrainingItemDto): string {
    const status = item.display_status ?? item.status;
    if (status === 'done') return 'Completado';
    if (status === 'active') return 'Activo';
    return 'Programado';
  }

  canUploadTrainingPdf(item: TrainingItemDto): boolean {
    return (item.display_status ?? item.status) === 'active';
  }

  toggleAreaSelection(areaId: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedAreas.includes(areaId)) {
        this.selectedAreas = [...this.selectedAreas, areaId];
      }
      return;
    }
    this.selectedAreas = this.selectedAreas.filter((id) => id !== areaId);
  }

  canEditSelected(): boolean {
    const schedule = this.schedules.find((s) => s.id === this.selectedScheduleId);
    if (!schedule) return false;
    if (this.auth.hasRole('superuser')) return true;
    if (schedule.status === 'approved') return false;
    return true;
  }

  get filteredSchedules(): ScheduleDto[] {
    if (!this.maintenanceStatusFilter) return this.schedules;
    return this.schedules.filter((s) => s.status === this.maintenanceStatusFilter);
  }

  get filteredTrainingSchedules(): TrainingScheduleDto[] {
    if (!this.trainingStatusFilter) return this.trainingSchedules;
    return this.trainingSchedules.filter((s) => s.status === this.trainingStatusFilter);
  }

  statusLabel(status: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'draft') return 'Borrador';
    if (value === 'approved') return 'Aprobado';
    if (value === 'closed') return 'Cerrado';
    return status;
  }

  isApprovedSelected(): boolean {
    const schedule = this.schedules.find((s) => s.id === this.selectedScheduleId);
    return schedule?.status === 'approved';
  }

  adjustToWeekday(date: Date): Date {
    const d = new Date(date);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d;
  }

  addBusinessDays(date: Date, days: number): Date {
    let d = new Date(date);
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        added += 1;
      }
    }
    return d;
  }

  subtractBusinessDays(date: Date, days: number): Date {
    let d = new Date(date);
    let subtracted = 0;
    while (subtracted < days) {
      d.setDate(d.getDate() - 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        subtracted += 1;
      }
    }
    return d;
  }

  toDateOnly(value: string): string {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
  }

  computeRangeMin(item: ScheduleItemDto): string {
    if (!item.deadline_date) return item.planned_date;
    const deadline = new Date(item.deadline_date);
    const minDate = this.subtractBusinessDays(deadline, 10);
    return minDate.toISOString().slice(0, 10);
  }

  onPlannedDateChange(item: ScheduleItemDto, value: string): void {
    const range = this.rangeMap.get(item.id);
    if (!range) return;
    const minDate = new Date(range.min);
    const maxDate = new Date(range.max);
    let planned = this.adjustToWeekday(new Date(value));
    if (planned < minDate) planned = minDate;
    if (planned > maxDate) planned = maxDate;
    item.planned_date = planned.toISOString().slice(0, 10);
    item.deadline_date = range.max;
  }

  rangeMin(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.min ?? item.planned_date;
  }

  rangeMax(item: ScheduleItemDto): string {
    return this.rangeMap.get(item.id)?.max ?? item.deadline_date;
  }

  async saveEdits(): Promise<void> {
    if (!this.selectedScheduleId) return;
    const payload = this.items.map((item) => ({
      id: item.id,
      plannedDate: item.planned_date
    }));
    try {
      await this.schedulesService.updateScheduleItems(this.selectedScheduleId, payload);
      this.editing = false;
      await this.loadSchedules();
      await this.loadItems();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo actualizar el cronograma.';
    }
  }

  async approveSchedule(): Promise<void> {
    if (!this.selectedScheduleId) return;
    try {
      await this.schedulesService.approveSchedule(this.selectedScheduleId);
      await this.loadSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aprobar el cronograma.';
    }
  }

  async openPdf(scheduleId: string): Promise<void> {
    try {
      const blob = await this.schedulesService.downloadSchedulePdf(scheduleId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo abrir el PDF.';
    }
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    if (!confirm('¿Eliminar cronograma?')) {
      return;
    }
    try {
      await this.schedulesService.deleteSchedule(scheduleId);
      await this.loadSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el cronograma.';
    }
  }

  get groupedItems(): { assetId: string; code: string; name: string; brand: string | null; model: string | null; frequency: string; items: ScheduleItemDto[] }[] {
    const map = new Map<string, { assetId: string; code: string; name: string; brand: string | null; model: string | null; frequency: string; items: ScheduleItemDto[] }>();
    for (const item of this.items) {
      if (!map.has(item.asset_id)) {
        map.set(item.asset_id, {
          assetId: item.asset_id,
          code: item.code ?? '',
          name: item.name ?? '',
          brand: item.brand ?? null,
          model: item.model ?? null,
          frequency: item.frequency,
          items: []
        });
      }
      map.get(item.asset_id)!.items.push(item);
    }
    return Array.from(map.values());
  }

  get maintenanceAreaOptions(): string[] {
    const areas = new Set<string>();
    for (const item of this.items) {
      if (item.area_name) areas.add(item.area_name);
    }
    return Array.from(areas).sort((a, b) => a.localeCompare(b));
  }

  get maintenanceFrequencyOptions(): string[] {
    const freqs = new Set<string>();
    for (const item of this.items) {
      if (item.frequency) freqs.add(item.frequency);
    }
    return Array.from(freqs);
  }

  get filteredGroupedItems(): { assetId: string; code: string; name: string; brand: string | null; model: string | null; frequency: string; items: ScheduleItemDto[] }[] {
    const query = this.maintenanceDetailSearch.trim().toLowerCase();
    return this.groupedItems.filter((group) => {
      const areaNames = group.items.map((item) => item.area_name ?? '').join(' ').toLowerCase();
      const matchesArea = this.maintenanceAreaFilter ? areaNames.includes(this.maintenanceAreaFilter.toLowerCase()) : true;
      const matchesFreq = this.maintenanceFrequencyFilter ? group.frequency === this.maintenanceFrequencyFilter : true;
      const haystack = `${group.code} ${group.name} ${group.brand ?? ''} ${group.model ?? ''} ${areaNames}`.toLowerCase();
      const matchesSearch = query ? haystack.includes(query) : true;
      return matchesArea && matchesFreq && matchesSearch;
    });
  }
}
