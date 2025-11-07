import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-content">
          <h1>專案管理系統</h1>
          <div class="user-info">
            <span>歡迎，{{ currentUser()?.fullName || '使用者' }}</span>
            <button (click)="logout()" class="btn-logout">登出</button>
          </div>
        </div>
      </header>

      <main class="dashboard-main">
        <div class="welcome-card">
          <h2>歡迎使用專案管理系統</h2>
          <p>開始管理您的專案和任務</p>
          
          <div class="quick-actions">
            <div class="action-card">
              <h3>工作區</h3>
              <p>管理您的工作區</p>
              <button class="btn-primary" disabled>即將推出</button>
            </div>
            
            <div class="action-card">
              <h3>專案</h3>
              <p>建立和管理專案</p>
              <button class="btn-primary" disabled>即將推出</button>
            </div>
            
            <div class="action-card">
              <h3>任務</h3>
              <p>查看和指派任務</p>
              <button class="btn-primary" disabled>即將推出</button>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3>開發狀態</h3>
          <ul>
            <li>✅ 認證系統已完成</li>
            <li>✅ 任務管理 API 已完成</li>
            <li>🔄 工作區與專案管理開發中</li>
            <li>⏳ 前端 UI 完善中</li>
          </ul>
        </div>
      </main>
    </div>
  `,
    styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: #f7fafc;
    }

    .dashboard-header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1a202c;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-info span {
      color: #4a5568;
      font-size: 14px;
    }

    .btn-logout {
      background: #e53e3e;
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-logout:hover {
      background: #c53030;
    }

    .dashboard-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .welcome-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }

    .welcome-card h2 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1a202c;
    }

    .welcome-card > p {
      margin: 0 0 32px 0;
      color: #718096;
      font-size: 16px;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
    }

    .action-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 24px;
    }

    .action-card h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #1a202c;
    }

    .action-card p {
      margin: 0 0 16px 0;
      color: #718096;
      font-size: 14px;
    }

    .btn-primary {
      width: 100%;
      background: #667eea;
      color: white;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .info-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .info-section h3 {
      margin: 0 0 16px 0;
      font-size: 20px;
      color: #1a202c;
    }

    .info-section ul {
      margin: 0;
      padding-left: 20px;
      color: #4a5568;
    }

    .info-section li {
      margin-bottom: 8px;
    }
  `]
})
export class DashboardComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    currentUser = this.authService.currentUser;

    logout(): void {
        this.authService.logout();
    }
}

