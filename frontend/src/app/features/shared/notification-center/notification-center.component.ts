import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
    selector: 'app-notification-center',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notification-center.component.html',
    styleUrls: ['./notification-center.component.css']
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
    private notificationService = inject(NotificationService);
    private wsService = inject(WebSocketService);
    private router = inject(Router);

    notifications = signal<Notification[]>([]);
    unreadCount = signal(0);
    loading = signal(false);
    showDropdown = signal(false);
    private subscriptions: Subscription[] = [];

    ngOnInit(): void {
        this.loadNotifications();
        this.loadUnreadCount();
        this.subscribeToNotifications();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    loadNotifications(): void {
        this.loading.set(true);
        this.notificationService.getNotifications({ limit: 20, offset: 0 }).subscribe({
            next: (response) => {
                this.notifications.set(response.notifications);
                this.unreadCount.set(response.unreadCount);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入通知失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadUnreadCount(): void {
        this.notificationService.getUnreadCount().subscribe({
            next: (response) => {
                this.unreadCount.set(response.unreadCount);
            },
            error: (error) => {
                console.error('載入未讀數量失敗:', error);
            }
        });
    }

    subscribeToNotifications(): void {
        // 確保 WebSocket 已連接
        this.wsService.connect();

        // 監聽新通知
        const newNotificationSub = this.wsService.onNotificationNew().subscribe((notification: Notification) => {
            const currentNotifications = this.notifications();
            this.notifications.set([notification, ...currentNotifications]);
            this.unreadCount.update(count => count + 1);
        });
        this.subscriptions.push(newNotificationSub);

        // 監聽未讀數量更新
        const unreadCountSub = this.wsService.onNotificationUnreadCount().subscribe((data) => {
            this.unreadCount.set(data.unreadCount);
        });
        this.subscriptions.push(unreadCountSub);
    }

    toggleDropdown(): void {
        this.showDropdown.update(show => !show);
        if (this.showDropdown()) {
            this.loadNotifications();
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const notificationCenter = target.closest('.notification-center');
        if (!notificationCenter && this.showDropdown()) {
            this.showDropdown.set(false);
        }
    }

    markAsRead(notification: Notification): void {
        if (notification.is_read) return;

        this.notificationService.markAsRead([notification.id]).subscribe({
            next: () => {
                const currentNotifications = this.notifications();
                const updatedNotifications = currentNotifications.map(n =>
                    n.id === notification.id ? { ...n, is_read: true } : n
                );
                this.notifications.set(updatedNotifications);
                this.unreadCount.update(count => Math.max(0, count - 1));
            },
            error: (error) => {
                console.error('標記已讀失敗:', error);
            }
        });
    }

    markAllAsRead(): void {
        const unreadNotifications = this.notifications().filter(n => !n.is_read);
        if (unreadNotifications.length === 0) return;

        this.notificationService.markAllAsRead().subscribe({
            next: () => {
                const currentNotifications = this.notifications();
                const updatedNotifications = currentNotifications.map(n => ({ ...n, is_read: true }));
                this.notifications.set(updatedNotifications);
                this.unreadCount.set(0);
            },
            error: (error) => {
                console.error('標記全部已讀失敗:', error);
            }
        });
    }

    deleteNotification(notification: Notification, event: Event): void {
        event.stopPropagation();
        if (!confirm('確定要刪除此通知嗎？')) return;

        this.notificationService.deleteNotification(notification.id).subscribe({
            next: () => {
                const currentNotifications = this.notifications();
                const filteredNotifications = currentNotifications.filter(n => n.id !== notification.id);
                this.notifications.set(filteredNotifications);
                if (!notification.is_read) {
                    this.unreadCount.update(count => Math.max(0, count - 1));
                }
            },
            error: (error) => {
                console.error('刪除通知失敗:', error);
            }
        });
    }

    handleNotificationClick(notification: Notification): void {
        this.markAsRead(notification);

        // 根據通知類型導航到相關頁面
        if (notification.related_entity_type === 'task' && notification.related_entity_id) {
            this.router.navigate(['/tasks', notification.related_entity_id]);
            this.showDropdown.set(false);
        } else if (notification.related_entity_type === 'project' && notification.related_entity_id) {
            this.router.navigate(['/projects', notification.related_entity_id, 'board']);
            this.showDropdown.set(false);
        }
    }

    getNotificationIcon(type: string): string {
        const iconMap: Record<string, string> = {
            'task_assigned': '📋',
            'task_mentioned': '💬',
            'comment_added': '💬',
            'comment_mentioned': '💬',
            'task_due_soon': '⏰',
            'task_overdue': '⚠️',
            'member_invited': '👥',
            'project_created': '📁',
            'attachment_added': '📎'
        };
        return iconMap[type] || '🔔';
    }

    formatTime(date: string): string {
        const now = new Date();
        const notificationDate = new Date(date);
        const diffMs = now.getTime() - notificationDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '剛剛';
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffHours < 24) return `${diffHours} 小時前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        return notificationDate.toLocaleDateString('zh-TW');
    }
}
