import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace } from '../../../core/models/task.model';

@Component({
    selector: 'app-workspace-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="workspace-list-container">
      <header class="workspace-header">
        <div class="header-content">
          <button class="btn-back" (click)="goBack()">← 返回</button>
          <h1>工作區</h1>
          <button class="btn-primary" (click)="showCreateModal = true">
            <span>+</span> 建立工作區
          </button>
        </div>
      </header>

      <main class="workspace-main">
        <div class="workspace-grid" *ngIf="workspaces().length > 0; else emptyState">
          <div class="workspace-card" *ngFor="let workspace of workspaces()" [routerLink]="['/workspaces', workspace.id]">
            <div class="workspace-card-header">
              <h3>{{ workspace.name }}</h3>
              <div class="workspace-actions" (click)="$event.stopPropagation()">
                <button class="btn-icon" (click)="editWorkspace(workspace)">✏️</button>
                <button class="btn-icon" (click)="deleteWorkspace(workspace.id)" *ngIf="workspace.owner_id === currentUserId">🗑️</button>
              </div>
            </div>
            <p class="workspace-description" *ngIf="workspace.description">{{ workspace.description }}</p>
            <div class="workspace-stats">
              <div class="stat-item">
                <span class="stat-label">專案</span>
                <span class="stat-value">{{ workspace.project_count || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">成員</span>
                <span class="stat-value">{{ workspace.member_count || 0 }}</span>
              </div>
            </div>
            <div class="workspace-footer">
              <span class="workspace-owner">擁有者: {{ workspace.owner_name || '未知' }}</span>
            </div>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <h2>還沒有工作區</h2>
            <p>建立您的第一個工作區來開始管理專案</p>
            <button class="btn-primary" (click)="showCreateModal = true">建立工作區</button>
          </div>
        </ng-template>
      </main>

      <!-- 建立/編輯工作區模態框 -->
      <div class="modal-overlay" *ngIf="showCreateModal || editingWorkspace" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingWorkspace ? '編輯工作區' : '建立工作區' }}</h2>
            <button class="btn-close" (click)="closeModal()">×</button>
          </div>
          <form (ngSubmit)="saveWorkspace()" class="modal-form">
            <div class="form-group">
              <label for="name">名稱 *</label>
              <input 
                type="text" 
                id="name" 
                [(ngModel)]="workspaceForm.name" 
                name="name"
                required
                placeholder="輸入工作區名稱"
              />
            </div>
            <div class="form-group">
              <label for="description">描述</label>
              <textarea 
                id="description" 
                [(ngModel)]="workspaceForm.description" 
                name="description"
                rows="3"
                placeholder="輸入工作區描述（選填）"
              ></textarea>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeModal()">取消</button>
              <button type="submit" class="btn-primary" [disabled]="loading() || !workspaceForm.name">
                {{ loading() ? '處理中...' : (editingWorkspace ? '更新' : '建立') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .workspace-list-container {
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
      justify-content: space-between;
      align-items: center;
      gap: 16px;
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
      white-space: nowrap;
    }

    .btn-back:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .header-content h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      color: #1a202c;
      flex: 1;
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

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .workspace-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .workspace-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #e2e8f0;
    }

    .workspace-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }

    .workspace-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .workspace-card-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
      flex: 1;
    }

    .workspace-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: #f7fafc;
    }

    .workspace-description {
      color: #718096;
      font-size: 14px;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }

    .workspace-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      padding-top: 16px;
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
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
    }

    .workspace-footer {
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .workspace-owner {
      font-size: 12px;
      color: #718096;
    }

    .empty-state {
      text-align: center;
      padding: 80px 24px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #1a202c;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      color: #718096;
      font-size: 16px;
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
export class WorkspaceListComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private router = inject(Router);
    private authService = inject(AuthService);

    workspaces = signal<Workspace[]>([]);
    loading = signal(false);
    showCreateModal = false;
    editingWorkspace: Workspace | null = null;
    currentUserId = '';

    workspaceForm = {
        name: '',
        description: ''
    };

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.id || '';
        this.loadWorkspaces();
    }

    loadWorkspaces() {
        this.loading.set(true);
        this.workspaceService.getWorkspaces().subscribe({
            next: (response) => {
                this.workspaces.set(response.workspaces);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    saveWorkspace() {
        if (!this.workspaceForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingWorkspace
            ? this.workspaceService.updateWorkspace(this.editingWorkspace.id, this.workspaceForm)
            : this.workspaceService.createWorkspace(this.workspaceForm);

        operation.subscribe({
            next: () => {
                this.closeModal();
                this.loadWorkspaces();
            },
            error: (error) => {
                console.error('儲存工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    editWorkspace(workspace: Workspace) {
        this.editingWorkspace = workspace;
        this.workspaceForm = {
            name: workspace.name,
            description: workspace.description || ''
        };
        this.showCreateModal = true;
    }

    deleteWorkspace(workspaceId: string) {
        if (!confirm('確定要刪除此工作區嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.workspaceService.deleteWorkspace(workspaceId).subscribe({
            next: () => {
                this.loadWorkspaces();
            },
            error: (error) => {
                console.error('刪除工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    closeModal() {
        this.showCreateModal = false;
        this.editingWorkspace = null;
        this.workspaceForm = { name: '', description: '' };
    }

    goBack() {
        this.router.navigate(['/dashboard']);
    }
}

