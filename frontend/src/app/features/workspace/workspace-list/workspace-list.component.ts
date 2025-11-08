import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace } from '../../../core/models/task.model';

@Component({
    selector: 'app-workspace-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './workspace-list.component.html',
    styleUrls: ['./workspace-list.component.css']
})
export class WorkspaceListComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private router = inject(Router);
    private authService = inject(AuthService);

    workspaces = signal<Workspace[]>([]);
    loading = signal(false);
    showCreateModal = false;
    editingWorkspace: Workspace | null = null;
    currentUserId = '';

    workspaceForm = {
        name: '',
        description: ''
    };

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.id || '';
        this.loadWorkspaces();
    }

    loadWorkspaces() {
        this.loading.set(true);
        this.workspaceService.getWorkspaces().subscribe({
            next: (response) => {
                this.workspaces.set(response.workspaces);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    saveWorkspace() {
        if (!this.workspaceForm.name.trim()) return;

        this.loading.set(true);
        const operation = this.editingWorkspace
            ? this.workspaceService.updateWorkspace(this.editingWorkspace.id, this.workspaceForm)
            : this.workspaceService.createWorkspace(this.workspaceForm);

        operation.subscribe({
            next: () => {
                this.closeModal();
                this.loadWorkspaces();
            },
            error: (error) => {
                console.error('儲存工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    editWorkspace(workspace: Workspace) {
        this.editingWorkspace = workspace;
        this.workspaceForm = {
            name: workspace.name,
            description: workspace.description || ''
        };
        this.showCreateModal = true;
    }

    deleteWorkspace(workspaceId: string) {
        if (!confirm('確定要刪除此工作區嗎？此操作無法復原。')) return;

        this.loading.set(true);
        this.workspaceService.deleteWorkspace(workspaceId).subscribe({
            next: () => {
                this.loadWorkspaces();
            },
            error: (error) => {
                console.error('刪除工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    closeModal() {
        this.showCreateModal = false;
        this.editingWorkspace = null;
        this.workspaceForm = { name: '', description: '' };
    }

    goBack() {
        this.router.navigate(['/dashboard']);
    }
}

