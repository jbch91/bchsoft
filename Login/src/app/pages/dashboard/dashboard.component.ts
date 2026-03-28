import { ChangeDetectorRef, Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBase, getPublicBase, joinBase } from '../../core/api-base';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly apiBase = getApiBase();
  private readonly publicBase = getPublicBase();
  enabledModules: Set<string> | null = null;
  clientInfo: { name: string; nit: string; city: string; address?: string | null; email: string; logo_path?: string | null } | null = null;
  private loadingClientInfo = false;

  constructor(
    public readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const user = this.auth.currentUser();
      if (user?.clientId) {
        void this.loadClientInfo();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await this.loadModules();
    await this.loadClientInfo();
  }

  async loadModules(): Promise<void> {
    try {
      const token = this.auth.tokens()?.accessToken;
      if (!token) {
        this.enabledModules = null;
        setTimeout(() => {
          void this.loadModules();
        }, 300);
        return;
      }
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
      const rows = await firstValueFrom(
        this.http.get<{ key: string; enabled: boolean }[]>(`${this.apiBase}/modules/me`, { headers })
      );
      this.enabledModules = new Set(rows.filter((row) => row.enabled).map((row) => row.key));
    } catch {
      this.enabledModules = null;
    }
  }

  async loadClientInfo(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.clientId) {
      this.clientInfo = null;
      return;
    }
    if (this.loadingClientInfo) return;
    const token = this.auth.tokens()?.accessToken;
    if (!token) {
      setTimeout(() => {
        void this.loadClientInfo();
      }, 300);
      return;
    }
    try {
      this.loadingClientInfo = true;
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      });
      const client = await firstValueFrom(
        this.http.get<{ name: string; nit: string; city: string; address?: string | null; email: string; logo_path?: string | null }>(
          `${this.apiBase}/clients/me?t=${Date.now()}`,
          { headers }
        )
      );
      this.clientInfo = client;
      this.cdr.detectChanges();
    } catch {
      // keep last known clientInfo to avoid flicker if token refresh delays
    } finally {
      this.loadingClientInfo = false;
    }
  }

  clientLogoUrl(): string | null {
    if (!this.clientInfo?.logo_path) return null;
    if (this.clientInfo.logo_path.startsWith('http')) return this.clientInfo.logo_path;
    return joinBase(this.publicBase, this.clientInfo.logo_path);
  }

  canShow(moduleKey: string): boolean {
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
