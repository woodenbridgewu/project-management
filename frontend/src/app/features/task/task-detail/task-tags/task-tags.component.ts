import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, Tag } from '../../../../core/models/task.model';
import { TagService } from '../../../../core/services/tag.service';

@Component({
  selector: 'app-task-tags',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-tags.component.html',
  styleUrls: ['./task-tags.component.css']
})
export class TaskTagsComponent implements OnInit {
  private tagService = inject(TagService);

  @Input() task: Task | null = null;
  @Input() taskId = '';
  @Input() workspaceId = '';
  @Input() presetColors = [
    '#808080', // 灰色
    '#E53E3E', // 紅色
    '#3182CE', // 藍色
    '#D53F8C', // 粉紅色
    '#00B5D8', // 青色
    '#48BB78', // 淺綠色
    '#ED8936', // 淺橙色
    '#9F7AEA'  // 淺紫色
  ];

  @Output() taskUpdated = new EventEmitter<void>();
  @Output() activitiesRefresh = new EventEmitter<void>();

  availableTags = signal<Tag[]>([]);
  loadingTags = signal(false);
  savingTag = signal(false);
  showTagModal = false;
  showManageTagsModal = false;
  editingTag: Tag | null = null;
  newTagForm = {
    name: '',
    color: '#808080'
  };
  editTagForm = {
    name: '',
    color: '#808080'
  };

  ngOnInit(): void {
    if (this.workspaceId) {
      this.loadTags();
    }
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

    let color = this.newTagForm.color || '#808080';
    if (!color.startsWith('#')) {
      color = '#' + color;
    }
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
        this.taskUpdated.emit();
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
    if (!this.task) return;

    this.savingTag.set(true);
    this.tagService.addTagToTask(this.taskId, tagId).subscribe({
      next: () => {
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
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
    if (!this.task) return;

    if (!confirm('確定要移除這個標籤嗎？')) {
      return;
    }

    this.savingTag.set(true);
    this.tagService.removeTagFromTask(this.taskId, tagId).subscribe({
      next: () => {
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
        this.savingTag.set(false);
      },
      error: (error) => {
        console.error('移除標籤失敗:', error);
        alert('移除標籤失敗：' + (error.error?.error || '未知錯誤'));
        this.savingTag.set(false);
      }
    });
  }

  updateTag(): void {
    if (!this.editingTag || !this.editTagForm.name.trim()) return;

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
        this.taskUpdated.emit();
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

  deleteTag(tagId: string): void {
    this.savingTag.set(true);
    this.tagService.deleteTag(tagId).subscribe({
      next: () => {
        this.loadTags();
        this.taskUpdated.emit();
        this.savingTag.set(false);
      },
      error: (error) => {
        console.error('刪除標籤失敗:', error);
        alert('刪除標籤失敗：' + (error.error?.error || '未知錯誤'));
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

  isTagAttached(tagId: string): boolean {
    if (!this.task?.tags) return false;
    return this.task.tags.some(tag => tag.id === tagId);
  }

  getContrastColor(backgroundColor: string): string {
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

  onNewTagFormChange(field: string, value: any): void {
    (this.newTagForm as any)[field] = value;
  }

  onEditTagFormChange(field: string, value: any): void {
    (this.editTagForm as any)[field] = value;
  }
}

