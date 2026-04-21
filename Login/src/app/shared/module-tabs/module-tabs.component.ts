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
      label: 'Clientes',
      route: '/clientes',
      moduleKey: 'clientes',
      roles: ['superuser']
    },
    {
      label: 'Usuarios',
      route: '/usuarios',
      moduleKey: 'usuarios',
      roles: ['superuser']
    },
    {
      label: 'Auditoría',
      route: '/auditoria',
      moduleKey: 'auditoria',
      permissionsAny: ['users:manage']
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
      return true;
    }
    return this.enabledModules.has(moduleKey);
  }
}
