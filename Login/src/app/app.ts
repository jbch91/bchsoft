import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, effect, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { SessionTimeoutService } from './auth/session-timeout.service';
import { getApiBase, getPublicBase, joinBase } from './core/api-base';
import { UserMenuComponent } from './shared/user-menu/user-menu.component';

interface ShellClientInfo {
  name: string;
  nit: string;
  city: string;
  address?: string | null;
  email: string;
  logo_path?: string | null;
}

interface ShellSoftwareSuite {
  key: string;
  name: string;
  enabled: boolean;
}

interface ShellSubscription {
  effective_status: string;
  effective_access_mode: string;
  is_read_only: boolean;
  is_blocked: boolean;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, UserMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  protected readonly title = signal('Login');
  currentPath = '/login';
  clientInfo: ShellClientInfo | null = null;
  softwareSuites: ShellSoftwareSuite[] = [];
  subscription: ShellSubscription | null = null;
  private loadingShellData = false;

  private readonly routeCopy: Record<string, { title: string; subtitle: string; eyebrow: string }> = {
    '/dashboard': {
      eyebrow: 'Inicio',
      title: 'Menú principal',
      subtitle: 'Accesos disponibles según licencia, rol y permisos.'
    },
    '/administracion-saas': {
      eyebrow: 'Plataforma',
      title: 'Administración SaaS',
      subtitle: 'Clientes, planes, suscripciones y control comercial.'
    },
    '/catalogo-biomedico': {
      eyebrow: 'Plataforma',
      title: 'Catálogo biomédico',
      subtitle: 'Gobierno global de equipos, marcas y modelos.'
    },
    '/clientes': {
      eyebrow: 'Plataforma',
      title: 'Clientes',
      subtitle: 'Gestión de cartera y datos comerciales.'
    },
    '/clientes/nuevo': {
      eyebrow: 'Plataforma',
      title: 'Crear cliente',
      subtitle: 'Registro comercial y acceso inicial.'
    },
    '/clientes/administrar': {
      eyebrow: 'Plataforma',
      title: 'Administrar cliente',
      subtitle: 'Detalle operativo y administración del cliente.'
    },
    '/usuarios': {
      eyebrow: 'Seguridad',
      title: 'Usuarios',
      subtitle: 'Cuentas, roles, permisos y accesos.'
    },
    '/roles-permisos': {
      eyebrow: 'Seguridad',
      title: 'Roles y permisos',
      subtitle: 'Alcances de acceso por rol.'
    },
    '/auditoria': {
      eyebrow: 'Trazabilidad',
      title: 'Auditoría',
      subtitle: 'Eventos, cambios y acciones del sistema.'
    },
    '/hojas-de-vida': {
      eyebrow: 'Biomédico',
      title: 'Hojas de vida',
      subtitle: 'Registro técnico e historial de equipos.'
    },
    '/inventario': {
      eyebrow: 'Biomédico',
      title: 'Inventario',
      subtitle: 'Equipos, ubicación y control de activos.'
    },
    '/sedes-areas-ubicaciones': {
      eyebrow: 'Biomédico',
      title: 'Sedes, áreas y ubicaciones',
      subtitle: 'Estructura física del cliente para la ubicación de equipos.'
    },
    '/guias-rapidas': {
      eyebrow: 'Biomédico',
      title: 'Guías rápidas',
      subtitle: 'Guías por marca y modelo para operación segura.'
    },
    '/mantenimiento': {
      eyebrow: 'Biomédico',
      title: 'Mantenimiento',
      subtitle: 'Solicitudes, preventivos, correctivos y firmas.'
    },
    '/cronogramas': {
      eyebrow: 'Biomédico',
      title: 'Cronogramas',
      subtitle: 'Preventivos, capacitaciones y control documental.'
    },
    '/calibraciones': {
      eyebrow: 'Biomédico',
      title: 'Calibraciones',
      subtitle: 'Cronograma y certificados de calibración.'
    },
    '/odontologia': {
      eyebrow: 'Odontológico',
      title: 'Odontología',
      subtitle: 'Pacientes, agenda, historia clínica y documentos.'
    },
    '/reportes': {
      eyebrow: 'Gestión',
      title: 'Reportes',
      subtitle: 'Indicadores y reportes disponibles.'
    },
    '/no-autorizado': {
      eyebrow: 'Acceso',
      title: 'No autorizado',
      subtitle: 'La cuenta no tiene permisos para esta sección.'
    }
  };

  constructor(
    public readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly sessionTimeout: SessionTimeoutService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.currentPath = this.router.url.split('?')[0];
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath = event.urlAfterRedirects.split('?')[0];
        this.scheduleShellDataLoad();
      });

    effect(() => {
      const user = this.auth.currentUser();
      if (!user) {
        this.sessionTimeout.stop();
        this.clientInfo = null;
        this.softwareSuites = [];
        this.subscription = null;
        return;
      }
      this.sessionTimeout.start();
      this.scheduleShellDataLoad();
    });
  }

  shellVisible(): boolean {
    return Boolean(this.auth.isAuthenticated() && !this.currentPath.startsWith('/login'));
  }

  routeEyebrow(): string {
    return this.routeInfo().eyebrow;
  }

  routeTitle(): string {
    return this.routeInfo().title;
  }

  routeSubtitle(): string {
    return this.routeInfo().subtitle;
  }

  clientLogoUrl(): string | null {
    if (!this.clientInfo?.logo_path) return null;
    if (this.clientInfo.logo_path.startsWith('http')) return this.clientInfo.logo_path;
    return joinBase(this.publicBase, this.clientInfo.logo_path);
  }

  footerEnvironmentLabel(): string {
    const path = this.currentPath;
    if (path === '/odontologia') return 'Software odontológico';
    if (['/hojas-de-vida', '/inventario', '/sedes-areas-ubicaciones', '/guias-rapidas', '/mantenimiento', '/cronogramas', '/calibraciones'].includes(path)) {
      return 'Software biomédico';
    }
    if (
      path.startsWith('/administracion-saas')
      || path.startsWith('/clientes')
      || path.startsWith('/catalogo-biomedico')
    ) return 'Administración SaaS';
    return this.routeTitle();
  }

  footerStatusLabel(): string {
    if (!this.subscription) return 'Sesión activa';
    if (this.subscription.is_blocked) return 'Acceso bloqueado';
    if (this.subscription.is_read_only) return 'Solo lectura';
    const labels: Record<string, string> = {
      active: 'Suscripción activa',
      grace: 'Periodo de gracia',
      suspended: 'Suspendida',
      cancelled: 'Cancelada'
    };
    return labels[this.subscription.effective_status] || 'Sesión activa';
  }

  footerModulesLabel(): string {
    const enabled = this.softwareSuites.filter((suite) => suite.enabled).length;
    if (enabled > 0) {
      return `${enabled} software${enabled === 1 ? '' : 's'}`;
    }
    return this.auth.currentUser()?.clientId ? 'Según permisos' : 'Plataforma';
  }

  private routeInfo(): { title: string; subtitle: string; eyebrow: string } {
    return this.routeCopy[this.currentPath] ?? {
      eyebrow: 'Sistema',
      title: 'INBIHOSPITALARIO',
      subtitle: 'Plataforma de gestión hospitalaria.'
    };
  }

  private scheduleShellDataLoad(): void {
    setTimeout(() => {
      void this.loadShellData();
    }, 0);
  }

  private async loadShellData(): Promise<void> {
    if (this.loadingShellData || !this.shellVisible()) return;
    const token = this.auth.tokens()?.accessToken;
    const user = this.auth.currentUser();
    if (!token || !user) return;

    try {
      this.loadingShellData = true;
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      });
      const nextSoftwareSuites = await firstValueFrom(
        this.http.get<ShellSoftwareSuite[]>(`${this.apiBase}/software-suites/me?t=${Date.now()}`, { headers })
      ).catch(() => []);

      let nextClientInfo: ShellClientInfo | null = null;
      let nextSubscription: ShellSubscription | null = null;

      if (user.clientId) {
        [nextClientInfo, nextSubscription] = await Promise.all([
          firstValueFrom(
            this.http.get<ShellClientInfo>(`${this.apiBase}/clients/me?t=${Date.now()}`, { headers })
          ).catch(() => this.clientInfo),
          firstValueFrom(
            this.http.get<ShellSubscription | null>(`${this.apiBase}/subscription/me?t=${Date.now()}`, { headers })
          ).catch(() => null)
        ]);
      }

      setTimeout(() => {
        if (this.auth.currentUser()?.id !== user.id || !this.shellVisible()) return;
        this.softwareSuites = nextSoftwareSuites;
        this.clientInfo = user.clientId ? nextClientInfo : null;
        this.subscription = user.clientId ? nextSubscription : null;
        this.cdr.detectChanges();
      }, 0);
    } finally {
      this.loadingShellData = false;
    }
  }
}
