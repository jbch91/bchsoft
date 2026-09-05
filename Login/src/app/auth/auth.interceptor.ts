import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

const AUTH_RETRIED = new HttpContextToken<boolean>(() => false);
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (PUBLIC_AUTH_ENDPOINTS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  const tokens = auth.tokens();
  if (!tokens?.accessToken) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${tokens.accessToken}`
    }
  });

  return next(cloned).pipe(
    catchError((error) => {
      const code = error?.error?.code;
      if (error?.status === 401 && code === 'SESSION_REPLACED') {
        if (auth.tokens()?.accessToken === tokens.accessToken) {
          auth.handleSessionFailure(code);
        }
        return throwError(() => error);
      }

      const alreadyRetried = req.context.get(AUTH_RETRIED);
      if (error?.status !== 401 || alreadyRetried) {
        return throwError(() => error);
      }

      return from(auth.refreshSession()).pipe(
        switchMap((ok) => {
          if (!ok) {
            return throwError(() => error);
          }
          const refreshed = auth.tokens();
          if (!refreshed?.accessToken) {
            return throwError(() => error);
          }
          const retry = req.clone({
            context: req.context.set(AUTH_RETRIED, true),
            setHeaders: {
              Authorization: `Bearer ${refreshed.accessToken}`
            }
          });
          return next(retry);
        })
      );
    })
  );
};
