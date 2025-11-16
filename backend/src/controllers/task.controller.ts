import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';
import { cacheService } from '../services/cache.service';
import { NotificationController } from './notification.controller';

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

            // 構建快取鍵（包含所有篩選參數）
            const cacheKey = `tasks:project:${projectId}:status:${status || 'all'}:assignee:${assigneeId || 'all'}:section:${sectionId || 'all'}`;

            // 嘗試從快取獲取
            const cached = await cacheService.get<any>(cacheKey);
            if (cached) {
                return res.json(cached);
            }

            let queryText = `
        SELECT 
          t.id,
          t.project_id,
          t.section_id,
          t.parent_task_id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_id,
          t.creator_id,
          (t.due_date AT TIME ZONE 'UTC')::text as due_date,
          (t.start_date AT TIME ZONE 'UTC')::text as start_date,
          (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
          t.position,
          t.estimated_hours,
          t.actual_hours,
          (t.created_at AT TIME ZONE 'UTC')::text as created_at,
          (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
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
        WHERE t.project_id = $1 
        AND t.parent_task_id IS NULL
        AND t.section_id IS NOT NULL
      `;

            const params: any[] = [projectId];
            let paramIndex = 2;

            if (status) {
                queryText += ` AND t.status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            if (assigneeId) {
                queryText += ` AND t.assignee_id = $${paramIndex}`;
                params.push(assigneeId);
                paramIndex++;
            }

            if (sectionId) {
                queryText += ` AND t.section_id = $${paramIndex}`;
                params.push(sectionId);
                paramIndex++;
            }

            queryText += `
        GROUP BY t.id, u.id, c.id, s.id, t.created_at, t.updated_at, t.due_date, t.start_date, t.completed_at
        ORDER BY t.position ASC
      `;

            const result = await query(queryText, params);
            // 轉換時間戳為 ISO 8601 格式
            const tasks = result.rows.map((task: any) => this.formatTaskTimestamps(task));
            const response = { tasks };

            // 設置快取（TTL: 2 分鐘，因為任務更新較頻繁）
            await cacheService.set(cacheKey, response, 120);

            res.json(response);
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
                    t.id,
                    t.project_id,
                    t.section_id,
                    t.parent_task_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.assignee_id,
                    t.creator_id,
                    (t.due_date AT TIME ZONE 'UTC')::text as due_date,
                    (t.start_date AT TIME ZONE 'UTC')::text as start_date,
                    (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
                    t.position,
                    t.estimated_hours,
                    t.actual_hours,
                    (t.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
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
                GROUP BY t.id, u.id, c.id, s.id, t.created_at, t.updated_at, t.due_date, t.start_date, t.completed_at`,
                [task.id]
            );

            // 轉換時間戳為 ISO 8601 格式
            const formattedTask = this.formatTaskTimestamps(fullTaskResult.rows[0]);
            
            // 如果任務指派給了其他用戶，發送通知
            if (taskData.assigneeId && taskData.assigneeId !== req.user!.id) {
                try {
                    const io = req.app.get('io') as SocketIOServer;
                    await NotificationController.createNotification(
                        taskData.assigneeId,
                        'task_assigned',
                        `您被指派了任務「${taskData.title.substring(0, 50)}」`,
                        `任務「${taskData.title}」已指派給您`,
                        'task',
                        task.id,
                        io
                    );
                } catch (notifError) {
                    console.error('Failed to create assignment notification:', notifError);
                }
            }
            
            // 清除相關快取
            await cacheService.deletePattern(`tasks:project:${projectId}:*`);
            await cacheService.delete(`task:${task.id}`);

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('task:created', formattedTask);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }
            
            res.status(201).json({ task: formattedTask });
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

            // 先取得更新前的任務資料，用於比較
            const oldTaskResult = await query(
                'SELECT title, description, status, priority, assignee_id, due_date, estimated_hours, parent_task_id, project_id FROM tasks WHERE id = $1',
                [id]
            );

            if (oldTaskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const oldTask = oldTaskResult.rows[0];

            // 欄位名稱對應（camelCase -> snake_case）
            const fieldMapping: Record<string, string> = {
                sectionId: 'section_id',
                assigneeId: 'assignee_id',
                dueDate: 'due_date',
                startDate: 'start_date',
                estimatedHours: 'estimated_hours',
                actualHours: 'actual_hours',
                parentTaskId: 'parent_task_id'
            };

            // 建立動態更新語句
            const fields = Object.keys(updates);
            const values: any[] = [];
            const setClauses: string[] = [];
            let paramIndex = 2;

            fields.forEach(field => {
                const dbField = fieldMapping[field] || field;
                const value = updates[field];
                
                // 跳過 null 或 undefined 的值（如果要清除欄位，需要明確傳 null）
                if (value !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            });

            if (setClauses.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            const result = await query(
                `UPDATE tasks 
         SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
                [id, ...values]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // 取得完整的任務資訊（包含關聯資料）
            const fullTaskResult = await query(
                `SELECT 
                    t.id,
                    t.project_id,
                    t.section_id,
                    t.parent_task_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.assignee_id,
                    t.creator_id,
                    (t.due_date AT TIME ZONE 'UTC')::text as due_date,
                    (t.start_date AT TIME ZONE 'UTC')::text as start_date,
                    (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
                    t.position,
                    t.estimated_hours,
                    t.actual_hours,
                    (t.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
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
                GROUP BY t.id, u.id, c.id, s.id, t.created_at, t.updated_at, t.due_date, t.start_date, t.completed_at`,
                [id]
            );

            // 記錄活動（需要 workspace_id）
            const projectResult = await query(
                `SELECT workspace_id FROM projects WHERE id = $1`,
                [oldTask.project_id]
            );

            if (projectResult.rows.length > 0) {
                try {
                    // 檢查是否為子任務（有 parent_task_id）
                    const isSubtask = oldTask.parent_task_id !== null;
                    const taskTitle = fullTaskResult.rows[0].title;
                    const taskDescription = fullTaskResult.rows[0].description;
                    
                    // 準備活動記錄的 changes，只記錄實際改變的欄位
                    const activityChanges: any = {};
                    
                    // 記錄任務標題（用於顯示）
                    if (isSubtask) {
                        activityChanges.parentTaskId = oldTask.parent_task_id;
                        activityChanges.subtaskTitle = taskTitle ? taskTitle.substring(0, 50) : '';
                    } else {
                        activityChanges.taskTitle = taskTitle ? taskTitle.substring(0, 50) : '';
                    }
                    
                    // 只記錄實際改變的欄位（比較新舊值）
                    if (updates.title !== undefined && updates.title !== oldTask.title) {
                        activityChanges.newTitle = updates.title.substring(0, 50);
                    }
                    
                    if (updates.description !== undefined) {
                        const newDesc = updates.description || '';
                        const oldDesc = oldTask.description || '';
                        if (newDesc !== oldDesc) {
                            activityChanges.newDescription = newDesc ? newDesc.substring(0, 100) : '';
                        }
                    }
                    
                    if (updates.status !== undefined && updates.status !== oldTask.status) {
                        activityChanges.newStatus = updates.status;
                        // 如果是子任務且狀態變為 done，標記為完成
                        if (isSubtask && updates.status === 'done') {
                            activityChanges.completed = true;
                        }
                    }
                    
                    if (updates.priority !== undefined && updates.priority !== oldTask.priority) {
                        activityChanges.newPriority = updates.priority;
                    }
                    
                    if (updates.assigneeId !== undefined) {
                        const newAssigneeId = updates.assigneeId || null;
                        const oldAssigneeId = oldTask.assignee_id || null;
                        if (String(newAssigneeId) !== String(oldAssigneeId)) {
                            activityChanges.newAssigneeId = updates.assigneeId;
                            
                            // 如果指派了新用戶，發送通知
                            if (newAssigneeId && newAssigneeId !== req.user!.id) {
                                try {
                                    const taskTitle = fullTaskResult.rows[0].title || '任務';
                                    const io = req.app.get('io') as SocketIOServer;
                                    await NotificationController.createNotification(
                                        newAssigneeId,
                                        'task_assigned',
                                        `您被指派了任務「${taskTitle.substring(0, 50)}」`,
                                        `任務「${taskTitle}」已指派給您`,
                                        'task',
                                        id,
                                        io
                                    );
                                } catch (notifError) {
                                    console.error('Failed to create assignment notification:', notifError);
                                }
                            }
                        }
                    }
                    
                    if (updates.dueDate !== undefined) {
                        const newDueDate = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
                        const oldDueDate = oldTask.due_date ? new Date(oldTask.due_date).toISOString() : null;
                        if (newDueDate !== oldDueDate) {
                            activityChanges.newDueDate = updates.dueDate;
                        }
                    }
                    
                    if (updates.estimatedHours !== undefined) {
                        const newHours = updates.estimatedHours || null;
                        const oldHours = oldTask.estimated_hours || null;
                        if (newHours !== oldHours) {
                            activityChanges.newEstimatedHours = updates.estimatedHours;
                        }
                    }
                    
                    // 只有當有實際改變時才記錄活動
                    const hasChanges = Object.keys(activityChanges).some(key => 
                        key !== 'parentTaskId' && 
                        key !== 'subtaskTitle' && 
                        key !== 'taskTitle'
                    );
                    
                    if (hasChanges) {
                        await this.logActivity(
                            projectResult.rows[0].workspace_id,
                            req.user!.id,
                            'task',
                            id,
                            'updated',
                            activityChanges
                        );
                    }
                } catch (activityError) {
                    console.error('Failed to log activity:', activityError);
                    // 活動紀錄失敗不影響任務更新
                }
            }

            // 轉換時間戳為 ISO 8601 格式
            const formattedTask = this.formatTaskTimestamps(fullTaskResult.rows[0]);
            
            // 清除相關快取
            await cacheService.deletePattern(`tasks:project:${oldTask.project_id}:*`);
            await cacheService.delete(`task:${id}`);

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && oldTask.project_id) {
                    io.to(`project:${oldTask.project_id}`).emit('task:updated', formattedTask);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }
            
            res.json({ task: formattedTask });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteTask(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            // 先取得任務的 project_id、parent_task_id 和 title，以便後續取得 workspace_id 和記錄活動
            const taskResult = await query(
                'SELECT project_id, parent_task_id, title FROM tasks WHERE id = $1',
                [id]
            );

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const projectId = taskResult.rows[0].project_id;
            const parentTaskId = taskResult.rows[0].parent_task_id;
            const taskTitle = taskResult.rows[0].title;

            // 取得 workspace_id 用於活動記錄
            const projectResult = await query(
                `SELECT workspace_id FROM projects WHERE id = $1`,
                [projectId]
            );

            // 刪除任務
            const deleteResult = await query(
                'DELETE FROM tasks WHERE id = $1 RETURNING id',
                [id]
            );

            if (deleteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // 記錄活動（使用 try-catch 避免活動紀錄失敗影響主要功能）
            if (projectResult.rows.length > 0) {
                try {
                    // 如果是子任務，在 changes 中包含 parentTaskId 和標題
                    const activityChanges: any = {};
                    if (parentTaskId) {
                        activityChanges.parentTaskId = parentTaskId;
                        activityChanges.subtaskTitle = taskTitle ? taskTitle.substring(0, 50) : '';
                    } else {
                        activityChanges.taskTitle = taskTitle ? taskTitle.substring(0, 50) : '';
                    }
                    
                    await this.logActivity(
                        projectResult.rows[0].workspace_id,
                        req.user!.id,
                        'task',
                        id,
                        'deleted',
                        activityChanges
                    );
                } catch (activityError) {
                    console.error('Failed to log activity:', activityError);
                    // 活動紀錄失敗不影響任務刪除
                }
            }

            // 清除相關快取
            await cacheService.deletePattern(`tasks:project:${projectId}:*`);
            await cacheService.delete(`task:${id}`);

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('task:deleted', { id, projectId });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

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

            // 取得任務的 workspace_id 用於活動記錄
            const taskResult = await query(
                `SELECT t.project_id, p.workspace_id, t.section_id as old_section_id
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [id]
            );

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const workspaceId = taskResult.rows[0].workspace_id;
            const projectId = taskResult.rows[0].project_id;
            const oldSectionId = taskResult.rows[0].old_section_id;

            // 取得新區段所屬的專案 ID（用於清除快取）
            let newProjectId = projectId;
            if (oldSectionId !== sectionId) {
                const sectionResult = await query(
                    `SELECT project_id FROM sections WHERE id = $1`,
                    [sectionId]
                );
                if (sectionResult.rows.length > 0) {
                    newProjectId = sectionResult.rows[0].project_id;
                }
            }

            await query(
                `UPDATE tasks 
         SET section_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3`,
                [sectionId, position, id]
            );

            // 清除相關快取
            // 清除舊專案和新專案的任務列表快取（如果跨專案移動）
            await cacheService.deletePattern(`tasks:project:${projectId}:*`);
            if (newProjectId !== projectId) {
                await cacheService.deletePattern(`tasks:project:${newProjectId}:*`);
            }
            // 清除任務詳情快取
            await cacheService.delete(`task:${id}`);
            // 清除專案列表快取（任務計數可能改變）
            await cacheService.deletePattern(`projects:workspace:${workspaceId}:*`);

            // 記錄活動
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'task',
                    id,
                    'moved',
                    { 
                        oldSectionId,
                        newSectionId: sectionId,
                        position
                    }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('task:moved', { 
                        id, 
                        projectId,
                        oldSectionId,
                        newSectionId: sectionId,
                        position
                    });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

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
          t.id,
          t.project_id,
          t.section_id,
          t.parent_task_id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_id,
          t.creator_id,
          (t.due_date AT TIME ZONE 'UTC')::text as due_date,
          (t.start_date AT TIME ZONE 'UTC')::text as start_date,
          (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
          t.position,
          t.estimated_hours,
          t.actual_hours,
          (t.created_at AT TIME ZONE 'UTC')::text as created_at,
          (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
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
        GROUP BY t.id, u.id, c.id, t.created_at, t.updated_at, t.due_date, t.start_date, t.completed_at`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // 轉換時間戳為 ISO 8601 格式
            const formattedTask = this.formatTaskTimestamps(result.rows[0]);
            res.json({ task: formattedTask });
        } catch (error) {
            console.error('Get task error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得子任務列表
    async getSubtasks(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            // 檢查父任務是否存在並取得專案 ID
            const parentTaskResult = await query(
                'SELECT project_id FROM tasks WHERE id = $1',
                [id]
            );

            if (parentTaskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Parent task not found' });
            }

            const projectId = parentTaskResult.rows[0].project_id;

            // 檢查專案訪問權限
            const hasAccess = await this.checkProjectAccess(projectId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 取得子任務列表
            const result = await query(
                `SELECT 
                    t.id,
                    t.project_id,
                    t.section_id,
                    t.parent_task_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.assignee_id,
                    t.creator_id,
                    (t.due_date AT TIME ZONE 'UTC')::text as due_date,
                    (t.start_date AT TIME ZONE 'UTC')::text as start_date,
                    (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
                    t.position,
                    t.estimated_hours,
                    t.actual_hours,
                    (t.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
                    u.full_name as assignee_name,
                    u.avatar_url as assignee_avatar,
                    c.full_name as creator_name
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN users c ON t.creator_id = c.id
                WHERE t.parent_task_id = $1
                ORDER BY t.position ASC, t.created_at ASC`,
                [id]
            );

            // 轉換時間戳為 ISO 8601 格式
            const subtasks = result.rows.map((task: any) => this.formatTaskTimestamps(task));

            res.json({ subtasks });
        } catch (error) {
            console.error('Get subtasks error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 建立子任務
    async createSubtask(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params; // 父任務 ID
            const taskData = createTaskSchema.parse(req.body);

            // 檢查父任務是否存在並取得專案和工作區 ID
            const parentTaskResult = await query(
                `SELECT t.project_id, p.workspace_id
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [id]
            );

            if (parentTaskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Parent task not found' });
            }

            const projectId = parentTaskResult.rows[0].project_id;
            const workspaceId = parentTaskResult.rows[0].workspace_id;

            // 檢查專案訪問權限
            const hasAccess = await this.checkProjectAccess(projectId, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 取得該父任務的最大 position
            const positionResult = await query(
                `SELECT COALESCE(MAX(position), 0) + 1 as next_position
                 FROM tasks
                 WHERE parent_task_id = $1`,
                [id]
            );
            const position = parseInt(positionResult.rows[0].next_position);

            // 建立子任務
            const result = await query(
                `INSERT INTO tasks (
                    project_id,
                    parent_task_id,
                    title,
                    description,
                    status,
                    priority,
                    assignee_id,
                    creator_id,
                    due_date,
                    estimated_hours,
                    position
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING 
                    id,
                    project_id,
                    section_id,
                    parent_task_id,
                    title,
                    description,
                    status,
                    priority,
                    assignee_id,
                    creator_id,
                    (due_date AT TIME ZONE 'UTC')::text as due_date,
                    (start_date AT TIME ZONE 'UTC')::text as start_date,
                    (completed_at AT TIME ZONE 'UTC')::text as completed_at,
                    position,
                    estimated_hours,
                    actual_hours,
                    (created_at AT TIME ZONE 'UTC')::text as created_at,
                    (updated_at AT TIME ZONE 'UTC')::text as updated_at`,
                [
                    projectId,
                    id, // parent_task_id
                    taskData.title,
                    taskData.description || null,
                    'todo', // 子任務預設狀態為 todo
                    taskData.priority || null,
                    taskData.assigneeId || null,
                    req.user!.id,
                    taskData.dueDate ? new Date(taskData.dueDate) : null,
                    taskData.estimatedHours || null,
                    position
                ]
            );

            const subtask = result.rows[0];

            // 轉換時間戳為 ISO 8601 格式
            const formattedSubtask = this.formatTaskTimestamps(subtask);

            // 取得完整的子任務資料（包含 assignee 和 creator 資訊）
            const fullSubtaskResult = await query(
                `SELECT 
                    t.id,
                    t.project_id,
                    t.section_id,
                    t.parent_task_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.assignee_id,
                    t.creator_id,
                    (t.due_date AT TIME ZONE 'UTC')::text as due_date,
                    (t.start_date AT TIME ZONE 'UTC')::text as start_date,
                    (t.completed_at AT TIME ZONE 'UTC')::text as completed_at,
                    t.position,
                    t.estimated_hours,
                    t.actual_hours,
                    (t.created_at AT TIME ZONE 'UTC')::text as created_at,
                    (t.updated_at AT TIME ZONE 'UTC')::text as updated_at,
                    u.full_name as assignee_name,
                    u.avatar_url as assignee_avatar,
                    c.full_name as creator_name
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN users c ON t.creator_id = c.id
                WHERE t.id = $1`,
                [formattedSubtask.id]
            );

            const fullSubtask = this.formatTaskTimestamps(fullSubtaskResult.rows[0]);

            // Log activity
            try {
                await this.logActivity(
                    workspaceId,
                    req.user!.id,
                    'task',
                    fullSubtask.id,
                    'created',
                    { 
                        parentTaskId: id,
                        subtaskTitle: taskData.title.substring(0, 50)
                    }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('task:created', fullSubtask);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(201).json({ subtask: fullSubtask });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create subtask error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 將任務的時間戳轉換為 ISO 8601 格式（UTC）
    private formatTaskTimestamps(task: any): any {
        const formattedTask = { ...task };
        
        // PostgreSQL 返回的時間已經是 UTC 格式的字串，需要加上 'Z' 後綴轉換為 ISO 8601
        if (formattedTask.created_at) {
            const createdAt = new Date(formattedTask.created_at + 'Z');
            if (!isNaN(createdAt.getTime())) {
                formattedTask.created_at = createdAt.toISOString();
            }
        }
        
        if (formattedTask.updated_at) {
            const updatedAt = new Date(formattedTask.updated_at + 'Z');
            if (!isNaN(updatedAt.getTime())) {
                formattedTask.updated_at = updatedAt.toISOString();
            }
        }
        
        if (formattedTask.due_date) {
            const dueDate = new Date(formattedTask.due_date + 'Z');
            if (!isNaN(dueDate.getTime())) {
                formattedTask.due_date = dueDate.toISOString();
            }
        }
        
        if (formattedTask.start_date) {
            const startDate = new Date(formattedTask.start_date + 'Z');
            if (!isNaN(startDate.getTime())) {
                formattedTask.start_date = startDate.toISOString();
            }
        }
        
        if (formattedTask.completed_at) {
            const completedAt = new Date(formattedTask.completed_at + 'Z');
            if (!isNaN(completedAt.getTime())) {
                formattedTask.completed_at = completedAt.toISOString();
            }
        }
        
        return formattedTask;
    }

    // 檢查使用者是否有權限訪問專案
    private async checkProjectAccess(projectId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT p.workspace_id, w.owner_id, wm.role as user_role
             FROM projects p
             JOIN workspaces w ON p.workspace_id = w.id
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE p.id = $1 AND (
                 w.owner_id = $2 OR 
                 wm.user_id = $2
             )`,
            [projectId, userId]
        );
        return result.rows.length > 0;
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