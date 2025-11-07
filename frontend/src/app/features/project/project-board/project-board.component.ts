import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { SectionService } from '../../../core/services/section.service';
import { ProjectService } from '../../../core/services/project.service';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { Task, Section } from '../../../core/models/task.model';

@Component({
    selector: 'app-project-board',
    standalone: true,
    imports: [CommonModule, DragDropModule, FormsModule, TaskCardComponent],
    template: `
    <div class="board-container">
      <div class="board-header">
        <div class="header-left">
          <button class="btn-back" (click)="goBack()">← 返回</button>
          <h2>{{ projectName() || '看板視圖' }}</h2>
        </div>
        <button class="btn-primary" (click)="showCreateSectionModal = true">
          + 新增區段
        </button>
      </div>
      
      <div class="board" cdkDropListGroup *ngIf="sections().length > 0; else emptyState">
        @for (section of sections(); track section.id) {
          <div class="board-column">
            <div class="column-header">
              <div class="column-title">
                <h3>{{ section.name }}</h3>
                <span class="task-count">{{ section.task_count || section.tasks?.length || 0 }}</span>
              </div>
              <div class="column-actions" (click)="$event.stopPropagation()">
                <button class="btn-icon" (click)="editSection(section)">✏️</button>
                <button class="btn-icon" (click)="deleteSection(section.id)">🗑️</button>
              </div>
            </div>
            
            <div 
              class="column-content"
              cdkDropList
              [id]="section.id"
              [cdkDropListData]="section.tasks || []"
              (cdkDropListDropped)="onDrop($event)">
              
              @for (task of section.tasks || []; track task.id) {
                <div class="task-card-wrapper" cdkDrag>
                  <app-task-card 
                    [task]="task"
                    (taskClick)="openTaskDetail(task)">
                  </app-task-card>
                </div>
              }
              
              <button class="add-task-btn" (click)="addTask(section.id)">
                + 新增任務
              </button>
            </div>
          </div>
        }
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>還沒有區段</h3>
          <p>建立第一個區段來開始管理任務</p>
          <button class="btn-primary" (click)="showCreateSectionModal = true">建立區段</button>
        </div>
      </ng-template>
    </div>

    <!-- 建立/編輯區段模態框 -->
    <div class="modal-overlay" *ngIf="showCreateSectionModal || editingSection" (click)="closeSectionModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingSection ? '編輯區段' : '建立區段' }}</h2>
          <button class="btn-close" (click)="closeSectionModal()">×</button>
        </div>
        <form (ngSubmit)="saveSection()" class="modal-form">
          <div class="form-group">
            <label for="section-name">名稱 *</label>
            <input 
              type="text" 
              id="section-name" 
              [(ngModel)]="sectionForm.name" 
              name="section-name"
              required
              placeholder="輸入區段名稱"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeSectionModal()">取消</button>
            <button type="submit" class="btn-primary" [disabled]="loading() || !sectionForm.name">
              {{ loading() ? '處理中...' : (editingSection ? '更新' : '建立') }}
            </button>
          </div>
        </form>
      </div>
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
            <label for="task-priority">優先級</label>
            <select id="task-priority" [(ngModel)]="taskForm.priority" name="task-priority">
              <option value="">無</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">緊急</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeTaskModal()">取消</button>
            <button type="submit" class="btn-primary" [disabled]="loading() || !taskForm.title">
              {{ loading() ? '處理中...' : '建立' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .board-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px;
      background: #F6F8FA;
    }
    
    .board-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
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
    }

    .btn-back:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }
    
    .board-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1a202c;
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
    
    .board {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      flex: 1;
      padding-bottom: 16px;
    }
    
    .board-column {
      min-width: 320px;
      max-width: 320px;
      background: #E8EAED;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      height: fit-content;
    }
    
    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 8px;
    }

    .column-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    
    .column-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1a202c;
    }
    
    .task-count {
      background: #666;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }

    .column-actions {
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
      background: rgba(0, 0, 0, 0.1);
    }
    
    .column-content {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
    }
    
    .task-card-wrapper {
      margin-bottom: 8px;
    }
    
    .add-task-btn {
      width: 100%;
      padding: 8px;
      background: transparent;
      border: 2px dashed #ccc;
      border-radius: 6px;
      cursor: pointer;
      color: #666;
      margin-top: 8px;
      transition: all 0.2s;
    }
    
    .add-task-btn:hover {
      background: rgba(0,0,0,0.05);
      border-color: #999;
    }
    
    .cdk-drag-preview {
      opacity: 0.8;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
    .column-content.cdk-drop-list-dragging .task-card-wrapper:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .empty-state {
      text-align: center;
      padding: 80px 24px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
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
export class ProjectBoardComponent implements OnInit {
    private taskService = inject(TaskService);
    private sectionService = inject(SectionService);
    private projectService = inject(ProjectService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    sections = signal<Section[]>([]);
    projectName = signal<string>('');
    loading = signal(false);
    projectId = '';

    showCreateSectionModal = false;
    editingSection: Section | null = null;
    sectionForm = { name: '' };

    showCreateTaskModal = false;
    currentSectionId = '';
    taskForm = {
        title: '',
        description: '',
        priority: '' as 'low' | 'medium' | 'high' | 'urgent' | ''
    };

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'];
            this.loadProject();
            this.loadSections();
        });
    }

    loadProject() {
        this.projectService.getProjectById(this.projectId).subscribe({
            next: (response) => {
                this.projectName.set(response.project.name);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
            }
        });
    }

    loadSections() {
        this.loading.set(true);
        this.sectionService.getSectionsByProject(this.projectId).subscribe({
            next: (response) => {
                const sections = response.sections.map(section => ({
                    ...section,
                    tasks: []
                }));
                this.sections.set(sections);
                this.loadTasks();
            },
            error: (error) => {
                console.error('載入區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadTasks() {
        this.taskService.getTasksByProject(this.projectId).subscribe({
            next: (response) => {
                // 將任務分配到對應的區段
                const sectionsData = this.sections();
                sectionsData.forEach(section => {
                    section.tasks = response.tasks.filter(
                        task => task.section_id === section.id
                    ) || [];
                });
                this.sections.set([...sectionsData]);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入任務失敗:', error);
                this.loading.set(false);
            }
        });
    }

    onDrop(event: CdkDragDrop<Task[]>): void {
        if (!event.container.data || !event.previousContainer.data) return;

        const task = event.previousContainer.data[event.previousIndex];
        const newSectionId = event.container.id;
        const newPosition = event.currentIndex;

        if (event.previousContainer === event.container) {
            // 同一區段內移動
            moveItemInArray(
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        } else {
            // 跨區段移動
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        }

        // 更新任務的區段和位置
        this.taskService.moveTask(task.id, newSectionId, newPosition).subscribe({
            next: () => {
                // 更新本地狀態
                const sectionsData = this.sections();
                const taskToUpdate = sectionsData
                    .flatMap(s => s.tasks || [])
                    .find(t => t.id === task.id);
                
                if (taskToUpdate) {
                    taskToUpdate.section_id = newSectionId;
                    taskToUpdate.position = newPosition;
                }
                this.sections.set([...sectionsData]);
            },
            error: (error) => {
                console.error('移動任務失敗:', error);
                // 重新載入以恢復狀態
                this.loadSections();
            }
        });
    }

    addSection(): void {
        this.editingSection = null;
        this.sectionForm = { name: '' };
        this.showCreateSectionModal = true;
    }

    editSection(section: Section): void {
        this.editingSection = section;
        this.sectionForm = { name: section.name };
        this.showCreateSectionModal = true;
    }

    saveSection() {
        if (!this.sectionForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingSection
            ? this.sectionService.updateSection(this.editingSection.id, this.sectionForm)
            : this.sectionService.createSection(this.projectId, this.sectionForm);

        operation.subscribe({
            next: () => {
                this.closeSectionModal();
                this.loadSections();
            },
            error: (error) => {
                console.error('儲存區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    deleteSection(sectionId: string) {
        if (!confirm('確定要刪除此區段嗎？區段內的任務將被保留但不再屬於任何區段。')) return;

        this.loading.set(true);
        this.sectionService.deleteSection(sectionId).subscribe({
            next: () => {
                this.loadSections();
            },
            error: (error) => {
                console.error('刪除區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    closeSectionModal() {
        this.showCreateSectionModal = false;
        this.editingSection = null;
        this.sectionForm = { name: '' };
    }

    addTask(sectionId: string): void {
        this.currentSectionId = sectionId;
        this.taskForm = { title: '', description: '', priority: '' };
        this.showCreateTaskModal = true;
    }

    saveTask() {
        if (!this.taskForm.title.trim()) return;

        this.loading.set(true);
        const taskData: any = {
            title: this.taskForm.title,
            sectionId: this.currentSectionId
        };

        if (this.taskForm.description) {
            taskData.description = this.taskForm.description;
        }

        if (this.taskForm.priority) {
            taskData.priority = this.taskForm.priority;
        }

        this.taskService.createTask(this.projectId, taskData).subscribe({
            next: () => {
                this.loading.set(false);
                this.closeTaskModal();
                this.loadSections();
            },
            error: (error) => {
                console.error('建立任務失敗:', error);
                this.loading.set(false);
                // 即使後端返回錯誤，也重新載入資料（因為任務可能已經建立）
                // 這樣可以確保 UI 與後端狀態同步
                setTimeout(() => {
                    this.loadSections();
                }, 500);
                // 如果錯誤不是 500，則顯示錯誤訊息
                if (error.status !== 500) {
                    alert('建立任務失敗：' + (error.error?.error || '未知錯誤'));
                } else {
                    // 對於 500 錯誤，可能是活動紀錄失敗但任務已建立，所以只重新載入
                    console.log('任務可能已建立，正在重新載入...');
                }
            }
        });
    }

    closeTaskModal() {
        this.showCreateTaskModal = false;
        this.currentSectionId = '';
        this.taskForm = { title: '', description: '', priority: '' };
    }

    openTaskDetail(task: Task): void {
        // TODO: 導航到任務詳情頁面
        console.log('Open task detail:', task.id);
    }

    goBack() {
        // 取得專案的工作區 ID
        this.projectService.getProjectById(this.projectId).subscribe({
            next: (response) => {
                this.router.navigate(['/workspaces', response.project.workspace_id]);
            },
            error: () => {
                this.router.navigate(['/workspaces']);
            }
        });
    }
}
