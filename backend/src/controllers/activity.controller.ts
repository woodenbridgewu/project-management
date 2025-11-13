import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { cacheService } from '../services/cache.service';

export class ActivityController {
    // 檢查使用者是否有權限訪問工作區
    private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT w.owner_id, wm.role as user_role
             FROM workspaces w
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE w.id = $1 AND (
                 w.owner_id = $2 OR 
                 wm.user_id = $2
             )`,
            [workspaceId, userId]
        );
        return result.rows.length > 0;
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

    // 取得工作區的活動紀錄
    async getWorkspaceActivities(req: AuthRequest, res: Response) {
        try {
            const { wid } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            // 檢查工作區訪問權限
            const hasAccess = await this.checkWorkspaceAccess(wid, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await query(
                `SELECT 
                    a.id,
                    a.workspace_id,
                    a.user_id,
                    a.entity_type,
                    a.entity_id,
                    a.action,
                    a.changes,
                    (a.created_at AT TIME ZONE 'UTC')::text as created_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM activity_logs a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.workspace_id = $1
                ORDER BY a.created_at DESC
                LIMIT $2 OFFSET $3`,
                [wid, limit, offset]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            const activities = result.rows.map((row: any) => {
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                // 解析 JSONB changes
                if (row.changes && typeof row.changes === 'string') {
                    try {
                        row.changes = JSON.parse(row.changes);
                    } catch (e) {
                        row.changes = {};
                    }
                }
                return row;
            });

            res.json({ activities });
        } catch (error) {
            console.error('Get workspace activities error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得專案的活動紀錄
    async getProjectActivities(req: AuthRequest, res: Response) {
        try {
            const { pid } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            // 檢查專案訪問權限
            const hasAccess = await this.checkProjectAccess(pid, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 取得專案的 workspace_id
            const projectResult = await query(
                'SELECT workspace_id FROM projects WHERE id = $1',
                [pid]
            );

            if (projectResult.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const workspaceId = projectResult.rows[0].workspace_id;

            const result = await query(
                `SELECT 
                    a.id,
                    a.workspace_id,
                    a.user_id,
                    a.entity_type,
                    a.entity_id,
                    a.action,
                    a.changes,
                    (a.created_at AT TIME ZONE 'UTC')::text as created_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM activity_logs a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.workspace_id = $1
                  AND (
                      -- 專案本身的活動紀錄
                      (a.entity_type = 'project' AND a.entity_id = $2)
                      OR 
                      -- 任務的活動紀錄
                      (a.entity_type = 'task' AND a.entity_id IN (
                          SELECT id FROM tasks WHERE project_id = $2
                      ))
                      OR 
                      -- 評論的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢評論表
                      (a.entity_type = 'comment' AND (
                          (a.changes->>'taskId')::uuid IN (
                              SELECT id FROM tasks WHERE project_id = $2
                          )
                          OR a.entity_id IN (
                              SELECT c.id FROM comments c
                              JOIN tasks t ON c.task_id = t.id
                              WHERE t.project_id = $2
                          )
                      ))
                      OR 
                      -- 附件的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢附件表
                      (a.entity_type = 'attachment' AND (
                          (a.changes->>'taskId')::uuid IN (
                              SELECT id FROM tasks WHERE project_id = $2
                          )
                          OR a.entity_id IN (
                              SELECT a2.id FROM task_attachments a2
                              JOIN tasks t ON a2.task_id = t.id
                              WHERE t.project_id = $2
                          )
                      ))
                      OR 
                      -- 標籤的活動紀錄：檢查 changes JSONB 中是否有 taskId
                      (a.entity_type = 'tag' AND (a.changes->>'taskId')::uuid IN (
                          SELECT id FROM tasks WHERE project_id = $2
                      ))
                  )
                ORDER BY a.created_at DESC
                LIMIT $3 OFFSET $4`,
                [workspaceId, pid, limit, offset]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            const activities = result.rows.map((row: any) => {
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                // 解析 JSONB changes
                if (row.changes && typeof row.changes === 'string') {
                    try {
                        row.changes = JSON.parse(row.changes);
                    } catch (e) {
                        row.changes = {};
                    }
                }
                return row;
            });

            res.json({ activities });
        } catch (error) {
            console.error('Get project activities error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得任務的活動紀錄
    async getTaskActivities(req: AuthRequest, res: Response) {
        try {
            const { tid } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            // 檢查任務訪問權限
            const hasAccess = await this.checkTaskAccess(tid, req.user!.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // 構建快取鍵（包含分頁參數）
            const cacheKey = `activities:task:${tid}:limit:${limit}:offset:${offset}`;

            // 嘗試從快取獲取
            const cached = await cacheService.get<any>(cacheKey);
            if (cached) {
                return res.json(cached);
            }

            // 取得任務的 workspace_id
            const taskResult = await query(
                `SELECT p.workspace_id 
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [tid]
            );

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const workspaceId = taskResult.rows[0].workspace_id;

            // 先取得總筆數
            const countResult = await query(
                `SELECT COUNT(*) as total
                FROM activity_logs a
                WHERE a.workspace_id = $1
                  AND (
                      -- 任務本身的活動紀錄
                      (a.entity_type = 'task' AND a.entity_id = $2)
                      OR 
                      -- 子任務的活動紀錄：檢查 changes JSONB 中是否有 parentTaskId，或查詢任務表
                      (a.entity_type = 'task' AND (
                          (a.changes->>'parentTaskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM tasks WHERE parent_task_id = $2
                          )
                      ))
                      OR 
                      -- 評論的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢評論表
                      (a.entity_type = 'comment' AND (
                          (a.changes->>'taskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM comments WHERE task_id = $2
                          )
                      ))
                      OR 
                      -- 附件的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢附件表
                      (a.entity_type = 'attachment' AND (
                          (a.changes->>'taskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM task_attachments WHERE task_id = $2
                          )
                      ))
                      OR 
                      -- 標籤的活動紀錄：檢查 changes JSONB 中是否有 taskId
                      (a.entity_type = 'tag' AND (a.changes->>'taskId')::uuid = $2::uuid)
                  )`,
                [workspaceId, tid]
            );

            const total = parseInt(countResult.rows[0].total);

            const result = await query(
                `SELECT 
                    a.id,
                    a.workspace_id,
                    a.user_id,
                    a.entity_type,
                    a.entity_id,
                    a.action,
                    a.changes,
                    (a.created_at AT TIME ZONE 'UTC')::text as created_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM activity_logs a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.workspace_id = $1
                  AND (
                      -- 任務本身的活動紀錄
                      (a.entity_type = 'task' AND a.entity_id = $2)
                      OR 
                      -- 子任務的活動紀錄：檢查 changes JSONB 中是否有 parentTaskId，或查詢任務表
                      (a.entity_type = 'task' AND (
                          (a.changes->>'parentTaskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM tasks WHERE parent_task_id = $2
                          )
                      ))
                      OR 
                      -- 評論的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢評論表
                      (a.entity_type = 'comment' AND (
                          (a.changes->>'taskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM comments WHERE task_id = $2
                          )
                      ))
                      OR 
                      -- 附件的活動紀錄：檢查 changes JSONB 中是否有 taskId，或查詢附件表
                      (a.entity_type = 'attachment' AND (
                          (a.changes->>'taskId')::uuid = $2::uuid
                          OR a.entity_id IN (
                              SELECT id FROM task_attachments WHERE task_id = $2
                          )
                      ))
                      OR 
                      -- 標籤的活動紀錄：檢查 changes JSONB 中是否有 taskId
                      (a.entity_type = 'tag' AND (a.changes->>'taskId')::uuid = $2::uuid)
                  )
                ORDER BY a.created_at DESC
                LIMIT $3 OFFSET $4`,
                [workspaceId, tid, limit, offset]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            const activities = result.rows.map((row: any) => {
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                // 解析 JSONB changes
                if (row.changes && typeof row.changes === 'string') {
                    try {
                        row.changes = JSON.parse(row.changes);
                    } catch (e) {
                        row.changes = {};
                    }
                }
                return row;
            });

            const response = { activities, total };

            // 設置快取（TTL: 1 分鐘，因為活動紀錄更新頻繁）
            await cacheService.set(cacheKey, response, 60);

            res.json(response);
        } catch (error) {
            console.error('Get task activities error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

