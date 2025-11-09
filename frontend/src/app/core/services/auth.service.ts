import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../src/environments/environment';
import { User } from '../models/task.model';

interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    private readonly TOKEN_KEY = 'access_token';
    private readonly REFRESH_TOKEN_KEY = 'refresh_token';
    private readonly USER_KEY = 'current_user';

    currentUser = signal<User | null>(null);
    private _isAuthenticated = signal<boolean>(false);
    isAuthenticatedSignal = this._isAuthenticated.asReadonly();

    constructor() {
        this.checkAuthStatus();
    }

    register(email: string, password: string, fullName: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, {
            email, password, fullName
        }).pipe(
            tap(response => this.handleAuthSuccess(response))
        );
    }

    login(email: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, {
            email, password
        }).pipe(
            tap(response => this.handleAuthSuccess(response))
        );
    }

    logout(): void {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.currentUser.set(null);
        this._isAuthenticated.set(false);
        this.router.navigate(['/auth/login']);
    }

    refreshToken(): Observable<{ accessToken: string }> {
        const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
        if (!refreshToken) {
            throw new Error('Refresh token not found');
        }
        return this.http.post<{ accessToken: string }>(
            `${environment.apiUrl}/auth/refresh`,
            { refreshToken }
        ).pipe(
            tap(response => {
                if (response.accessToken) {
                    localStorage.setItem(this.TOKEN_KEY, response.accessToken);
                }
            })
        );
    }

    getToken(): string | null {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    isAuthenticated(): boolean {
        return this._isAuthenticated();
    }

    getCurrentUser(): Observable<{ user: User }> {
        return this.http.get<{ user: User }>(`${environment.apiUrl}/auth/me`);
    }

    private handleAuthSuccess(response: AuthResponse): void {
        localStorage.setItem(this.TOKEN_KEY, response.accessToken);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
        // 將用戶資料保存到 localStorage
        localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
        this.currentUser.set(response.user);
        this._isAuthenticated.set(true);
    }

    private checkAuthStatus(): void {
        const token = this.getToken();
        if (token) {
            // 從 localStorage 恢復用戶資料（快速恢復）
            const userJson = localStorage.getItem(this.USER_KEY);
            if (userJson) {
                try {
                    const user = JSON.parse(userJson) as User;
                    this.currentUser.set(user);
                    this._isAuthenticated.set(true);
                } catch (error) {
                    console.error('Failed to parse user data from localStorage:', error);
                    // 如果解析失敗，清除無效的資料
                    localStorage.removeItem(this.USER_KEY);
                }
            }

            // 延遲調用 API，避免在構造函數中立即觸發 HTTP 請求導致循環依賴
            // 再次檢查 token 是否存在（可能在延遲期間被清除）
            setTimeout(() => {
                const currentToken = this.getToken();
                if (!currentToken) {
                    // Token 已被清除，不需要調用 API
                    return;
                }

                // 嘗試從 API 獲取最新的用戶資訊（驗證 token 並更新用戶資料）
                this.getCurrentUser().subscribe({
                    next: (response) => {
                        // 更新用戶資料
                        localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
                        this.currentUser.set(response.user);
                        this._isAuthenticated.set(true);
                    },
                    error: (error) => {
                        // Token 無效或過期，清除認證狀態
                        // 靜默處理 401 錯誤和 "No token provided" 錯誤，避免在 console 中顯示不必要的錯誤訊息
                        if (error.status === 401 || 
                            (error.error && (error.error.error === 'No token provided' || error.error.error === 'Invalid token' || error.error.error === 'Unauthorized'))) {
                            // Token 無效或不存在，清除所有認證資料
                            localStorage.removeItem(this.TOKEN_KEY);
                            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
                            localStorage.removeItem(this.USER_KEY);
                            this.currentUser.set(null);
                            this._isAuthenticated.set(false);
                        } else {
                            // 其他錯誤才記錄到 console
                            console.error('Failed to get current user:', error);
                        }
                    }
                });
            }, 0);
        } else {
            // 沒有 token，清除所有認證資料
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
            localStorage.removeItem(this.USER_KEY);
            this.currentUser.set(null);
            this._isAuthenticated.set(false);
        }
    }
}