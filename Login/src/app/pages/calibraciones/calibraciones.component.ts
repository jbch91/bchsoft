import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import {
  CalibrationService,
  CalibrationScheduleDto,
  CalibrationItemDto
} from '../../calibration/calibration.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  address?: string | null;
  email?: string | null;
  logoPath?: string | null;
}

@Component({
  selector: 'app-calibraciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './calibraciones.component.html',
  styleUrl: './calibraciones.component.scss'
})
export class CalibracionesComponent implements OnInit {
  private readonly publicBase = getPublicBase();
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = '';
  selectedYear = new Date().getFullYear();
  startDate = '';
  schedules: CalibrationScheduleDto[] = [];
  selectedScheduleId = '';
  items: CalibrationItemDto[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  viewMode: 'cronogramas' | 'detalle' = 'cronogramas';

  constructor(
    private readonly admin: AdminService,
    private readonly calibration: CalibrationService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const userClient = this.auth.currentUser()?.clientId ?? '';
    if (userClient) {
      this.selectedClientId = userClient;
      await this.loadSchedules();
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
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) => client.name.toLowerCase().includes(term));
  }

  get selectedClientInfo(): ClientOption | null {
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  get canManageSchedules(): boolean {
    return this.auth.hasPermission('calibration:schedule:manage');
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  async loadSchedules(): Promise<void> {
    if (!this.selectedClientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      this.schedules = await this.calibration.listSchedules(this.selectedClientId, this.selectedYear);
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

  async loadItems(): Promise<void> {
    if (!this.selectedScheduleId) return;
    try {
      this.items = await this.calibration.listItems(this.selectedScheduleId);
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
      await this.calibration.generateSchedule(this.selectedClientId, {
        year: this.selectedYear,
        startDate: this.startDate
      });
      this.successMessage = 'Cronograma de calibración generado.';
      await this.loadSchedules();
      this.viewMode = 'cronogramas';
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo generar el cronograma.';
    }
  }

  async approveSchedule(): Promise<void> {
    if (!this.selectedScheduleId) return;
    try {
      await this.calibration.approveSchedule(this.selectedScheduleId);
      await this.loadSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo aprobar el cronograma.';
    }
  }

  async openSchedulePdf(scheduleId: string): Promise<void> {
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

  async uploadPdf(item: CalibrationItemDto, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    try {
      await this.calibration.uploadPdf(item.id, file);
      await this.loadItems();
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

  async openPdf(item: CalibrationItemDto): Promise<void> {
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

  async deletePdf(item: CalibrationItemDto): Promise<void> {
    if (!confirm('¿Eliminar acta cargada?')) return;
    try {
      await this.calibration.deletePdf(item.id);
      await this.loadItems();
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

  async deleteSchedule(scheduleId: string): Promise<void> {
    if (!confirm('¿Eliminar cronograma?')) return;
    try {
      await this.calibration.deleteSchedule(scheduleId);
      await this.loadSchedules();
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error?.error?.message ?? 'No se pudo eliminar el cronograma.';
    }
  }

  statusLabel(status: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'draft') return 'Borrador';
    if (value === 'approved') return 'Aprobado';
    if (value === 'closed') return 'Cerrado';
    return status;
  }

  itemStatus(item: CalibrationItemDto): string {
    const status = item.display_status ?? item.status;
    if (status === 'done') return 'Completado';
    if (status === 'active') return 'Activo';
    return 'Programado';
  }

  canUploadCalibration(item: CalibrationItemDto): boolean {
    return this.auth.hasPermission('calibration:report:upload') && this.itemStatus(item) === 'Activo';
  }

  async onClientChange(): Promise<void> {
    await this.loadSchedules();
  }

  async onYearChange(): Promise<void> {
    this.selectedScheduleId = '';
    this.items = [];
    await this.loadSchedules();
  }
}
