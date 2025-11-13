import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SearchResult {
    tasks: SearchTask[];
    projects: SearchProject[];
    workspaces: SearchWorkspace[];
    total: number;
}

export interface SearchTask {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    project_id: string;
    project_name?: string;
    workspace_id?: string;
    workspace_name?: string;
    assignee_name?: string;
    rank?: number;
}

export interface SearchProject {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    workspace_id: string;
    workspace_name?: string;
    task_count?: number;
    rank?: number;
}

export interface SearchWorkspace {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    owner_name?: string;
    project_count?: number;
    member_count?: number;
    rank?: number;
}

export interface SearchSuggestion {
    id: string;
    title: string;
    type: 'task' | 'project' | 'workspace';
    subtitle?: string;
    url: string;
}

export interface SearchSuggestionsResponse {
    suggestions: SearchSuggestion[];
}

export type SearchType = 'all' | 'tasks' | 'projects' | 'workspaces';

@Injectable({ providedIn: 'root' })
export class SearchService {
    private http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/search`;

    /**
     * 執行全文搜尋
     */
    search(
        query: string,
        type: SearchType = 'all',
        limit: number = 20,
        offset: number = 0
    ): Observable<SearchResult> {
        const params = new HttpParams()
            .set('q', query)
            .set('type', type)
            .set('limit', limit.toString())
            .set('offset', offset.toString());

        return this.http.get<SearchResult>(this.apiUrl, { params });
    }

    /**
     * 獲取搜尋建議（自動完成）
     */
    getSuggestions(query: string): Observable<SearchSuggestionsResponse> {
        const params = new HttpParams().set('q', query);
        return this.http.get<SearchSuggestionsResponse>(`${this.apiUrl}/suggestions`, { params });
    }
}

