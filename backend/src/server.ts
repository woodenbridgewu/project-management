import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/index';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { workspaceRouter } from './routes/workspace.routes';
import { projectRouter } from './routes/project.routes';
import { sectionRouter } from './routes/section.routes';
import { taskRouter } from './routes/task.routes';
import { commentRouter } from './routes/comment.routes';
import { tagRouter } from './routes/tag.routes';
import { attachmentRouter } from './routes/attachment.routes';
import { activityRouter } from './routes/activity.routes';
import notificationRouter from './routes/notification.routes';
import { initializeWebSocket } from './websocket/index';
import { EmailService } from './services/email.service';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: { origin: config.frontendUrl, credentials: true }
});

// 將 io 實例存儲在 app 中，以便控制器訪問
app.set('io', io);

// 中介軟體
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 注意：不要對 multipart/form-data 設置編碼，因為 Multer 需要處理二進制數據
// 檔名編碼問題已在 attachment.controller.ts 中處理

// 靜態檔案服務（提供上傳的檔案）
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 路由
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/projects', projectRouter);
app.use('/api/sections', sectionRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/comments', commentRouter);
app.use('/api/tags', tagRouter);
app.use('/api/attachments', attachmentRouter);
app.use('/api/activities', activityRouter);
app.use('/api/notifications', notificationRouter);

// 錯誤處理
app.use(errorHandler);

// WebSocket 初始化
initializeWebSocket(io);

const PORT = config.port || 3000;
httpServer.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend URL: ${config.frontendUrl}`);
    
    // 驗證 Email 配置（異步，不阻塞啟動）
    if (config.smtp.host) {
        EmailService.verifyConnection().then(verified => {
            if (verified) {
                console.log('✅ Email service configured and verified');
            } else {
                console.warn('⚠️  Email service configuration failed, email notifications will be disabled');
            }
        }).catch(error => {
            console.warn('⚠️  Email service verification error:', error.message);
        });
    } else {
        console.log('ℹ️  Email service not configured (SMTP_HOST not set), email notifications disabled');
    }
});