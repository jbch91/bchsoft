import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
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
      const alreadyRetried = req.headers.has('x-retry');
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
            setHeaders: {
              Authorization: `Bearer ${refreshed.accessToken}`,
              'x-retry': '1'
            }
          });
          return next(retry);
        })
      );
    })
  );
};
