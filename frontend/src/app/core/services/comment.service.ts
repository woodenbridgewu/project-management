import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Comment } from '../models/task.model';

export interface CreateCommentData {
    content: string;
}

export interface UpdateCommentData {
    content: string;
}

@Injectable({ providedIn: 'root' })
export class CommentService {
    private http = inject(HttpClient);

    getCommentsByTask(taskId: string): Observable<{ comments: Comment[] }> {
        return this.http.get<{ comments: Comment[] }>(
            `${environment.apiUrl}/comments/tasks/${taskId}/comments`
        );
    }

    createComment(taskId: string, commentData: CreateCommentData): Observable<{ comment: Comment }> {
        return this.http.post<{ comment: Comment }>(
            `${environment.apiUrl}/comments/tasks/${taskId}/comments`,
            commentData
        );
    }

    updateComment(commentId: string, commentData: UpdateCommentData): Observable<{ comment: Comment }> {
        return this.http.patch<{ comment: Comment }>(
            `${environment.apiUrl}/comments/${commentId}`,
            commentData
        );
    }

    deleteComment(commentId: string): Observable<void> {
        return this.http.delete<void>(`${environment.apiUrl}/comments/${commentId}`);
    }
}

