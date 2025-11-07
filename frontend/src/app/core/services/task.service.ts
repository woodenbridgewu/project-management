import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Task } from '../models/task.model';

interface TaskFilters {
    status?: string;
    assigneeId?: string;
    sectionId?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
    private http = inject(HttpClient);

    getTasksByProject(projectId: string, filters?: TaskFilters): Observable<{ tasks: Task[] }> {
        let params = new HttpParams();

        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params = params.set(key, value);
            });
        }

        return this.http.get<{ tasks: Task[] }>(
            `${environment.apiUrl}/tasks/projects/${projectId}/tasks`,
            { params }
        );
    }

    getTaskById(taskId: string): Observable<{ task: Task }> {
        return this.http.get<{ task: Task }>(
            `${environment.apiUrl}/tasks/${taskId}`
        );
    }

    createTask(projectId: string, taskData: Partial<Task>): Observable<{ task: Task }> {
        return this.http.post<{ task: Task }>(
            `${environment.apiUrl}/tasks/projects/${projectId}/tasks`,
            taskData
        );
    }

    updateTask(taskId: string, updates: Partial<Task>): Observable<{ task: Task }> {
        return this.http.patch<{ task: Task }>(
            `${environment.apiUrl}/tasks/${taskId}`,
            updates
        );
    }

    deleteTask(taskId: string): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/tasks/${taskId}`);
    }

    moveTask(taskId: string, sectionId: string, position: number): Observable<void> {
        return this.http.post<void>(
            `${environment.apiUrl}/tasks/${taskId}/move`,
            { sectionId, position }
        );
    }
}