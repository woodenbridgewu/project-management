import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Task } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-list',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="task-list-container">
      <div class="task-list-header">
        <h2>任務列表</h2>
        <button (click)="openCreateTaskDialog()" class="btn-primary">
          + 新增任務
        </button>
      </div>
      
      <div class="filters">
        <select (change)="onFilterChange('status', $event)">
          <option value="">所有狀態</option>
          <option value="todo">待辦</option>
          <option value="in_progress">進行中</option>
          <option value="review">審核中</option>
          <option value="done">已完成</option>
        </select>
      </div>
      
      @if (loading()) {
        <div class="loading">載入中...</div>
      } @else {
        <div class="tasks">
          @for (task of tasks(); track task.id) {
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
      margin-bottom: 16px;
    }
    
    .tasks {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .btn-primary {
      background: #4A90E2;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    
    .empty-state {
      text-align: center;
      padding: 60px;
      color: #666;
    }
  `]
})
export class TaskListComponent implements OnInit {
    private taskService = inject(TaskService);
    private wsService = inject(WebSocketService);
    private route = inject(ActivatedRoute);

    tasks = signal<Task[]>([]);
    loading = signal(false);
    projectId = signal('');

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId.set(params['id']);
            this.loadTasks();
            this.subscribeToUpdates();
        });
    }

    loadTasks(): void {
        this.loading.set(true);
        this.taskService.getTasksByProject(this.projectId())
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

    subscribeToUpdates(): void {
        this.wsService.joinProject(this.projectId());

        this.wsService.onTaskUpdated().subscribe(updatedTask => {
            const currentTasks = this.tasks();
            const index = currentTasks.findIndex(t => t.id === updatedTask.id);

            if (index !== -1) {
                const newTasks = [...currentTasks];
                newTasks[index] = updatedTask;
                this.tasks.set(newTasks);
            }
        });
    }

    onFilterChange(filterType: string, event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        // TODO: 實作篩選邏輯
        console.log('Filter changed:', filterType, value);
    }

    openCreateTaskDialog(): void {
        // TODO: 開啟建立任務對話框
        console.log('Open create task dialog');
    }

    openTaskDetail(task: Task): void {
        // TODO: 開啟任務詳情
        console.log('Open task detail:', task);
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