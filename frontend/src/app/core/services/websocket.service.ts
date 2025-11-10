import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Task, Comment, Attachment, Tag, Section } from '../models/task.model';
import { Notification } from './notification.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
    private authService = inject(AuthService);
    private socket: Socket | null = null;

    connect(): void {
        const token = this.authService.getToken();

        if (!token) return;

        if (this.socket?.connected) {
            // 已經連接，不需要重新連接
            return;
        }

        this.socket = io(environment.wsUrl, {
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
        });
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }

    joinWorkspace(workspaceId: string): void {
        this.socket?.emit('join:workspace', workspaceId);
    }

    joinProject(projectId: string): void {
        this.socket?.emit('join:project', projectId);
    }

    // 任務相關事件
    onTaskCreated(): Observable<Task> {
        return new Observable(observer => {
            this.socket?.on('task:created', (data: Task) => {
                observer.next(data);
            });
        });
    }

    onTaskUpdated(): Observable<Task> {
        return new Observable(observer => {
            this.socket?.on('task:updated', (data: Task) => {
                observer.next(data);
            });
        });
    }

    onTaskDeleted(): Observable<{ id: string; projectId: string }> {
        return new Observable(observer => {
            this.socket?.on('task:deleted', (data: { id: string; projectId: string }) => {
                observer.next(data);
            });
        });
    }

    onTaskMoved(): Observable<{ id: string; projectId: string; oldSectionId: string | null; newSectionId: string | null; position: number }> {
        return new Observable(observer => {
            this.socket?.on('task:moved', (data: { id: string; projectId: string; oldSectionId: string | null; newSectionId: string | null; position: number }) => {
                observer.next(data);
            });
        });
    }

    // 評論相關事件
    onCommentAdded(): Observable<Comment> {
        return new Observable(observer => {
            this.socket?.on('comment:added', (data: Comment) => {
                observer.next(data);
            });
        });
    }

    onCommentUpdated(): Observable<Comment> {
        return new Observable(observer => {
            this.socket?.on('comment:updated', (data: Comment) => {
                observer.next(data);
            });
        });
    }

    onCommentDeleted(): Observable<{ id: string; taskId: string }> {
        return new Observable(observer => {
            this.socket?.on('comment:deleted', (data: { id: string; taskId: string }) => {
                observer.next(data);
            });
        });
    }

    // 附件相關事件
    onAttachmentAdded(): Observable<Attachment> {
        return new Observable(observer => {
            this.socket?.on('attachment:added', (data: Attachment) => {
                observer.next(data);
            });
        });
    }

    onAttachmentDeleted(): Observable<{ id: string; taskId: string }> {
        return new Observable(observer => {
            this.socket?.on('attachment:deleted', (data: { id: string; taskId: string }) => {
                observer.next(data);
            });
        });
    }

    // 標籤相關事件
    onTagAddedToTask(): Observable<{ taskId: string; tag: Tag }> {
        return new Observable(observer => {
            this.socket?.on('tag:added_to_task', (data: { taskId: string; tag: Tag }) => {
                observer.next(data);
            });
        });
    }

    onTagRemovedFromTask(): Observable<{ taskId: string; tagId: string }> {
        return new Observable(observer => {
            this.socket?.on('tag:removed_from_task', (data: { taskId: string; tagId: string }) => {
                observer.next(data);
            });
        });
    }

    // 區段相關事件
    onSectionCreated(): Observable<Section> {
        return new Observable(observer => {
            this.socket?.on('section:created', (data: Section) => {
                observer.next(data);
            });
        });
    }

    onSectionUpdated(): Observable<Section> {
        return new Observable(observer => {
            this.socket?.on('section:updated', (data: Section) => {
                observer.next(data);
            });
        });
    }

    onSectionDeleted(): Observable<{ id: string; projectId: string }> {
        return new Observable(observer => {
            this.socket?.on('section:deleted', (data: { id: string; projectId: string }) => {
                observer.next(data);
            });
        });
    }

    // 舊方法（向後兼容）
    emitTaskUpdate(projectId: string, task: Task): void {
        this.socket?.emit('task:update', { projectId, task });
    }

    emitTypingStart(projectId: string, taskId: string): void {
        this.socket?.emit('typing:start', { projectId, taskId });
    }

    // 通知相關事件
    onNotificationNew(): Observable<Notification> {
        return new Observable(observer => {
            this.socket?.on('notification:new', (notification) => {
                observer.next(notification);
            });
        });
    }

    onNotificationUnreadCount(): Observable<{ unreadCount: number }> {
        return new Observable(observer => {
            this.socket?.on('notification:unread_count', (data) => {
                observer.next(data);
            });
        });
    }
}