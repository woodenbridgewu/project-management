import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const createCommentSchema = z.object({
    content: z.string().min(1).max(5000)
});

const updateCommentSchema = z.object({
    content: z.string().min(1).max(5000)
});

export class CommentController {
    // 檢查使用者是否有權限訪問任務
    private async checkTaskAccess(taskId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT p.workspace_id, w.owner_id, wm.role as user_role
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             JOIN workspaces w ON p.workspace_id = w.id
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE t.id = $1 AND (
                 w.owner_id = $2 OR 
                 wm.user_id = $2
             )`,
            [taskId, userId]
        );
        return result.rows.length > 0;
    }

    // 取得任務的所有評論
    async getCommentsByTask(req: AuthRequest, res: Response) {
        try {
            const { taskId } = req.params;

            // 檢查任務訪問權限
            const hasAccess = await this.checkTaskAccess(taskId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await query(
                `SELECT 
                    c.id,
                    c.task_id,
                    c.user_id,
                    c.content,
                    (c.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (c.updated_at AT TIME ZONE 'UTC')::text as updated_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.task_id = $1
                ORDER BY c.created_at ASC`,
                [taskId]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            const comments = result.rows.map((row: any) => {
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                if (row.updated_at) {
                    const updatedAt = new Date(row.updated_at + 'Z');
                    if (!isNaN(updatedAt.getTime())) {
                        row.updated_at = updatedAt.toISOString();
                    }
                }
                return row;
            });

            res.json({ comments });
        } catch (error) {
            console.error('Get comments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 新增評論
    async createComment(req: AuthRequest, res: Response) {
        try {
            const { taskId } = req.params;
            const { content } = createCommentSchema.parse(req.body);

            // 檢查任務訪問權限
            const hasAccess = await this.checkTaskAccess(taskId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 檢查任務是否存在並取得 project_id
            const taskResult = await query(
                `SELECT t.id, t.project_id, p.workspace_id 
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [taskId]
            );

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const workspaceId = taskResult.rows[0].workspace_id;
            const projectId = taskResult.rows[0].project_id;

            // 建立評論
            const result = await query(
                `INSERT INTO comments (task_id, user_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [taskId, req.user!.id, content]
            );

            const comment = result.rows[0];

            // 取得完整的評論資料（包含使用者資訊）
            const commentWithUser = await query(
                `SELECT 
                    c.id,
                    c.task_id,
                    c.user_id,
                    c.content,
                    (c.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (c.updated_at AT TIME ZONE 'UTC')::text as updated_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = $1`,
                [comment.id]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            if (commentWithUser.rows[0]) {
                const row = commentWithUser.rows[0];
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                if (row.updated_at) {
                    const updatedAt = new Date(row.updated_at + 'Z');
                    if (!isNaN(updatedAt.getTime())) {
                        row.updated_at = updatedAt.toISOString();
                    }
                }
            }

            // 記錄活動（使用 try-catch 避免活動紀錄失敗影響主要功能）
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'comment',
                    comment.id,
                    'created',
                    { taskId, commentContent: content.substring(0, 100) }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('comment:added', commentWithUser.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(201).json({ comment: commentWithUser.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create comment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 更新評論
    async updateComment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { content } = updateCommentSchema.parse(req.body);

            // 檢查評論是否存在且屬於當前使用者
            const commentResult = await query(
                `SELECT c.*, t.id as task_id, p.workspace_id
                 FROM comments c
                 JOIN tasks t ON c.task_id = t.id
                 JOIN projects p ON t.project_id = p.id
                 WHERE c.id = $1`,
                [id]
            );

            if (commentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            const comment = commentResult.rows[0];

            // 檢查權限：只有評論的建立者可以編輯
            if (comment.user_id !== req.user!.id) {
                return res.status(403).json({ error: 'Only the comment author can edit' });
            }

            // 更新評論
            await query(
                `UPDATE comments 
                 SET content = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [content, id]
            );

            // 取得完整的評論資料（包含使用者資訊）
            const commentWithUser = await query(
                `SELECT 
                    c.id,
                    c.task_id,
                    c.user_id,
                    c.content,
                    (c.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (c.updated_at AT TIME ZONE 'UTC')::text as updated_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = $1`,
                [id]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            if (commentWithUser.rows[0]) {
                const row = commentWithUser.rows[0];
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                if (row.updated_at) {
                    const updatedAt = new Date(row.updated_at + 'Z');
                    if (!isNaN(updatedAt.getTime())) {
                        row.updated_at = updatedAt.toISOString();
                    }
                }
            }

            // 記錄活動
            try {
                await this.logActivity(
                    comment.workspace_id,
                    req.user!.id,
                    'comment',
                    id,
                    'updated',
                    { taskId: comment.task_id, commentContent: content.substring(0, 100) }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                // 取得專案 ID
                const projectResult = await query(
                    `SELECT p.id FROM projects p
                     JOIN tasks t ON p.id = t.project_id
                     WHERE t.id = $1`,
                    [comment.task_id]
                );
                if (io && projectResult.rows.length > 0) {
                    io.to(`project:${projectResult.rows[0].id}`).emit('comment:updated', commentWithUser.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ comment: commentWithUser.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update comment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除評論
    async deleteComment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            // 檢查評論是否存在
            const commentResult = await query(
                `SELECT c.*, t.id as task_id, p.workspace_id
                 FROM comments c
                 JOIN tasks t ON c.task_id = t.id
                 JOIN projects p ON t.project_id = p.id
                 WHERE c.id = $1`,
                [id]
            );

            if (commentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            const comment = commentResult.rows[0];

            // 檢查權限：只有評論的建立者可以刪除
            if (comment.user_id !== req.user!.id) {
                return res.status(403).json({ error: 'Only the comment author can delete' });
            }

            // 取得評論內容（在刪除前）
            const commentContent = comment.content;

            // 刪除評論
            await query('DELETE FROM comments WHERE id = $1', [id]);

            // 記錄活動
            try {
                await this.logActivity(
                    comment.workspace_id,
                    req.user!.id,
                    'comment',
                    id,
                    'deleted',
                    { taskId: comment.task_id, commentContent: commentContent ? commentContent.substring(0, 100) : '' }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                // 取得專案 ID
                const projectResult = await query(
                    `SELECT p.id FROM projects p
                     JOIN tasks t ON p.id = t.project_id
                     WHERE t.id = $1`,
                    [comment.task_id]
                );
                if (io && projectResult.rows.length > 0) {
                    io.to(`project:${projectResult.rows[0].id}`).emit('comment:deleted', { id, taskId: comment.task_id });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete comment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    private async logActivity(
        workspaceId: string,
        userId: string,
        entityType: string,
        entityId: string,
        action: string,
        changes?: any
    ) {
        await query(
            `INSERT INTO activity_logs 
       (workspace_id, user_id, entity_type, entity_id, action, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [workspaceId, userId, entityType, entityId, action, JSON.stringify(changes || {})]
        );
    }
}

