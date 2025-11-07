import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ProjectService } from '../../core/services/project.service';
import { Workspace, Project } from '../../core/models/task.model';

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
              <button class="btn-primary" [routerLink]="['/workspaces']">查看工作區</button>
            </div>
            
            <div class="action-card">
              <h3>專案</h3>
              <p>建立和管理專案</p>
              <button class="btn-primary" [routerLink]="['/workspaces']">查看專案</button>
            </div>
          </div>
        </div>

        <div class="workspaces-section" *ngIf="workspaces().length > 0">
          <div class="section-header">
            <h3>我的工作區</h3>
            <button class="btn-link" [routerLink]="['/workspaces']">查看全部</button>
          </div>
          <div class="workspaces-grid">
            <div class="workspace-card" *ngFor="let workspace of workspaces().slice(0, 3)" [routerLink]="['/workspaces', workspace.id]">
              <h4>{{ workspace.name }}</h4>
              <p *ngIf="workspace.description" class="workspace-desc">{{ workspace.description }}</p>
              <div class="workspace-meta">
                <span>{{ workspace.project_count || 0 }} 個專案</span>
                <span>{{ workspace.member_count || 0 }} 位成員</span>
              </div>
            </div>
          </div>
        </div>

        <div class="projects-section" *ngIf="recentProjects().length > 0">
          <div class="section-header">
            <h3>最近的專案</h3>
            <button class="btn-link" [routerLink]="['/workspaces']">查看全部</button>
          </div>
          <div class="projects-grid">
            <div class="project-card" *ngFor="let project of recentProjects()" [routerLink]="['/projects', project.id]">
              <div class="project-color" [style.background-color]="project.color"></div>
              <div class="project-info">
                <h4>{{ project.name }}</h4>
                <p *ngIf="project.description" class="project-desc">{{ project.description }}</p>
                <div class="project-meta">
                  <span>{{ project.task_count || 0 }} 個任務</span>
                </div>
              </div>
            </div>
          </div>
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

    .workspaces-section,
    .projects-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
    }

    .btn-link {
      background: transparent;
      border: none;
      color: #667eea;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      padding: 0;
    }

    .btn-link:hover {
      text-decoration: underline;
    }

    .workspaces-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .workspace-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .workspace-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .workspace-card h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
    }

    .workspace-desc {
      margin: 0 0 12px 0;
      color: #718096;
      font-size: 14px;
      line-height: 1.5;
    }

    .workspace-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #718096;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .project-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .project-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .project-color {
      width: 4px;
      height: 100%;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .project-info {
      flex: 1;
    }

    .project-info h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
    }

    .project-desc {
      margin: 0 0 12px 0;
      color: #718096;
      font-size: 14px;
      line-height: 1.5;
    }

    .project-meta {
      font-size: 12px;
      color: #718096;
    }
  `]
})
export class DashboardComponent implements OnInit {
    private authService = inject(AuthService);
    private workspaceService = inject(WorkspaceService);
    private projectService = inject(ProjectService);
    private router = inject(Router);

    currentUser = this.authService.currentUser;
    workspaces = signal<Workspace[]>([]);
    recentProjects = signal<Project[]>([]);
    loading = signal(false);

    ngOnInit() {
        this.loadWorkspaces();
    }

    loadWorkspaces() {
        this.loading.set(true);
        this.workspaceService.getWorkspaces().subscribe({
            next: (response) => {
                this.workspaces.set(response.workspaces);
                // 載入每個工作區的專案
                this.loadRecentProjects(response.workspaces);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadRecentProjects(workspaces: Workspace[]) {
        const allProjects: Project[] = [];
        let loadedCount = 0;

        if (workspaces.length === 0) {
            this.recentProjects.set([]);
            return;
        }

        workspaces.slice(0, 3).forEach(workspace => {
            this.projectService.getProjectsByWorkspace(workspace.id, false).subscribe({
                next: (response) => {
                    allProjects.push(...response.projects);
                    loadedCount++;
                    if (loadedCount === Math.min(workspaces.length, 3)) {
                        // 按建立時間排序，取最近 6 個
                        const sorted = allProjects.sort((a, b) => {
                            const dateA = new Date(a.created_at).getTime();
                            const dateB = new Date(b.created_at).getTime();
                            return dateB - dateA;
                        });
                        this.recentProjects.set(sorted.slice(0, 6));
                    }
                },
                error: (error) => {
                    console.error('載入專案失敗:', error);
                    loadedCount++;
                }
            });
        });
    }

    logout(): void {
        this.authService.logout();
    }
}

