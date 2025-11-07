import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const createProjectSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: z.string().max(50).optional(),
    viewMode: z.enum(['list', 'board', 'timeline', 'calendar']).optional()
});

const updateProjectSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: z.string().max(50).optional(),
    viewMode: z.enum(['list', 'board', 'timeline', 'calendar']).optional()
});

export class ProjectController {
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

    // 檢查使用者是否有權限編輯專案（必須是工作區的 owner、admin 或專案的建立者）
    private async checkProjectEditAccess(projectId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT p.created_by, w.owner_id, wm.role as user_role
             FROM projects p
             JOIN workspaces w ON p.workspace_id = w.id
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE p.id = $1 AND (
                 p.created_by = $2 OR 
                 w.owner_id = $2 OR 
                 wm.role IN ('owner', 'admin')
             )`,
            [projectId, userId]
        );
        return result.rows.length > 0;
    }

    // 取得工作區的專案列表
    async getProjectsByWorkspace(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId || req.params.id;
            const userId = req.user!.id;
            const { archived } = req.query;

            // 檢查使用者是否有權限訪問此工作區
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
            if (!hasAccess) {
                return res.status(404).json({ error: 'Workspace not found or access denied' });
            }

            let queryText = `
                SELECT 
                    p.*,
                    u.full_name as creator_name,
                    u.email as creator_email,
                    u.avatar_url as creator_avatar,
                    COUNT(DISTINCT t.id) as task_count,
                    COUNT(DISTINCT s.id) as section_count
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN tasks t ON t.project_id = p.id
                LEFT JOIN sections s ON s.project_id = p.id
                WHERE p.workspace_id = $1
            `;

            const params: any[] = [workspaceId];
            let paramIndex = 2;

            // 根據 archived 參數篩選
            if (archived === 'true') {
                queryText += ` AND p.is_archived = true`;
            } else if (archived === 'false' || archived === undefined) {
                queryText += ` AND p.is_archived = false`;
            }
            // 如果 archived 未指定或為其他值，則顯示所有專案

            queryText += `
                GROUP BY p.id, u.id
                ORDER BY p.created_at DESC
            `;

            const result = await query(queryText, params);
            res.json({ projects: result.rows });
        } catch (error) {
            console.error('Get projects error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 建立專案
    async createProject(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId || req.params.id;
            const userId = req.user!.id;
            const projectData = createProjectSchema.parse(req.body);

            // 檢查使用者是否有權限訪問此工作區
            const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
            if (!hasAccess) {
                return res.status(404).json({ error: 'Workspace not found or access denied' });
            }

            // 建立專案
            const result = await query(
                `INSERT INTO projects (
                    workspace_id, name, description, color, icon, view_mode, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                [
                    workspaceId,
                    projectData.name,
                    projectData.description || null,
                    projectData.color || '#4A90E2',
                    projectData.icon || null,
                    projectData.viewMode || 'list',
                    userId
                ]
            );

            const project = result.rows[0];

            // 取得完整的專案資訊
            const fullProject = await query(
                `SELECT 
                    p.*,
                    u.full_name as creator_name,
                    u.email as creator_email,
                    u.avatar_url as creator_avatar
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = $1`,
                [project.id]
            );

            res.status(201).json({ project: fullProject.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create project error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得專案詳情
    async getProjectById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 取得專案資訊並檢查權限
            const result = await query(
                `SELECT 
                    p.*,
                    u.full_name as creator_name,
                    u.email as creator_email,
                    u.avatar_url as creator_avatar,
                    w.name as workspace_name,
                    w.owner_id as workspace_owner_id
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                JOIN workspaces w ON p.workspace_id = w.id
                WHERE p.id = $1`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const project = result.rows[0];

            // 檢查使用者是否有權限訪問此工作區
            const hasAccess = await this.checkWorkspaceAccess(project.workspace_id, userId);
            if (!hasAccess) {
                return res.status(404).json({ error: 'Project not found or access denied' });
            }

            // 取得統計資訊
            const taskCount = await query(
                `SELECT COUNT(*) as count FROM tasks WHERE project_id = $1`,
                [id]
            );

            const sectionCount = await query(
                `SELECT COUNT(*) as count FROM sections WHERE project_id = $1`,
                [id]
            );

            res.json({
                project: {
                    ...project,
                    task_count: parseInt(taskCount.rows[0].count),
                    section_count: parseInt(sectionCount.rows[0].count)
                }
            });
        } catch (error) {
            console.error('Get project error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 更新專案
    async updateProject(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const updateData = updateProjectSchema.parse(req.body);

            // 檢查使用者是否有權限編輯此專案
            const hasAccess = await this.checkProjectEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 建立更新語句
            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (updateData.name !== undefined) {
                updates.push(`name = $${paramIndex}`);
                values.push(updateData.name);
                paramIndex++;
            }

            if (updateData.description !== undefined) {
                updates.push(`description = $${paramIndex}`);
                values.push(updateData.description);
                paramIndex++;
            }

            if (updateData.color !== undefined) {
                updates.push(`color = $${paramIndex}`);
                values.push(updateData.color);
                paramIndex++;
            }

            if (updateData.icon !== undefined) {
                updates.push(`icon = $${paramIndex}`);
                values.push(updateData.icon);
                paramIndex++;
            }

            if (updateData.viewMode !== undefined) {
                updates.push(`view_mode = $${paramIndex}`);
                values.push(updateData.viewMode);
                paramIndex++;
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = NOW()`);
            values.push(id);

            const result = await query(
                `UPDATE projects 
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING *`,
                values
            );

            // 取得完整的專案資訊
            const fullProject = await query(
                `SELECT 
                    p.*,
                    u.full_name as creator_name,
                    u.email as creator_email,
                    u.avatar_url as creator_avatar
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = $1`,
                [result.rows[0].id]
            );

            res.json({ project: fullProject.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update project error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除專案
    async deleteProject(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限刪除此專案
            const hasAccess = await this.checkProjectEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 刪除專案（CASCADE 會自動刪除相關資料）
            await query(`DELETE FROM projects WHERE id = $1`, [id]);

            res.json({ message: 'Project deleted successfully' });
        } catch (error) {
            console.error('Delete project error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 封存/取消封存專案
    async archiveProject(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const { archived } = req.body;

            // 檢查使用者是否有權限編輯此專案
            const hasAccess = await this.checkProjectEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 更新封存狀態
            const result = await query(
                `UPDATE projects 
                 SET is_archived = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [archived !== false, id] // 預設為 true（封存）
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            // 取得完整的專案資訊
            const fullProject = await query(
                `SELECT 
                    p.*,
                    u.full_name as creator_name,
                    u.email as creator_email,
                    u.avatar_url as creator_avatar
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = $1`,
                [result.rows[0].id]
            );

            res.json({ project: fullProject.rows[0] });
        } catch (error) {
            console.error('Archive project error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

