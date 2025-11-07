import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="task-card" (click)="taskClick.emit(task)">
      <div class="task-header">
        <h3 class="task-title">{{ task.title }}</h3>
        @if (task.priority) {
          <span class="priority-badge" [class]="'priority-' + task.priority">
            {{ getPriorityLabel(task.priority) }}
          </span>
        }
      </div>
      
      @if (task.description) {
        <p class="task-description">{{ task.description }}</p>
      }
      
      <div class="task-footer">
        <div class="task-meta">
          @if (task.assignee || task.assignee_name) {
            <div class="assignee">
              @if (task.assignee?.avatarUrl || task.assignee_avatar) {
                <img [src]="task.assignee?.avatarUrl || task.assignee_avatar" [alt]="task.assignee?.fullName || task.assignee_name">
              } @else {
                <div class="avatar-placeholder">
                  {{ getInitials(task.assignee?.fullName || task.assignee_name || '') }}
                </div>
              }
              <span>{{ task.assignee?.fullName || task.assignee_name }}</span>
            </div>
          }
          
          @if (task.due_date) {
            <div class="due-date" [class.overdue]="isOverdue(task.due_date)">
              <span>📅 {{ formatDate(task.due_date) }}</span>
            </div>
          }
        </div>
        
        <div class="task-stats">
          @if (task.subtask_count) {
            <span class="stat">✓ {{ task.subtask_count }}</span>
          }
          @if (task.comment_count) {
            <span class="stat">💬 {{ task.comment_count }}</span>
          }
          @if (task.attachment_count) {
            <span class="stat">📎 {{ task.attachment_count }}</span>
          }
        </div>
      </div>
      
      @if (task.tags && task.tags.length > 0) {
        <div class="task-tags">
          @for (tag of task.tags; track tag.id) {
            <span class="tag" [style.background-color]="tag.color">
              {{ tag.name }}
            </span>
          }
        </div>
      }
    </div>
  `,
    styles: [`
    .task-card {
      background: white;
      border: 1px solid #E1E4E8;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .task-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }
    
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 8px;
    }
    
    .task-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #24292E;
    }
    
    .priority-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .priority-low { background: #E8F5E9; color: #2E7D32; }
    .priority-medium { background: #FFF9C4; color: #F57F17; }
    .priority-high { background: #FFECB3; color: #E65100; }
    .priority-urgent { background: #FFEBEE; color: #C62828; }
    
    .task-description {
      color: #586069;
      font-size: 14px;
      margin: 8px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
    }
    
    .task-meta {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .assignee {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
    }
    
    .assignee img,
    .avatar-placeholder {
      width: 24px;
      height: 24px;
      border-radius: 50%;
    }
    
    .avatar-placeholder {
      background: #4A90E2;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }
    
    .due-date {
      font-size: 13px;
      color: #666;
    }
    
    .due-date.overdue {
      color: #C62828;
      font-weight: 500;
    }
    
    .task-stats {
      display: flex;
      gap: 12px;
      font-size: 13px;
      color: #666;
    }
    
    .task-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    
    .tag {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: white;
    }
  `]
})
export class TaskCardComponent {
    @Input({ required: true }) task!: Task;
    @Output() taskClick = new EventEmitter<Task>();
    @Output() taskUpdate = new EventEmitter<Task>();

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
}