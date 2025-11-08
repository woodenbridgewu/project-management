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
import { initializeWebSocket } from './websocket/index';

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
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/projects', projectRouter);
app.use('/api/sections', sectionRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/comments', commentRouter);

// 錯誤處理
app.use(errorHandler);

// WebSocket 初始化
initializeWebSocket(io);

const PORT = config.port || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});