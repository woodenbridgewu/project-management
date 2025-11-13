import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';

@Component({
  selector: 'app-task-subtasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-subtasks.component.html',
  styleUrls: ['./task-subtasks.component.css']
})
export class TaskSubtasksComponent implements OnInit {
  private taskService = inject(TaskService);

  @Input() taskId = '';
  @Input() isEditing = false;

  @Output() taskUpdated = new EventEmitter<void>();
  @Output() activitiesRefresh = new EventEmitter<void>();

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

  ngOnInit(): void {
    if (this.taskId) {
      this.loadSubtasks();
    }
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
          this.taskUpdated.emit();
          this.activitiesRefresh.emit();
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
          this.taskUpdated.emit();
          this.activitiesRefresh.emit();
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
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
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
        this.taskUpdated.emit();
        this.activitiesRefresh.emit();
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

  isOverdue(date: Date | string | undefined): boolean {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return d < new Date();
  }

  onFormChange(field: string, value: any): void {
    (this.subtaskForm as any)[field] = value;
  }
}

