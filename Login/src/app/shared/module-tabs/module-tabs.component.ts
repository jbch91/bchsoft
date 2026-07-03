import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { Permission, Role } from '../../auth/models';
import { getApiBase } from '../../core/api-base';

interface ModuleTab {
  label: string;
  route: string;
  moduleKey?: string;
  roles?: Role[];
  permissionsAny?: Permission[];
  hiddenForRoles?: Role[];
  platform?: boolean;
  platformOnly?: boolean;
}

@Component({
  selector: 'app-module-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './module-tabs.component.html',
  styleUrl: './module-tabs.component.scss'
})
export class ModuleTabsComponent implements OnInit {
  private readonly apiBase = getApiBase();
  enabledModules: Set<string> | null = null;

  readonly tabs: ModuleTab[] = [
    {
      label: 'Administración SaaS',
      route: '/administracion-saas',
      moduleKey: 'clientes',
      permissionsAny: [
        'clients:manage',
        'saas:access',
        'saas:clients:view',
        'saas:clients:update',
        'saas:subscriptions:manage',
        'saas:plans:manage',
        'saas:client_admins:reset_password'
      ],
      platform: true
    },
    {
      label: 'Usuarios',
      route: '/usuarios',
      moduleKey: 'usuarios',
      permissionsAny: ['users:manage'],
      platform: true
    },
    {
      label: 'Roles y permisos',
      route: '/roles-permisos',
      permissionsAny: ['users:manage'],
      platform: true
    },
    {
      label: 'Auditoría',
      route: '/auditoria',
      permissionsAny: ['users:manage', 'audit:client:view', 'saas:audit:view'],
      platform: true
    },
    {
      label: 'Hojas de vida',
      route: '/hojas-de-vida',
      moduleKey: 'hojas_de_vida',
      permissionsAny: ['hb:create', 'hb:view', 'read:all'],
      hiddenForRoles: ['lector']
    },
    {
      label: 'Inventario',
      route: '/inventario',
      moduleKey: 'inventario',
      permissionsAny: ['hb:create', 'hb:view', 'read:all']
    },
    {
      label: 'Guías rápidas',
      route: '/guias-rapidas',
      moduleKey: 'guias_rapidas',
      permissionsAny: ['quick_guides:view', 'quick_guides:create', 'quick_guides:edit', 'quick_guides:approve', 'quick_guides:delete', 'hb:view', 'read:all']
    },
    {
      label: 'Mantenimiento',
      route: '/mantenimiento',
      moduleKey: 'reportes_mantenimiento',
      permissionsAny: ['maintenance:request:create', 'maintenance:report:create', 'maintenance:report:sign', 'read:all']
    },
    {
      label: 'Cronogramas',
      route: '/cronogramas',
      moduleKey: 'cronogramas',
      permissionsAny: ['schedules:manage']
    },
    {
      label: 'Calibraciones',
      route: '/calibraciones',
      moduleKey: 'calibraciones',
      permissionsAny: ['calibration:schedule:manage', 'calibration:report:upload', 'read:all']
    },
    {
      label: 'Odontología',
      route: '/odontologia',
      moduleKey: 'odontologia',
      permissionsAny: [
        'software:odontologico:access',
        'odontology:access',
        'odontology:patients:manage',
        'odontology:patients:import',
        'odontology:clinical_records:manage',
        'odontology:appointments:manage',
        'odontology:settings:manage',
        'odontology:odontogram:manage',
        'odontology:periodontogram:manage',
        'odontology:consents:manage',
        'odontology:treatment_plans:manage',
        'odontology:attachments:manage',
        'odontology:inventory:manage',
        'odontology:sterilization:manage',
        'odontology:payments:manage',
        'odontology:financial:view',
        'odontology:prescriptions:manage',
        'odontology:documents:manage',
        'odontology:reports:view'
      ]
    }
  ];

  constructor(
    public readonly auth: AuthService,
    private readonly http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadEnabledModules();
  }

  get visibleTabs(): ModuleTab[] {
    return this.tabs.filter((tab) => this.canOpen(tab));
  }

  private async loadEnabledModules(): Promise<void> {
    try {
      const rows = await firstValueFrom(
        this.http.get<{ key: string; enabled: boolean }[]>(`${this.apiBase}/modules/me`)
      );
      this.enabledModules = new Set(rows.filter((row) => row.enabled).map((row) => row.key));
    } catch {
      this.enabledModules = null;
    }
  }

  private canOpen(tab: ModuleTab): boolean {
    const user = this.auth.currentUser();
    if (this.auth.hasRole('superuser') && !tab.platform) {
      return false;
    }
    if (tab.platformOnly && user?.clientId) {
      return false;
    }
    if (tab.roles && !this.auth.hasRole(tab.roles)) {
      return false;
    }
    if (tab.hiddenForRoles?.some((role) => this.auth.hasRole(role))) {
      return false;
    }
    if (tab.permissionsAny && !tab.permissionsAny.some((permission) => this.auth.hasPermission(permission))) {
      return false;
    }
    if (!tab.moduleKey) {
      return true;
    }
    return this.canShowModule(tab.moduleKey);
  }

  private canShowModule(moduleKey: string): boolean {
    const user = this.auth.currentUser();
    if (!user?.clientId) {
      return true;
    }
    if (!this.enabledModules) {
      return false;
    }
    return this.enabledModules.has(moduleKey);
  }
}
