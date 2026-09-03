import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { getApiBase } from '../core/api-base';
import { LoginResult, Permission, Role, User } from './models';

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

interface CurrentUserResponse {
  user: LoginResponse['user'];
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthBroadcastMessage {
  source: string;
  type: 'session-updated' | 'logout';
  reason?: LogoutReason;
}

interface BrowserLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export type SessionState = 'checking' | 'ready' | 'connection-error';
export type LogoutReason = 'manual' | 'expired' | 'inactive' | 'replaced';

export interface ActiveSession {
  id: string;
  device: string;
  startedAt: string;
  lastSeenAt: string;
  ipAddress: string | null;
  current: boolean;
}

export interface ActiveSessionsResponse {
  maxActiveSessions: number;
  sessions: ActiveSession[];
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly storageKey = 'auth_user_v1';
  private readonly tokenKey = 'auth_tokens_v1';
  private readonly lastActivityKey = 'auth_last_activity_v1';
  private readonly logoutReasonKey = 'auth_logout_reason_v1';
  private readonly channelName = 'inbi-auth-v1';
  private readonly refreshLockName = 'inbi-auth-refresh-v1';
  private readonly apiBase = getApiBase();
  private readonly instanceId = this.createInstanceId();
  private broadcastChannel: BroadcastChannel | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private initializationPromise: Promise<boolean> | null = null;
  private storageSyncScheduled = false;

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly tokens = signal<StoredTokens | null>(this.loadStoredTokens());
  readonly sessionState = signal<SessionState>(
    this.currentUser() && this.tokens() ? 'checking' : 'ready'
  );
  readonly sessionValidationMessage = signal('');

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key !== this.storageKey && event.key !== this.tokenKey) return;
    this.scheduleStorageSync();
  };

  private readonly onBroadcast = (event: MessageEvent<AuthBroadcastMessage>): void => {
    const message = event.data;
    if (!message || message.source === this.instanceId) return;

    if (message.type === 'logout') {
      this.clearLocalSession(message.reason ?? 'manual', true, false);
      return;
    }
    this.syncFromStorage();
  };

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    const hasPartialOrInvalidStorage = Boolean(
      localStorage.getItem(this.storageKey) || localStorage.getItem(this.tokenKey)
    ) && (!this.currentUser() || !this.tokens());

    if (hasPartialOrInvalidStorage || Boolean(this.currentUser()) !== Boolean(this.tokens())) {
      this.clearLocalSession('expired', false, false);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage);
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.addEventListener('message', this.onBroadcast);
      }
    }

    if (this.isAuthenticated()) {
      queueMicrotask(() => void this.initializeSession());
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage);
    }
    this.broadcastChannel?.removeEventListener('message', this.onBroadcast);
    this.broadcastChannel?.close();
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null && this.tokens() !== null;
  }

  async initializeSession(force = false): Promise<boolean> {
    if (!this.isAuthenticated()) {
      this.sessionState.set('ready');
      this.sessionValidationMessage.set('');
      return false;
    }
    if (!force && this.sessionState() === 'ready') return true;
    if (this.initializationPromise) return this.initializationPromise;

    this.sessionState.set('checking');
    this.sessionValidationMessage.set('');
    const expectedRefreshToken = this.tokens()?.refreshToken;

    this.initializationPromise = (async () => {
      try {
        const response = await firstValueFrom(
          this.http.get<CurrentUserResponse>(`${this.apiBase}/auth/me?t=${Date.now()}`)
        );

        if (!expectedRefreshToken || this.tokens()?.refreshToken !== expectedRefreshToken) {
          return this.isAuthenticated();
        }

        this.persistUser(this.userFromResponse(response.user), true);
        this.sessionState.set('ready');
        return true;
      } catch (error) {
        if (this.sessionState() === 'connection-error' || this.isTransientSessionError(error)) {
          this.setConnectionError();
          return false;
        }

        if (this.isAuthenticated()) {
          this.clearLocalSession('expired', true, true);
        }
        return false;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, { username, password })
      );

      this.persistSession(
        this.userFromResponse(response.user),
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        true,
        true
      );
      return { ok: true };
    } catch (error: any) {
      console.error(error);
      const connectionFailed = error?.status === 0 || error?.status >= 500;
      return {
        ok: false,
        message: connectionFailed
          ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta nuevamente.'
          : error?.error?.message ?? 'Usuario o contraseña incorrectos.'
      };
    }
  }

  logout(redirectToLogin = false, reason: LogoutReason = 'manual'): void {
    const refreshToken = this.tokens()?.refreshToken;
    if (refreshToken) {
      void firstValueFrom(
        this.http.post(`${this.apiBase}/auth/logout`, { refreshToken })
      ).catch(() => {});
    }

    this.clearLocalSession(reason, redirectToLogin, true);
  }

  handleSessionFailure(code?: string): void {
    const reason: LogoutReason = code === 'SESSION_REPLACED' ? 'replaced' : 'expired';
    this.clearLocalSession(reason, true, true);
  }

  handleConnectionFailure(): void {
    if (this.isAuthenticated()) this.setConnectionError();
  }

  async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshWithDeviceLock()
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  async reloadCurrentUser(): Promise<boolean> {
    const expectedRefreshToken = this.tokens()?.refreshToken;
    if (!expectedRefreshToken) return false;

    try {
      const response = await firstValueFrom(
        this.http.get<CurrentUserResponse>(`${this.apiBase}/auth/me?t=${Date.now()}`)
      );
      if (this.tokens()?.refreshToken !== expectedRefreshToken) {
        return this.isAuthenticated();
      }
      this.persistUser(this.userFromResponse(response.user), true);
      this.sessionState.set('ready');
      this.sessionValidationMessage.set('');
      return true;
    } catch (error) {
      if (this.sessionState() === 'connection-error' || this.isTransientSessionError(error)) {
        this.setConnectionError();
      }
      return false;
    }
  }

  async listActiveSessions(): Promise<ActiveSessionsResponse> {
    return firstValueFrom(
      this.http.get<ActiveSessionsResponse>(`${this.apiBase}/auth/sessions?t=${Date.now()}`)
    );
  }

  async revokeActiveSession(sessionId: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.delete<{ ok: boolean; revoked: boolean }>(
        `${this.apiBase}/auth/sessions/${encodeURIComponent(sessionId)}`
      )
    );
    return response.ok && response.revoked;
  }

  async revokeOtherActiveSessions(): Promise<number> {
    const response = await firstValueFrom(
      this.http.post<{ ok: boolean; revoked: number }>(
        `${this.apiBase}/auth/sessions/revoke-others`,
        {}
      )
    );
    return response.revoked ?? 0;
  }

  private async refreshWithDeviceLock(): Promise<boolean> {
    const attemptedRefreshToken = this.tokens()?.refreshToken;
    if (!attemptedRefreshToken) return false;

    const lockManager = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: BrowserLockManager }).locks
      : undefined;
    if (lockManager) {
      return lockManager.request(this.refreshLockName, async () => {
        if (this.adoptRotatedStoredSession(attemptedRefreshToken)) return true;
        return this.performRefresh(attemptedRefreshToken);
      });
    }
    return this.performRefresh(attemptedRefreshToken);
  }

  private async performRefresh(attemptedRefreshToken: string): Promise<boolean> {
    if (this.adoptRotatedStoredSession(attemptedRefreshToken)) return true;

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/refresh`, {
          refreshToken: attemptedRefreshToken
        })
      );

      const currentRefreshToken = this.tokens()?.refreshToken;
      if (!currentRefreshToken) return false;
      if (currentRefreshToken !== attemptedRefreshToken) {
        return this.adoptRotatedStoredSession(attemptedRefreshToken);
      }

      this.persistSession(
        this.userFromResponse(response.user),
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        false,
        true
      );
      return true;
    } catch (error: any) {
      const code = error?.error?.code;
      if (code === 'TOKEN_ROTATED') {
        return this.waitForRotatedStoredSession(attemptedRefreshToken);
      }
      if (this.isTransientSessionError(error)) {
        this.setConnectionError();
        return false;
      }

      this.handleSessionFailure(code);
      return false;
    }
  }

  private async waitForRotatedStoredSession(attemptedRefreshToken: string): Promise<boolean> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (this.adoptRotatedStoredSession(attemptedRefreshToken)) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }

    this.clearLocalSession('expired', true, true);
    return false;
  }

  private adoptRotatedStoredSession(attemptedRefreshToken: string): boolean {
    const storedTokens = this.loadStoredTokens();
    if (!storedTokens || storedTokens.refreshToken === attemptedRefreshToken) return false;

    const storedUser = this.loadStoredUser();
    if (!storedUser) return false;
    this.currentUser.set(storedUser);
    this.tokens.set(storedTokens);
    this.sessionState.set('ready');
    this.sessionValidationMessage.set('');
    return true;
  }

  private persistSession(
    user: User,
    tokens: StoredTokens,
    resetActivity: boolean,
    broadcast: boolean
  ): void {
    localStorage.setItem(this.storageKey, JSON.stringify(user));
    localStorage.setItem(this.tokenKey, JSON.stringify(tokens));
    if (resetActivity || !localStorage.getItem(this.lastActivityKey)) {
      localStorage.setItem(this.lastActivityKey, String(Date.now()));
    }
    this.currentUser.set(user);
    this.tokens.set(tokens);
    this.sessionState.set('ready');
    this.sessionValidationMessage.set('');
    if (broadcast) this.broadcast({ type: 'session-updated' });
  }

  private persistUser(user: User, broadcast: boolean): void {
    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
    if (broadcast) this.broadcast({ type: 'session-updated' });
  }

  private clearLocalSession(reason: LogoutReason, redirectToLogin: boolean, broadcast: boolean): void {
    this.currentUser.set(null);
    this.tokens.set(null);
    this.sessionState.set('ready');
    this.sessionValidationMessage.set('');
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.lastActivityKey);
    if (broadcast) this.broadcast({ type: 'logout', reason });

    if (redirectToLogin) {
      if (reason !== 'manual') sessionStorage.setItem(this.logoutReasonKey, reason);
      void this.router.navigate(['/login'], {
        queryParams: reason !== 'manual' ? { reason } : undefined,
        replaceUrl: true
      });
    }
  }

  private scheduleStorageSync(): void {
    if (this.storageSyncScheduled) return;
    this.storageSyncScheduled = true;
    queueMicrotask(() => {
      this.storageSyncScheduled = false;
      this.syncFromStorage();
    });
  }

  private syncFromStorage(): void {
    const storedUser = this.loadStoredUser();
    const storedTokens = this.loadStoredTokens();
    if (storedUser && storedTokens) {
      const previousUserId = this.currentUser()?.id;
      this.currentUser.set(storedUser);
      this.tokens.set(storedTokens);
      this.sessionState.set('ready');
      this.sessionValidationMessage.set('');
      if (previousUserId && previousUserId !== storedUser.id) {
        void this.router.navigate(['/dashboard']);
      }
      return;
    }

    if (this.currentUser() || this.tokens()) {
      this.clearLocalSession('manual', true, false);
    }
  }

  private setConnectionError(): void {
    this.sessionState.set('connection-error');
    this.sessionValidationMessage.set(
      'No pudimos confirmar tu sesión porque el servidor no respondió. Tus datos de acceso se conservaron.'
    );
  }

  private isTransientSessionError(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    return status === 0 || status === 408 || status === 429 || Boolean(status && status >= 500);
  }

  private broadcast(message: Omit<AuthBroadcastMessage, 'source'>): void {
    this.broadcastChannel?.postMessage({ ...message, source: this.instanceId });
  }

  private createInstanceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private userFromResponse(responseUser: LoginResponse['user']): User {
    const role = (responseUser.roles[0] ?? 'viewer') as Role;
    return {
      id: responseUser.sub,
      username: responseUser.username,
      displayName: responseUser.displayName,
      clientId: responseUser.clientId ?? null,
      subscription: responseUser.subscription ?? null,
      role,
      roles: responseUser.roles ?? [role],
      permissions: responseUser.permissions
    };
  }

  hasRole(roles: readonly Role[] | Role): boolean {
    const user = this.currentUser();
    if (!user) return false;

    const roleList = Array.isArray(roles) ? roles : [roles];
    const userRoles = user.roles?.length ? user.roles : [user.role];
    return userRoles.some((role) => roleList.includes(role));
  }

  hasPermission(permissions: readonly Permission[] | Permission): boolean {
    const user = this.currentUser();
    if (!user) return false;

    const required = Array.isArray(permissions) ? permissions : [permissions];
    return required.every((permission) => user.permissions.includes(permission));
  }

  private loadStoredUser(): User | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private loadStoredTokens(): StoredTokens | null {
    const raw = localStorage.getItem(this.tokenKey);
    if (!raw) return null;

    try {
      const tokens = JSON.parse(raw) as Partial<StoredTokens>;
      return tokens.accessToken && tokens.refreshToken
        ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        : null;
    } catch {
      return null;
    }
  }

  consumeLogoutReason(): Exclude<LogoutReason, 'manual'> | null {
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
