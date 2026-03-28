import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';
  isSubmitting = false;
  showRecovery = false;
  recoveryEmail = '';
  recoveryCode = '';
  recoveryPassword = '';
  recoveryMessage = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;
    try {
      const result = await this.auth.login(this.username.trim(), this.password.trim());

      if (result.ok) {
        void this.router.navigateByUrl('/dashboard');
        return;
      }

      this.errorMessage = result.message ?? 'No se pudo iniciar sesión.';
      this.cdr.detectChanges();
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  toggleRecovery(): void {
    this.showRecovery = !this.showRecovery;
    this.recoveryMessage = '';
    this.errorMessage = '';
  }

  async onRequestCode(): Promise<void> {
    this.recoveryMessage = '';
    if (!this.recoveryEmail) {
      this.recoveryMessage = 'Ingresa tu correo.';
      return;
    }

    const ok = await this.auth.requestPasswordReset(this.recoveryEmail.trim());
    this.recoveryMessage = ok
      ? 'Código enviado. Revisa tu correo.'
      : 'No se pudo enviar el código.';
  }

  async onResetPassword(): Promise<void> {
    this.recoveryMessage = '';
    if (!this.recoveryEmail || !this.recoveryCode || !this.recoveryPassword) {
      this.recoveryMessage = 'Completa todos los campos.';
      return;
    }

    const ok = await this.auth.resetPassword(
      this.recoveryEmail.trim(),
      this.recoveryCode.trim(),
      this.recoveryPassword
    );

    if (ok) {
      this.recoveryMessage = 'Contraseña actualizada. Ya puedes iniciar sesión.';
      this.recoveryCode = '';
      this.recoveryPassword = '';
      return;
    }

    this.recoveryMessage = 'Código inválido o expirado.';
  }
}
