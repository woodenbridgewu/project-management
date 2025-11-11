import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { CommentService } from '../../../core/services/comment.service';
import { TagService } from '../../../core/services/tag.service';
import { AttachmentService } from '../../../core/services/attachment.service';
import { ActivityService } from '../../../core/services/activity.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { Task, Project, Comment, User, Tag, Attachment, Activity, WorkspaceMember } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './task-detail.component.html',
    styleUrls: ['./task-detail.component.css']
})
export class TaskDetailComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private taskService = inject(TaskService);
    private projectService = inject(ProjectService);
    private commentService = inject(CommentService);
    private tagService = inject(TagService);
    private attachmentService = inject(AttachmentService);
    private activityService = inject(ActivityService);
    private workspaceService = inject(WorkspaceService);
    private wsService = inject(WebSocketService);
    private authService = inject(AuthService);
    private navigationService = inject(NavigationService);

    task = signal<Task | null>(null);
    project = signal<Project | null>(null);
    loading = signal(false);
    saving = signal(false);
    isEditing = false;
    taskId = '';

    // 評論相關
    comments = signal<Comment[]>([]);
    loadingComments = signal(false);
    savingComment = signal(false);
    editingCommentId = signal<string | null>(null);
    newCommentContent = '';
    editCommentContent = '';
    private subscriptions: Subscription[] = [];

    // 標籤相關
    availableTags = signal<Tag[]>([]);
    loadingTags = signal(false);
    savingTag = signal(false);
    showTagModal = false;
    showManageTagsModal = false;
    editingTag: Tag | null = null;
    editTagForm = {
        name: '',
        color: '#808080'
    };
    newTagForm = {
        name: '',
        color: '#808080'
    };
    workspaceId = '';

    // 預設顏色選項
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

    // 附件相關
    attachments = signal<Attachment[]>([]);
    loadingAttachments = signal(false);
    uploadingAttachment = signal(false);
    selectedFile: File | null = null;

    // 活動紀錄相關
    activities = signal<Activity[]>([]);
    loadingActivities = signal(false);
    activitiesExpanded = signal(false);
    activitiesCurrentPage = signal(1);
    activitiesPageSize = 10;
    activitiesTotal = signal(0);
    activitiesTotalPages = signal(0);

    // 子任務相關
    subtasks = signal<Task[]>([]);
    loadingSubtasks = signal(false);
    savingSubtask = signal(false);
    showSubtaskModal = false;
    editingSubtask: Task | null = null;
    subtaskForm = {
        title: '',
        description: '',
        priority: '' as '' | 'low' | 'medium' | 'high' | 'urgent',
        dueDate: ''
    };

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
            this.loadComments();
            this.loadSubtasks();
            this.loadAttachments();
            // 載入活動紀錄總數（只載入第一頁的第一筆，以獲取總數）
            this.loadActivitiesCount();
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
                // 載入標籤列表和工作區成員
                if (this.workspaceId) {
                    this.loadTags();
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

    loadTags(): void {
        if (!this.workspaceId) return;
        
        this.loadingTags.set(true);
        this.tagService.getTagsByWorkspace(this.workspaceId).subscribe({
            next: (response) => {
                this.availableTags.set(response.tags);
                this.loadingTags.set(false);
            },
            error: (error) => {
                console.error('載入標籤失敗:', error);
                this.loadingTags.set(false);
            }
        });
    }

    createTag(): void {
        if (!this.newTagForm.name.trim() || !this.workspaceId) return;

        // 確保 color 格式正確（必須是 # 開頭的 6 位十六進制）
        let color = this.newTagForm.color || '#808080';
        if (!color.startsWith('#')) {
            color = '#' + color;
        }
        // 驗證顏色格式
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            alert('顏色格式不正確，請使用 #RRGGBB 格式（例如：#808080）');
            return;
        }

        this.savingTag.set(true);
        this.tagService.createTag(this.workspaceId, {
            name: this.newTagForm.name.trim(),
            color: color
        }).subscribe({
            next: () => {
                this.newTagForm = {
                    name: '',
                    color: '#808080'
                };
                this.loadTags();
                this.loadTask(); // 重新載入任務以更新標籤顯示
                this.closeTagModal();
                this.savingTag.set(false);
            },
            error: (error) => {
                console.error('建立標籤失敗:', error);
                const errorMessage = error.error?.error || error.error?.message || '未知錯誤';
                const errorDetails = error.error?.details ? JSON.stringify(error.error.details) : '';
                alert('建立標籤失敗：' + errorMessage + (errorDetails ? '\n詳細：' + errorDetails : ''));
                this.savingTag.set(false);
            }
        });
    }

    addTagToTask(tagId: string): void {
        if (!this.task()) return;

        this.savingTag.set(true);
        this.tagService.addTagToTask(this.taskId, tagId).subscribe({
            next: () => {
                // 重新載入任務以獲取更新的標籤列表
                this.loadTask();
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
                this.savingTag.set(false);
            },
            error: (error) => {
                console.error('添加標籤失敗:', error);
                alert('添加標籤失敗：' + (error.error?.error || '未知錯誤'));
                this.savingTag.set(false);
            }
        });
    }

    removeTagFromTask(tagId: string): void {
        if (!this.task()) return;

        if (!confirm('確定要移除這個標籤嗎？')) {
            return;
        }

        this.savingTag.set(true);
        this.tagService.removeTagFromTask(this.taskId, tagId).subscribe({
            next: () => {
                // 重新載入任務以獲取更新的標籤列表
                this.loadTask();
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
                this.savingTag.set(false);
            },
            error: (error) => {
                console.error('移除標籤失敗:', error);
                alert('移除標籤失敗：' + (error.error?.error || '未知錯誤'));
                this.savingTag.set(false);
            }
        });
    }

    isTagAttached(tagId: string): boolean {
        if (!this.task()?.tags) return false;
        return this.task()!.tags!.some(tag => tag.id === tagId);
    }

    getContrastColor(backgroundColor: string): string {
        // 計算對比色（白色或黑色）
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }

    closeTagModal(): void {
        this.showTagModal = false;
        this.newTagForm = {
            name: '',
            color: '#808080'
        };
    }

    closeManageTagsModal(): void {
        this.showManageTagsModal = false;
    }

    startEditTag(tag: Tag): void {
        this.editingTag = tag;
        this.editTagForm = {
            name: tag.name,
            color: tag.color
        };
    }

    cancelEditTag(): void {
        this.editingTag = null;
        this.editTagForm = {
            name: '',
            color: '#808080'
        };
    }

    updateTag(): void {
        if (!this.editingTag || !this.editTagForm.name.trim()) return;

        // 確保 color 格式正確
        let color = this.editTagForm.color || '#808080';
        if (!color.startsWith('#')) {
            color = '#' + color;
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            alert('顏色格式不正確，請使用 #RRGGBB 格式（例如：#808080）');
            return;
        }

        this.savingTag.set(true);
        this.tagService.updateTag(this.editingTag.id, {
            name: this.editTagForm.name.trim(),
            color: color
        }).subscribe({
            next: () => {
                this.loadTags();
                this.loadTask(); // 重新載入任務以更新標籤顯示
                this.cancelEditTag();
                this.savingTag.set(false);
            },
            error: (error) => {
                console.error('更新標籤失敗:', error);
                const errorMessage = error.error?.error || error.error?.message || '未知錯誤';
                const errorDetails = error.error?.details ? JSON.stringify(error.error.details) : '';
                alert('更新標籤失敗：' + errorMessage + (errorDetails ? '\n詳細：' + errorDetails : ''));
                this.savingTag.set(false);
            }
        });
    }

    confirmDeleteTag(tag: Tag): void {
        if (!confirm(`確定要刪除標籤「${tag.name}」嗎？\n\n刪除後，所有使用此標籤的任務將自動移除該標籤。`)) {
            return;
        }

        this.deleteTag(tag.id);
    }

    deleteTag(tagId: string): void {
        this.savingTag.set(true);
        this.tagService.deleteTag(tagId).subscribe({
            next: () => {
                this.loadTags();
                this.loadTask(); // 重新載入任務以更新標籤顯示
                this.savingTag.set(false);
            },
            error: (error) => {
                console.error('刪除標籤失敗:', error);
                alert('刪除標籤失敗：' + (error.error?.error || '未知錯誤'));
                this.savingTag.set(false);
            }
        });
    }

    loadComments(): void {
        this.loadingComments.set(true);
        this.commentService.getCommentsByTask(this.taskId).subscribe({
            next: (response) => {
                this.comments.set(response.comments);
                this.loadingComments.set(false);
            },
            error: (error) => {
                console.error('載入評論失敗:', error);
                this.loadingComments.set(false);
            }
        });
    }

    loadSubtasks(): void {
        this.loadingSubtasks.set(true);
        this.taskService.getSubtasks(this.taskId).subscribe({
            next: (response) => {
                this.subtasks.set(response.subtasks);
                this.loadingSubtasks.set(false);
            },
            error: (error) => {
                console.error('載入子任務失敗:', error);
                this.loadingSubtasks.set(false);
            }
        });
    }

    saveSubtask(): void {
        if (!this.subtaskForm.title.trim()) return;

        this.savingSubtask.set(true);

        const subtaskData: any = {
            title: this.subtaskForm.title.trim(),
            description: this.subtaskForm.description || undefined,
            priority: this.subtaskForm.priority || undefined
        };

        if (this.subtaskForm.dueDate) {
            subtaskData.dueDate = new Date(this.subtaskForm.dueDate).toISOString();
        }

        if (this.editingSubtask) {
            // 更新子任務
            this.taskService.updateTask(this.editingSubtask.id, subtaskData).subscribe({
                next: () => {
                    this.loadSubtasks();
                    this.loadTask(); // 重新載入任務以更新子任務數量
                    // 重新載入活動紀錄（回到第一頁）
                    this.loadActivitiesFirstPage();
                    this.closeSubtaskModal();
                    this.savingSubtask.set(false);
                },
                error: (error) => {
                    console.error('更新子任務失敗:', error);
                    alert('更新子任務失敗：' + (error.error?.error || '未知錯誤'));
                    this.savingSubtask.set(false);
                }
            });
        } else {
            // 建立子任務
            this.taskService.createSubtask(this.taskId, subtaskData).subscribe({
                next: () => {
                    this.loadSubtasks();
                    this.loadTask(); // 重新載入任務以更新子任務數量
                    // 重新載入活動紀錄（回到第一頁）
                    this.loadActivitiesFirstPage();
                    this.closeSubtaskModal();
                    this.savingSubtask.set(false);
                },
                error: (error) => {
                    console.error('建立子任務失敗:', error);
                    alert('建立子任務失敗：' + (error.error?.error || '未知錯誤'));
                    this.savingSubtask.set(false);
                }
            });
        }
    }

    editSubtask(subtask: Task): void {
        this.editingSubtask = subtask;
        this.subtaskForm = {
            title: subtask.title,
            description: subtask.description || '',
            priority: subtask.priority || '',
            dueDate: subtask.due_date ? this.formatDateForInput(subtask.due_date) : ''
        };
        this.showSubtaskModal = true;
    }

    deleteSubtask(subtaskId: string): void {
        if (!confirm('確定要刪除此子任務嗎？')) {
            return;
        }

        this.savingSubtask.set(true);
        this.taskService.deleteTask(subtaskId).subscribe({
            next: () => {
                this.loadSubtasks();
                this.loadTask(); // 重新載入任務以更新子任務數量
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
                this.savingSubtask.set(false);
            },
            error: (error) => {
                console.error('刪除子任務失敗:', error);
                alert('刪除子任務失敗：' + (error.error?.error || '未知錯誤'));
                this.savingSubtask.set(false);
            }
        });
    }

    toggleSubtaskStatus(subtask: Task): void {
        const newStatus = subtask.status === 'done' ? 'todo' : 'done';
        const updates: any = { status: newStatus };

        if (newStatus === 'done') {
            updates.completed_at = new Date().toISOString();
        } else {
            updates.completed_at = null;
        }

        this.savingSubtask.set(true);
        this.taskService.updateTask(subtask.id, updates).subscribe({
            next: () => {
                this.loadSubtasks();
                this.loadTask(); // 重新載入任務以更新子任務數量
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
                this.savingSubtask.set(false);
            },
            error: (error) => {
                console.error('更新子任務狀態失敗:', error);
                alert('更新子任務狀態失敗：' + (error.error?.error || '未知錯誤'));
                this.savingSubtask.set(false);
                // 重新載入以恢復原狀態
                this.loadSubtasks();
            }
        });
    }

    closeSubtaskModal(): void {
        this.showSubtaskModal = false;
        this.editingSubtask = null;
        this.subtaskForm = {
            title: '',
            description: '',
            priority: '',
            dueDate: ''
        };
    }

    formatDateForInput(date: Date | string): string {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        // 轉換為本地時間的 datetime-local 格式 (YYYY-MM-DDTHH:mm)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

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

        // 監聽評論新增
        const commentAddedSub = this.wsService.onCommentAdded().subscribe((comment: Comment) => {
            if (comment.task_id === this.taskId) {
                const currentComments = this.comments();
                if (!currentComments.find(c => c.id === comment.id)) {
                    this.comments.set([...currentComments, comment]);
                    // 重新載入活動紀錄
                    this.loadActivitiesFirstPage();
                }
            }
        });
        this.subscriptions.push(commentAddedSub);

        // 監聽評論更新
        const commentUpdatedSub = this.wsService.onCommentUpdated().subscribe((comment: Comment) => {
            if (comment.task_id === this.taskId) {
                const currentComments = this.comments();
                const index = currentComments.findIndex(c => c.id === comment.id);
                if (index !== -1) {
                    const updatedComments = [...currentComments];
                    updatedComments[index] = comment;
                    this.comments.set(updatedComments);
                    // 重新載入活動紀錄
                    this.loadActivitiesFirstPage();
                }
            }
        });
        this.subscriptions.push(commentUpdatedSub);

        // 監聽評論刪除
        const commentDeletedSub = this.wsService.onCommentDeleted().subscribe((data: { id: string; taskId: string }) => {
            if (data.taskId === this.taskId) {
                const currentComments = this.comments();
                this.comments.set(currentComments.filter(c => c.id !== data.id));
                // 重新載入活動紀錄
                this.loadActivitiesFirstPage();
            }
        });
        this.subscriptions.push(commentDeletedSub);

        // 監聽附件新增
        const attachmentAddedSub = this.wsService.onAttachmentAdded().subscribe((attachment: Attachment) => {
            if (attachment.task_id === this.taskId) {
                const currentAttachments = this.attachments();
                // 檢查附件是否已存在（避免重複添加）
                if (!currentAttachments.find(a => a.id === attachment.id)) {
                    // 將新附件添加到列表開頭（最新的在前）
                    this.attachments.set([attachment, ...currentAttachments]);
                    // 重新載入活動紀錄
                    this.loadActivitiesFirstPage();
                }
            }
        });
        this.subscriptions.push(attachmentAddedSub);

        // 監聽附件刪除
        const attachmentDeletedSub = this.wsService.onAttachmentDeleted().subscribe((data: { id: string; taskId: string }) => {
            if (data.taskId === this.taskId) {
                const currentAttachments = this.attachments();
                this.attachments.set(currentAttachments.filter(a => a.id !== data.id));
                // 重新載入活動紀錄
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

    addComment(): void {
        if (!this.newCommentContent.trim()) return;

        this.savingComment.set(true);
        this.commentService.createComment(this.taskId, { content: this.newCommentContent.trim() }).subscribe({
            next: (response) => {
                // WebSocket 會自動添加新評論，這裡只需要清空輸入框
                this.newCommentContent = '';
                this.savingComment.set(false);
                // 重新載入評論以確保同步
                this.loadComments();
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('新增評論失敗:', error);
                alert('新增評論失敗：' + (error.error?.error || '未知錯誤'));
                this.savingComment.set(false);
            }
        });
    }

    startEditComment(comment: Comment): void {
        this.editingCommentId.set(comment.id);
        this.editCommentContent = comment.content;
    }

    cancelEditComment(): void {
        this.editingCommentId.set(null);
        this.editCommentContent = '';
    }

    saveEditComment(commentId: string): void {
        if (!this.editCommentContent.trim()) return;

        this.savingComment.set(true);
        this.commentService.updateComment(commentId, { content: this.editCommentContent.trim() }).subscribe({
            next: () => {
                // 更新本地評論列表
                const currentComments = this.comments();
                const updatedComments = currentComments.map(c => 
                    c.id === commentId 
                        ? { ...c, content: this.editCommentContent.trim(), updated_at: new Date().toISOString() }
                        : c
                );
                this.comments.set(updatedComments);
                this.cancelEditComment();
                this.savingComment.set(false);
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('更新評論失敗:', error);
                alert('更新評論失敗：' + (error.error?.error || '未知錯誤'));
                this.savingComment.set(false);
            }
        });
    }

    deleteComment(commentId: string): void {
        if (!confirm('確定要刪除此評論嗎？')) return;

        this.savingComment.set(true);
        this.commentService.deleteComment(commentId).subscribe({
            next: () => {
                // 從本地評論列表中移除
                const currentComments = this.comments();
                this.comments.set(currentComments.filter(c => c.id !== commentId));
                this.savingComment.set(false);
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('刪除評論失敗:', error);
                alert('刪除評論失敗：' + (error.error?.error || '未知錯誤'));
                this.savingComment.set(false);
            }
        });
    }

    canEditComment(comment: Comment): boolean {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return false;
        
        // 檢查評論是否屬於當前使用者
        const commentUserId = comment.user_id || comment.user.id;
        const currentUserId = currentUser.id;
        
        return String(commentUserId) === String(currentUserId);
    }

    formatCommentTime(date: Date | string | undefined): string {
        if (!date) return '';
        
        // 後端已經返回 ISO 8601 格式（UTC），直接解析
        const d = new Date(date);
        
        // 驗證日期是否有效
        if (isNaN(d.getTime())) {
            return '';
        }
        
        const now = new Date();
        // 計算時間差（毫秒）
        const diff = now.getTime() - d.getTime();
        
        // 如果時間差為負數（未來時間），顯示為"剛剛"
        if (diff < 0) {
            return '剛剛';
        }
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '剛剛';
        if (minutes < 60) return `${minutes} 分鐘前`;
        if (hours < 24) return `${hours} 小時前`;
        if (days < 7) return `${days} 天前`;
        return d.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

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

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            todo: '待辦',
            in_progress: '進行中',
            review: '審核中',
            done: '已完成'
        };
        return labels[status] || status;
    }

    getPriorityLabel(priority: string): string {
        const labels: Record<string, string> = {
            low: '低',
            medium: '中',
            high: '高',
            urgent: '緊急'
        };
        return labels[priority] || priority;
    }

    formatDate(date: Date | string | undefined): string {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateTime(date: Date | string | undefined): string {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('zh-TW');
    }

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

    isOverdue(date: Date | string | undefined): boolean {
        if (!date) return false;
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        // 對於子任務，只檢查日期是否過期
        // 對於主任務，還要檢查任務是否已完成
        return d < new Date() && !this.task()?.completed_at;
    }

    getInitials(name: string): string {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    // 附件相關方法
    loadAttachments(): void {
        this.loadingAttachments.set(true);
        this.attachmentService.getAttachmentsByTask(this.taskId).subscribe({
            next: (response) => {
                this.attachments.set(response.attachments);
                this.loadingAttachments.set(false);
            },
            error: (error) => {
                console.error('載入附件失敗:', error);
                this.loadingAttachments.set(false);
            }
        });
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
            this.uploadAttachment();
        }
    }

    uploadAttachment(): void {
        if (!this.selectedFile) return;

        this.uploadingAttachment.set(true);
        this.attachmentService.uploadAttachment(this.taskId, this.selectedFile).subscribe({
            next: (response) => {
                // 不手動添加附件，完全依賴 WebSocket 事件來處理，避免重複顯示
                // WebSocket 監聽器有重複檢查邏輯，不會導致重複添加
                this.selectedFile = null;
                this.uploadingAttachment.set(false);
                // 重新載入任務以更新附件數量（不重新載入附件列表，避免與 WebSocket 衝突）
                this.loadTask();
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('上傳附件失敗:', error);
                alert('上傳附件失敗：' + (error.error?.error || '未知錯誤'));
                this.uploadingAttachment.set(false);
                this.selectedFile = null;
            }
        });
    }

    deleteAttachment(attachmentId: string): void {
        if (!confirm('確定要刪除此附件嗎？')) return;

        this.attachmentService.deleteAttachment(attachmentId).subscribe({
            next: () => {
                // 不手動移除附件，讓 WebSocket 事件來處理，避免重複操作
                // WebSocket 會自動從列表中移除附件
                // 重新載入任務以更新附件數量
                this.loadTask();
                // 重新載入活動紀錄（回到第一頁）
                this.loadActivitiesFirstPage();
            },
            error: (error) => {
                console.error('刪除附件失敗:', error);
                alert('刪除附件失敗：' + (error.error?.error || '未知錯誤'));
            }
        });
    }

    downloadAttachment(attachment: Attachment): void {
        const url = this.attachmentService.getAttachmentUrl(attachment.file_url, attachment.id);
        window.open(url, '_blank');
    }

    formatFileSize(bytes: number): string {
        return this.attachmentService.formatFileSize(bytes);
    }

    getFileIcon(fileType: string): string {
        return this.attachmentService.getFileIcon(fileType);
    }

    isImage(fileType: string): boolean {
        return this.attachmentService.isImage(fileType);
    }

    getImagePreviewUrl(attachment: Attachment): string {
        return this.attachmentService.getImagePreviewUrl(attachment);
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        if (img) {
            img.style.display = 'none';
        }
    }

    canDeleteAttachment(attachment: Attachment): boolean {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return false;
        return String(attachment.uploaded_by) === String(currentUser.id);
    }

    // 活動紀錄相關方法
    loadActivities(page: number = 1): void {
        this.loadingActivities.set(true);
        const offset = (page - 1) * this.activitiesPageSize;
        
        this.activityService.getTaskActivities(this.taskId, this.activitiesPageSize, offset).subscribe({
            next: (response) => {
                this.activities.set(response.activities);
                this.activitiesTotal.set(response.total);
                this.activitiesTotalPages.set(Math.ceil(response.total / this.activitiesPageSize));
                this.activitiesCurrentPage.set(page);
                this.loadingActivities.set(false);
            },
            error: (error) => {
                console.error('載入活動紀錄失敗:', error);
                this.loadingActivities.set(false);
            }
        });
    }

    // 載入活動紀錄總數（只載入第一筆以獲取總數）
    loadActivitiesCount(): void {
        this.activityService.getTaskActivities(this.taskId, 1, 0).subscribe({
            next: (response) => {
                // 只更新總數，不更新活動列表
                this.activitiesTotal.set(response.total);
                this.activitiesTotalPages.set(Math.ceil(response.total / this.activitiesPageSize));
            },
            error: (error) => {
                // 靜默失敗，不影響其他功能
                console.error('載入活動紀錄總數失敗:', error);
            }
        });
    }

    loadActivitiesFirstPage(): void {
        this.loadActivities(1);
    }

    loadActivitiesLastPage(): void {
        const totalPages = this.activitiesTotalPages();
        if (totalPages > 0) {
            this.loadActivities(totalPages);
        }
    }

    loadActivitiesNextPage(): void {
        const currentPage = this.activitiesCurrentPage();
        const totalPages = this.activitiesTotalPages();
        if (currentPage < totalPages) {
            this.loadActivities(currentPage + 1);
        }
    }

    loadActivitiesPrevPage(): void {
        const currentPage = this.activitiesCurrentPage();
        if (currentPage > 1) {
            this.loadActivities(currentPage - 1);
        }
    }

    goToActivitiesPage(page: number): void {
        const totalPages = this.activitiesTotalPages();
        if (page >= 1 && page <= totalPages) {
            this.loadActivities(page);
        }
    }

    getActivitiesPageNumbers(): number[] {
        const currentPage = this.activitiesCurrentPage();
        const totalPages = this.activitiesTotalPages();
        const pages: number[] = [];
        
        // 顯示最多 5 個頁碼
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // 如果接近最後一頁，調整起始頁
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        return pages;
    }

    onActivitiesToggle(): void {
        const wasExpanded = this.activitiesExpanded();
        this.activitiesExpanded.set(!wasExpanded);
        
        // 如果展開且還沒有載入過活動紀錄（或總筆數為0），則載入第一頁
        if (!wasExpanded && (this.activities().length === 0 || this.activitiesTotal() === 0)) {
            this.loadActivitiesFirstPage();
        }
    }

    // 截取文字，超過長度用「...」代替
    private truncateText(text: string, maxLength: number): string {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getActivityDescription(activity: Activity): string {
        const userName = activity.user?.fullName || '未知使用者';
        const action = activity.action;
        const entityType = activity.entity_type;
        const changes = activity.changes || {};

        switch (entityType) {
            case 'task':
                // 檢查是否為子任務（有 parentTaskId）
                const isSubtask = changes.parentTaskId !== undefined;
                const subtaskTitle = changes.subtaskTitle || '';
                const taskTitle = changes.taskTitle || '';
                
                switch (action) {
                    case 'created':
                        if (isSubtask && subtaskTitle) {
                            return `${userName} 建立了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                        }
                        return isSubtask ? `${userName} 建立了子任務` : `${userName} 建立了任務`;
                    case 'updated':
                        // 檢查更新了什麼
                        if (isSubtask) {
                            // 子任務完成
                            if (changes.completed === true && subtaskTitle) {
                                return `${userName} 完成了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                            }
                            // 子任務狀態更新
                            if (changes.newStatus && subtaskTitle) {
                                const statusMap: Record<string, string> = {
                                    'todo': '待辦',
                                    'in_progress': '進行中',
                                    'review': '審核中',
                                    'done': '已完成'
                                };
                                const statusText = statusMap[changes.newStatus] || changes.newStatus;
                                return `${userName} 將子任務「${this.truncateText(subtaskTitle, 30)}」更新為${statusText}`;
                            }
                            // 子任務更新（收集所有更新的欄位）
                            const subtaskUpdateItems: string[] = [];
                            
                            // 子任務完成
                            if (changes.completed === true && subtaskTitle) {
                                return `${userName} 完成了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                            }
                            
                            // 子任務狀態更新
                            if (changes.newStatus && subtaskTitle) {
                                const statusMap: Record<string, string> = {
                                    'todo': '待辦',
                                    'in_progress': '進行中',
                                    'review': '審核中',
                                    'done': '已完成'
                                };
                                const statusText = statusMap[changes.newStatus] || changes.newStatus;
                                subtaskUpdateItems.push(`狀態為${statusText}`);
                            }
                            
                            // 子任務標題更新
                            if (changes.newTitle !== undefined) {
                                subtaskUpdateItems.push(`標題「${this.truncateText(changes.newTitle, 30)}」`);
                            }
                            
                            // 子任務描述更新
                            if (changes.newDescription !== undefined) {
                                const descText = changes.newDescription ? this.truncateText(changes.newDescription, 30) : '（已清除）';
                                subtaskUpdateItems.push(`描述「${descText}」`);
                            }
                            
                            // 子任務優先級更新
                            if (changes.newPriority !== undefined) {
                                const priorityMap: Record<string, string> = {
                                    'low': '低',
                                    'medium': '中',
                                    'high': '高',
                                    'urgent': '緊急'
                                };
                                const priorityText = priorityMap[changes.newPriority] || changes.newPriority;
                                subtaskUpdateItems.push(`優先級為${priorityText}`);
                            }
                            
                            // 根據更新的欄位數量顯示不同的描述
                            if (subtaskUpdateItems.length > 0) {
                                const subtaskName = subtaskTitle ? `子任務「${this.truncateText(subtaskTitle, 30)}」` : '子任務';
                                if (subtaskUpdateItems.length === 1) {
                                    // 單一更新
                                    if (subtaskUpdateItems[0].includes('標題')) {
                                        return `${userName} 更新了${subtaskName}的${subtaskUpdateItems[0]}`;
                                    } else if (subtaskUpdateItems[0].includes('描述')) {
                                        return `${userName} 更新了${subtaskName}的${subtaskUpdateItems[0]}`;
                                    } else if (subtaskUpdateItems[0].includes('狀態')) {
                                        return `${userName} 將${subtaskName}${subtaskUpdateItems[0]}`;
                                    } else if (subtaskUpdateItems[0].includes('優先級')) {
                                        return `${userName} 將${subtaskName}${subtaskUpdateItems[0]}`;
                                    } else {
                                        return `${userName} 更新了${subtaskName}的${subtaskUpdateItems[0]}`;
                                    }
                                } else {
                                    // 多個更新
                                    return `${userName} 更新了${subtaskName}：${subtaskUpdateItems.join('、')}`;
                                }
                            }
                            
                            // 其他更新
                            if (subtaskTitle) {
                                return `${userName} 更新了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                            }
                            return `${userName} 更新了子任務`;
                        } else {
                            // 一般任務更新（收集所有更新的欄位）
                            const updateItems: string[] = [];
                            
                            // 標題更新
                            if (changes.newTitle !== undefined) {
                                updateItems.push(`標題「${this.truncateText(changes.newTitle, 30)}」`);
                            }
                            // 描述更新
                            if (changes.newDescription !== undefined) {
                                const descText = changes.newDescription ? this.truncateText(changes.newDescription, 30) : '（已清除）';
                                updateItems.push(`描述「${descText}」`);
                            }
                            // 狀態更新
                            if (changes.newStatus !== undefined) {
                                const statusMap: Record<string, string> = {
                                    'todo': '待辦',
                                    'in_progress': '進行中',
                                    'review': '審核中',
                                    'done': '已完成'
                                };
                                const statusText = statusMap[changes.newStatus] || changes.newStatus;
                                updateItems.push(`狀態為${statusText}`);
                            }
                            // 優先級更新
                            if (changes.newPriority !== undefined) {
                                const priorityMap: Record<string, string> = {
                                    'low': '低',
                                    'medium': '中',
                                    'high': '高',
                                    'urgent': '緊急'
                                };
                                const priorityText = priorityMap[changes.newPriority] || changes.newPriority;
                                updateItems.push(`優先級為${priorityText}`);
                            }
                            // 指派對象更新
                            if (changes.newAssigneeId !== undefined) {
                                updateItems.push('指派對象');
                            }
                            // 截止日期更新
                            if (changes.newDueDate !== undefined) {
                                updateItems.push('截止日期');
                            }
                            // 預估時數更新
                            if (changes.newEstimatedHours !== undefined) {
                                updateItems.push('預估時數');
                            }
                            
                            // 根據更新的欄位數量顯示不同的描述
                            if (updateItems.length > 0) {
                                if (updateItems.length === 1) {
                                    // 單一更新
                                    if (updateItems[0].includes('標題')) {
                                        return `${userName} 更新了${updateItems[0]}`;
                                    } else if (updateItems[0].includes('描述')) {
                                        return `${userName} 更新了${updateItems[0]}`;
                                    } else if (updateItems[0].includes('狀態')) {
                                        return `${userName} 將任務${updateItems[0]}`;
                                    } else if (updateItems[0].includes('優先級')) {
                                        return `${userName} 將任務${updateItems[0]}`;
                                    } else {
                                        return `${userName} 更新了任務${updateItems[0]}`;
                                    }
                                } else {
                                    // 多個更新
                                    return `${userName} 更新了任務：${updateItems.join('、')}`;
                                }
                            }
                            
                            // 其他更新
                            if (taskTitle) {
                                return `${userName} 更新了任務「${this.truncateText(taskTitle, 30)}」`;
                            }
                            return `${userName} 更新了任務`;
                        }
                    case 'deleted':
                        if (isSubtask && subtaskTitle) {
                            return `${userName} 刪除了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                        }
                        return isSubtask ? `${userName} 刪除了子任務` : `${userName} 刪除了任務`;
                    case 'moved':
                        if (isSubtask && subtaskTitle) {
                            return `${userName} 移動了子任務「${this.truncateText(subtaskTitle, 30)}」`;
                        }
                        return isSubtask ? `${userName} 移動了子任務` : `${userName} 移動了任務`;
                    default:
                        return isSubtask ? `${userName} ${action} 了子任務` : `${userName} ${action} 了任務`;
                }
            case 'comment':
                const commentContent = changes.commentContent || '';
                switch (action) {
                    case 'created':
                        if (commentContent) {
                            return `${userName} 新增了評論「${this.truncateText(commentContent, 30)}」`;
                        }
                        return `${userName} 新增了評論`;
                    case 'updated':
                        if (commentContent) {
                            return `${userName} 編輯了評論「${this.truncateText(commentContent, 30)}」`;
                        }
                        return `${userName} 編輯了評論`;
                    case 'deleted':
                        if (commentContent) {
                            return `${userName} 刪除了評論「${this.truncateText(commentContent, 30)}」`;
                        }
                        return `${userName} 刪除了評論`;
                    default:
                        return `${userName} ${action} 了評論`;
                }
            case 'attachment':
                switch (action) {
                    case 'created':
                        const fileName = changes.fileName || '檔案';
                        return `${userName} 上傳了附件「${this.truncateText(fileName, 30)}」`;
                    case 'deleted':
                        const deletedFileName = changes.fileName || '檔案';
                        return `${userName} 刪除了附件「${this.truncateText(deletedFileName, 30)}」`;
                    default:
                        return `${userName} ${action} 了附件`;
                }
            case 'tag':
                switch (action) {
                    case 'added_to_task':
                        const tagName = changes.tagName || '標籤';
                        return `${userName} 添加了標籤「${this.truncateText(tagName, 30)}」`;
                    case 'removed_from_task':
                        const removedTagName = changes.tagName || '標籤';
                        return `${userName} 移除了標籤「${this.truncateText(removedTagName, 30)}」`;
                    default:
                        return `${userName} ${action} 了標籤`;
                }
            default:
                return `${userName} ${action} 了 ${entityType}`;
        }
    }
}

