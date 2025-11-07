import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';

export const initializeWebSocket = (io: SocketIOServer) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        try {
            const decoded = jwt.verify(token, config.jwt.accessSecret) as any;
            socket.data.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.data.userId);

        // 加入工作區房間
        socket.on('join:workspace', (workspaceId: string) => {
            socket.join(`workspace:${workspaceId}`);
            console.log(`User ${socket.data.userId} joined workspace ${workspaceId}`);
        });

        // 加入專案房間
        socket.on('join:project', (projectId: string) => {
            socket.join(`project:${projectId}`);
        });

        // 任務更新
        socket.on('task:update', (data) => {
            socket.to(`project:${data.projectId}`).emit('task:updated', data);
        });

        // 新增評論
        socket.on('comment:add', (data) => {
            socket.to(`project:${data.projectId}`).emit('comment:added', data);
        });

        // 使用者正在輸入
        socket.on('typing:start', (data) => {
            socket.to(`project:${data.projectId}`).emit('user:typing', {
                userId: socket.data.userId,
                taskId: data.taskId
            });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.data.userId);
        });
    });
};