import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppHeaderComponent } from './features/shared/app-header/app-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  
  showHeader = signal(false);

  ngOnInit(): void {
    // 監聽路由變化，決定是否顯示 header
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || event.url;
        // 排除登入和註冊頁面
        this.showHeader.set(!url.startsWith('/auth'));
      });

    // 初始化時檢查當前路由
    const currentUrl = this.router.url;
    this.showHeader.set(!currentUrl.startsWith('/auth'));
  }
}
