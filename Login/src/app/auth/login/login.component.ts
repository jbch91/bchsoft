import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  private sessionMessageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const requestedRoute = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requestedRoute !== null) {
      this.auth.rememberPostLoginRoute(requestedRoute);
    }

    const storedReason = this.auth.consumeLogoutReason();
    const urlReason = this.route.snapshot.queryParamMap.get('reason');
    const reason = urlReason || storedReason;
    if (urlReason !== null) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { reason: null },
        queryParamsHandling: 'merge',
        preserveFragment: true,
        replaceUrl: true
      });
    }
    if (reason === 'expired') {
      this.showSessionMessage('Tu sesión expiró. Inicia sesión nuevamente.');
    }
    if (reason === 'inactive') {
      this.showSessionMessage('Sesión cerrada por inactividad. Inicia sesión nuevamente.');
    }
    if (reason === 'replaced') {
      this.showSessionMessage('Esta sesión dejó de estar activa. Puedes ingresar nuevamente.');
    }

    if (this.auth.isAuthenticated()) {
      void this.auth.initializeSession().then((valid) => {
        if (valid) void this.navigateAfterLogin();
      });
    }
  }

  ngOnDestroy(): void {
    this.clearCloseRecoveryTimer();
    this.clearSessionMessage();
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.clearSessionMessage();
    this.isSubmitting = true;
    try {
      const result = await this.auth.login(this.username.trim(), this.password);

      if (result.ok) {
        await this.navigateAfterLogin();
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
    this.clearSessionMessage();
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
          this.showSessionMessage('Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.');
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

  private showSessionMessage(message: string): void {
    this.clearSessionMessage();
    this.sessionMessage = message;
    this.sessionMessageTimer = setTimeout(() => {
      this.clearSessionMessage();
      this.cdr.detectChanges();
    }, 5000);
  }

  private clearSessionMessage(): void {
    if (this.sessionMessageTimer !== null) {
      clearTimeout(this.sessionMessageTimer);
      this.sessionMessageTimer = null;
    }
    this.sessionMessage = '';
  }

  private postLoginRoute(): string {
    const requestedRoute = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requestedRoute !== null) {
      const returnUrl = this.auth.rememberPostLoginRoute(requestedRoute);
      if (returnUrl) return returnUrl;
    } else {
      const pendingRoute = this.auth.pendingPostLoginRoute();
      if (pendingRoute) return pendingRoute;
    }

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

  private async navigateAfterLogin(): Promise<void> {
    const destination = this.postLoginRoute();
    try {
      const navigated = await this.router.navigateByUrl(destination, { replaceUrl: true });
      if (navigated !== false) this.auth.clearPostLoginRoute();
    } catch {
      this.auth.rememberPostLoginRoute(destination);
      this.errorMessage = 'La sesión inició, pero no se pudo abrir el destino solicitado. Intenta nuevamente.';
      this.cdr.detectChanges();
    }
  }
}
