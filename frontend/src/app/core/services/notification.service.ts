import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
    id: string;
    type: string;
    title: string;
    content: string | null;
    related_entity_type: string | null;
    related_entity_id: string | null;
    is_read: boolean;
    created_at: string;
    actor?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
        email: string;
    };
}

export interface NotificationResponse {
    notifications: Notification[];
    unreadCount: number;
    total: number;
}

export interface UnreadCountResponse {
    unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
    private http = inject(HttpClient);

    // 取得通知列表
    getNotifications(options?: {
        isRead?: boolean;
        limit?: number;
        offset?: number;
    }): Observable<NotificationResponse> {
        let params = new HttpParams();
        if (options?.isRead !== undefined) {
            params = params.set('isRead', options.isRead.toString());
        }
        if (options?.limit) {
            params = params.set('limit', options.limit.toString());
        }
        if (options?.offset) {
            params = params.set('offset', options.offset.toString());
        }

        return this.http.get<NotificationResponse>(
            `${environment.apiUrl}/notifications`,
            { params }
        );
    }

    // 取得未讀通知數量
    getUnreadCount(): Observable<UnreadCountResponse> {
        return this.http.get<UnreadCountResponse>(
            `${environment.apiUrl}/notifications/unread-count`
        );
    }

    // 標記通知為已讀
    markAsRead(notificationIds: string[]): Observable<{ message: string; updated: number }> {
        return this.http.patch<{ message: string; updated: number }>(
            `${environment.apiUrl}/notifications/mark-as-read`,
            { notificationIds }
        );
    }

    // 標記所有通知為已讀
    markAllAsRead(): Observable<{ message: string; updated: number }> {
        return this.http.patch<{ message: string; updated: number }>(
            `${environment.apiUrl}/notifications/mark-all-as-read`,
            {}
        );
    }

    // 刪除通知
    deleteNotification(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${environment.apiUrl}/notifications/${id}`
        );
    }
}

