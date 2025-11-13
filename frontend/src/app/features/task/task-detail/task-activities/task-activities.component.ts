import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Activity } from '../../../../core/models/task.model';
import { ActivityService } from '../../../../core/services/activity.service';

@Component({
  selector: 'app-task-activities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-activities.component.html',
  styleUrls: ['./task-activities.component.css']
})
export class TaskActivitiesComponent implements OnInit {
  private activityService = inject(ActivityService);

  @Input() taskId = '';
  @Input() isEditing = false;

  activities = signal<Activity[]>([]);
  loadingActivities = signal(false);
  activitiesExpanded = signal(false);
  activitiesCurrentPage = signal(1);
  activitiesPageSize = 10;
  activitiesTotal = signal(0);
  activitiesTotalPages = signal(0);

  ngOnInit(): void {
    if (this.taskId) {
      // 載入活動紀錄總數（只載入第一頁的第一筆，以獲取總數）
      this.loadActivitiesCount();
    }
  }

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

  loadActivitiesCount(): void {
    this.activityService.getTaskActivities(this.taskId, 1, 0).subscribe({
      next: (response) => {
        this.activitiesTotal.set(response.total);
        this.activitiesTotalPages.set(Math.ceil(response.total / this.activitiesPageSize));
      },
      error: (error) => {
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

  onActivitiesToggle(): void {
    const wasExpanded = this.activitiesExpanded();
    this.activitiesExpanded.set(!wasExpanded);
    
    // 如果展開且還沒有載入過活動紀錄（或總筆數為0），則載入第一頁
    if (!wasExpanded && (this.activities().length === 0 || this.activitiesTotal() === 0)) {
      this.loadActivitiesFirstPage();
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

