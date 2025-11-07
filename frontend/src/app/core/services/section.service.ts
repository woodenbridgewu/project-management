import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Section } from '../models/task.model';

export interface CreateSectionData {
    name: string;
    position?: number;
}

export interface UpdateSectionData {
    name?: string;
    position?: number;
}

export interface ReorderSectionData {
    position: number;
}

@Injectable({ providedIn: 'root' })
export class SectionService {
    private http = inject(HttpClient);

    // 取得專案的區段列表
    getSectionsByProject(projectId: string): Observable<{ sections: Section[] }> {
        return this.http.get<{ sections: Section[] }>(
            `${environment.apiUrl}/sections/projects/${projectId}/sections`
        );
    }

    // 建立區段
    createSection(projectId: string, data: CreateSectionData): Observable<{ section: Section }> {
        return this.http.post<{ section: Section }>(
            `${environment.apiUrl}/sections/projects/${projectId}/sections`,
            data
        );
    }

    // 更新區段
    updateSection(sectionId: string, data: UpdateSectionData): Observable<{ section: Section }> {
        return this.http.patch<{ section: Section }>(
            `${environment.apiUrl}/sections/${sectionId}`,
            data
        );
    }

    // 刪除區段
    deleteSection(sectionId: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${environment.apiUrl}/sections/${sectionId}`
        );
    }

    // 重新排序區段
    reorderSection(sectionId: string, data: ReorderSectionData): Observable<{ section: Section }> {
        return this.http.post<{ section: Section }>(
            `${environment.apiUrl}/sections/${sectionId}/reorder`,
            data
        );
    }
}

