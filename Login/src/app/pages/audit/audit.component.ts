import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';

interface AuditView {
  id: string;
  actor: string;
  action: string;
  target: string;
  when: string;
  details: string;
  createdAt: string;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss'
})
export class AuditComponent {
  logs: AuditView[] = [];
  filteredLogs: AuditView[] = [];
  loading = false;
  errorMessage = '';
  selectedActor = 'todos';
  selectedAction = 'todos';
  dateFrom = '';
  dateTo = '';

  constructor(private readonly admin: AdminService, private readonly cdr: ChangeDetectorRef) {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const logs = await this.admin.listAuditLogs();
      this.logs = logs.map((log) => ({
        id: log.id,
        actor: log.actor_username ?? 'Sistema',
        action: log.action,
        target: log.target_username ?? '-',
        when: new Date(log.created_at).toLocaleString(),
        details: log.details ? JSON.stringify(log.details) : '-',
        createdAt: log.created_at
      }));
      this.applyFilters();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la auditoría.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get actors(): string[] {
    const set = new Set(this.logs.map((log) => log.actor));
    return ['todos', ...Array.from(set)];
  }

  get actions(): string[] {
    const set = new Set(this.logs.map((log) => log.action));
    return ['todos', ...Array.from(set)];
  }

  applyFilters(): void {
    const from = this.dateFrom ? new Date(this.dateFrom) : null;
    const to = this.dateTo ? new Date(this.dateTo) : null;

    this.filteredLogs = this.logs.filter((log) => {
      if (this.selectedActor !== 'todos' && log.actor !== this.selectedActor) {
        return false;
      }
      if (this.selectedAction !== 'todos' && log.action !== this.selectedAction) {
        return false;
      }
      if (from) {
        const created = new Date(log.createdAt);
        if (created < from) {
          return false;
        }
      }
      if (to) {
        const created = new Date(log.createdAt);
        if (created > new Date(to.getTime() + 24 * 60 * 60 * 1000)) {
          return false;
        }
      }
      return true;
    });
    this.cdr.detectChanges();
  }
}
