import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Workspace, WorkspaceMember } from '../models/task.model';

export interface CreateWorkspaceData {
    name: string;
    description?: string;
}

export interface UpdateWorkspaceData {
    name?: string;
    description?: string;
}

export interface InviteMemberData {
    email: string;
    role?: 'admin' | 'member' | 'guest';
}

export interface UpdateMemberRoleData {
    role: 'owner' | 'admin' | 'member' | 'guest';
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
    private http = inject(HttpClient);

    // 取得使用者的所有工作區
    getWorkspaces(): Observable<{ workspaces: Workspace[] }> {
        return this.http.get<{ workspaces: Workspace[] }>(
            `${environment.apiUrl}/workspaces`
        );
    }

    // 取得工作區詳情
    getWorkspaceById(workspaceId: string): Observable<{ workspace: Workspace }> {
        return this.http.get<{ workspace: Workspace }>(
            `${environment.apiUrl}/workspaces/${workspaceId}`
        );
    }

    // 建立工作區
    createWorkspace(data: CreateWorkspaceData): Observable<{ workspace: Workspace }> {
        return this.http.post<{ workspace: Workspace }>(
            `${environment.apiUrl}/workspaces`,
            data
        );
    }

    // 更新工作區
    updateWorkspace(workspaceId: string, data: UpdateWorkspaceData): Observable<{ workspace: Workspace }> {
        return this.http.patch<{ workspace: Workspace }>(
            `${environment.apiUrl}/workspaces/${workspaceId}`,
            data
        );
    }

    // 刪除工作區
    deleteWorkspace(workspaceId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${environment.apiUrl}/workspaces/${workspaceId}`
        );
    }

    // 取得工作區成員列表
    getMembers(workspaceId: string): Observable<{ members: WorkspaceMember[] }> {
        return this.http.get<{ members: WorkspaceMember[] }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/members`
        );
    }

    // 邀請成員
    inviteMember(workspaceId: string, data: InviteMemberData): Observable<{ message: string; member?: WorkspaceMember }> {
        return this.http.post<{ message: string; member?: WorkspaceMember }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/members`,
            data
        );
    }

    // 更新成員角色
    updateMemberRole(workspaceId: string, userId: string, data: UpdateMemberRoleData): Observable<{ member: WorkspaceMember }> {
        return this.http.patch<{ member: WorkspaceMember }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/members/${userId}`,
            data
        );
    }

    // 移除成員
    removeMember(workspaceId: string, userId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/members/${userId}`
        );
    }
}

