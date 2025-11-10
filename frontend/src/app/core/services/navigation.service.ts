import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
    providedIn: 'root'
})
export class NavigationService {
    private customBackHandler = signal<(() => void) | null>(null);

    constructor(private router: Router) {}

    /**
     * 註冊自訂返回處理器
     * @param handler 返回處理函數
     */
    registerBackHandler(handler: () => void): void {
        this.customBackHandler.set(handler);
    }

    /**
     * 清除自訂返回處理器
     */
    clearBackHandler(): void {
        this.customBackHandler.set(null);
    }

    /**
     * 執行返回操作
     * 如果有註冊的自訂處理器，則使用它；否則使用預設的返回邏輯
     * @param defaultUrl 預設返回 URL
     */
    goBack(defaultUrl: string = '/dashboard'): void {
        const handler = this.customBackHandler();
        if (handler) {
            handler();
        } else {
            this.router.navigate([defaultUrl]);
        }
    }

    /**
     * 獲取當前是否有自訂返回處理器
     */
    hasCustomBackHandler(): boolean {
        return this.customBackHandler() !== null;
    }
}

