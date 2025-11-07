import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { Task, Section } from '../../../core/models/task.model';

@Component({
    selector: 'app-project-board',
    standalone: true,
    imports: [CommonModule, DragDropModule],
    template: `
    <div class="board-container">
      <div class="board-header">
        <h2>看板視圖</h2>
        <button class="btn-secondary" (click)="addSection()">
          + 新增區段
        </button>
      </div>
      
      <div class="board" cdkDropListGroup>
        @for (section of sections(); track section.id) {
          <div class="board-column">
            <div class="column-header">
              <h3>{{ section.name }}</h3>
              <span class="task-count">{{ section.tasks?.length || 0 }}</span>
            </div>
            
            <div 
              class="column-content"
              cdkDropList
              [id]="section.id"
              [cdkDropListData]="section.tasks"
              (cdkDropListDropped)="onDrop($event)">
              
              @for (task of section.tasks; track task.id) {
                <div class="task-card-wrapper" cdkDrag>
                  <app-task-card [task]="task"></app-task-card>
                </div>
              }
              
              <button class="add-task-btn" (click)="addTask(section.id)">
                + 新增任務
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
    styles: [`
    .board-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px;
      background: #F6F8FA;
    }
    
    .board-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    .board {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      flex: 1;
    }
    
    .board-column {
      min-width: 320px;
      max-width: 320px;
      background: #E8EAED;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
    }
    
    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 8px;
    }
    
    .column-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    .task-count {
      background: #666;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    
    .column-content {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
    }
    
    .task-card-wrapper {
      margin-bottom: 8px;
    }
    
    .add-task-btn {
      width: 100%;
      padding: 8px;
      background: transparent;
      border: 2px dashed #ccc;
      border-radius: 6px;
      cursor: pointer;
      color: #666;
      margin-top: 8px;
    }
    
    .add-task-btn:hover {
      background: rgba(0,0,0,0.05);
      border-color: #999;
    }
    
    .cdk-drag-preview {
      opacity: 0.8;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
    .column-content.cdk-drop-list-dragging .task-card-wrapper:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class ProjectBoardComponent implements OnInit {
    private taskService = inject(TaskService);
    private route = inject(ActivatedRoute);

    sections = signal<Section[]>([
        { id: '1', projectId: '', name: '待辦', position: 0, tasks: [] },
        { id: '2', projectId: '', name: '進行中', position: 1, tasks: [] },
        { id: '3', projectId: '', name: '審核中', position: 2, tasks: [] },
        { id: '4', projectId: '', name: '已完成', position: 3, tasks: [] }
    ]);

    projectId = '';

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'];
            this.loadTasks();
        });
    }

    loadTasks(): void {
        this.taskService.getTasksByProject(this.projectId)
            .subscribe({
                next: (response) => {
                    // 將任務分配到對應的區段
                    const sectionsData = this.sections();
                    sectionsData.forEach(section => {
                        section.tasks = response.tasks.filter(
                            task => task.sectionId === section.id
                        );
                    });
                    this.sections.set([...sectionsData]);
                },
                error: (error) => {
                    console.error('載入任務失敗:', error);
                }
            });
    }

    onDrop(event: CdkDragDrop<Task[] | undefined>): void {
        if (!event.container.data || !event.previousContainer.data) return;

        if (event.previousContainer === event.container) {
            moveItemInArray(
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        } else {
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );

            // 更新任務的區段
            const task = event.container.data[event.currentIndex];
            this.taskService.moveTask(
                task.id,
                event.container.id,
                event.currentIndex
            ).subscribe();
        }
    }

    addSection(): void {
        // TODO: 實作新增區段
        console.log('Add section');
    }

    addTask(sectionId: string): void {
        // TODO: 實作新增任務
        console.log('Add task to section:', sectionId);
    }
}