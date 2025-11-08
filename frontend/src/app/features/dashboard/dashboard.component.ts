import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ProjectService } from '../../core/services/project.service';
import { Workspace, Project } from '../../core/models/task.model';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    private authService = inject(AuthService);
    private workspaceService = inject(WorkspaceService);
    private projectService = inject(ProjectService);
    private router = inject(Router);

    currentUser = this.authService.currentUser;
    workspaces = signal<Workspace[]>([]);
    recentProjects = signal<Project[]>([]);
    loading = signal(false);

    ngOnInit() {
        this.loadWorkspaces();
    }

    loadWorkspaces() {
        this.loading.set(true);
        this.workspaceService.getWorkspaces().subscribe({
            next: (response) => {
                this.workspaces.set(response.workspaces);
                // 載入每個工作區的專案
                this.loadRecentProjects(response.workspaces);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
                this.loading.set(false);
            }
        });
    }

    loadRecentProjects(workspaces: Workspace[]) {
        const allProjects: Project[] = [];
        let loadedCount = 0;

        if (workspaces.length === 0) {
            this.recentProjects.set([]);
            return;
        }

        workspaces.slice(0, 3).forEach(workspace => {
            this.projectService.getProjectsByWorkspace(workspace.id, false).subscribe({
                next: (response) => {
                    allProjects.push(...response.projects);
                    loadedCount++;
                    if (loadedCount === Math.min(workspaces.length, 3)) {
                        // 按建立時間排序，取最近 6 個
                        const sorted = allProjects.sort((a, b) => {
                            const dateA = new Date(a.created_at).getTime();
                            const dateB = new Date(b.created_at).getTime();
                            return dateB - dateA;
                        });
                        this.recentProjects.set(sorted.slice(0, 6));
                    }
                },
                error: (error) => {
                    console.error('載入專案失敗:', error);
                    loadedCount++;
                }
            });
        });
    }

    logout(): void {
        this.authService.logout();
    }
}

