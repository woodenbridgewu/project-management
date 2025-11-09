import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ProjectService } from '../../../core/services/project.service';
import { SectionService } from '../../../core/services/section.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { Task, Section, WorkspaceMember } from '../../../core/models/task.model';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';

@Component({
    selector: 'app-task-list',
    standalone: true,
    imports: [CommonModule, FormsModule, TaskCardComponent],
    templateUrl: './task-list.component.html',
    styleUrls: ['./task-list.component.css']
})
export class TaskListComponent implements OnInit, OnDestroy {
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
    private subscriptions: Subscription[] = [];

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

    ngOnDestroy(): void {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
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
        // 確保 WebSocket 已連接並加入專案房間
        this.wsService.connect();
        this.wsService.joinProject(this.projectId());

        // 監聽任務創建
        const taskCreatedSub = this.wsService.onTaskCreated().subscribe((task: Task) => {
            if (task.project_id === this.projectId()) {
                // 重新載入任務列表
                this.loadTasks();
            }
        });
        this.subscriptions.push(taskCreatedSub);

        // 監聽任務更新
        const taskUpdatedSub = this.wsService.onTaskUpdated().subscribe((updatedTask: Task) => {
            if (updatedTask.project_id === this.projectId()) {
                const currentTasks = this.tasks();
                const index = currentTasks.findIndex(t => t.id === updatedTask.id);

                if (index !== -1) {
                    const newTasks = [...currentTasks];
                    newTasks[index] = updatedTask;
                    this.tasks.set(newTasks);
                } else {
                    // 任務不在列表中，重新載入
                    this.loadTasks();
                }
            }
        });
        this.subscriptions.push(taskUpdatedSub);

        // 監聽任務刪除
        const taskDeletedSub = this.wsService.onTaskDeleted().subscribe((data: { id: string; projectId: string }) => {
            if (data.projectId === this.projectId()) {
                const currentTasks = this.tasks();
                this.tasks.set(currentTasks.filter(t => t.id !== data.id));
            }
        });
        this.subscriptions.push(taskDeletedSub);

        // 監聽任務移動
        const taskMovedSub = this.wsService.onTaskMoved().subscribe((data: { id: string; projectId: string; oldSectionId: string | null; newSectionId: string | null; position: number }) => {
            if (data.projectId === this.projectId()) {
                // 重新載入任務列表以確保順序正確
                this.loadTasks();
            }
        });
        this.subscriptions.push(taskMovedSub);
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