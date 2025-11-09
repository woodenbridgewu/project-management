import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const createTagSchema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#808080')
});

const updateTagSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

export class TagController {
    // 檢查使用者是否有權限訪問工作區
    private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT 1 FROM workspaces w
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE w.id = $1 AND (w.owner_id = $2 OR wm.user_id = $2)`,
            [workspaceId, userId]
        );
        return result.rows.length > 0;
    }

    // 取得工作區的所有標籤
    async getTagsByWorkspace(req: AuthRequest, res: Response) {
        try {
            const { workspaceId } = req.params;

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await query(
                `SELECT 
                    id,
                    workspace_id,
                    name,
                    color
                FROM tags
                WHERE workspace_id = $1
                ORDER BY name ASC`,
                [workspaceId]
            );

            res.json({ tags: result.rows });
        } catch (error) {
            console.error('Get tags error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 建立標籤
    async createTag(req: AuthRequest, res: Response) {
        try {
            const { workspaceId } = req.params;
            const parsed = createTagSchema.parse(req.body);
            const name = parsed.name;
            const color = parsed.color || '#808080';

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 檢查標籤名稱是否已存在（在同一工作區內）
            const existing = await query(
                'SELECT id FROM tags WHERE workspace_id = $1 AND name = $2',
                [workspaceId, name]
            );

            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Tag name already exists in this workspace' });
            }

            // 建立標籤
            const result = await query(
                `INSERT INTO tags (workspace_id, name, color)
                 VALUES ($1, $2, $3)
                 RETURNING 
                    id,
                    workspace_id,
                    name,
                    color`,
                [workspaceId, name, color]
            );

            const tag = result.rows[0];

            res.status(201).json({ tag });
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('Validation error:', error.errors);
                return res.status(400).json({ 
                    error: 'Validation failed',
                    details: error.errors 
                });
            }
            console.error('Create tag error:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // 更新標籤
    async updateTag(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const updates = updateTagSchema.parse(req.body);

            // 檢查標籤是否存在
            const tagResult = await query(
                'SELECT workspace_id FROM tags WHERE id = $1',
                [id]
            );

            if (tagResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tag not found' });
            }

            const workspaceId = tagResult.rows[0].workspace_id;

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 如果更新名稱，檢查是否與其他標籤重複
            if (updates.name) {
                const existing = await query(
                    'SELECT id FROM tags WHERE workspace_id = $1 AND name = $2 AND id != $3',
                    [workspaceId, updates.name, id]
                );

                if (existing.rows.length > 0) {
                    return res.status(400).json({ error: 'Tag name already exists in this workspace' });
                }
            }

            // 構建更新查詢
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (updates.name !== undefined) {
                setClauses.push(`name = $${paramIndex}`);
                values.push(updates.name);
                paramIndex++;
            }

            if (updates.color !== undefined) {
                setClauses.push(`color = $${paramIndex}`);
                values.push(updates.color);
                paramIndex++;
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(id);

            const result = await query(
                `UPDATE tags 
                 SET ${setClauses.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING 
                    id,
                    workspace_id,
                    name,
                    color`,
                values
            );

            const tag = result.rows[0];

            res.json({ tag });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update tag error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除標籤
    async deleteTag(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            // 檢查標籤是否存在
            const tagResult = await query(
                'SELECT workspace_id FROM tags WHERE id = $1',
                [id]
            );

            if (tagResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tag not found' });
            }

            const workspaceId = tagResult.rows[0].workspace_id;

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 刪除標籤（會自動刪除 task_tags 關聯，因為有 ON DELETE CASCADE）
            await query('DELETE FROM tags WHERE id = $1', [id]);

            res.status(204).send();
        } catch (error) {
            console.error('Delete tag error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 為任務添加標籤
    async addTagToTask(req: AuthRequest, res: Response) {
        try {
            const { taskId } = req.params;
            const { tagId } = req.body;

            if (!tagId) {
                return res.status(400).json({ error: 'tagId is required' });
            }

            // 檢查任務是否存在並取得工作區 ID 和專案 ID
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

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 檢查標籤是否存在且屬於同一工作區
            const tagResult = await query(
                'SELECT id FROM tags WHERE id = $1 AND workspace_id = $2',
                [tagId, workspaceId]
            );

            if (tagResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tag not found or does not belong to this workspace' });
            }

            // 檢查標籤是否已經添加到任務
            const existing = await query(
                'SELECT 1 FROM task_tags WHERE task_id = $1 AND tag_id = $2',
                [taskId, tagId]
            );

            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Tag already added to this task' });
            }

            // 取得標籤名稱用於活動記錄
            const tagNameResult = await query(
                'SELECT name FROM tags WHERE id = $1',
                [tagId]
            );
            const tagName = tagNameResult.rows[0]?.name || '標籤';

            // 添加標籤到任務
            await query(
                'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)',
                [taskId, tagId]
            );

            // 記錄活動
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'tag',
                    tagId,
                    'added_to_task',
                    { taskId, tagName }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    // 取得標籤完整資訊
                    const tagInfoResult = await query(
                        'SELECT id, name, color FROM tags WHERE id = $1',
                        [tagId]
                    );
                    const tagInfo = tagInfoResult.rows[0];
                    
                    io.to(`project:${projectId}`).emit('tag:added_to_task', {
                        taskId,
                        tag: tagInfo
                    });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(201).json({ message: 'Tag added to task successfully' });
        } catch (error) {
            console.error('Add tag to task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 從任務移除標籤
    async removeTagFromTask(req: AuthRequest, res: Response) {
        try {
            const { taskId, tagId } = req.params;

            // 檢查任務是否存在並取得工作區 ID 和專案 ID
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

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 取得標籤名稱用於活動記錄
            const tagNameResult = await query(
                'SELECT name FROM tags WHERE id = $1',
                [tagId]
            );
            const tagName = tagNameResult.rows[0]?.name || '標籤';

            // 移除標籤
            const result = await query(
                'DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2',
                [taskId, tagId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Tag not found on this task' });
            }

            // 記錄活動
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'tag',
                    tagId,
                    'removed_from_task',
                    { taskId, tagName }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('tag:removed_from_task', {
                        taskId,
                        tagId
                    });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(204).send();
        } catch (error) {
            console.error('Remove tag from task error:', error);
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
