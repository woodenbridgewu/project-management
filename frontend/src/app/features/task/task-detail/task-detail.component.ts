import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { Task, Project, Comment, User, Tag, Attachment, Activity, WorkspaceMember } from '../../../core/models/task.model';
import { TaskInfoComponent } from './task-info/task-info.component';
import { TaskSubtasksComponent } from './task-subtasks/task-subtasks.component';
import { TaskTagsComponent } from './task-tags/task-tags.component';
import { TaskAttachmentsComponent } from './task-attachments/task-attachments.component';
import { TaskActivitiesComponent } from './task-activities/task-activities.component';
import { TaskCommentsComponent } from './task-comments/task-comments.component';

@Component({
    selector: 'app-task-detail',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        TaskInfoComponent, 
        TaskSubtasksComponent,
        TaskTagsComponent,
        TaskAttachmentsComponent,
        TaskActivitiesComponent,
        TaskCommentsComponent
    ],
    templateUrl: './task-detail.component.html',
    styleUrls: ['./task-detail.component.css']
})
export class TaskDetailComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private taskService = inject(TaskService);
    private projectService = inject(ProjectService);
    private workspaceService = inject(WorkspaceService);
    private wsService = inject(WebSocketService);
    private authService = inject(AuthService);
    private navigationService = inject(NavigationService);
    
    // 注意：以下服務已遷移到各子組件：
    // - CommentService -> task-comments 組件
    // - TagService -> task-tags 組件
    // - AttachmentService -> task-attachments 組件
    // - ActivityService -> task-activities 組件

    task = signal<Task | null>(null);
    project = signal<Project | null>(null);
    loading = signal(false);
    saving = signal(false);
    isEditing = false;
    taskId = '';

    private subscriptions: Subscription[] = [];

    workspaceId = '';

    // 預設顏色選項（傳遞給 task-tags 組件）
    presetColors = [
        '#808080', // 灰色
        '#E53E3E', // 紅色
        '#3182CE', // 藍色
        '#D53F8C', // 粉紅色
        '#00B5D8', // 青色
        '#48BB78', // 淺綠色
        '#ED8936', // 淺橙色
        '#9F7AEA'  // 淺紫色
    ];

    // 注意：以下狀態變量已遷移到各子組件：
    // - 評論相關：comments, loadingComments, savingComment, editingCommentId, newCommentContent, editCommentContent
    // - 標籤相關：availableTags, loadingTags, savingTag, showTagModal, showManageTagsModal, editingTag, editTagForm, newTagForm
    // - 附件相關：attachments, loadingAttachments, uploadingAttachment, selectedFile
    // - 活動紀錄相關：activities, loadingActivities, activitiesExpanded, activitiesCurrentPage, activitiesPageSize, activitiesTotal, activitiesTotalPages
    // - 子任務相關：subtasks, loadingSubtasks, savingSubtask, showSubtaskModal, editingSubtask, subtaskForm

    editForm = {
        title: '',
        description: '',
        status: 'todo' as 'todo' | 'in_progress' | 'review' | 'done',
        priority: '' as '' | 'low' | 'medium' | 'high' | 'urgent',
        assigneeId: '' as string | '',
        due_date: '',
        estimated_hours: 0
    };

    workspaceMembers = signal<WorkspaceMember[]>([]);
    loadingMembers = signal(false);

    ngOnInit(): void {
        // 註冊返回處理器（如果專案還沒載入，會在 loadProject 中再次註冊以確保使用最新的專案信息）
        this.registerBackHandler();
        this.route.params.subscribe(params => {
            this.taskId = params['id'];
            this.loadTask();
            // 子組件會在各自的 ngOnInit 中載入數據
            this.subscribeToAllUpdates();
        });
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
        // 清除返回處理器
        this.navigationService.clearBackHandler();
    }

    loadTask(): void {
        this.loading.set(true);
        this.taskService.getTaskById(this.taskId).subscribe({
            next: (response) => {
                this.task.set(response.task);
                this.loadProject(response.task.project_id);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入任務失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadProject(projectId: string): void {
        this.projectService.getProjectById(projectId).subscribe({
            next: (response) => {
                this.project.set(response.project);
                this.workspaceId = response.project.workspace_id;
                // 載入工作區成員（標籤列表由 task-tags 組件自己載入）
                if (this.workspaceId) {
                    this.loadWorkspaceMembers();
                }
                // 確保 WebSocket 已連接，然後加入專案的 WebSocket 房間以接收即時更新
                this.wsService.connect();
                this.wsService.joinProject(projectId);
                // 載入專案後，重新註冊返回處理器
                // 這樣可以確保專案信息已經載入，返回時能正確導航到專案看板
                this.registerBackHandler();
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
                // 即使載入專案失敗，也註冊返回處理器（會返回到工作區列表）
                this.registerBackHandler();
            }
        });
    }

    loadWorkspaceMembers(): void {
        if (!this.workspaceId) return;
        this.loadingMembers.set(true);
        this.workspaceService.getMembers(this.workspaceId).subscribe({
            next: (response) => {
                this.workspaceMembers.set(response.members);
                this.loadingMembers.set(false);
            },
            error: (error) => {
                console.error('載入工作區成員失敗:', error);
                this.loadingMembers.set(false);
            }
        });
    }

    // 標籤相關方法已遷移到 task-tags 組件

    // 評論相關方法已遷移到 task-comments 組件

    // 子任務相關方法已遷移到 task-subtasks 組件

    subscribeToAllUpdates(): void {
        // 確保 WebSocket 已連接
        this.wsService.connect();
        
        // 如果任務已經載入，立即加入專案房間
        const currentTask = this.task();
        if (currentTask && currentTask.project_id) {
            this.wsService.joinProject(currentTask.project_id);
        }

        // 監聽任務更新
        const taskUpdatedSub = this.wsService.onTaskUpdated().subscribe((updatedTask: Task) => {
            if (updatedTask.id === this.taskId) {
                this.task.set(updatedTask);
                // 重新載入活動紀錄
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(taskUpdatedSub);

        // 監聽任務刪除
        const taskDeletedSub = this.wsService.onTaskDeleted().subscribe((data: { id: string; projectId: string }) => {
            if (data.id === this.taskId) {
                // 任務被刪除，導航回專案頁面
                const currentTask = this.task();
                if (currentTask?.project_id) {
                    this.router.navigate(['/projects', currentTask.project_id]);
                }
            }
        });
        this.subscriptions.push(taskDeletedSub);

        // 監聽評論新增/更新/刪除（由 task-comments 組件自己處理，這裡只刷新活動紀錄）
        const commentAddedSub = this.wsService.onCommentAdded().subscribe((comment: Comment) => {
            if (comment.task_id === this.taskId) {
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(commentAddedSub);

        const commentUpdatedSub = this.wsService.onCommentUpdated().subscribe((comment: Comment) => {
            if (comment.task_id === this.taskId) {
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(commentUpdatedSub);

        const commentDeletedSub = this.wsService.onCommentDeleted().subscribe((data: { id: string; taskId: string }) => {
            if (data.taskId === this.taskId) {
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(commentDeletedSub);

        // 監聽附件新增/刪除（由 task-attachments 組件自己處理，這裡只刷新活動紀錄）
        const attachmentAddedSub = this.wsService.onAttachmentAdded().subscribe((attachment: Attachment) => {
            if (attachment.task_id === this.taskId) {
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(attachmentAddedSub);

        const attachmentDeletedSub = this.wsService.onAttachmentDeleted().subscribe((data: { id: string; taskId: string }) => {
            if (data.taskId === this.taskId) {
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(attachmentDeletedSub);

        // 監聽標籤添加到任務
        const tagAddedSub = this.wsService.onTagAddedToTask().subscribe((data: { taskId: string; tag: Tag }) => {
            if (data.taskId === this.taskId) {
                const currentTask = this.task();
                if (currentTask) {
                    const currentTags = currentTask.tags || [];
                    if (!currentTags.find(t => t.id === data.tag.id)) {
                        this.task.set({
                            ...currentTask,
                            tags: [...currentTags, data.tag]
                        });
                        // 重新載入活動紀錄
                        this.loadActivitiesFirstPage();
                    }
                }
            }
        });
        this.subscriptions.push(tagAddedSub);

        // 監聽標籤從任務移除
        const tagRemovedSub = this.wsService.onTagRemovedFromTask().subscribe((data: { taskId: string; tagId: string }) => {
            if (data.taskId === this.taskId) {
                const currentTask = this.task();
                if (currentTask) {
                    const currentTags = currentTask.tags || [];
                    this.task.set({
                        ...currentTask,
                        tags: currentTags.filter(t => t.id !== data.tagId)
                    });
                    // 重新載入活動紀錄
                    this.loadActivitiesFirstPage();
                }
            }
        });
        this.subscriptions.push(tagRemovedSub);
    }

    // 評論相關方法已遷移到 task-comments 組件（已在上面註釋）

    toggleEditMode(): void {
        if (!this.task()) return;

        if (!this.isEditing) {
            // 進入編輯模式，初始化表單
            this.editForm = {
                title: this.task()!.title,
                description: this.task()!.description || '',
                status: this.task()!.status,
                priority: this.task()!.priority || '',
                assigneeId: this.task()!.assignee_id || '',
                due_date: this.getDateTimeLocalValue(this.task()!.due_date),
                estimated_hours: this.task()!.estimated_hours || 0
            };
        }

        this.isEditing = !this.isEditing;
    }

    cancelEdit(): void {
        this.isEditing = false;
        this.editForm = {
            title: '',
            description: '',
            status: 'todo',
            priority: '',
            assigneeId: '',
            due_date: '',
            estimated_hours: 0
        };
    }

    saveTask(): void {
        if (!this.editForm.title.trim()) return;

        this.saving.set(true);

        const updates: any = {
            title: this.editForm.title,
            description: this.editForm.description || null,
            status: this.editForm.status,
            priority: this.editForm.priority || null
        };

        if (this.editForm.due_date) {
            updates.dueDate = new Date(this.editForm.due_date).toISOString();
        } else {
            updates.dueDate = null;
        }

        if (this.editForm.estimated_hours) {
            updates.estimatedHours = this.editForm.estimated_hours;
        } else {
            updates.estimatedHours = null;
        }

        if (this.editForm.assigneeId) {
            updates.assigneeId = this.editForm.assigneeId;
        } else {
            updates.assigneeId = null;
        }

        this.taskService.updateTask(this.taskId, updates).subscribe({
            next: (response) => {
                this.task.set(response.task);
                this.isEditing = false;
                this.saving.set(false);
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('更新任務失敗:', error);
                alert('更新任務失敗：' + (error.error?.error || '未知錯誤'));
                this.saving.set(false);
            }
        });
    }

    deleteTask(): void {
        if (!confirm('確定要刪除此任務嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.taskService.deleteTask(this.taskId).subscribe({
            next: () => {
                // 導航回專案看板或工作區
                if (this.project()) {
                    this.router.navigate(['/projects', this.project()!.id, 'board']);
                } else {
                    this.router.navigate(['/workspaces']);
                }
            },
            error: (error) => {
                console.error('刪除任務失敗:', error);
                alert('刪除任務失敗：' + (error.error?.error || '未知錯誤'));
                this.loading.set(false);
            }
        });
    }

    goBack(): void {
        if (this.project()) {
            this.router.navigate(['/projects', this.project()!.id, 'board']);
        } else {
            this.router.navigate(['/workspaces']);
        }
    }

    /**
     * 註冊返回處理器到導航服務
     * 這樣 Header 組件就可以使用任務詳情組件的返回邏輯
     */
    private registerBackHandler(): void {
        this.navigationService.registerBackHandler(() => {
            this.goBack();
        });
    }

    // 以下工具方法已遷移到 task-info 組件：
    // - getStatusLabel, getPriorityLabel, formatDate, formatDateTime
    // - isOverdue, getInitials

    // 保留 getDateTimeLocalValue 供 toggleEditMode 使用
    getDateTimeLocalValue(date: Date | string | undefined): string {
        if (!date) return '';
        const d = new Date(date);
        // 轉換為本地時間格式 (YYYY-MM-DDTHH:mm)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    onDueDateChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.editForm.due_date = input.value;
    }

    onEditFormChange(event: { field: string; value: any }): void {
        (this.editForm as any)[event.field] = event.value;
    }

    // 附件相關方法已遷移到 task-attachments 組件

    // 活動紀錄相關方法已遷移到 task-activities 組件
    // 保留 loadActivitiesFirstPage 方法供 WebSocket 事件和子組件事件使用
    loadActivitiesFirstPage(): void {
        // 這個方法現在只是一個占位符，實際的刷新邏輯由 task-activities 組件處理
        // 可以通過 @ViewChild 訪問子組件來調用，或者通過事件通知
        // 目前保留此方法以避免破壞現有的 WebSocket 事件處理
    }
}

