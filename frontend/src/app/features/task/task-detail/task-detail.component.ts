import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { CommentService } from '../../../core/services/comment.service';
import { TagService } from '../../../core/services/tag.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task, Project, Comment, User, Tag } from '../../../core/models/task.model';

@Component({
    selector: 'app-task-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="task-detail-container">
      <div class="task-detail-header">
        <button class="btn-back" (click)="goBack()">← 返回</button>
        <div class="header-actions">
          <button class="btn-secondary" (click)="toggleEditMode()" *ngIf="!isEditing">
            ✏️ 編輯
          </button>
          <button class="btn-danger" (click)="deleteTask()" *ngIf="!isEditing">
            🗑️ 刪除
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">載入中...</div>
      } @else if (task()) {
        <div class="task-detail-content">
          <!-- 任務標題 -->
          <div class="task-title-section">
            @if (isEditing) {
              <input
                type="text"
                class="title-input"
                [(ngModel)]="editForm.title"
                placeholder="任務標題"
              />
            } @else {
              <h1>{{ task()?.title }}</h1>
            }
          </div>

          <!-- 任務狀態和優先級 -->
          <div class="task-meta-section">
            <div class="meta-item">
              <label>狀態</label>
              @if (isEditing) {
                <select [(ngModel)]="editForm.status" class="form-control">
                  <option value="todo">待辦</option>
                  <option value="in_progress">進行中</option>
                  <option value="review">審核中</option>
                  <option value="done">已完成</option>
                </select>
              } @else {
                <span class="status-badge" [class]="'status-' + task()?.status">
                  {{ getStatusLabel(task()?.status || 'todo') }}
                </span>
              }
            </div>

            <div class="meta-item">
              <label>優先級</label>
              @if (isEditing) {
                <select [(ngModel)]="editForm.priority" class="form-control">
                  <option value="">無</option>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              } @else {
                <span class="priority-badge" [class]="'priority-' + (task()?.priority || 'none')" *ngIf="task()?.priority">
                  {{ getPriorityLabel(task()?.priority || '') }}
                </span>
                <span *ngIf="!task()?.priority">無</span>
              }
            </div>
          </div>

          <!-- 任務描述 -->
          <div class="task-description-section">
            <label>描述</label>
            @if (isEditing) {
              <textarea
                class="description-textarea"
                [(ngModel)]="editForm.description"
                rows="6"
                placeholder="輸入任務描述..."
              ></textarea>
            } @else {
              <div class="description-content">
                {{ task()?.description || '無描述' }}
              </div>
            }
          </div>

          <!-- 任務資訊 -->
          <div class="task-info-grid">
            <div class="info-item">
              <label>指派給</label>
              @if (isEditing) {
                <input
                  type="text"
                  class="form-control"
                  [(ngModel)]="editForm.assignee_name"
                  placeholder="指派給（暫時只顯示名稱）"
                  disabled
                />
                <small class="form-hint">指派功能將在後續版本中實作</small>
              } @else {
                <div class="assignee-info" *ngIf="task()?.assignee_name">
                  @if (task()?.assignee_avatar) {
                    <img [src]="task()?.assignee_avatar" [alt]="task()?.assignee_name" class="avatar">
                  } @else {
                    <div class="avatar-placeholder">
                      {{ getInitials(task()?.assignee_name || '') }}
                    </div>
                  }
                  <span>{{ task()?.assignee_name }}</span>
                </div>
                <span *ngIf="!task()?.assignee_name">未指派</span>
              }
            </div>

            <div class="info-item">
              <label>建立者</label>
              <div class="creator-info" *ngIf="task()?.creator_name">
                <span>{{ task()?.creator_name }}</span>
              </div>
              <span *ngIf="!task()?.creator_name">未知</span>
            </div>

            <div class="info-item">
              <label>截止日期</label>
              @if (isEditing) {
                <input
                  type="datetime-local"
                  class="form-control"
                  [value]="getDateTimeLocalValue(task()?.due_date)"
                  (input)="onDueDateChange($event)"
                />
              } @else {
                <div class="due-date" [class.overdue]="isOverdue(task()?.due_date)">
                  {{ formatDate(task()?.due_date) || '無' }}
                </div>
              }
            </div>

            <div class="info-item">
              <label>預估時數</label>
              @if (isEditing) {
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="editForm.estimated_hours"
                  min="0"
                  step="0.5"
                  placeholder="預估時數"
                />
              } @else {
                <span>{{ task()?.estimated_hours || '無' }}</span>
              }
            </div>

            <div class="info-item">
              <label>區段</label>
              <span>{{ task()?.section_name || '未分類' }}</span>
            </div>

            <div class="info-item">
              <label>建立時間</label>
              <span>{{ formatDateTime(task()?.created_at) }}</span>
            </div>
          </div>

          <!-- 任務統計 -->
          <div class="task-stats">
            <div class="stat-item" *ngIf="task()?.subtask_count">
              <span class="stat-label">子任務</span>
              <span class="stat-value">{{ task()?.subtask_count }}</span>
            </div>
            <div class="stat-item" *ngIf="task()?.comment_count">
              <span class="stat-label">評論</span>
              <span class="stat-value">{{ task()?.comment_count }}</span>
            </div>
            <div class="stat-item" *ngIf="task()?.attachment_count">
              <span class="stat-label">附件</span>
              <span class="stat-value">{{ task()?.attachment_count }}</span>
            </div>
          </div>

          <!-- 標籤區塊 -->
          <div class="tags-section">
            <div class="section-header">
              <h3 class="section-title">標籤</h3>
              <div class="header-actions">
                <button class="btn-link" (click)="showTagModal = true">+ 新增標籤</button>
                <button class="btn-link" (click)="showManageTagsModal = true">管理標籤</button>
              </div>
            </div>
            
            <!-- 任務標籤列表 -->
            <div class="task-tags-list">
              @for (tag of task()?.tags || []; track tag.id) {
                <span 
                  class="tag-badge" 
                  [style.background-color]="tag.color"
                  [style.color]="getContrastColor(tag.color)"
                >
                  {{ tag.name }}
                  <button 
                    class="tag-remove" 
                    (click)="removeTagFromTask(tag.id)"
                    [style.color]="getContrastColor(tag.color)"
                  >
                    ×
                  </button>
                </span>
              } @empty {
                <span class="no-tags">尚無標籤</span>
              }
            </div>

            <!-- 添加標籤 -->
            @if (availableTags().length > 0) {
              <div class="add-tag-section">
                <label>添加標籤</label>
                <div class="available-tags">
                  @for (tag of availableTags(); track tag.id) {
                    @if (!isTagAttached(tag.id)) {
                      <button 
                        class="tag-option"
                        [style.background-color]="tag.color"
                        [style.color]="getContrastColor(tag.color)"
                        (click)="addTagToTask(tag.id)"
                      >
                        {{ tag.name }}
                      </button>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- 新增標籤模態框 -->
          <div class="modal-overlay" *ngIf="showTagModal" (click)="closeTagModal()">
            <div class="modal-content" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>新增標籤</h2>
                <button class="btn-close" (click)="closeTagModal()">×</button>
              </div>
              <form (ngSubmit)="createTag()" class="modal-form">
                <div class="form-group">
                  <label for="tag-name">名稱 *</label>
                  <input 
                    type="text" 
                    id="tag-name" 
                    [(ngModel)]="newTagForm.name" 
                    name="tag-name"
                    required
                    placeholder="輸入標籤名稱"
                    maxlength="100"
                  />
                </div>
                <div class="form-group">
                  <label for="tag-color">顏色</label>
                  <!-- 預設顏色選項 -->
                  <div class="preset-colors">
                    @for (presetColor of presetColors; track presetColor) {
                      <button
                        type="button"
                        class="preset-color-btn"
                        [class.active]="newTagForm.color === presetColor"
                        [style.background-color]="presetColor"
                        (click)="newTagForm.color = presetColor"
                        [title]="presetColor"
                      >
                        @if (newTagForm.color === presetColor) {
                          <span class="check-icon">✓</span>
                        }
                      </button>
                    }
                  </div>
                  <!-- 自訂顏色選擇器 -->
                  <div class="color-picker-group">
                    <input 
                      type="color" 
                      id="tag-color" 
                      [(ngModel)]="newTagForm.color" 
                      name="tag-color"
                    />
                    <input 
                      type="text" 
                      [(ngModel)]="newTagForm.color" 
                      name="tag-color-hex"
                      placeholder="#808080"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
                <div class="modal-actions">
                  <button type="button" class="btn-secondary" (click)="closeTagModal()">取消</button>
                  <button type="submit" class="btn-primary" [disabled]="savingTag() || !newTagForm.name.trim()">
                    {{ savingTag() ? '建立中...' : '建立' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- 管理標籤模態框 -->
          <div class="modal-overlay" *ngIf="showManageTagsModal" (click)="closeManageTagsModal()">
            <div class="modal-content" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>管理標籤</h2>
                <button class="btn-close" (click)="closeManageTagsModal()">×</button>
              </div>
              <div class="modal-body">
                @if (loadingTags()) {
                  <div class="loading">載入中...</div>
                } @else if (availableTags().length > 0) {
                  <div class="tags-management-list">
                    @for (tag of availableTags(); track tag.id) {
                      <div class="tag-management-item">
                        <span 
                          class="tag-preview" 
                          [style.background-color]="tag.color"
                          [style.color]="getContrastColor(tag.color)"
                        >
                          {{ tag.name }}
                        </span>
                        <div class="tag-actions">
                          <button class="btn-icon" (click)="startEditTag(tag)" title="編輯">
                            ✏️
                          </button>
                          <button class="btn-icon btn-danger-icon" (click)="confirmDeleteTag(tag)" title="刪除">
                            🗑️
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-state">
                    <p>尚無標籤，請先建立標籤</p>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- 編輯標籤模態框 -->
          <div class="modal-overlay" *ngIf="editingTag" (click)="cancelEditTag()">
            <div class="modal-content" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>編輯標籤</h2>
                <button class="btn-close" (click)="cancelEditTag()">×</button>
              </div>
              <form (ngSubmit)="updateTag()" class="modal-form">
                <div class="form-group">
                  <label for="edit-tag-name">名稱 *</label>
                  <input 
                    type="text" 
                    id="edit-tag-name" 
                    [(ngModel)]="editTagForm.name" 
                    name="edit-tag-name"
                    required
                    placeholder="輸入標籤名稱"
                    maxlength="100"
                  />
                </div>
                <div class="form-group">
                  <label for="edit-tag-color">顏色</label>
                  <!-- 預設顏色選項 -->
                  <div class="preset-colors">
                    @for (presetColor of presetColors; track presetColor) {
                      <button
                        type="button"
                        class="preset-color-btn"
                        [class.active]="editTagForm.color === presetColor"
                        [style.background-color]="presetColor"
                        (click)="editTagForm.color = presetColor"
                        [title]="presetColor"
                      >
                        @if (editTagForm.color === presetColor) {
                          <span class="check-icon">✓</span>
                        }
                      </button>
                    }
                  </div>
                  <!-- 自訂顏色選擇器 -->
                  <div class="color-picker-group">
                    <input 
                      type="color" 
                      id="edit-tag-color" 
                      [(ngModel)]="editTagForm.color" 
                      name="edit-tag-color"
                    />
                    <input 
                      type="text" 
                      [(ngModel)]="editTagForm.color" 
                      name="edit-tag-color-hex"
                      placeholder="#808080"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
                <div class="modal-actions">
                  <button type="button" class="btn-secondary" (click)="cancelEditTag()">取消</button>
                  <button type="submit" class="btn-primary" [disabled]="savingTag() || !editTagForm.name.trim()">
                    {{ savingTag() ? '更新中...' : '更新' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- 編輯模式按鈕 -->
          @if (isEditing) {
            <div class="edit-actions">
              <button class="btn-secondary" (click)="cancelEdit()">取消</button>
              <button class="btn-primary" (click)="saveTask()" [disabled]="saving() || !editForm.title">
                {{ saving() ? '儲存中...' : '儲存' }}
              </button>
            </div>
          }

          <!-- 評論區塊 -->
          <div class="comments-section">
            <h3 class="section-title">評論</h3>
            
            <!-- 新增評論表單 -->
            <div class="comment-form">
              <textarea
                class="comment-input"
                [(ngModel)]="newCommentContent"
                placeholder="輸入評論..."
                rows="3"
              ></textarea>
              <div class="comment-form-actions">
                <button 
                  class="btn-primary" 
                  (click)="addComment()" 
                  [disabled]="!newCommentContent.trim() || savingComment()"
                >
                  {{ savingComment() ? '發送中...' : '發送' }}
                </button>
              </div>
            </div>

            <!-- 評論列表 -->
            @if (loadingComments()) {
              <div class="loading-comments">載入評論中...</div>
            } @else {
              <div class="comments-list">
                @for (comment of comments(); track comment.id) {
                  <div class="comment-item">
                    <div class="comment-header">
                      <div class="comment-author">
                        @if (comment.user?.avatarUrl) {
                          <img [src]="comment.user.avatarUrl" [alt]="comment.user.fullName" class="comment-avatar">
                        } @else {
                          <div class="comment-avatar-placeholder">
                            {{ getInitials(comment.user?.fullName || '') }}
                          </div>
                        }
                        <div class="comment-author-info">
                          <span class="comment-author-name">{{ comment.user?.fullName || '未知使用者' }}</span>
                          <span class="comment-time">{{ formatCommentTime(comment.created_at) }}</span>
                        </div>
                      </div>
                      @if (canEditComment(comment)) {
                        <div class="comment-actions">
                          @if (editingCommentId() === comment.id) {
                            <button class="btn-link" (click)="cancelEditComment()">取消</button>
                            <button class="btn-link" (click)="saveEditComment(comment.id)">儲存</button>
                          } @else {
                            <button class="btn-link" (click)="startEditComment(comment)">編輯</button>
                            <button class="btn-link btn-danger-link" (click)="deleteComment(comment.id)">刪除</button>
                          }
                        </div>
                      }
                    </div>
                    <div class="comment-content">
                      @if (editingCommentId() === comment.id) {
                        <textarea
                          class="comment-edit-input"
                          [(ngModel)]="editCommentContent"
                          rows="3"
                        ></textarea>
                      } @else {
                        <p>{{ comment.content }}</p>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="empty-comments">
                    <p>尚無評論，開始第一個評論吧！</p>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="error-state">
          <p>任務不存在或載入失敗</p>
          <button class="btn-primary" (click)="goBack()">返回</button>
        </div>
      }
    </div>
  `,
    styles: [`
    .task-detail-container {
      min-height: 100vh;
      background: #F6F8FA;
      padding: 24px;
    }

    .task-detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .btn-back {
      background: transparent;
      border: 1px solid #e2e8f0;
      color: #4a5568;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-back:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-secondary:hover {
      background: #cbd5e0;
    }

    .btn-danger {
      background: #e53e3e;
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-danger:hover {
      background: #c53030;
    }

    .btn-primary {
      background: #667eea;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #718096;
    }

    .task-detail-content {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .task-title-section {
      margin-bottom: 24px;
    }

    .task-title-section h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      color: #1a202c;
    }

    .title-input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      font-size: 28px;
      font-weight: 600;
      font-family: inherit;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .title-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .task-meta-section {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .meta-item label {
      font-size: 12px;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-control {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #667eea;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-todo {
      background: #e2e8f0;
      color: #4a5568;
    }

    .status-in_progress {
      background: #bee3f8;
      color: #2c5282;
    }

    .status-review {
      background: #faf089;
      color: #744210;
    }

    .status-done {
      background: #c6f6d5;
      color: #22543d;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .priority-low {
      background: #e2e8f0;
      color: #4a5568;
    }

    .priority-medium {
      background: #fbd38d;
      color: #744210;
    }

    .priority-high {
      background: #fc8181;
      color: #742a2a;
    }

    .priority-urgent {
      background: #f56565;
      color: #742a2a;
    }

    .task-description-section {
      margin-bottom: 24px;
    }

    .task-description-section label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .description-textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .description-textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .description-content {
      padding: 12px;
      background: #f7fafc;
      border-radius: 6px;
      color: #4a5568;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .task-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-item label {
      font-size: 12px;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .assignee-info,
    .creator-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }

    .due-date {
      color: #4a5568;
    }

    .due-date.overdue {
      color: #e53e3e;
      font-weight: 600;
    }

    .form-hint {
      display: block;
      font-size: 11px;
      color: #a0aec0;
      margin-top: 4px;
    }

    .task-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #718096;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
    }

    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }

    .error-state {
      text-align: center;
      padding: 60px;
      background: white;
      border-radius: 12px;
      max-width: 800px;
      margin: 0 auto;
    }

    .error-state p {
      color: #718096;
      margin-bottom: 24px;
    }

    /* 評論區塊樣式 */
    .comments-section {
      margin-top: 16px;
      padding-top: 32px;
      border-top: 1px solid #e2e8f0;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 20px;
    }

    .comment-form {
      margin-bottom: 24px;
    }

    .comment-input,
    .comment-edit-input {
      width: 100%;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .comment-input:focus,
    .comment-edit-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .comment-form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .loading-comments {
      text-align: center;
      padding: 24px;
      color: #718096;
    }

    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .comment-item {
      background: #f7fafc;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .comment-author {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .comment-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .comment-avatar-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
    }

    .comment-author-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .comment-author-name {
      font-weight: 600;
      color: #1a202c;
      font-size: 14px;
    }

    .comment-time {
      font-size: 12px;
      color: #718096;
    }

    .comment-actions {
      display: flex;
      gap: 8px;
    }

    .btn-link {
      background: transparent;
      border: none;
      color: #667eea;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-link:hover {
      background: #edf2f7;
    }

    .btn-danger-link {
      color: #e53e3e;
    }

    .btn-danger-link:hover {
      background: #fed7d7;
    }

    .comment-content {
      margin-top: 8px;
    }

    .comment-content p {
      margin: 0;
      color: #4a5568;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .empty-comments {
      text-align: center;
      padding: 40px;
      color: #a0aec0;
    }

    .empty-comments p {
      margin: 0;
    }

    /* 標籤區塊樣式 */
    .tags-section {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #e2e8f0;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .task-tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      cursor: default;
    }

    .tag-remove {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      margin-left: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .tag-remove:hover {
      opacity: 1;
    }

    .no-tags {
      color: #a0aec0;
      font-size: 14px;
    }

    .add-tag-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }

    .add-tag-section label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .available-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag-option {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border: none;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .tag-option:hover {
      opacity: 0.8;
    }

    .color-picker-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .color-picker-group input[type="color"] {
      width: 50px;
      height: 40px;
      padding: 2px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
    }

    .color-picker-group input[type="text"] {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: monospace;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .color-picker-group input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
    }

    /* 預設顏色選項樣式 */
    .preset-colors {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .preset-color-btn {
      width: 40px;
      height: 40px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preset-color-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .preset-color-btn.active {
      border-color: #667eea;
      border-width: 3px;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }

    .check-icon {
      color: white;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    /* 模態框樣式 */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #718096;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-close:hover {
      background: #f7fafc;
    }

    .modal-form {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #1a202c;
    }

    .form-group input[type="text"],
    .form-group input[type="number"],
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-group input[type="text"]:focus,
    .form-group input[type="number"]:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-group textarea {
      resize: vertical;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .modal-body {
      padding: 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .tags-management-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .tag-management-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: #f7fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .tag-preview {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
    }

    .tag-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: white;
    }

    .btn-danger-icon:hover {
      background: #fed7d7;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #a0aec0;
    }

    .empty-state p {
      margin: 0;
    }
  `]
})
export class TaskDetailComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private taskService = inject(TaskService);
    private projectService = inject(ProjectService);
    private commentService = inject(CommentService);
    private tagService = inject(TagService);
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
        const commentUserId = comment.user_id || comment.user?.id;
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
        return new Date(date) < new Date();
    }

    getInitials(name: string): string {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
}

