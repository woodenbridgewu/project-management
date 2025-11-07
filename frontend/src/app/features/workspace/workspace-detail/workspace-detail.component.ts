import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace, Project } from '../../../core/models/task.model';

@Component({
    selector: 'app-workspace-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="workspace-detail-container">
      <header class="workspace-header">
        <div class="header-content">
          <button class="btn-back" (click)="goBack()">← 返回</button>
          <div class="header-title">
            <h1>{{ workspace()?.name || '載入中...' }}</h1>
            <p *ngIf="workspace()?.description" class="workspace-description">{{ workspace()?.description }}</p>
          </div>
          <button class="btn-primary" (click)="showCreateProjectModal = true">
            <span>+</span> 建立專案
          </button>
        </div>
      </header>

      <main class="workspace-main" *ngIf="workspace()">
        <div class="workspace-info">
          <div class="info-card">
            <div class="info-item">
              <span class="info-label">擁有者</span>
              <span class="info-value">{{ workspace()?.owner_name || '未知' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">專案數量</span>
              <span class="info-value">{{ workspace()?.project_count || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">成員數量</span>
              <span class="info-value">{{ workspace()?.member_count || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="projects-section">
          <div class="section-header">
            <h2>專案</h2>
            <div class="filter-tabs">
              <button 
                class="tab-btn" 
                [class.active]="!showArchived"
                (click)="toggleArchived(false)"
              >
                進行中
              </button>
              <button 
                class="tab-btn" 
                [class.active]="showArchived"
                (click)="toggleArchived(true)"
              >
                已封存
              </button>
            </div>
          </div>

          <div class="projects-grid" *ngIf="projects().length > 0; else emptyProjects">
            <div class="project-card" *ngFor="let project of projects()" [routerLink]="['/projects', project.id]">
              <div class="project-card-header">
                <div class="project-color" [style.background-color]="project.color"></div>
                <h3>{{ project.name }}</h3>
                <div class="project-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon" (click)="editProject(project)">✏️</button>
                  <button class="btn-icon" (click)="archiveProject(project.id, !project.is_archived)" *ngIf="canEditProject(project)">
                    {{ project.is_archived ? '📂' : '📦' }}
                  </button>
                  <button class="btn-icon" (click)="deleteProject(project.id)" *ngIf="canEditProject(project)">🗑️</button>
                </div>
              </div>
              <p class="project-description" *ngIf="project.description">{{ project.description }}</p>
              <div class="project-stats">
                <div class="stat-item">
                  <span class="stat-label">任務</span>
                  <span class="stat-value">{{ project.task_count || 0 }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">區段</span>
                  <span class="stat-value">{{ project.section_count || 0 }}</span>
                </div>
              </div>
              <div class="project-footer">
                <span class="project-creator">建立者: {{ project.creator_name || '未知' }}</span>
              </div>
            </div>
          </div>

          <ng-template #emptyProjects>
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <h3>還沒有專案</h3>
              <p>{{ showArchived ? '沒有已封存的專案' : '建立您的第一個專案來開始管理任務' }}</p>
              <button class="btn-primary" (click)="showCreateProjectModal = true" *ngIf="!showArchived">
                建立專案
              </button>
            </div>
          </ng-template>
        </div>
      </main>

      <!-- 建立/編輯專案模態框 -->
      <div class="modal-overlay" *ngIf="showCreateProjectModal || editingProject" (click)="closeProjectModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingProject ? '編輯專案' : '建立專案' }}</h2>
            <button class="btn-close" (click)="closeProjectModal()">×</button>
          </div>
          <form (ngSubmit)="saveProject()" class="modal-form">
            <div class="form-group">
              <label for="name">名稱 *</label>
              <input 
                type="text" 
                id="name" 
                [(ngModel)]="projectForm.name" 
                name="name"
                required
                placeholder="輸入專案名稱"
              />
            </div>
            <div class="form-group">
              <label for="description">描述</label>
              <textarea 
                id="description" 
                [(ngModel)]="projectForm.description" 
                name="description"
                rows="3"
                placeholder="輸入專案描述（選填）"
              ></textarea>
            </div>
            <div class="form-group">
              <label for="color">顏色</label>
              <input 
                type="color" 
                id="color" 
                [(ngModel)]="projectForm.color" 
                name="color"
              />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeProjectModal()">取消</button>
              <button type="submit" class="btn-primary" [disabled]="loading() || !projectForm.name">
                {{ loading() ? '處理中...' : (editingProject ? '更新' : '建立') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .workspace-detail-container {
      min-height: 100vh;
      background: #f7fafc;
    }

    .workspace-header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 24px 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .btn-back {
      background: transparent;
      border: 1px solid #e2e8f0;
      color: #4a5568;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-back:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .header-title {
      flex: 1;
    }

    .header-title h1 {
      margin: 0 0 4px 0;
      font-size: 28px;
      font-weight: 600;
      color: #1a202c;
    }

    .workspace-description {
      margin: 0;
      color: #718096;
      font-size: 14px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }

    .workspace-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .workspace-info {
      margin-bottom: 32px;
    }

    .info-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 32px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-label {
      font-size: 12px;
      color: #718096;
    }

    .info-value {
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
    }

    .projects-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .section-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
    }

    .filter-tabs {
      display: flex;
      gap: 8px;
      background: #f7fafc;
      padding: 4px;
      border-radius: 8px;
    }

    .tab-btn {
      background: transparent;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #718096;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn.active {
      background: white;
      color: #667eea;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    .project-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .project-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }

    .project-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .project-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .project-card-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
      flex: 1;
    }

    .project-actions {
      display: flex;
      gap: 4px;
    }

    .btn-icon {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: white;
    }

    .project-description {
      color: #718096;
      font-size: 14px;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }

    .project-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #718096;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #1a202c;
    }

    .project-footer {
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .project-creator {
      font-size: 12px;
      color: #718096;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a202c;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      color: #718096;
      font-size: 14px;
    }

    /* 模態框樣式 */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #718096;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-close:hover {
      background: #f7fafc;
    }

    .modal-form {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #1a202c;
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-group input[type="color"] {
      width: 60px;
      height: 40px;
      padding: 2px;
      cursor: pointer;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-group textarea {
      resize: vertical;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-secondary:hover {
      background: #cbd5e0;
    }
  `]
})
export class WorkspaceDetailComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private projectService = inject(ProjectService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authService = inject(AuthService);

    workspace = signal<Workspace | null>(null);
    projects = signal<Project[]>([]);
    loading = signal(false);
    showArchived = false;
    showCreateProjectModal = false;
    editingProject: Project | null = null;
    workspaceId = '';
    currentUserId = '';

    projectForm = {
        name: '',
        description: '',
        color: '#4A90E2'
    };

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.id || '';

        this.route.params.subscribe(params => {
            this.workspaceId = params['id'];
            this.loadWorkspace();
            this.loadProjects();
        });
    }

    loadWorkspace() {
        this.workspaceService.getWorkspaceById(this.workspaceId).subscribe({
            next: (response) => {
                this.workspace.set(response.workspace);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
            }
        });
    }

    loadProjects() {
        this.loading.set(true);
        this.projectService.getProjectsByWorkspace(this.workspaceId, this.showArchived ? true : false).subscribe({
            next: (response) => {
                this.projects.set(response.projects);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    toggleArchived(archived: boolean) {
        this.showArchived = archived;
        this.loadProjects();
    }

    saveProject() {
        if (!this.projectForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingProject
            ? this.projectService.updateProject(this.editingProject.id, this.projectForm)
            : this.projectService.createProject(this.workspaceId, this.projectForm);

        operation.subscribe({
            next: () => {
                this.closeProjectModal();
                this.loadProjects();
            },
            error: (error) => {
                console.error('儲存專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    editProject(project: Project) {
        this.editingProject = project;
        this.projectForm = {
            name: project.name,
            description: project.description || '',
            color: project.color
        };
        this.showCreateProjectModal = true;
    }

    archiveProject(projectId: string, archived: boolean) {
        this.loading.set(true);
        this.projectService.archiveProject(projectId, archived).subscribe({
            next: () => {
                this.loadProjects();
            },
            error: (error) => {
                console.error('封存專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    deleteProject(projectId: string) {
        if (!confirm('確定要刪除此專案嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.projectService.deleteProject(projectId).subscribe({
            next: () => {
                this.loadProjects();
            },
            error: (error) => {
                console.error('刪除專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    canEditProject(project: Project): boolean {
        const workspace = this.workspace();
        if (!workspace) return false;
        return workspace.owner_id === this.currentUserId || project.created_by === this.currentUserId;
    }

    closeProjectModal() {
        this.showCreateProjectModal = false;
        this.editingProject = null;
        this.projectForm = { name: '', description: '', color: '#4A90E2' };
    }

    goBack() {
        this.router.navigate(['/workspaces']);
    }
}

