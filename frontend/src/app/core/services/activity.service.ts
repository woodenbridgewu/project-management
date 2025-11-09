import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Activity } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class ActivityService {
    private http = inject(HttpClient);

    getWorkspaceActivities(workspaceId: string, limit: number = 50, offset: number = 0): Observable<{ activities: Activity[] }> {
        const params = new HttpParams()
            .set('limit', limit.toString())
            .set('offset', offset.toString());
        
        return this.http.get<{ activities: Activity[] }>(
            `${environment.apiUrl}/activities/workspaces/${workspaceId}/activities`,
            { params }
        );
    }

    getProjectActivities(projectId: string, limit: number = 50, offset: number = 0): Observable<{ activities: Activity[] }> {
        const params = new HttpParams()
            .set('limit', limit.toString())
            .set('offset', offset.toString());
        
        return this.http.get<{ activities: Activity[] }>(
            `${environment.apiUrl}/activities/projects/${projectId}/activities`,
            { params }
        );
    }

    getTaskActivities(taskId: string, limit: number = 50, offset: number = 0): Observable<{ activities: Activity[]; total: number }> {
        const params = new HttpParams()
            .set('limit', limit.toString())
            .set('offset', offset.toString());
        
        return this.http.get<{ activities: Activity[]; total: number }>(
            `${environment.apiUrl}/activities/tasks/${taskId}/activities`,
            { params }
        );
    }
}

