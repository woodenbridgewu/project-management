import { HttpInterceptorFn } from '@angular/common/http';
import { inject, runInInjectionContext, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../src/environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // 在 injection context 中注入所需的服務
    const http = inject(HttpClient);
    const injector = inject(Injector);
    
    // 直接從 localStorage 讀取 token，避免循環依賴
    const token = localStorage.getItem('access_token');

    // 只有在 token 存在且非空時，才添加 Authorization header
    // 排除不需要 token 的認證端點：/auth/login, /auth/register, /auth/refresh
    // 但 /auth/me 需要 token，所以要包含它
    const needsAuth = token && token.trim() !== '' && 
                      !req.url.includes('/auth/login') && 
                      !req.url.includes('/auth/register') && 
                      !req.url.includes('/auth/refresh');
    
    if (needsAuth) {
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
                    // 沒有 refreshToken，直接清除認證資料並導航到登入頁面
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('current_user');
                    // 使用 runInInjectionContext 來在正確的 injection context 中導航
                    setTimeout(() => {
                        runInInjectionContext(injector, () => {
                            const router = inject(Router);
                            router.navigate(['/auth/login']);
                        });
                    }, 0);
                    return throwError(() => error);
                }
                
                // 直接調用 refresh API，避免注入 AuthService 造成循環依賴
                return http.post<{ accessToken: string }>(
                    `${environment.apiUrl}/auth/refresh`,
                    { refreshToken }
                ).pipe(
                    switchMap((response) => {
                        if (response.accessToken) {
                            localStorage.setItem('access_token', response.accessToken);
                            const newToken = localStorage.getItem('access_token');
                            if (!newToken) {
                                // 清除認證資料
                                localStorage.removeItem('access_token');
                                localStorage.removeItem('refresh_token');
                                localStorage.removeItem('current_user');
                                setTimeout(() => {
                                    runInInjectionContext(injector, () => {
                                        const router = inject(Router);
                                        router.navigate(['/auth/login']);
                                    });
                                }, 0);
                                return throwError(() => error);
                            }
                            const clonedReq = req.clone({
                                setHeaders: {
                                    Authorization: `Bearer ${newToken}`
                                }
                            });
                            return next(clonedReq);
                        }
                        return throwError(() => error);
                    }),
                    catchError(refreshError => {
                        // 刷新失敗，清除認證資料
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('current_user');
                        setTimeout(() => {
                            runInInjectionContext(injector, () => {
                                const router = inject(Router);
                                router.navigate(['/auth/login']);
                            });
                        }, 0);
                        return throwError(() => refreshError);
                    })
                );
            }
            return throwError(() => error);
        })
    );
};