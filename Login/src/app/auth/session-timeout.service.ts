import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly inactivityMs = 30 * 60 * 1000;
  private readonly windowActivityEvents = [
    'click',
    'keydown',
    'mousemove',
    'scroll',
    'touchstart'
  ];
  private readonly documentActivityEvents = ['visibilitychange'];
  private readonly onActivity = () => this.scheduleTimeout();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;

  constructor(private readonly auth: AuthService) {}

  start(): void {
    if (this.listening || typeof window === 'undefined') {
      return;
    }

    for (const eventName of this.windowActivityEvents) {
      window.addEventListener(eventName, this.onActivity, { passive: true });
    }
    for (const eventName of this.documentActivityEvents) {
      document.addEventListener(eventName, this.onActivity);
    }
    this.listening = true;
    this.scheduleTimeout();
  }

  stop(): void {
    if (typeof window !== 'undefined' && this.listening) {
      for (const eventName of this.windowActivityEvents) {
        window.removeEventListener(eventName, this.onActivity);
      }
      for (const eventName of this.documentActivityEvents) {
        document.removeEventListener(eventName, this.onActivity);
      }
    }
    this.listening = false;
    this.clearTimer();
  }

  private scheduleTimeout(): void {
    if (!this.auth.isAuthenticated()) {
      this.stop();
      return;
    }

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.stop();
      this.auth.logout(true, 'inactive');
    }, this.inactivityMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
