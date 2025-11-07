import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();

    if (token && !req.url.includes('/auth/')) {
        req = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    return next(req).pipe(
        catchError(error => {
            // 不要對認證相關的請求嘗試刷新 token
            if (error.status === 401 && 
                !req.url.includes('/auth/refresh') && 
                !req.url.includes('/auth/login') && 
                !req.url.includes('/auth/register')) {
                // Token 過期，嘗試刷新
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    // 沒有 refreshToken，直接登出
                    authService.logout();
                    return throwError(() => error);
                }
                
                return authService.refreshToken().pipe(
                    switchMap(() => {
                        const newToken = authService.getToken();
                        if (!newToken) {
                            authService.logout();
                            return throwError(() => error);
                        }
                        const clonedReq = req.clone({
                            setHeaders: {
                                Authorization: `Bearer ${newToken}`
                            }
                        });
                        return next(clonedReq);
                    }),
                    catchError(refreshError => {
                        authService.logout();
                        return throwError(() => refreshError);
                    })
                );
            }
            return throwError(() => error);
        })
    );
};