import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-card.component.html',
    styleUrls: ['./task-card.component.css']
})
export class TaskCardComponent {
    @Input({ required: true }) task!: Task;
    @Output() taskClick = new EventEmitter<Task>();
    @Output() taskUpdate = new EventEmitter<Task>();
    @Output() taskEdit = new EventEmitter<Task>();
    @Output() taskDelete = new EventEmitter<Task>();

    getInitials(name: string): string {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
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

    formatDate(date: Date | string): string {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    isOverdue(dueDate: Date | string): boolean {
        return new Date(dueDate) < new Date();
    }

    onEditClick(): void {
        this.taskEdit.emit(this.task);
    }

    onDeleteClick(): void {
        if (confirm('確定要刪除此任務嗎？')) {
            this.taskDelete.emit(this.task);
        }
    }
}