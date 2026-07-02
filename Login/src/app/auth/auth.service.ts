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
  private readonly logoutReasonKey = 'auth_logout_reason_v1';
  private readonly apiBase = getApiBase();

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly tokens = signal<{ accessToken: string; refreshToken: string } | null>(
    this.loadStoredTokens()
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

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

      return { ok: true };
    } catch (error: any) {
      console.error(error);
      return {
        ok: false,
        message: error?.error?.message ?? 'Usuario o contraseña incorrectos.'
      };
    }
  }

  logout(
    redirectToLogin = false,
    reason: 'manual' | 'expired' | 'inactive' | 'replaced' = 'manual'
  ): void {
    const refreshToken = this.tokens()?.refreshToken;
    if (refreshToken) {
      void firstValueFrom(
        this.http.post(`${this.apiBase}/auth/logout`, { refreshToken })
      ).catch(() => {});
    }

    this.currentUser.set(null);
    this.tokens.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.tokenKey);

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

      return true;
    } catch (error: any) {
      console.error(error);
      const reason = error?.error?.code === 'SESSION_REPLACED' ? 'replaced' : 'expired';
      this.logout(true, reason);
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

  consumeLogoutReason(): 'expired' | 'inactive' | 'replaced' | null {
    const reason = sessionStorage.getItem(this.logoutReasonKey);
    sessionStorage.removeItem(this.logoutReasonKey);
    return reason === 'expired' || reason === 'inactive' || reason === 'replaced' ? reason : null;
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
