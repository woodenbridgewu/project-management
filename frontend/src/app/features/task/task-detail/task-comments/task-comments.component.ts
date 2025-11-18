import { Component, Input, Output, EventEmitter, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Comment } from '../../../../core/models/task.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CommentService } from '../../../../core/services/comment.service';
import { WebSocketService } from '../../../../core/services/websocket.service';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-comments.component.html',
  styleUrls: ['./task-comments.component.css']
})
export class TaskCommentsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private commentService = inject(CommentService);
  private wsService = inject(WebSocketService);

  @Input() taskId = '';
  @Input() projectId = '';
  @Input() isEditing = false;

  @Output() activitiesRefresh = new EventEmitter<void>();

  comments = signal<Comment[]>([]);
  loadingComments = signal(false);
  savingComment = signal(false);
  editingCommentId = signal<string | null>(null);
  newCommentContent = '';
  editCommentContent = '';
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    if (this.taskId) {
      this.loadComments();
      this.subscribeToWebSocketUpdates();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  subscribeToWebSocketUpdates(): void {
    // 確保 WebSocket 已連接並加入專案房間
    this.wsService.connect();
    if (this.projectId) {
      this.wsService.joinProject(this.projectId);
    }

    // 監聽評論新增
    const commentAddedSub = this.wsService.onCommentAdded().subscribe((comment: Comment) => {
      if (comment.task_id === this.taskId) {
        // 檢查評論是否已存在（避免重複添加）
        const currentComments = this.comments();
        const exists = currentComments.some(c => c.id === comment.id);
        if (!exists) {
          // 將新評論添加到列表末尾（因為後端按 created_at ASC 排序）
          this.comments.set([...currentComments, comment]);
        }
      }
    });
    this.subscriptions.push(commentAddedSub);

    // 監聽評論更新
    const commentUpdatedSub = this.wsService.onCommentUpdated().subscribe((comment: Comment) => {
      if (comment.task_id === this.taskId) {
        const currentComments = this.comments();
        const updatedComments = currentComments.map(c => 
          c.id === comment.id ? comment : c
        );
        this.comments.set(updatedComments);
      }
    });
    this.subscriptions.push(commentUpdatedSub);

    // 監聽評論刪除
    const commentDeletedSub = this.wsService.onCommentDeleted().subscribe((data: { id: string; taskId: string }) => {
      if (data.taskId === this.taskId) {
        const currentComments = this.comments();
        this.comments.set(currentComments.filter(c => c.id !== data.id));
      }
    });
    this.subscriptions.push(commentDeletedSub);
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

  addComment(): void {
    if (!this.newCommentContent.trim()) return;

    this.savingComment.set(true);
    this.commentService.createComment(this.taskId, { content: this.newCommentContent.trim() }).subscribe({
      next: () => {
        this.newCommentContent = '';
        this.savingComment.set(false);
        this.loadComments();
        this.activitiesRefresh.emit();
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
        const currentComments = this.comments();
        const updatedComments = currentComments.map(c => 
          c.id === commentId 
            ? { ...c, content: this.editCommentContent.trim(), updated_at: new Date().toISOString() }
            : c
        );
        this.comments.set(updatedComments);
        this.cancelEditComment();
        this.savingComment.set(false);
        this.activitiesRefresh.emit();
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
        const currentComments = this.comments();
        this.comments.set(currentComments.filter(c => c.id !== commentId));
        this.savingComment.set(false);
        this.activitiesRefresh.emit();
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
    const commentUserId = comment.user_id || comment.user.id;
    const currentUserId = currentUser.id;
    return String(commentUserId) === String(currentUserId);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  formatCommentTime(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 0) return '剛剛';
    
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
}

