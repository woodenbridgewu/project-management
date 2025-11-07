import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const createTaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    sectionId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().datetime().optional(),
    estimatedHours: z.number().optional()
});

export class TaskController {
    async getTasksByProject(req: AuthRequest, res: Response) {
        try {
            const { projectId } = req.params;
            const { status, assigneeId, sectionId } = req.query;

            let queryText = `
        SELECT 
          t.*,
          u.full_name as assignee_name,
          u.avatar_url as assignee_avatar,
          c.full_name as creator_name,
          s.name as section_name,
          COUNT(DISTINCT st.id) as subtask_count,
          COUNT(DISTINCT cm.id) as comment_count,
          COUNT(DISTINCT a.id) as attachment_count
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users c ON t.creator_id = c.id
        LEFT JOIN sections s ON t.section_id = s.id
        LEFT JOIN tasks st ON st.parent_task_id = t.id
        LEFT JOIN comments cm ON cm.task_id = t.id
        LEFT JOIN task_attachments a ON a.task_id = t.id
        WHERE t.project_id = $1 AND t.parent_task_id IS NULL
      `;

            const params: any[] = [projectId];
            let paramIndex = 2;

            if (status) {
                queryText += ` AND t.status = ${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            if (assigneeId) {
                queryText += ` AND t.assignee_id = ${paramIndex}`;
                params.push(assigneeId);
                paramIndex++;
            }

            if (sectionId) {
                queryText += ` AND t.section_id = ${paramIndex}`;
                params.push(sectionId);
                paramIndex++;
            }

            queryText += `
        GROUP BY t.id, u.id, c.id, s.id
        ORDER BY t.position ASC
      `;

            const result = await query(queryText, params);
            res.json({ tasks: result.rows });
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createTask(req: AuthRequest, res: Response) {
        try {
            const { projectId } = req.params;
            const taskData = createTaskSchema.parse(req.body);

            // 取得專案的工作區 ID（用於活動紀錄）
            const projectResult = await query(
                `SELECT workspace_id FROM projects WHERE id = $1`,
                [projectId]
            );

            if (projectResult.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const workspaceId = projectResult.rows[0].workspace_id;

            // 取得最大 position（如果指定了 sectionId，則在該區段內計算，否則在專案內計算）
            let posQuery = `SELECT COALESCE(MAX(position), 0) + 1 as next_position 
                           FROM tasks WHERE project_id = $1`;
            let posParams: any[] = [projectId];

            if (taskData.sectionId) {
                posQuery += ` AND section_id = $2`;
                posParams.push(taskData.sectionId);
            } else {
                posQuery += ` AND section_id IS NULL`;
            }

            const posResult = await query(posQuery, posParams);
            const position = posResult.rows[0].next_position;

            const result = await query(
                `INSERT INTO tasks (
          project_id, section_id, title, description, 
          assignee_id, priority, due_date, estimated_hours,
          creator_id, position, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'todo')
        RETURNING *`,
                [
                    projectId,
                    taskData.sectionId || null,
                    taskData.title,
                    taskData.description || null,
                    taskData.assigneeId || null,
                    taskData.priority || null,
                    taskData.dueDate || null,
                    taskData.estimatedHours || null,
                    req.user!.id,
                    position
                ]
            );

            const task = result.rows[0];

            // 記錄活動（使用 try-catch 避免活動紀錄失敗影響主要功能）
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'task',
                    task.id,
                    'created'
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
                // 活動紀錄失敗不影響任務建立
            }

            // 取得完整的任務資訊（包含關聯資料）
            const fullTaskResult = await query(
                `SELECT 
                    t.*,
                    u.full_name as assignee_name,
                    u.avatar_url as assignee_avatar,
                    c.full_name as creator_name,
                    s.name as section_name,
                    COUNT(DISTINCT st.id) as subtask_count,
                    COUNT(DISTINCT cm.id) as comment_count,
                    COUNT(DISTINCT a.id) as attachment_count
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN users c ON t.creator_id = c.id
                LEFT JOIN sections s ON t.section_id = s.id
                LEFT JOIN tasks st ON st.parent_task_id = t.id
                LEFT JOIN comments cm ON cm.task_id = t.id
                LEFT JOIN task_attachments a ON a.task_id = t.id
                WHERE t.id = $1
                GROUP BY t.id, u.id, c.id, s.id`,
                [task.id]
            );

            res.status(201).json({ task: fullTaskResult.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateTask(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // 建立動態更新語句
            const fields = Object.keys(updates);
            const values = Object.values(updates);

            if (fields.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            const setClause = fields
                .map((field, idx) => `${field} = ${idx + 2}`)
                .join(', ');

            const result = await query(
                `UPDATE tasks 
         SET ${setClause}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
                [id, ...values]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // 記錄活動
            await this.logActivity(
                result.rows[0].project_id,
                req.user!.id,
                'task',
                id,
                'updated',
                updates
            );

            res.json({ task: result.rows[0] });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteTask(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            const result = await query(
                'DELETE FROM tasks WHERE id = $1 RETURNING project_id',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            await this.logActivity(
                result.rows[0].project_id,
                req.user!.id,
                'task',
                id,
                'deleted'
            );

            res.json({ message: 'Task deleted successfully' });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async moveTask(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { sectionId, position } = req.body;

            await query(
                `UPDATE tasks 
         SET section_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3`,
                [sectionId, position, id]
            );

            res.json({ message: 'Task moved successfully' });
        } catch (error) {
            console.error('Move task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getTaskById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            const result = await query(
                `SELECT 
          t.*,
          json_build_object(
            'id', u.id,
            'fullName', u.full_name,
            'avatarUrl', u.avatar_url
          ) as assignee,
          json_build_object(
            'id', c.id,
            'fullName', c.full_name
          ) as creator,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', tag.id,
                'name', tag.name,
                'color', tag.color
              )
            ) FILTER (WHERE tag.id IS NOT NULL),
            '[]'
          ) as tags
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users c ON t.creator_id = c.id
        LEFT JOIN task_tags tt ON tt.task_id = t.id
        LEFT JOIN tags tag ON tag.id = tt.tag_id
        WHERE t.id = $1
        GROUP BY t.id, u.id, c.id`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            res.json({ task: result.rows[0] });
        } catch (error) {
            console.error('Get task error:', error);
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