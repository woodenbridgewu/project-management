import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { NotificationCenterComponent } from '../notification-center/notification-center.component';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, RouterLink, NotificationCenterComponent],
    templateUrl: './app-header.component.html',
    styleUrls: ['./app-header.component.css']
})
export class AppHeaderComponent implements OnInit, OnDestroy {
    private authService = inject(AuthService);
    private router = inject(Router);
    private navigationService = inject(NavigationService);

    currentUser = this.authService.currentUser;
    showUserMenu = signal(false);
    pageTitle = signal<string>('');
    showBackButton = signal(false);
    backUrl = signal<string>('');

    ngOnInit(): void {
        // 監聽路由變化，更新頁面標題和返回按鈕
        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe((event: any) => {
                this.updatePageInfo(event.urlAfterRedirects || event.url);
            });

        // 初始化時檢查當前路由
        this.updatePageInfo(this.router.url);
    }

    ngOnDestroy(): void {
        // 清理工作
    }

    updatePageInfo(url: string): void {
        // 解析 URL 並設置頁面標題和返回按鈕
        if (url.startsWith('/dashboard')) {
            this.pageTitle.set('首頁');
            this.showBackButton.set(false);
        } else if (url.startsWith('/workspaces')) {
            const parts = url.split('/').filter(p => p);
            if (parts.length === 1) {
                // /workspaces - 工作區列表
                this.pageTitle.set('工作區');
                this.showBackButton.set(true);
                this.backUrl.set('/dashboard');
            } else if (parts.length === 2) {
                // /workspaces/:id - 工作區詳情
                this.pageTitle.set('工作區詳情');
                this.showBackButton.set(true);
                this.backUrl.set('/workspaces');
            } else {
                this.pageTitle.set('');
                this.showBackButton.set(false);
            }
        } else if (url.startsWith('/projects')) {
            const parts = url.split('/').filter(p => p);
            if (parts.length >= 2 && parts[1] === 'board') {
                // /projects/:id/board - 專案看板
                this.pageTitle.set('專案看板');
                this.showBackButton.set(true);
                // 嘗試從路由參數獲取 workspaceId，如果沒有則返回工作區列表
                this.backUrl.set('/workspaces');
            } else {
                this.pageTitle.set('專案');
                this.showBackButton.set(true);
                this.backUrl.set('/workspaces');
            }
        } else if (url.startsWith('/tasks')) {
            const parts = url.split('/').filter(p => p);
            if (parts.length === 1) {
                // /tasks - 空路徑，重定向到 dashboard
                this.pageTitle.set('');
                this.showBackButton.set(false);
                this.backUrl.set('/dashboard');
            } else if (parts.length === 2 && parts[1] === 'list') {
                // /tasks/list/:projectId - 任務列表
                this.pageTitle.set('任務列表');
                this.showBackButton.set(true);
                this.backUrl.set('/dashboard');
            } else if (parts.length === 2) {
                // /tasks/:id - 任務詳情
                this.pageTitle.set('任務詳情');
                this.showBackButton.set(true);
                // 任務詳情應該返回到專案看板，但我們無法從 URL 獲取專案 ID
                // 所以返回到 dashboard，讓任務詳情組件自己處理返回邏輯
                this.backUrl.set('/dashboard');
            } else {
                this.pageTitle.set('任務');
                this.showBackButton.set(true);
                this.backUrl.set('/dashboard');
            }
        } else {
            this.pageTitle.set('');
            this.showBackButton.set(false);
        }
    }

    toggleUserMenu(): void {
        this.showUserMenu.update(show => !show);
    }

    closeUserMenu(): void {
        this.showUserMenu.set(false);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const userMenu = target.closest('.user-menu-container');
        if (!userMenu && this.showUserMenu()) {
            this.closeUserMenu();
        }
    }

    logout(): void {
        this.closeUserMenu();
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }

    goToDashboard(): void {
        this.router.navigate(['/dashboard']);
    }

    goBack(): void {
        // 如果有註冊的自訂返回處理器（例如任務詳情頁），使用它
        // 否則使用預設的返回 URL
        if (this.navigationService.hasCustomBackHandler()) {
            this.navigationService.goBack(this.backUrl() || '/dashboard');
        } else if (this.backUrl()) {
            this.router.navigate([this.backUrl()]);
        } else {
            this.router.navigate(['/dashboard']);
        }
    }

    getInitials(name: string): string {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
}
