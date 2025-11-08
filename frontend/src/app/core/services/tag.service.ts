import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Tag } from '../models/task.model';

export interface CreateTagData {
    name: string;
    color?: string;
}

export interface UpdateTagData {
    name?: string;
    color?: string;
}

@Injectable({ providedIn: 'root' })
export class TagService {
    private http = inject(HttpClient);

    getTagsByWorkspace(workspaceId: string): Observable<{ tags: Tag[] }> {
        return this.http.get<{ tags: Tag[] }>(
            `${environment.apiUrl}/tags/workspaces/${workspaceId}/tags`
        );
    }

    createTag(workspaceId: string, tagData: CreateTagData): Observable<{ tag: Tag }> {
        return this.http.post<{ tag: Tag }>(
            `${environment.apiUrl}/tags/workspaces/${workspaceId}/tags`,
            tagData
        );
    }

    updateTag(tagId: string, tagData: UpdateTagData): Observable<{ tag: Tag }> {
        return this.http.patch<{ tag: Tag }>(
            `${environment.apiUrl}/tags/${tagId}`,
            tagData
        );
    }

    deleteTag(tagId: string): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/tags/${tagId}`);
    }

    addTagToTask(taskId: string, tagId: string): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(
            `${environment.apiUrl}/tags/tasks/${taskId}/tags`,
            { tagId }
        );
    }

    removeTagFromTask(taskId: string, tagId: string): Observable<void> {
        return this.http.delete<void>(
            `${environment.apiUrl}/tags/tasks/${taskId}/tags/${tagId}`
        );
    }
}
