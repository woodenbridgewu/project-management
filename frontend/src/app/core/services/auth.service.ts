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
            // 從 localStorage 恢復用戶資料
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
                    this._isAuthenticated.set(false);
                }
            } else {
                // 有 token 但沒有用戶資料，仍然設為已認證（但 currentUser 為 null）
                // 這種情況可能需要重新獲取用戶資訊，但為了向後兼容，先設為已認證
                this._isAuthenticated.set(true);
            }
        }
    }
}