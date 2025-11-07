import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ProjectService } from '../../../core/services/project.service';
import { SectionService } from '../../../core/services/section.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { Task, Section, WorkspaceMember } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-list',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="task-list-container">
      <div class="task-list-header">
        <h2>任務列表</h2>
        <button (click)="openCreateTaskDialog()" class="btn-primary">
          + 新增任務
        </button>
      </div>
      
      <div class="filters">
        <div class="filter-group">
          <label>狀態</label>
          <select [(ngModel)]="filters.status" (change)="applyFilters()">
            <option value="">所有狀態</option>
            <option value="todo">待辦</option>
            <option value="in_progress">進行中</option>
            <option value="review">審核中</option>
            <option value="done">已完成</option>
          </select>
        </div>
        <div class="filter-group">
          <label>區段</label>
          <select [(ngModel)]="filters.sectionId" (change)="applyFilters()">
            <option value="">所有區段</option>
            @for (section of sections(); track section.id) {
              <option [value]="section.id">{{ section.name }}</option>
            }
          </select>
        </div>
        <button class="btn-clear" (click)="clearFilters()">清除篩選</button>
      </div>
      
      @if (loading()) {
        <div class="loading">載入中...</div>
      } @else {
        <div class="tasks">
          @for (task of filteredTasks(); track task.id) {
            <app-task-card 
              [task]="task"
              (taskClick)="openTaskDetail(task)"
              (taskUpdate)="onTaskUpdate($event)">
            </app-task-card>
          } @empty {
            <div class="empty-state">
              <p>尚無任務，開始建立第一個任務吧！</p>
            </div>
          }
        </div>
      }
    </div>

    <!-- 建立任務模態框 -->
    <div class="modal-overlay" *ngIf="showCreateTaskModal" (click)="closeTaskModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>建立任務</h2>
          <button class="btn-close" (click)="closeTaskModal()">×</button>
        </div>
        <form (ngSubmit)="saveTask()" class="modal-form">
          <div class="form-group">
            <label for="task-title">標題 *</label>
            <input 
              type="text" 
              id="task-title" 
              [(ngModel)]="taskForm.title" 
              name="task-title"
              required
              placeholder="輸入任務標題"
            />
          </div>
          <div class="form-group">
            <label for="task-description">描述</label>
            <textarea 
              id="task-description" 
              [(ngModel)]="taskForm.description" 
              name="task-description"
              rows="3"
              placeholder="輸入任務描述（選填）"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="task-section">區段</label>
            <select id="task-section" [(ngModel)]="taskForm.sectionId" name="task-section">
              <option value="">未分類</option>
              @for (section of sections(); track section.id) {
                <option [value]="section.id">{{ section.name }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label for="task-priority">優先級</label>
            <select id="task-priority" [(ngModel)]="taskForm.priority" name="task-priority">
              <option value="">無</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">緊急</option>
            </select>
          </div>
          <div class="form-group">
            <label for="task-due-date">截止日期</label>
            <input 
              type="datetime-local" 
              id="task-due-date" 
              [(ngModel)]="taskForm.dueDate" 
              name="task-due-date"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeTaskModal()">取消</button>
            <button type="submit" class="btn-primary" [disabled]="loading() || !taskForm.title">
              {{ loading() ? '建立中...' : '建立' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .task-list-container {
      padding: 24px;
    }
    
    .task-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    .filters {
      display: flex;
      gap: 16px;
      align-items: flex-end;
      margin-bottom: 24px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .filter-group label {
      font-size: 12px;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      min-width: 150px;
    }

    .btn-clear {
      background: #e2e8f0;
      color: #4a5568;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-clear:hover {
      background: #cbd5e0;
    }
    
    .tasks {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .empty-state {
      text-align: center;
      padding: 60px;
      color: #666;
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #718096;
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
    .form-group textarea,
    .form-group select {
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
    .form-group textarea:focus,
    .form-group select:focus {
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
export class TaskListComponent implements OnInit {
    private taskService = inject(TaskService);
    private wsService = inject(WebSocketService);
    private projectService = inject(ProjectService);
    private sectionService = inject(SectionService);
    private workspaceService = inject(WorkspaceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    tasks = signal<Task[]>([]);
    sections = signal<Section[]>([]);
    loading = signal(false);
    projectId = signal('');
    workspaceId = signal('');

    filters = {
        status: '',
        sectionId: ''
    };

    showCreateTaskModal = false;
    taskForm = {
        title: '',
        description: '',
        sectionId: '',
        priority: '',
        dueDate: ''
    };

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId.set(params['id']);
            this.loadProject();
            this.loadSections();
            this.loadTasks();
            this.subscribeToUpdates();
        });
    }

    loadProject(): void {
        this.projectService.getProjectById(this.projectId()).subscribe({
            next: (response) => {
                this.workspaceId.set(response.project.workspace_id);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
            }
        });
    }

    loadSections(): void {
        this.sectionService.getSectionsByProject(this.projectId()).subscribe({
            next: (response) => {
                this.sections.set(response.sections);
            },
            error: (error) => {
                console.error('載入區段失敗:', error);
            }
        });
    }

    loadTasks(): void {
        this.loading.set(true);
        const taskFilters: any = {};
        if (this.filters.status) taskFilters.status = this.filters.status;
        if (this.filters.sectionId) taskFilters.sectionId = this.filters.sectionId;

        this.taskService.getTasksByProject(this.projectId(), taskFilters)
            .subscribe({
                next: (response) => {
                    this.tasks.set(response.tasks);
                    this.loading.set(false);
                },
                error: (error) => {
                    console.error('載入任務失敗:', error);
                    this.loading.set(false);
                }
            });
    }

    filteredTasks() {
        // 如果沒有篩選條件，返回所有任務
        if (!this.filters.status && !this.filters.sectionId) {
            return this.tasks();
        }

        return this.tasks().filter(task => {
            const statusMatch = !this.filters.status || task.status === this.filters.status;
            const sectionMatch = !this.filters.sectionId || task.section_id === this.filters.sectionId;
            return statusMatch && sectionMatch;
        });
    }

    applyFilters(): void {
        this.loadTasks();
    }

    clearFilters(): void {
        this.filters = {
            status: '',
            sectionId: ''
        };
        this.loadTasks();
    }

    subscribeToUpdates(): void {
        this.wsService.joinProject(this.projectId());

        this.wsService.onTaskUpdated().subscribe(updatedTask => {
            const currentTasks = this.tasks();
            const index = currentTasks.findIndex(t => t.id === updatedTask.id);

            if (index !== -1) {
                const newTasks = [...currentTasks];
                newTasks[index] = updatedTask;
                this.tasks.set(newTasks);
            } else {
                // 新任務，重新載入
                this.loadTasks();
            }
        });
    }

    openCreateTaskDialog(): void {
        this.taskForm = {
            title: '',
            description: '',
            sectionId: '',
            priority: '',
            dueDate: ''
        };
        this.showCreateTaskModal = true;
    }

    closeTaskModal(): void {
        this.showCreateTaskModal = false;
        this.taskForm = {
            title: '',
            description: '',
            sectionId: '',
            priority: '',
            dueDate: ''
        };
    }

    saveTask(): void {
        if (!this.taskForm.title.trim()) return;

        this.loading.set(true);
        const taskData: any = {
            title: this.taskForm.title
        };

        if (this.taskForm.description) {
            taskData.description = this.taskForm.description;
        }

        if (this.taskForm.sectionId) {
            taskData.sectionId = this.taskForm.sectionId;
        }

        if (this.taskForm.priority) {
            taskData.priority = this.taskForm.priority;
        }

        if (this.taskForm.dueDate) {
            taskData.dueDate = new Date(this.taskForm.dueDate).toISOString();
        }

        this.taskService.createTask(this.projectId(), taskData).subscribe({
            next: () => {
                this.loading.set(false);
                this.closeTaskModal();
                this.loadTasks();
            },
            error: (error) => {
                console.error('建立任務失敗:', error);
                this.loading.set(false);
                alert('建立任務失敗：' + (error.error?.error || '未知錯誤'));
            }
        });
    }

    openTaskDetail(task: Task): void {
        this.router.navigate(['/tasks', task.id]);
    }

    onTaskUpdate(task: Task): void {
        this.taskService.updateTask(task.id, task)
            .subscribe({
                next: () => {
                    this.wsService.emitTaskUpdate(this.projectId(), task);
                },
                error: (error) => {
                    console.error('更新任務失敗:', error);
                }
            });
    }
}