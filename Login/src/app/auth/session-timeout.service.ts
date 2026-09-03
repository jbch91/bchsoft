import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly inactivityMs = 30 * 60 * 1000;
  private readonly activityThrottleMs = 1000;
  private readonly persistThrottleMs = 10 * 1000;
  private readonly lastActivityKey = 'auth_last_activity_v1';
  private readonly activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  private readonly onActivity = (): void => this.recordActivity();
  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) this.checkAndSchedule();
  };
  private readonly onFocus = (): void => this.checkAndSchedule();
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key !== this.lastActivityKey || !event.newValue) return;
    const timestamp = Number(event.newValue);
    if (!Number.isFinite(timestamp)) return;
    this.lastActivityAt = Math.max(this.lastActivityAt, timestamp);
    this.scheduleFromLastActivity();
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private lastActivityAt = 0;
  private lastPersistedAt = 0;

  constructor(private readonly auth: AuthService) {}

  start(): void {
    if (typeof window === 'undefined') return;

    if (!this.listening) {
      for (const eventName of this.activityEvents) {
        window.addEventListener(eventName, this.onActivity, { passive: true });
      }
      window.addEventListener('focus', this.onFocus);
      window.addEventListener('storage', this.onStorage);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.listening = true;
    }

    const storedActivity = this.readLastActivity();
    if (!storedActivity) {
      this.recordActivity(true);
      return;
    }
    this.lastActivityAt = Math.max(this.lastActivityAt, storedActivity);
    this.lastPersistedAt = Math.max(this.lastPersistedAt, storedActivity);
    this.checkAndSchedule();
  }

  stop(): void {
    if (typeof window !== 'undefined' && this.listening) {
      for (const eventName of this.activityEvents) {
        window.removeEventListener(eventName, this.onActivity);
      }
      window.removeEventListener('focus', this.onFocus);
      window.removeEventListener('storage', this.onStorage);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.listening = false;
    this.clearTimer();
    this.lastActivityAt = 0;
    this.lastPersistedAt = 0;
  }

  private recordActivity(forcePersist = false): void {
    if (!this.auth.isAuthenticated()) {
      this.stop();
      return;
    }

    const now = Date.now();
    if (!forcePersist && now - this.lastActivityAt < this.activityThrottleMs) return;
    this.lastActivityAt = now;
    if (forcePersist || now - this.lastPersistedAt >= this.persistThrottleMs) {
      this.lastPersistedAt = now;
      localStorage.setItem(this.lastActivityKey, String(now));
    }
    this.scheduleFromLastActivity();
  }

  private checkAndSchedule(): void {
    if (!this.auth.isAuthenticated()) {
      this.stop();
      return;
    }

    const storedActivity = this.readLastActivity();
    if (storedActivity) this.lastActivityAt = Math.max(this.lastActivityAt, storedActivity);
    if (!this.lastActivityAt) {
      this.recordActivity(true);
      return;
    }

    if (Date.now() - this.lastActivityAt >= this.inactivityMs) {
      this.expireSession();
      return;
    }
    this.scheduleFromLastActivity();
  }

  private scheduleFromLastActivity(): void {
    this.clearTimer();
    const remaining = this.inactivityMs - (Date.now() - this.lastActivityAt);
    if (remaining <= 0) {
      this.expireSession();
      return;
    }
    this.timer = setTimeout(() => this.checkAndSchedule(), remaining);
  }

  private expireSession(): void {
    this.stop();
    this.auth.logout(true, 'inactive');
  }

  private readLastActivity(): number {
    const value = Number(localStorage.getItem(this.lastActivityKey));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
