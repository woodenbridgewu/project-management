import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace, Project } from '../../../core/models/task.model';

@Component({
    selector: 'app-workspace-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './workspace-detail.component.html',
    styleUrls: ['./workspace-detail.component.css']
})
export class WorkspaceDetailComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private projectService = inject(ProjectService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authService = inject(AuthService);

    workspace = signal<Workspace | null>(null);
    projects = signal<Project[]>([]);
    loading = signal(false);
    showArchived = false;
    showCreateProjectModal = false;
    editingProject: Project | null = null;
    workspaceId = '';
    currentUserId = '';

    projectForm = {
        name: '',
        description: '',
        color: '#4A90E2'
    };

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.id || '';

        this.route.params.subscribe(params => {
            this.workspaceId = params['id'];
            this.loadWorkspace();
            this.loadProjects();
        });
    }

    loadWorkspace() {
        this.workspaceService.getWorkspaceById(this.workspaceId).subscribe({
            next: (response) => {
                this.workspace.set(response.workspace);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
            }
        });
    }

    loadProjects() {
        this.loading.set(true);
        this.projectService.getProjectsByWorkspace(this.workspaceId, this.showArchived ? true : false).subscribe({
            next: (response) => {
                this.projects.set(response.projects);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    toggleArchived(archived: boolean) {
        this.showArchived = archived;
        this.loadProjects();
    }

    saveProject() {
        if (!this.projectForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingProject
            ? this.projectService.updateProject(this.editingProject.id, this.projectForm)
            : this.projectService.createProject(this.workspaceId, this.projectForm);

        operation.subscribe({
            next: () => {
                this.closeProjectModal();
                this.loadProjects();
            },
            error: (error) => {
                console.error('儲存專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    editProject(project: Project) {
        this.editingProject = project;
        this.projectForm = {
            name: project.name,
            description: project.description || '',
            color: project.color
        };
        this.showCreateProjectModal = true;
    }

    archiveProject(projectId: string, archived: boolean) {
        this.loading.set(true);
        this.projectService.archiveProject(projectId, archived).subscribe({
            next: () => {
                this.loadProjects();
            },
            error: (error) => {
                console.error('封存專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    deleteProject(projectId: string) {
        if (!confirm('確定要刪除此專案嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.projectService.deleteProject(projectId).subscribe({
            next: () => {
                this.loadProjects();
            },
            error: (error) => {
                console.error('刪除專案失敗:', error);
                this.loading.set(false);
            }
        });
    }

    canEditProject(project: Project): boolean {
        const workspace = this.workspace();
        if (!workspace) return false;
        return workspace.owner_id === this.currentUserId || project.created_by === this.currentUserId;
    }

    closeProjectModal() {
        this.showCreateProjectModal = false;
        this.editingProject = null;
        this.projectForm = { name: '', description: '', color: '#4A90E2' };
    }

    goBack() {
        this.router.navigate(['/workspaces']);
    }
}

