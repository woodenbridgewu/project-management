import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const createSectionSchema = z.object({
    name: z.string().min(1).max(255),
    position: z.number().int().optional()
});

const updateSectionSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    position: z.number().int().optional()
});

const reorderSectionSchema = z.object({
    position: z.number().int().min(0)
});

export class SectionController {
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

    // 檢查使用者是否有權限編輯區段（通過檢查區段所屬的專案）
    private async checkSectionEditAccess(sectionId: string, userId: string): Promise<boolean> {
        const result = await query(
            `SELECT p.created_by, w.owner_id, wm.role as user_role
             FROM sections s
             JOIN projects p ON s.project_id = p.id
             JOIN workspaces w ON p.workspace_id = w.id
             LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
             WHERE s.id = $1 AND (
                 p.created_by = $2 OR 
                 w.owner_id = $2 OR 
                 wm.role IN ('owner', 'admin')
             )`,
            [sectionId, userId]
        );
        return result.rows.length > 0;
    }

    // 取得專案的區段列表
    async getSectionsByProject(req: AuthRequest, res: Response) {
        try {
            const { projectId } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限訪問此專案
            const hasAccess = await this.checkProjectAccess(projectId, userId);
            if (!hasAccess) {
                return res.status(404).json({ error: 'Project not found or access denied' });
            }

            const result = await query(
                `SELECT 
                    s.*,
                    COUNT(DISTINCT t.id) as task_count
                FROM sections s
                LEFT JOIN tasks t ON t.section_id = s.id
                WHERE s.project_id = $1
                GROUP BY s.id
                ORDER BY s.position ASC`,
                [projectId]
            );

            res.json({ sections: result.rows });
        } catch (error) {
            console.error('Get sections error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 建立區段
    async createSection(req: AuthRequest, res: Response) {
        try {
            const { projectId } = req.params;
            const userId = req.user!.id;
            const sectionData = createSectionSchema.parse(req.body);

            // 檢查使用者是否有權限編輯此專案
            const hasAccess = await this.checkProjectEditAccess(projectId, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 如果沒有指定 position，則設為最後一個位置
            let position = sectionData.position;
            if (position === undefined) {
                const posResult = await query(
                    `SELECT COALESCE(MAX(position), -1) + 1 as next_position 
                     FROM sections WHERE project_id = $1`,
                    [projectId]
                );
                position = posResult.rows[0].next_position;
            } else {
                // 如果指定了 position，需要將後面的區段位置往後移
                await query(
                    `UPDATE sections 
                     SET position = position + 1 
                     WHERE project_id = $1 AND position >= $2`,
                    [projectId, position]
                );
            }

            // 建立區段
            const result = await query(
                `INSERT INTO sections (project_id, name, position)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [projectId, sectionData.name, position]
            );

            // 取得完整的區段資訊（包含任務數量）
            const fullSection = await query(
                `SELECT 
                    s.*,
                    COUNT(DISTINCT t.id) as task_count
                FROM sections s
                LEFT JOIN tasks t ON t.section_id = s.id
                WHERE s.id = $1
                GROUP BY s.id`,
                [result.rows[0].id]
            );

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('section:created', fullSection.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(201).json({ section: fullSection.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create section error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 更新區段
    async updateSection(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const updateData = updateSectionSchema.parse(req.body);

            // 檢查使用者是否有權限編輯此區段
            const hasAccess = await this.checkSectionEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 取得原始區段資訊
            const sectionResult = await query(
                `SELECT project_id, position FROM sections WHERE id = $1`,
                [id]
            );

            if (sectionResult.rows.length === 0) {
                return res.status(404).json({ error: 'Section not found' });
            }

            const oldPosition = sectionResult.rows[0].position;
            const projectId = sectionResult.rows[0].project_id;
            const newPosition = updateData.position;

            // 如果更新了 position，需要重新排序
            if (newPosition !== undefined && newPosition !== oldPosition) {
                if (newPosition > oldPosition) {
                    // 往後移：將中間的區段往前移
                    await query(
                        `UPDATE sections 
                         SET position = position - 1 
                         WHERE project_id = $1 AND position > $2 AND position <= $3`,
                        [projectId, oldPosition, newPosition]
                    );
                } else {
                    // 往前移：將中間的區段往後移
                    await query(
                        `UPDATE sections 
                         SET position = position + 1 
                         WHERE project_id = $1 AND position >= $2 AND position < $3`,
                        [projectId, newPosition, oldPosition]
                    );
                }
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

            if (updateData.position !== undefined) {
                updates.push(`position = $${paramIndex}`);
                values.push(updateData.position);
                paramIndex++;
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = NOW()`);
            values.push(id);

            const result = await query(
                `UPDATE sections 
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING *`,
                values
            );

            // 取得完整的區段資訊
            const fullSection = await query(
                `SELECT 
                    s.*,
                    COUNT(DISTINCT t.id) as task_count
                FROM sections s
                LEFT JOIN tasks t ON t.section_id = s.id
                WHERE s.id = $1
                GROUP BY s.id`,
                [result.rows[0].id]
            );

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('section:updated', fullSection.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ section: fullSection.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update section error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除區段
    async deleteSection(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限編輯此區段
            const hasAccess = await this.checkSectionEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 取得區段資訊（用於重新排序）
            const sectionResult = await query(
                `SELECT project_id, position FROM sections WHERE id = $1`,
                [id]
            );

            if (sectionResult.rows.length === 0) {
                return res.status(404).json({ error: 'Section not found' });
            }

            const projectId = sectionResult.rows[0].project_id;
            const position = sectionResult.rows[0].position;

            // 刪除區段（CASCADE 會自動處理相關任務）
            await query(`DELETE FROM sections WHERE id = $1`, [id]);

            // 重新排序：將後面的區段位置往前移
            await query(
                `UPDATE sections 
                 SET position = position - 1 
                 WHERE project_id = $1 AND position > $2`,
                [projectId, position]
            );

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('section:deleted', { id, projectId });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ message: 'Section deleted successfully' });
        } catch (error) {
            console.error('Delete section error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 重新排序區段
    async reorderSection(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const { position } = reorderSectionSchema.parse(req.body);

            // 檢查使用者是否有權限編輯此區段
            const hasAccess = await this.checkSectionEditAccess(id, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 取得原始區段資訊
            const sectionResult = await query(
                `SELECT project_id, position as old_position FROM sections WHERE id = $1`,
                [id]
            );

            if (sectionResult.rows.length === 0) {
                return res.status(404).json({ error: 'Section not found' });
            }

            const projectId = sectionResult.rows[0].project_id;
            const oldPosition = sectionResult.rows[0].old_position;

            if (position === oldPosition) {
                // 位置沒有改變，直接返回
                const result = await query(
                    `SELECT 
                        s.*,
                        COUNT(DISTINCT t.id) as task_count
                    FROM sections s
                    LEFT JOIN tasks t ON t.section_id = s.id
                    WHERE s.id = $1
                    GROUP BY s.id`,
                    [id]
                );
                return res.json({ section: result.rows[0] });
            }

            // 重新排序邏輯
            if (position > oldPosition) {
                // 往後移：將中間的區段往前移
                await query(
                    `UPDATE sections 
                     SET position = position - 1 
                     WHERE project_id = $1 AND position > $2 AND position <= $3`,
                    [projectId, oldPosition, position]
                );
            } else {
                // 往前移：將中間的區段往後移
                await query(
                    `UPDATE sections 
                     SET position = position + 1 
                     WHERE project_id = $1 AND position >= $2 AND position < $3`,
                    [projectId, position, oldPosition]
                );
            }

            // 更新當前區段的位置
            const result = await query(
                `UPDATE sections 
                 SET position = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [position, id]
            );

            // 取得完整的區段資訊
            const fullSection = await query(
                `SELECT 
                    s.*,
                    COUNT(DISTINCT t.id) as task_count
                FROM sections s
                LEFT JOIN tasks t ON t.section_id = s.id
                WHERE s.id = $1
                GROUP BY s.id`,
                [result.rows[0].id]
            );

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && projectId) {
                    io.to(`project:${projectId}`).emit('section:updated', fullSection.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ section: fullSection.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Reorder section error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

