import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { NotificationCenterComponent } from '../notification-center/notification-center.component';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, NotificationCenterComponent],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent {
  constructor(public readonly auth: AuthService) {}

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
