import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Attachment } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class AttachmentService {
    private http = inject(HttpClient);

    getAttachmentsByTask(taskId: string): Observable<{ attachments: Attachment[] }> {
        return this.http.get<{ attachments: Attachment[] }>(
            `${environment.apiUrl}/attachments/tasks/${taskId}/attachments`
        );
    }

    uploadAttachment(taskId: string, file: File): Observable<{ attachment: Attachment }> {
        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<{ attachment: Attachment }>(
            `${environment.apiUrl}/attachments/tasks/${taskId}/attachments`,
            formData
        );
    }

    deleteAttachment(attachmentId: string): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/attachments/${attachmentId}`);
    }

    getAttachmentUrl(fileUrl: string): string {
        // 如果 fileUrl 已經是完整 URL，直接返回
        if (fileUrl.startsWith('http')) {
            return fileUrl;
        }
        // 否則拼接 API URL
        return `${environment.apiUrl.replace('/api', '')}${fileUrl}`;
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    getFileIcon(fileType: string): string {
        if (fileType.startsWith('image/')) {
            return '🖼️';
        } else if (fileType.includes('pdf')) {
            return '📄';
        } else if (fileType.includes('word') || fileType.includes('document')) {
            return '📝';
        } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
            return '📊';
        } else if (fileType.includes('text')) {
            return '📃';
        } else {
            return '📎';
        }
    }
}

