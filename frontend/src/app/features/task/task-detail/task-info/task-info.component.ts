import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, WorkspaceMember } from '../../../../core/models/task.model';

@Component({
  selector: 'app-task-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-info.component.html',
  styleUrls: ['./task-info.component.css']
})
export class TaskInfoComponent {
  @Input() task: Task | null = null;
  @Input() workspaceMembers = signal<WorkspaceMember[]>([]);
  @Input() isEditing = false;
  @Input() editForm: {
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority: '' | 'low' | 'medium' | 'high' | 'urgent';
    assigneeId: string | '';
    due_date: string;
    estimated_hours: number;
  } = {
    title: '',
    description: '',
    status: 'todo',
    priority: '',
    assigneeId: '',
    due_date: '',
    estimated_hours: 0
  };

  @Output() editFormChange = new EventEmitter<any>();
  @Output() dueDateChange = new EventEmitter<Event>();

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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  isOverdue(date: Date | string | undefined): boolean {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return d < new Date() && !this.task?.completed_at;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  onFormChange(field: string, value: any): void {
    this.editFormChange.emit({ field, value });
  }

  onDueDateChange(event: Event): void {
    this.dueDateChange.emit(event);
  }
}

