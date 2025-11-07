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
        this.currentUser.set(null);
        this._isAuthenticated.set(false);
        this.router.navigate(['/auth/login']);
    }

    refreshToken(): Observable<{ accessToken: string }> {
        const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
        return this.http.post<{ accessToken: string }>(
            `${environment.apiUrl}/auth/refresh`,
            { refreshToken }
        ).pipe(
            tap(response => {
                localStorage.setItem(this.TOKEN_KEY, response.accessToken);
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
        this.currentUser.set(response.user);
        this._isAuthenticated.set(true);
    }

    private checkAuthStatus(): void {
        const token = this.getToken();
        if (token) {
            // TODO: 驗證 token 並取得使用者資訊
            this._isAuthenticated.set(true);
        }
    }
}