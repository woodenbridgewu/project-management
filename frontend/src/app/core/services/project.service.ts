import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Project } from '../models/task.model';

export interface CreateProjectData {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    viewMode?: 'list' | 'board' | 'timeline' | 'calendar';
}

export interface UpdateProjectData {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    viewMode?: 'list' | 'board' | 'timeline' | 'calendar';
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
    private http = inject(HttpClient);

    // 取得工作區的專案列表
    getProjectsByWorkspace(workspaceId: string, archived?: boolean): Observable<{ projects: Project[] }> {
        let params = new HttpParams();
        if (archived !== undefined) {
            params = params.set('archived', archived.toString());
        }

        return this.http.get<{ projects: Project[] }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/projects`,
            { params }
        );
    }

    // 取得專案詳情
    getProjectById(projectId: string): Observable<{ project: Project }> {
        return this.http.get<{ project: Project }>(
            `${environment.apiUrl}/projects/${projectId}`
        );
    }

    // 建立專案
    createProject(workspaceId: string, data: CreateProjectData): Observable<{ project: Project }> {
        return this.http.post<{ project: Project }>(
            `${environment.apiUrl}/workspaces/${workspaceId}/projects`,
            data
        );
    }

    // 更新專案
    updateProject(projectId: string, data: UpdateProjectData): Observable<{ project: Project }> {
        return this.http.patch<{ project: Project }>(
            `${environment.apiUrl}/projects/${projectId}`,
            data
        );
    }

    // 刪除專案
    deleteProject(projectId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${environment.apiUrl}/projects/${projectId}`
        );
    }

    // 封存/取消封存專案
    archiveProject(projectId: string, archived: boolean): Observable<{ project: Project }> {
        return this.http.post<{ project: Project }>(
            `${environment.apiUrl}/projects/${projectId}/archive`,
            { archived }
        );
    }
}

