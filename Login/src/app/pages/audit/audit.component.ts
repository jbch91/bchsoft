import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';

interface ClientOption {
  id: string;
  name: string;
}

interface AuditView {
  id: string;
  actor: string;
  action: string;
  actionCode: string;
  software: string;
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
  imports: [CommonModule, FormsModule, ModuleTabsComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss'
})
export class AuditComponent {
  private readonly actionLabels: Record<string, string> = {
    ASSET_CREATE: 'Creación de hoja de vida',
    ASSET_UPDATE: 'Edición de hoja de vida',
    ASSET_DELETE: 'Eliminación de equipo',
    MAINTENANCE_REQUEST_CREATE: 'Solicitud de mantenimiento',
    MAINTENANCE_REQUEST_DELETE: 'Eliminación de solicitud',
    MAINTENANCE_REPORT_CREATE: 'Reporte de mantenimiento',
    MAINTENANCE_BLANK_PROTOCOL_PRINT: 'Protocolos físicos en blanco',
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
    CLIENT_SOFTWARE_ACCESS_UPDATE: 'Software del cliente',
    CLIENT_SUBSCRIPTION_UPDATE: 'Cambio de suscripción',
    CLIENT_SUBSCRIPTION_PAYMENT: 'Pago de suscripción',
    CLIENT_ADMIN_CREATE: 'Creación de administrador del cliente',
    CLIENT_ADMIN_PASSWORD_RESET: 'Clave de administrador del cliente',
    SUBSCRIPTION_PLAN_CREATE: 'Creación de plan SaaS',
    SUBSCRIPTION_PLAN_UPDATE: 'Edición de plan SaaS',
    SUBSCRIPTION_PLAN_APPLY_TO_CLIENTS: 'Aplicación de plan SaaS',
    SUBSCRIPTION_UPDATE: 'Actualización interna de suscripción',
    SUBSCRIPTION_PAYMENT_REGISTER: 'Registro interno de pago',
    USER_CREATE: 'Creación de usuario',
    USER_UPDATE: 'Edición de usuario',
    USER_DELETE: 'Eliminación de usuario',
    USER_ROLE_UPDATE: 'Cambio de rol',
    USER_ACTIVE_UPDATE: 'Estado de usuario',
    USER_PASSWORD_RESET: 'Correo de contraseña',
    USER_SIGNATURE_UPDATE: 'Firma de usuario',
    READER_ACCESS_UPDATE: 'Accesos lector',
    CLIENT_ROLE_PERMISSIONS_UPDATE: 'Permisos de rol del cliente',
    AREA_CREATE: 'Creación de área',
    AREA_UPDATE: 'Edición de área',
    AREA_DELETE: 'Eliminación de área',
    LOCATION_CREATE: 'Creación de ubicación',
    LOCATION_UPDATE: 'Edición de ubicación',
    LOCATION_DELETE: 'Eliminación de ubicación',
    SCHEDULE_DELETE: 'Eliminación de cronograma',
    ODONTOLOGY_SITE_CREATE: 'Creación de sede odontológica',
    ODONTOLOGY_SITE_UPDATE: 'Edición de sede odontológica',
    ODONTOLOGY_SETTINGS_UPDATE: 'Actualización de configuración odontológica',
    ODONTOLOGY_CATALOG_ITEM_CREATE: 'Creación de catálogo odontológico',
    ODONTOLOGY_CATALOG_ITEM_UPDATE: 'Edición de catálogo odontológico',
    ODONTOLOGY_PROCEDURE_TYPE_CREATE: 'Creación de procedimiento odontológico',
    ODONTOLOGY_PROCEDURE_TYPE_UPDATE: 'Edición de procedimiento odontológico',
    ODONTOLOGY_CHAIR_CREATE: 'Creación de unidad odontológica',
    ODONTOLOGY_CHAIR_UPDATE: 'Edición de unidad odontológica',
    ODONTOLOGY_APPOINTMENT_CREATE: 'Creación de cita odontológica',
    ODONTOLOGY_APPOINTMENT_UPDATE: 'Edición de cita odontológica',
    ODONTOLOGY_CLINICAL_RECORD_CREATE: 'Creación de historia clínica odontológica',
    ODONTOLOGY_CLINICAL_RECORD_UPDATE: 'Edición de historia clínica odontológica',
    ODONTOLOGY_CLINICAL_RECORD_SIGN: 'Firma de historia clínica odontológica',
    ODONTOLOGY_TREATMENT_PLAN_CREATE: 'Creación de plan de tratamiento',
    ODONTOLOGY_TREATMENT_PLAN_UPDATE: 'Edición de plan de tratamiento',
    ODONTOLOGY_PAYMENT_CREATE: 'Registro de pago odontológico',
    ODONTOLOGY_PAYMENT_VOID: 'Anulación de pago odontológico',
    ODONTOLOGY_MEDICATION_CREATE: 'Creación de medicamento odontológico',
    ODONTOLOGY_PRESCRIPTION_CREATE: 'Creación de receta odontológica',
    ODONTOLOGY_CLINICAL_DOCUMENT_CREATE: 'Creación de documento clínico odontológico',
    ODONTOLOGY_ATTACHMENT_UPLOAD: 'Carga de adjunto odontológico',
    ODONTOLOGY_ATTACHMENT_DELETE: 'Eliminación de adjunto odontológico',
    ODONTOLOGY_INVENTORY_ITEM_CREATE: 'Creación de insumo odontológico',
    ODONTOLOGY_INVENTORY_ITEM_UPDATE: 'Edición de insumo odontológico',
    ODONTOLOGY_INVENTORY_MOVEMENT_CREATE: 'Movimiento de inventario odontológico',
    ODONTOLOGY_PROCEDURE_KIT_UPDATE: 'Actualización de kit por procedimiento',
    ODONTOLOGY_INSTRUMENT_CREATE: 'Creación de instrumental',
    ODONTOLOGY_INSTRUMENT_UPDATE: 'Edición de instrumental',
    ODONTOLOGY_STERILIZATION_CYCLE_CREATE: 'Registro de esterilización',
    ODONTOLOGY_CONSENT_TEMPLATE_CREATE: 'Creación de plantilla de consentimiento',
    ODONTOLOGY_CONSENT_TEMPLATE_UPDATE: 'Edición de plantilla de consentimiento',
    ODONTOLOGY_CONSENT_CREATE: 'Creación de consentimiento',
    ODONTOLOGY_CONSENT_SIGN: 'Firma de consentimiento',
    ODONTOLOGY_ODONTOGRAM_ENTRY_CREATE: 'Registro de odontograma',
    ODONTOLOGY_PERIODONTOGRAM_CREATE: 'Creación de periodontograma',
    ODONTOLOGY_PATIENT_CREATE: 'Creación de paciente odontológico',
    ODONTOLOGY_PATIENT_IMPORT: 'Importación masiva de pacientes',
    ODONTOLOGY_PATIENT_UPDATE: 'Edición de paciente odontológico'
  };

  logs: AuditView[] = [];
  filteredLogs: AuditView[] = [];
  clients: ClientOption[] = [];
  searchTerm = '';
  selectedClientId = 'todos';
  loading = false;
  errorMessage = '';
  selectedActor = 'todos';
  selectedAction = 'todos';
  selectedSoftware = 'todos';
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
        name: client.name
      }));
      this.logs = logs.map((log) => ({
        id: log.id,
        actor: this.formatActor(log.actor_username, log.details),
        action: this.labelAction(log.action),
        actionCode: log.action,
        software: this.softwareLabel(log.action),
        target: this.formatTarget(log.action, log.target_username, log.details),
        when: new Date(log.created_at).toLocaleString(),
        details: this.formatDetails(log.action, log.details),
        category: this.categoryLabel(log.action, log.details?.['category']),
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

  get softwares(): string[] {
    const set = new Set(this.logs.map((log) => log.software));
    return ['todos', ...Array.from(set)];
  }

  labelAction(action: string): string {
    return this.actionLabels[action] ?? action;
  }

  applyFilters(): void {
    const from = this.dateFrom ? new Date(this.dateFrom) : null;
    const to = this.dateTo ? new Date(this.dateTo) : null;
    const term = this.searchTerm.toLowerCase().trim();

    this.filteredLogs = this.logs.filter((log) => {
      if (term) {
        const haystack = [
          log.actor,
          log.action,
          log.actionCode,
          log.software,
          log.target,
          log.details,
          log.category,
          log.clientName
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      if (this.selectedClientId !== 'todos') {
        const selectedClient = this.clients.find((client) => client.id === this.selectedClientId);
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
      if (this.selectedSoftware !== 'todos' && log.software !== this.selectedSoftware) {
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

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  private formatActor(username: string | null, details: Record<string, any> | null): string {
    const displayName = details?.['actorDisplayName'];
    const auditUsername = details?.['actorUsername'] ?? username;
    if (displayName && auditUsername && displayName !== auditUsername) {
      return `${displayName} (${auditUsername})`;
    }
    return displayName ?? auditUsername ?? 'Sistema';
  }

  private formatTarget(action: string, target: string | null, details: Record<string, any> | null): string {
    const asset = details?.['asset'];
    if (asset?.code || asset?.name) {
      return `${asset.code ? `${asset.code} - ` : ''}${asset.name ?? 'Equipo'}`;
    }
    if (action.startsWith('ODONTOLOGY_')) {
      if (details?.['internalCode']) return `Paciente ${details['internalCode']}`;
      if (details?.['patientId']) return `Paciente ${this.shortId(details['patientId'])}`;
      if (details?.['appointmentId']) return `Cita ${this.shortId(details['appointmentId'])}`;
      if (details?.['catalogItemId']) return `Catálogo ${details['name'] ?? this.shortId(details['catalogItemId'])}`;
      if (details?.['procedureTypeId']) return `Procedimiento ${details['name'] ?? this.shortId(details['procedureTypeId'])}`;
      if (details?.['siteId']) return `Sede ${details['name'] ?? this.shortId(details['siteId'])}`;
      if (details?.['chairId']) return `Unidad ${details['name'] ?? this.shortId(details['chairId'])}`;
      if (details?.['itemId']) return `Inventario ${this.shortId(details['itemId'])}`;
      if (details?.['instrumentId']) return `Instrumental ${this.shortId(details['instrumentId'])}`;
    }
    if (action.startsWith('SUBSCRIPTION_PLAN_')) {
      const plan = details?.['plan'];
      return plan?.name ?? details?.['planKey'] ?? 'Plan SaaS';
    }
    if (action.startsWith('CLIENT_SUBSCRIPTION') || action === 'SUBSCRIPTION_UPDATE' || action === 'SUBSCRIPTION_PAYMENT_REGISTER') {
      return target ?? details?.['clientName'] ?? `Cliente ${this.shortId(details?.['clientId'])}`;
    }
    if (
      action === 'CLIENT_SOFTWARE_ACCESS_UPDATE' ||
      action === 'CLIENT_MODULES_UPDATE' ||
      action === 'CLIENT_LOGO_UPDATE' ||
      action === 'CLIENT_ROLE_PERMISSIONS_UPDATE'
    ) {
      return target ?? details?.['clientName'] ?? `Cliente ${this.shortId(details?.['clientId'])}`;
    }
    if (action.startsWith('CLIENT_ADMIN_')) {
      return target ?? details?.['initialAdminUsername'] ?? details?.['email'] ?? 'Administrador del cliente';
    }
    return target ?? details?.['clientName'] ?? '-';
  }

  private formatDetails(action: string, details: Record<string, any> | null): string {
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
    if (details['planKey']) {
      parts.push(`Plan: ${details['planKey']}`);
    }
    if (details['billingCycle']) {
      parts.push(`Ciclo: ${details['billingCycle'] === 'annual' ? 'Anual' : 'Mensual'}`);
    }
    if (details['affected_clients'] != null) {
      parts.push(`Clientes afectados: ${details['affected_clients']}`);
    }
    if (details['initialAdminUsername']) {
      parts.push(`Administrador inicial: ${details['initialAdminUsername']}`);
    }
    if (details['email'] && action.startsWith('CLIENT_ADMIN_')) {
      parts.push(`Correo: ${details['email']}`);
    }
    if (details['payment']?.amount != null) {
      parts.push(`Pago: ${details['payment'].amount} ${details['payment'].currency ?? ''}`.trim());
    }
    if (details['payment']?.period_end) {
      parts.push(`Cubre hasta: ${this.formatDateOnly(details['payment'].period_end)}`);
    }
    if (details['subscription']?.plan_name) {
      parts.push(`Suscripción: ${details['subscription'].plan_name}`);
    }
    if (details['subscription']?.effective_status) {
      parts.push(`Estado: ${this.subscriptionStatusLabel(details['subscription'].effective_status)}`);
    }
    if (Array.isArray(details['modules'])) {
      parts.push(`Módulos: ${details['modules'].length}`);
    }
    if (Array.isArray(details['suites'])) {
      const enabled = details['suites'].filter((suite: any) => suite?.enabled).length;
      parts.push(`Softwares activos: ${enabled}`);
    }
    if (action === 'CLIENT_ROLE_PERMISSIONS_UPDATE') {
      if (details['role']) parts.push(`Rol: ${this.roleLabel(String(details['role']))}`);
      if (Array.isArray(details['permissions'])) parts.push(`Permisos activos: ${details['permissions'].length}`);
    }
    if (details['maintenanceType']) {
      parts.push(`Tipo: ${details['maintenanceType']}`);
    }
    if (details['pdfPath']) {
      parts.push('Documento PDF cargado');
    }
    if (action.startsWith('ODONTOLOGY_')) {
      if (details['internalCode']) parts.push(`Código paciente: ${details['internalCode']}`);
      if (details['patientId']) parts.push(`Paciente ID: ${this.shortId(details['patientId'])}`);
      if (details['appointmentId']) parts.push(`Cita ID: ${this.shortId(details['appointmentId'])}`);
      if (details['clinicalRecordId']) parts.push(`Historia clínica ID: ${this.shortId(details['clinicalRecordId'])}`);
      if (details['treatmentPlanId']) parts.push(`Plan ID: ${this.shortId(details['treatmentPlanId'])}`);
      if (details['prescriptionId']) parts.push(`Receta ID: ${this.shortId(details['prescriptionId'])}`);
      if (details['documentId']) parts.push(`Documento ID: ${this.shortId(details['documentId'])}`);
      if (details['consentId']) parts.push(`Consentimiento ID: ${this.shortId(details['consentId'])}`);
      if (details['paymentId']) parts.push(`Pago ID: ${this.shortId(details['paymentId'])}`);
      if (details['catalogType']) parts.push(`Catálogo: ${details['catalogType']}`);
      if (details['procedureTypeId']) parts.push(`Procedimiento ID: ${this.shortId(details['procedureTypeId'])}`);
      if (details['imported']) parts.push(`Registros importados: ${details['imported']}`);
      if (details['defaultLandingPage']) parts.push(`Página inicial: ${details['defaultLandingPage']}`);
      if (details['status']) parts.push(`Estado: ${details['status']}`);
      if (details['totalAmount']) parts.push(`Valor: ${details['totalAmount']}`);
      if (details['amount']) parts.push(`Valor: ${details['amount']}`);
    }
    return parts.length ? parts.join(' · ') : JSON.stringify(details);
  }

  private categoryLabel(action: string, category?: string): string {
    const labels: Record<string, string> = {
      equipment: 'Equipo',
      training: 'Capacitación',
      odontology: 'Odontología'
    };
    if (category) return labels[category] ?? category;
    if (action.startsWith('ODONTOLOGY_PATIENT')) return 'Paciente';
    if (
      action.startsWith('ODONTOLOGY_SETTINGS') ||
      action.startsWith('ODONTOLOGY_SITE') ||
      action.startsWith('ODONTOLOGY_CHAIR') ||
      action.startsWith('ODONTOLOGY_CATALOG') ||
      action.startsWith('ODONTOLOGY_PROCEDURE_TYPE')
    ) return 'Configuración';
    if (action.startsWith('ODONTOLOGY_APPOINTMENT')) return 'Agenda';
    if (action.startsWith('ODONTOLOGY_CLINICAL') || action.includes('ODONTOGRAM') || action.includes('PERIODONTOGRAM')) return 'Clínico';
    if (action.includes('CONSENT')) return 'Consentimiento';
    if (action.includes('INVENTORY') || action.includes('PROCEDURE_KIT')) return 'Inventario';
    if (action.includes('STERILIZATION') || action.includes('INSTRUMENT')) return 'Esterilización';
    if (action.includes('PAYMENT')) return 'Pagos';
    if (action.includes('PRESCRIPTION') || action.includes('MEDICATION')) return 'Recetas';
    if (action.startsWith('SUBSCRIPTION_PLAN_')) return 'Planes SaaS';
    if (action.startsWith('CLIENT_SUBSCRIPTION') || action.startsWith('SUBSCRIPTION_')) return 'Suscripciones';
    if (action === 'CLIENT_SOFTWARE_ACCESS_UPDATE' || action === 'CLIENT_MODULES_UPDATE' || action === 'CLIENT_LOGO_UPDATE') return 'Personalización';
    if (action === 'CLIENT_ROLE_PERMISSIONS_UPDATE') return 'Usuarios';
    if (action.startsWith('CLIENT_ADMIN_')) return 'Administradores';
    return 'General';
  }

  private softwareLabel(action: string): string {
    if (action.startsWith('ODONTOLOGY_')) return 'Odontológico';
    if (
      action.startsWith('SUBSCRIPTION_') ||
      action.startsWith('CLIENT_SUBSCRIPTION') ||
      action.startsWith('CLIENT_ADMIN_') ||
      action === 'CLIENT_SOFTWARE_ACCESS_UPDATE' ||
      action === 'CLIENT_LOGO_UPDATE'
    ) {
      return 'SaaS';
    }
    if (
      action.startsWith('ASSET_') ||
      action.startsWith('MAINTENANCE_') ||
      action.startsWith('SCHEDULE_') ||
      action.startsWith('CALIBRATION_') ||
      action.startsWith('TRAINING_') ||
      action.startsWith('QUICK_GUIDE') ||
      ['SITE_CREATE', 'SITE_UPDATE', 'SITE_DELETE', 'AREA_CREATE', 'AREA_UPDATE', 'AREA_DELETE', 'LOCATION_CREATE', 'LOCATION_UPDATE', 'LOCATION_DELETE'].includes(action)
    ) {
      return 'Biomédico';
    }
    if (action.startsWith('CLIENT_') || action.startsWith('USER_') || action.startsWith('READER_')) return 'Administración';
    return 'Sistema';
  }

  private roleLabel(role: string): string {
    const labels: Record<string, string> = {
      almacenista: 'Almacenista',
      ingeniero_biomedico: 'Ingeniero biomédico',
      calibracion: 'Calibración',
      lector: 'Lector',
      odontologo: 'Odontólogo',
      auxiliar_odontologia: 'Auxiliar odontología',
      recepcion_odontologia: 'Recepción odontología',
      admin_odontologia: 'Admin odontología',
      auditor_odontologia: 'Auditor odontología',
      bacteriologo: 'Bacteriólogo',
      auxiliar_laboratorio: 'Auxiliar laboratorio'
    };
    return labels[role] ?? role;
  }

  private subscriptionStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Activo',
      grace: 'En gracia',
      read_only: 'Solo lectura',
      suspended: 'Suspendido',
      cancelled: 'Cancelado'
    };
    return labels[status] ?? status;
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  }

  private shortId(value: unknown): string {
    const text = String(value || '');
    if (!text) return '-';
    return text.length > 8 ? text.slice(0, 8) : text;
  }

  private resolveClientId(details: Record<string, any> | null): string | null {
    return details?.['clientId'] ?? details?.['client']?.['id'] ?? details?.['asset']?.['clientId'] ?? null;
  }

  private resolveClientName(details: Record<string, any> | null): string | null {
    return details?.['clientName'] ?? details?.['client']?.['name'] ?? null;
  }
}
