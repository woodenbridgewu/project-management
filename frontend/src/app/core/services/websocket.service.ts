import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Task, Comment } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
    private authService = inject(AuthService);
    private socket: Socket | null = null;

    connect(): void {
        const token = this.authService.getToken();

        if (!token) return;

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

    onTaskUpdated(): Observable<Task> {
        return new Observable(observer => {
            this.socket?.on('task:updated', (data: Task) => {
                observer.next(data);
            });
        });
    }

    onCommentAdded(): Observable<Comment> {
        return new Observable(observer => {
            this.socket?.on('comment:added', (data: Comment) => {
                observer.next(data);
            });
        });
    }

    emitTaskUpdate(projectId: string, task: Task): void {
        this.socket?.emit('task:update', { projectId, task });
    }

    emitTypingStart(projectId: string, taskId: string): void {
        this.socket?.emit('typing:start', { projectId, taskId });
    }
}