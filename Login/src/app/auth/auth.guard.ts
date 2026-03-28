import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Permission, Role } from './models';

interface AccessData {
  roles?: Role[];
  permissions?: Permission[];
  permissionsAny?: Permission[];
}

export const accessGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const data = route.data as AccessData | undefined;

  if (data?.roles && !auth.hasRole(data.roles)) {
    return router.createUrlTree(['/no-autorizado']);
  }

  if (data?.permissions && !auth.hasPermission(data.permissions)) {
    return router.createUrlTree(['/no-autorizado']);
  }

  if (data?.permissionsAny) {
    const ok = data.permissionsAny.some((perm) => auth.hasPermission(perm));
    if (!ok) {
      return router.createUrlTree(['/no-autorizado']);
    }
  }

  return true;
};
