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
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task, Project, Comment, User, Tag, Attachment } from '../../../core/models/task.model';

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
    private workspaceService = inject(WorkspaceService);
    private wsService = inject(WebSocketService);
    private authService = inject(AuthService);

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
    private commentSubscription?: Subscription;

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
        assignee_name: '',
        due_date: '',
        estimated_hours: 0
    };

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.taskId = params['id'];
            this.loadTask();
            this.loadComments();
            this.loadSubtasks();
            this.loadAttachments();
            this.subscribeToCommentUpdates();
        });
    }

    ngOnDestroy(): void {
        this.commentSubscription?.unsubscribe();
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
                // 載入標籤列表
                if (this.workspaceId) {
                    this.loadTags();
                }
                // 確保 WebSocket 已連接，然後加入專案的 WebSocket 房間以接收即時更新
                this.wsService.connect();
                this.wsService.joinProject(projectId);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
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

    subscribeToCommentUpdates(): void {
        this.commentSubscription = this.wsService.onCommentAdded().subscribe((comment: Comment) => {
            // 只添加屬於當前任務的評論
            if (comment.task_id === this.taskId) {
                const currentComments = this.comments();
                // 檢查評論是否已存在（避免重複）
                if (!currentComments.find(c => c.id === comment.id)) {
                    this.comments.set([...currentComments, comment]);
                }
            }
        });
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
                assignee_name: this.task()!.assignee_name || '',
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
            assignee_name: '',
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

        this.taskService.updateTask(this.taskId, updates).subscribe({
            next: (response) => {
                this.task.set(response.task);
                this.isEditing = false;
                this.saving.set(false);
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
                // 將新附件加入列表
                this.attachments.set([response.attachment, ...this.attachments()]);
                this.selectedFile = null;
                this.uploadingAttachment.set(false);
                // 重新載入任務以更新附件數量
                this.loadTask();
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
                // 從列表中移除附件
                this.attachments.set(this.attachments().filter(a => a.id !== attachmentId));
                // 重新載入任務以更新附件數量
                this.loadTask();
            },
            error: (error) => {
                console.error('刪除附件失敗:', error);
                alert('刪除附件失敗：' + (error.error?.error || '未知錯誤'));
            }
        });
    }

    downloadAttachment(attachment: Attachment): void {
        const url = this.attachmentService.getAttachmentUrl(attachment.file_url);
        window.open(url, '_blank');
    }

    formatFileSize(bytes: number): string {
        return this.attachmentService.formatFileSize(bytes);
    }

    getFileIcon(fileType: string): string {
        return this.attachmentService.getFileIcon(fileType);
    }

    canDeleteAttachment(attachment: Attachment): boolean {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return false;
        return String(attachment.uploaded_by) === String(currentUser.id);
    }
}

