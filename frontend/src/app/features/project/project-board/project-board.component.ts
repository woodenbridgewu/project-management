import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { SectionService } from '../../../core/services/section.service';
import { ProjectService } from '../../../core/services/project.service';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { Task, Section } from '../../../core/models/task.model';

@Component({
    selector: 'app-project-board',
    standalone: true,
    imports: [CommonModule, DragDropModule, FormsModule, TaskCardComponent],
    templateUrl: './project-board.component.html',
    styleUrls: ['./project-board.component.css']
})
export class ProjectBoardComponent implements OnInit {
    private taskService = inject(TaskService);
    private sectionService = inject(SectionService);
    private projectService = inject(ProjectService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    sections = signal<Section[]>([]);
    projectName = signal<string>('');
    loading = signal(false);
    projectId = '';

    showCreateSectionModal = false;
    editingSection: Section | null = null;
    sectionForm = { name: '' };

    showCreateTaskModal = false;
    currentSectionId = '';
    taskForm = {
        title: '',
        description: '',
        priority: '' as 'low' | 'medium' | 'high' | 'urgent' | ''
    };

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'];
            this.loadProject();
            this.loadSections();
        });
    }

    loadProject() {
        this.projectService.getProjectById(this.projectId).subscribe({
            next: (response) => {
                this.projectName.set(response.project.name);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
            }
        });
    }

    loadSections() {
        this.loading.set(true);
        this.sectionService.getSectionsByProject(this.projectId).subscribe({
            next: (response) => {
                const sections = response.sections.map(section => ({
                    ...section,
                    tasks: []
                }));
                this.sections.set(sections);
                this.loadTasks();
            },
            error: (error) => {
                console.error('載入區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadTasks() {
        this.taskService.getTasksByProject(this.projectId).subscribe({
            next: (response) => {
                // 將任務分配到對應的區段
                const sectionsData = this.sections();
                sectionsData.forEach(section => {
                    section.tasks = response.tasks.filter(
                        task => task.section_id === section.id
                    ) || [];
                });
                this.sections.set([...sectionsData]);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入任務失敗:', error);
                this.loading.set(false);
            }
        });
    }

    onDrop(event: CdkDragDrop<Task[]>): void {
        if (!event.container.data || !event.previousContainer.data) return;

        const task = event.previousContainer.data[event.previousIndex];
        const newSectionId = event.container.id;
        const newPosition = event.currentIndex;

        if (event.previousContainer === event.container) {
            // 同一區段內移動
            moveItemInArray(
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        } else {
            // 跨區段移動
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        }

        // 更新任務的區段和位置
        this.taskService.moveTask(task.id, newSectionId, newPosition).subscribe({
            next: () => {
                // 更新本地狀態
                const sectionsData = this.sections();
                const taskToUpdate = sectionsData
                    .flatMap(s => s.tasks || [])
                    .find(t => t.id === task.id);
                
                if (taskToUpdate) {
                    taskToUpdate.section_id = newSectionId;
                    taskToUpdate.position = newPosition;
                }
                this.sections.set([...sectionsData]);
            },
            error: (error) => {
                console.error('移動任務失敗:', error);
                // 重新載入以恢復狀態
                this.loadSections();
            }
        });
    }

    addSection(): void {
        this.editingSection = null;
        this.sectionForm = { name: '' };
        this.showCreateSectionModal = true;
    }

    editSection(section: Section): void {
        this.editingSection = section;
        this.sectionForm = { name: section.name };
        this.showCreateSectionModal = true;
    }

    saveSection() {
        if (!this.sectionForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingSection
            ? this.sectionService.updateSection(this.editingSection.id, this.sectionForm)
            : this.sectionService.createSection(this.projectId, this.sectionForm);

        operation.subscribe({
            next: () => {
                this.closeSectionModal();
                this.loadSections();
            },
            error: (error) => {
                console.error('儲存區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    deleteSection(sectionId: string) {
        if (!confirm('確定要刪除此區段嗎？區段內的任務將被保留但不再屬於任何區段。')) return;

        this.loading.set(true);
        this.sectionService.deleteSection(sectionId).subscribe({
            next: () => {
                this.loadSections();
            },
            error: (error) => {
                console.error('刪除區段失敗:', error);
                this.loading.set(false);
            }
        });
    }

    closeSectionModal() {
        this.showCreateSectionModal = false;
        this.editingSection = null;
        this.sectionForm = { name: '' };
    }

    addTask(sectionId: string): void {
        this.currentSectionId = sectionId;
        this.taskForm = { title: '', description: '', priority: '' };
        this.showCreateTaskModal = true;
    }

    saveTask() {
        if (!this.taskForm.title.trim()) return;

        this.loading.set(true);
        const taskData: any = {
            title: this.taskForm.title,
            sectionId: this.currentSectionId
        };

        if (this.taskForm.description) {
            taskData.description = this.taskForm.description;
        }

        if (this.taskForm.priority) {
            taskData.priority = this.taskForm.priority;
        }

        this.taskService.createTask(this.projectId, taskData).subscribe({
            next: () => {
                this.loading.set(false);
                this.closeTaskModal();
                this.loadSections();
            },
            error: (error) => {
                console.error('建立任務失敗:', error);
                this.loading.set(false);
                // 即使後端返回錯誤，也重新載入資料（因為任務可能已經建立）
                // 這樣可以確保 UI 與後端狀態同步
                setTimeout(() => {
                    this.loadSections();
                }, 500);
                // 如果錯誤不是 500，則顯示錯誤訊息
                if (error.status !== 500) {
                    alert('建立任務失敗：' + (error.error?.error || '未知錯誤'));
                } else {
                    // 對於 500 錯誤，可能是活動紀錄失敗但任務已建立，所以只重新載入
                    console.log('任務可能已建立，正在重新載入...');
                }
            }
        });
    }

    closeTaskModal() {
        this.showCreateTaskModal = false;
        this.currentSectionId = '';
        this.taskForm = { title: '', description: '', priority: '' };
    }

    openTaskDetail(task: Task): void {
        this.router.navigate(['/tasks', task.id]);
    }

    editTask(task: Task): void {
        // 導航到任務詳情頁面進行編輯
        this.router.navigate(['/tasks', task.id]);
    }

    deleteTask(task: Task): void {
        if (!confirm('確定要刪除此任務嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.taskService.deleteTask(task.id).subscribe({
            next: () => {
                this.loadSections();
            },
            error: (error) => {
                console.error('刪除任務失敗:', error);
                alert('刪除任務失敗：' + (error.error?.error || '未知錯誤'));
                this.loading.set(false);
            }
        });
    }

    goBack() {
        // 取得專案的工作區 ID
        this.projectService.getProjectById(this.projectId).subscribe({
            next: (response) => {
                this.router.navigate(['/workspaces', response.project.workspace_id]);
            },
            error: () => {
                this.router.navigate(['/workspaces']);
            }
        });
    }
}
