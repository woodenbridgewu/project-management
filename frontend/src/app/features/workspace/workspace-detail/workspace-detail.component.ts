import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace, Project, WorkspaceMember } from '../../../core/models/task.model';

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
    members = signal<WorkspaceMember[]>([]);
    loading = signal(false);
    loadingMembers = signal(false);
    showArchived = false;
    showCreateProjectModal = false;
    showMembersModal = false;
    showInviteModal = false;
    editingProject: Project | null = null;
    workspaceId = '';
    currentUserId = '';
    isOwner = false;
    isAdmin = false;

    projectForm = {
        name: '',
        description: '',
        color: '#4A90E2'
    };

    inviteForm = {
        email: '',
        role: 'member' as 'admin' | 'member' | 'guest'
    };

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.id || '';

        this.route.params.subscribe(params => {
            this.workspaceId = params['id'];
            this.loadWorkspace();
            this.loadProjects();
            this.loadMembers();
        });
    }

    loadWorkspace() {
        this.workspaceService.getWorkspaceById(this.workspaceId).subscribe({
            next: (response) => {
                this.workspace.set(response.workspace);
                // 檢查使用者權限
                const workspace = response.workspace;
                this.isOwner = workspace.owner_id === this.currentUserId;
                // 檢查是否為 admin（需要從成員列表中檢查）
                this.checkAdminRole();
            },
            error: (error) => {
                console.error('載入工作區失敗:', error);
            }
        });
    }

    loadMembers() {
        this.loadingMembers.set(true);
        this.workspaceService.getMembers(this.workspaceId).subscribe({
            next: (response) => {
                this.members.set(response.members);
                this.checkAdminRole();
                this.loadingMembers.set(false);
            },
            error: (error) => {
                console.error('載入成員失敗:', error);
                this.loadingMembers.set(false);
            }
        });
    }

    checkAdminRole() {
        const currentMember = this.members().find(m => m.user_id === this.currentUserId);
        this.isAdmin = this.isOwner || currentMember?.role === 'admin';
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

    // 成員管理相關方法
    openMembersModal() {
        this.showMembersModal = true;
        this.loadMembers();
    }

    closeMembersModal() {
        this.showMembersModal = false;
    }

    openInviteModal() {
        this.inviteForm = {
            email: '',
            role: 'member'
        };
        this.showInviteModal = true;
    }

    closeInviteModal() {
        this.showInviteModal = false;
        this.inviteForm = {
            email: '',
            role: 'member'
        };
    }

    inviteMember() {
        if (!this.inviteForm.email.trim()) return;

        this.loading.set(true);
        this.workspaceService.inviteMember(this.workspaceId, {
            email: this.inviteForm.email.trim(),
            role: this.inviteForm.role
        }).subscribe({
            next: () => {
                this.closeInviteModal();
                this.loadMembers();
                this.loadWorkspace(); // 更新成員數量
                this.loading.set(false);
            },
            error: (error) => {
                console.error('邀請成員失敗:', error);
                alert('邀請成員失敗：' + (error.error?.error || '未知錯誤'));
                this.loading.set(false);
            }
        });
    }

    updateMemberRole(member: WorkspaceMember, newRole: 'admin' | 'member' | 'guest') {
        if (member.role === newRole) return;
        if (!this.isOwner) {
            alert('只有工作區擁有者可以更新成員角色');
            return;
        }

        this.loading.set(true);
        this.workspaceService.updateMemberRole(this.workspaceId, member.user_id, {
            role: newRole
        }).subscribe({
            next: () => {
                this.loadMembers();
                this.loading.set(false);
            },
            error: (error) => {
                console.error('更新成員角色失敗:', error);
                alert('更新成員角色失敗：' + (error.error?.error || '未知錯誤'));
                this.loading.set(false);
            }
        });
    }

    removeMember(member: WorkspaceMember) {
        if (!confirm(`確定要將 ${member.full_name} 從工作區中移除嗎？`)) return;
        if (!this.isOwner && !this.isAdmin) {
            alert('您沒有權限移除成員');
            return;
        }
        if (member.is_owner) {
            alert('無法移除工作區擁有者');
            return;
        }

        this.loading.set(true);
        this.workspaceService.removeMember(this.workspaceId, member.user_id).subscribe({
            next: () => {
                this.loadMembers();
                this.loadWorkspace(); // 更新成員數量
                this.loading.set(false);
            },
            error: (error) => {
                console.error('移除成員失敗:', error);
                alert('移除成員失敗：' + (error.error?.error || '未知錯誤'));
                this.loading.set(false);
            }
        });
    }

    canManageMembers(): boolean {
        return this.isOwner || this.isAdmin;
    }

    getRoleText(role: string): string {
        const roleMap: Record<string, string> = {
            'owner': '擁有者',
            'admin': '管理員',
            'member': '成員',
            'guest': '訪客'
        };
        return roleMap[role] || role;
    }
}

