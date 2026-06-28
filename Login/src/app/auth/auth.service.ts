import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginResult, Permission, Role, User } from './models';
import { getApiBase } from '../core/api-base';

interface LoginResponse {
  user: {
    sub: string;
    username: string;
    displayName: string;
    clientId?: string | null;
    subscription?: User['subscription'];
    roles: Role[];
    permissions: Permission[];
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'auth_user_v1';
  private readonly tokenKey = 'auth_tokens_v1';
  private readonly lastActivityKey = 'auth_last_activity_v1';
  private readonly logoutReasonKey = 'auth_logout_reason_v1';
  private readonly apiBase = getApiBase();
  private readonly idleTimeoutMs = 15 * 60 * 1000;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListenersAttached = false;
  private readonly activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly tokens = signal<{ accessToken: string; refreshToken: string } | null>(
    this.loadStoredTokens()
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.initializeIdleControl();
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, {
          username,
          password
        })
      );

      const role = (response.user.roles[0] ?? 'viewer') as Role;
      const user: User = {
        id: response.user.sub,
        username: response.user.username,
        displayName: response.user.displayName,
        clientId: response.user.clientId ?? null,
        subscription: response.user.subscription ?? null,
        role,
        roles: response.user.roles ?? [role],
        permissions: response.user.permissions
      };

      this.currentUser.set(user);
      this.tokens.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      localStorage.setItem(
        this.tokenKey,
        JSON.stringify({ accessToken: response.accessToken, refreshToken: response.refreshToken })
      );
      this.markActivity();
      this.startIdleTimer();

      return { ok: true };
    } catch (error: any) {
      console.error(error);
      return {
        ok: false,
        message: error?.error?.message ?? 'Usuario o contraseña incorrectos.'
      };
    }
  }

  logout(redirectToLogin = false, reason: 'manual' | 'idle' | 'expired' = 'manual'): void {
    const refreshToken = this.tokens()?.refreshToken;
    if (refreshToken) {
      void firstValueFrom(
        this.http.post(`${this.apiBase}/auth/logout`, { refreshToken })
      ).catch(() => {});
    }

    this.stopIdleTimer();
    this.currentUser.set(null);
    this.tokens.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.lastActivityKey);

    if (redirectToLogin) {
      if (reason !== 'manual') {
        sessionStorage.setItem(this.logoutReasonKey, reason);
      }
      void this.router.navigate(['/login'], {
        queryParams: reason !== 'manual' ? { reason } : undefined
      });
    }
  }

  async refreshSession(): Promise<boolean> {
    const refreshToken = this.tokens()?.refreshToken;
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/refresh`, { refreshToken })
      );

      const role = (response.user.roles[0] ?? 'viewer') as Role;
      const user: User = {
        id: response.user.sub,
        username: response.user.username,
        displayName: response.user.displayName,
        clientId: response.user.clientId ?? null,
        subscription: response.user.subscription ?? null,
        role,
        roles: response.user.roles ?? [role],
        permissions: response.user.permissions
      };

      this.currentUser.set(user);
      this.tokens.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      localStorage.setItem(
        this.tokenKey,
        JSON.stringify({ accessToken: response.accessToken, refreshToken: response.refreshToken })
      );
      this.markActivity();
      this.startIdleTimer();

      return true;
    } catch (error) {
      console.error(error);
      this.logout(true, 'expired');
      return false;
    }
  }

  hasRole(roles: Role[] | Role): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    const userRoles = user.roles?.length ? user.roles : [user.role];
    return userRoles.some((role) => roleList.includes(role));
  }

  hasPermission(permissions: Permission[] | Permission): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    const required = Array.isArray(permissions) ? permissions : [permissions];
    return required.every((permission) => user.permissions.includes(permission));
  }

  private loadStoredUser(): User | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private loadStoredTokens(): { accessToken: string; refreshToken: string } | null {
    const raw = localStorage.getItem(this.tokenKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as { accessToken: string; refreshToken: string };
    } catch {
      return null;
    }
  }

  private initializeIdleControl(): void {
    this.attachActivityListeners();
    if (!this.currentUser()) return;

    if (this.isIdleExpired()) {
      this.logout(true, 'idle');
      return;
    }

    if (!localStorage.getItem(this.lastActivityKey)) {
      this.markActivity();
    }
    this.startIdleTimer();
  }

  private attachActivityListeners(): void {
    if (this.activityListenersAttached || typeof window === 'undefined') return;
    this.activityListenersAttached = true;
    for (const eventName of this.activityEvents) {
      window.addEventListener(eventName, this.handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private readonly handleActivity = (): void => {
    if (!this.currentUser()) return;
    if (this.isIdleExpired()) {
      this.logout(true, 'idle');
      return;
    }
    this.markActivity();
    this.startIdleTimer();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible' || !this.currentUser()) return;
    if (this.isIdleExpired()) {
      this.logout(true, 'idle');
      return;
    }
    this.markActivity();
    this.startIdleTimer();
  };

  private markActivity(): void {
    localStorage.setItem(this.lastActivityKey, String(Date.now()));
  }

  private isIdleExpired(): boolean {
    const raw = localStorage.getItem(this.lastActivityKey);
    if (!raw) return false;
    const lastActivity = Number(raw);
    if (!Number.isFinite(lastActivity)) return false;
    return Date.now() - lastActivity >= this.idleTimeoutMs;
  }

  private startIdleTimer(): void {
    this.stopIdleTimer();
    if (!this.currentUser()) return;

    const raw = localStorage.getItem(this.lastActivityKey);
    const lastActivity = raw ? Number(raw) : Date.now();
    const elapsed = Number.isFinite(lastActivity) ? Date.now() - lastActivity : 0;
    const remaining = Math.max(0, this.idleTimeoutMs - elapsed);

    this.idleTimer = setTimeout(() => {
      this.logout(true, 'idle');
    }, remaining);
  }

  consumeLogoutReason(): 'idle' | 'expired' | null {
    const reason = sessionStorage.getItem(this.logoutReasonKey);
    sessionStorage.removeItem(this.logoutReasonKey);
    return reason === 'idle' || reason === 'expired' ? reason : null;
  }

  private stopIdleTimer(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/auth/forgot-password`, { email }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiBase}/auth/reset-password`, { email, code, newPassword })
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
