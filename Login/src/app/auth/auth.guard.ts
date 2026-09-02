import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { Permission, Role } from './models';
import { getApiBase } from '../core/api-base';

interface AccessData {
  roles?: readonly Role[];
  excludedRoles?: readonly Role[];
  permissions?: readonly Permission[];
  permissionsAny?: readonly Permission[];
  platformOnly?: boolean;
  suiteKey?: string;
  moduleKey?: string;
}

export const accessGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  const data = route.data as AccessData | undefined;

  if (data?.suiteKey && !auth.currentUser()?.clientId) {
    return router.createUrlTree(['/no-autorizado']);
  }

  if (data?.platformOnly && auth.currentUser()?.clientId) {
    return router.createUrlTree(['/no-autorizado']);
  }

  if (data?.roles && !auth.hasRole(data.roles)) {
    return router.createUrlTree(['/no-autorizado']);
  }

  if (data?.excludedRoles?.some((role) => auth.hasRole(role))) {
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

  if (data?.suiteKey) {
    try {
      const suites = await firstValueFrom(
        http.get<Array<{ key: string; enabled: boolean }>>(`${getApiBase()}/software-suites/me`)
      );
      const suite = suites.find((item) => item.key === data.suiteKey);
      if (!suite?.enabled) {
        return router.createUrlTree(['/no-autorizado']);
      }
    } catch {
      return router.createUrlTree(['/no-autorizado']);
    }
  }

  if (data?.moduleKey) {
    try {
      const modules = await firstValueFrom(
        http.get<Array<{ key: string; enabled: boolean }>>(`${getApiBase()}/modules/me`)
      );
      const module = modules.find((item) => item.key === data.moduleKey);
      if (!module?.enabled) {
        return router.createUrlTree(['/no-autorizado']);
      }
    } catch {
      return router.createUrlTree(['/no-autorizado']);
    }
  }

  return true;
};
