import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideEye, LucideEyeOff],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  username = '';
  password = '';
  showPassword = false;
  errorMessage = '';
  isSubmitting = false;
  showRecovery = false;
  recoveryEmail = '';
  recoveryCode = '';
  recoveryPassword = '';
  showRecoveryPassword = false;
  recoveryMessage = '';
  recoveryMessageType: 'info' | 'success' | 'error' = 'info';
  isSendingRecoveryCode = false;
  isResettingPassword = false;
  sessionMessage = '';
  private closeRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.auth.initializeSession().then((valid) => {
        if (valid) void this.router.navigateByUrl(this.postLoginRoute());
      });
    }

    const reason = this.route.snapshot.queryParamMap.get('reason') || this.auth.consumeLogoutReason();
    if (reason === 'expired') {
      this.sessionMessage = 'Tu sesión expiró. Inicia sesión nuevamente para continuar.';
    }
    if (reason === 'inactive') {
      this.sessionMessage = 'Tu sesión se cerró por inactividad. Inicia sesión nuevamente para continuar.';
    }
    if (reason === 'replaced') {
      this.sessionMessage = 'Esta sesión dejó de estar activa. Puedes ingresar nuevamente si aún usas este dispositivo.';
    }
  }

  ngOnDestroy(): void {
    this.clearCloseRecoveryTimer();
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.sessionMessage = '';
    this.isSubmitting = true;
    try {
      const result = await this.auth.login(this.username.trim(), this.password);

      if (result.ok) {
        void this.router.navigateByUrl(this.postLoginRoute());
        return;
      }

      this.errorMessage = result.message ?? 'No se pudo iniciar sesión.';
      this.cdr.detectChanges();
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  openRecovery(): void {
    this.showRecovery = true;
    this.recoveryMessage = '';
    this.recoveryMessageType = 'info';
    this.errorMessage = '';
  }

  closeRecovery(): void {
    this.showRecovery = false;
    this.showRecoveryPassword = false;
    this.recoveryMessage = '';
    this.recoveryMessageType = 'info';
    this.recoveryCode = '';
    this.recoveryPassword = '';
    this.clearCloseRecoveryTimer();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleRecoveryPasswordVisibility(): void {
    this.showRecoveryPassword = !this.showRecoveryPassword;
  }

  async onRequestCode(): Promise<void> {
    this.recoveryMessage = '';
    if (!this.recoveryEmail) {
      this.recoveryMessage = 'Ingresa tu correo.';
      this.recoveryMessageType = 'error';
      return;
    }

    this.isSendingRecoveryCode = true;
    try {
      const ok = await this.auth.requestPasswordReset(this.recoveryEmail.trim());
      this.recoveryMessage = ok
        ? 'Código enviado. Revisa tu correo.'
        : 'No se pudo enviar el código.';
      this.recoveryMessageType = ok ? 'success' : 'error';
    } finally {
      this.isSendingRecoveryCode = false;
      this.cdr.detectChanges();
    }
  }

  async onResetPassword(): Promise<void> {
    this.recoveryMessage = '';
    if (!this.recoveryEmail || !this.recoveryCode || !this.recoveryPassword) {
      this.recoveryMessage = 'Completa todos los campos.';
      this.recoveryMessageType = 'error';
      return;
    }
    if (!this.isStrongPassword(this.recoveryPassword)) {
      this.recoveryMessage = 'La contraseña debe tener mínimo 10 caracteres, una mayúscula, una minúscula y un número.';
      this.recoveryMessageType = 'error';
      return;
    }

    this.isResettingPassword = true;
    try {
      const ok = await this.auth.resetPassword(
        this.recoveryEmail.trim(),
        this.recoveryCode.trim(),
        this.recoveryPassword
      );

      if (ok) {
        this.recoveryMessage = 'Contraseña actualizada. Ya puedes iniciar sesión.';
        this.recoveryMessageType = 'success';
        this.recoveryCode = '';
        this.recoveryPassword = '';
        this.clearCloseRecoveryTimer();
        this.closeRecoveryTimer = setTimeout(() => {
          this.closeRecovery();
          this.sessionMessage = 'Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.';
          this.cdr.detectChanges();
        }, 1400);
        return;
      }

      this.recoveryMessage = 'Código inválido o expirado.';
      this.recoveryMessageType = 'error';
    } finally {
      this.isResettingPassword = false;
      this.cdr.detectChanges();
    }
  }

  private isStrongPassword(password: string): boolean {
    return password.length >= 10
      && /[A-Z]/.test(password)
      && /[a-z]/.test(password)
      && /\d/.test(password);
  }

  private clearCloseRecoveryTimer(): void {
    if (this.closeRecoveryTimer) {
      clearTimeout(this.closeRecoveryTimer);
      this.closeRecoveryTimer = null;
    }
  }

  private postLoginRoute(): string {
    const returnUrl = this.safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    if (returnUrl) return returnUrl;

    const user = this.auth.currentUser();
    if (
      user
      && !user.clientId
      && (
        this.auth.hasRole('superuser')
        || this.auth.hasPermission('saas:access')
        || this.auth.hasPermission('saas:clients:view')
        || this.auth.hasPermission('users:manage')
      )
    ) {
      return '/administracion-saas';
    }
    return '/dashboard';
  }

  private safeReturnUrl(value: string | null): string | null {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    try {
      const target = new URL(value, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname === '/login') return null;
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return null;
    }
  }
}
