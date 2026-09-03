import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveSession, AuthService } from '../../auth/auth.service';
import { NotificationCenterComponent } from '../notification-center/notification-center.component';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, NotificationCenterComponent],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent {
  readonly sessionsOpen = signal(false);
  readonly sessionsLoading = signal(false);
  readonly sessions = signal<ActiveSession[]>([]);
  readonly maxActiveSessions = signal(3);
  readonly sessionActionId = signal<string | null>(null);
  readonly sessionsMessage = signal('');
  readonly sessionsError = signal('');

  constructor(public readonly auth: AuthService) {}

  async toggleSessions(event: Event): Promise<void> {
    event.stopPropagation();
    const open = !this.sessionsOpen();
    this.sessionsOpen.set(open);
    this.sessionsMessage.set('');
    this.sessionsError.set('');
    if (open) await this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    if (this.sessionsLoading()) return;
    this.sessionsLoading.set(true);
    this.sessionsError.set('');
    try {
      const response = await this.auth.listActiveSessions();
      this.sessions.set(response.sessions);
      this.maxActiveSessions.set(response.maxActiveSessions);
    } catch (error: any) {
      console.error(error);
      this.sessionsError.set(
        error?.error?.message ?? 'No fue posible consultar los dispositivos activos.'
      );
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  async closeSession(session: ActiveSession): Promise<void> {
    if (session.current || this.sessionActionId()) return;
    if (!window.confirm(`¿Cerrar la sesión de ${session.device}?`)) return;

    this.sessionActionId.set(session.id);
    this.sessionsError.set('');
    this.sessionsMessage.set('');
    try {
      const revoked = await this.auth.revokeActiveSession(session.id);
      this.sessions.update((items) => items.filter((item) => item.id !== session.id));
      this.sessionsMessage.set(
        revoked ? 'La sesión del dispositivo fue cerrada.' : 'Esa sesión ya estaba cerrada.'
      );
    } catch (error: any) {
      console.error(error);
      this.sessionsError.set(error?.error?.message ?? 'No se pudo cerrar esa sesión.');
    } finally {
      this.sessionActionId.set(null);
    }
  }

  async closeOtherSessions(): Promise<void> {
    if (this.sessionActionId() || this.otherSessionsCount() === 0) return;
    if (!window.confirm('¿Cerrar todas las sesiones excepto la de este dispositivo?')) return;

    this.sessionActionId.set('all');
    this.sessionsError.set('');
    this.sessionsMessage.set('');
    try {
      const revoked = await this.auth.revokeOtherActiveSessions();
      this.sessions.update((items) => items.filter((item) => item.current));
      this.sessionsMessage.set(
        revoked > 0 ? 'Las demás sesiones fueron cerradas.' : 'No había otras sesiones activas.'
      );
    } catch (error: any) {
      console.error(error);
      this.sessionsError.set(error?.error?.message ?? 'No se pudieron cerrar las demás sesiones.');
    } finally {
      this.sessionActionId.set(null);
    }
  }

  otherSessionsCount(): number {
    return this.sessions().filter((session) => !session.current).length;
  }

  logout(): void {
    this.auth.logout(true);
  }

  initials(): string {
    const user = this.auth.currentUser();
    const source = user?.displayName || user?.username || 'Usuario';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  roleLabel(): string {
    const role = this.auth.currentUser()?.role ?? 'usuario';
    const labels: Record<string, string> = {
      responsable_area: 'Responsable de área',
      ingeniero_biomedico: 'Ingeniero biomédico',
      client_admin: 'Administrador del cliente'
    };
    return labels[role] ?? role.replace(/_/g, ' ');
  }
}
