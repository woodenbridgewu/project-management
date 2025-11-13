import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Attachment } from '../../../../core/models/task.model';
import { AttachmentService } from '../../../../core/services/attachment.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-task-attachments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-attachments.component.html',
  styleUrls: ['./task-attachments.component.css']
})
export class TaskAttachmentsComponent implements OnInit {
  private attachmentService = inject(AttachmentService);
  private authService = inject(AuthService);

  @Input() taskId = '';
  @Input() isEditing = false;

  @Output() taskUpdated = new EventEmitter<void>();
  @Output() activitiesRefresh = new EventEmitter<void>();

  attachments = signal<Attachment[]>([]);
  loadingAttachments = signal(false);
  uploadingAttachment = signal(false);
  selectedFile: File | null = null;

  ngOnInit(): void {
    if (this.taskId) {
      this.loadAttachments();
    }
  }

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
      next: () => {
        this.selectedFile = null;
        this.uploadingAttachment.set(false);
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
        // 重新載入附件列表（WebSocket 會自動更新，但為了確保同步）
        this.loadAttachments();
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
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
        // 重新載入附件列表（WebSocket 會自動更新，但為了確保同步）
        this.loadAttachments();
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

  canDeleteAttachment(attachment: Attachment): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return false;
    return String(attachment.uploaded_by) === String(currentUser.id);
  }
}

