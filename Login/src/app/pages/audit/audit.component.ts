import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { getPublicBase, joinBase } from '../../core/api-base';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  address?: string | null;
  email?: string | null;
  logoPath?: string | null;
}

interface AuditView {
  id: string;
  actor: string;
  action: string;
  actionCode: string;
  target: string;
  when: string;
  details: string;
  category: string;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModuleTabsComponent, UserMenuComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss'
})
export class AuditComponent {
  private readonly publicBase = getPublicBase();
  private readonly actionLabels: Record<string, string> = {
    ASSET_CREATE: 'Creación de hoja de vida',
    ASSET_UPDATE: 'Edición de hoja de vida',
    ASSET_DELETE: 'Eliminación de equipo',
    MAINTENANCE_REQUEST_CREATE: 'Solicitud de mantenimiento',
    MAINTENANCE_REQUEST_DELETE: 'Eliminación de solicitud',
    MAINTENANCE_REPORT_CREATE: 'Reporte de mantenimiento',
    MAINTENANCE_REPORT_SIGN: 'Firma de reporte',
    MAINTENANCE_REPORT_FINALIZED: 'Reporte finalizado',
    MAINTENANCE_REPORT_DELETE: 'Eliminación de reporte',
    CALIBRATION_CERTIFICATE_UPLOAD: 'Certificado de calibración',
    TRAINING_RECORD_UPLOAD: 'Acta de capacitación',
    CLIENT_CREATE: 'Creación de cliente',
    CLIENT_UPDATE: 'Edición de cliente',
    CLIENT_DELETE: 'Eliminación de cliente',
    CLIENT_LOGO_UPDATE: 'Logo de cliente',
    CLIENT_MODULES_UPDATE: 'Módulos del cliente',
    USER_CREATE: 'Creación de usuario',
    USER_UPDATE: 'Edición de usuario',
    USER_DELETE: 'Eliminación de usuario',
    USER_ROLE_UPDATE: 'Cambio de rol',
    USER_ACTIVE_UPDATE: 'Estado de usuario',
    USER_PASSWORD_RESET: 'Cambio de contraseña',
    USER_SIGNATURE_UPDATE: 'Firma de usuario',
    READER_ACCESS_UPDATE: 'Accesos lector',
    AREA_CREATE: 'Creación de área',
    AREA_UPDATE: 'Edición de área',
    AREA_DELETE: 'Eliminación de área',
    LOCATION_CREATE: 'Creación de ubicación',
    LOCATION_UPDATE: 'Edición de ubicación',
    LOCATION_DELETE: 'Eliminación de ubicación',
    SCHEDULE_DELETE: 'Eliminación de cronograma'
  };

  logs: AuditView[] = [];
  filteredLogs: AuditView[] = [];
  clients: ClientOption[] = [];
  clientSearchTerm = '';
  selectedClientId = 'todos';
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
      const [logs, clients] = await Promise.all([
        this.admin.listAuditLogs(),
        this.admin.listClients().catch(() => [])
      ]);
      this.clients = clients.map((client) => ({
        id: client.id,
        name: client.name,
        nit: client.nit,
        city: client.city,
        address: client.address ?? null,
        email: client.email,
        logoPath: client.logo_path ?? null
      }));
      this.logs = logs.map((log) => ({
        id: log.id,
        actor: this.formatActor(log.actor_username, log.details),
        action: this.labelAction(log.action),
        actionCode: log.action,
        target: this.formatTarget(log.target_username, log.details),
        when: new Date(log.created_at).toLocaleString(),
        details: this.formatDetails(log.details),
        category: this.categoryLabel(log.details?.['category']),
        createdAt: log.created_at,
        clientId: this.resolveClientId(log.details),
        clientName: this.resolveClientName(log.details)
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
    const set = new Set(this.logs.map((log) => log.actionCode));
    return ['todos', ...Array.from(set)];
  }

  get filteredClients(): ClientOption[] {
    const term = this.clientSearchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter((client) =>
      [client.name, client.nit, client.city, client.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  get selectedClientInfo(): ClientOption | null {
    if (this.selectedClientId === 'todos') return null;
    return this.clients.find((client) => client.id === this.selectedClientId) ?? null;
  }

  clientLogoUrl(client: ClientOption | null): string | null {
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return joinBase(this.publicBase, client.logoPath);
  }

  labelAction(action: string): string {
    return this.actionLabels[action] ?? action;
  }

  applyFilters(): void {
    const from = this.dateFrom ? new Date(this.dateFrom) : null;
    const to = this.dateTo ? new Date(this.dateTo) : null;

    this.filteredLogs = this.logs.filter((log) => {
      if (this.selectedClientId !== 'todos') {
        const selectedClient = this.selectedClientInfo;
        const matchesClientId = log.clientId === this.selectedClientId;
        const matchesClientName = selectedClient?.name && log.clientName === selectedClient.name;
        if (!matchesClientId && !matchesClientName) {
          return false;
        }
      }
      if (this.selectedActor !== 'todos' && log.actor !== this.selectedActor) {
        return false;
      }
      if (this.selectedAction !== 'todos' && log.actionCode !== this.selectedAction) {
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

  private formatActor(username: string | null, details: Record<string, any> | null): string {
    const displayName = details?.['actorDisplayName'];
    const auditUsername = details?.['actorUsername'] ?? username;
    if (displayName && auditUsername && displayName !== auditUsername) {
      return `${displayName} (${auditUsername})`;
    }
    return displayName ?? auditUsername ?? 'Sistema';
  }

  private formatTarget(target: string | null, details: Record<string, any> | null): string {
    const asset = details?.['asset'];
    if (asset?.code || asset?.name) {
      return `${asset.code ? `${asset.code} - ` : ''}${asset.name ?? 'Equipo'}`;
    }
    return target ?? details?.['clientName'] ?? '-';
  }

  private formatDetails(details: Record<string, any> | null): string {
    if (!details) return '-';
    const parts: string[] = [];
    if (details['description']) {
      parts.push(details['description']);
    }
    if (details['clientName']) {
      parts.push(`Cliente: ${details['clientName']}`);
    }
    const asset = details['asset'];
    if (asset?.brand || asset?.model || asset?.serial) {
      parts.push(
        `Equipo: ${[asset.brand, asset.model, asset.serial ? `Serie ${asset.serial}` : null]
          .filter(Boolean)
          .join(' / ')}`
      );
    }
    if (Array.isArray(details['changedFields']) && details['changedFields'].length) {
      parts.push(`Cambios: ${details['changedFields'].map((field: any) => field.label).join(', ')}`);
    }
    if (details['maintenanceType']) {
      parts.push(`Tipo: ${details['maintenanceType']}`);
    }
    if (details['pdfPath']) {
      parts.push('Documento PDF cargado');
    }
    return parts.length ? parts.join(' · ') : JSON.stringify(details);
  }

  private categoryLabel(category?: string): string {
    const labels: Record<string, string> = {
      equipment: 'Equipo',
      training: 'Capacitación'
    };
    return category ? labels[category] ?? category : 'General';
  }

  private resolveClientId(details: Record<string, any> | null): string | null {
    return details?.['clientId'] ?? details?.['client']?.['id'] ?? details?.['asset']?.['clientId'] ?? null;
  }

  private resolveClientName(details: Record<string, any> | null): string | null {
    return details?.['clientName'] ?? details?.['client']?.['name'] ?? null;
  }
}
