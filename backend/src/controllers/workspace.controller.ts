import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';
import { NotificationController } from './notification.controller';

const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional()
});

const updateWorkspaceSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional()
});

const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member', 'guest']).default('member')
});

const updateMemberRoleSchema = z.object({
    role: z.enum(['owner', 'admin', 'member', 'guest'])
});

export class WorkspaceController {
    // 取得使用者的所有工作區
    async getWorkspaces(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            const result = await query(
                `SELECT 
                    w.*,
                    u.full_name as owner_name,
                    u.email as owner_email,
                    COUNT(DISTINCT p.id) as project_count,
                    COUNT(DISTINCT wm.user_id) as member_count
                FROM workspaces w
                LEFT JOIN users u ON w.owner_id = u.id
                LEFT JOIN projects p ON p.workspace_id = w.id
                LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
                WHERE w.owner_id = $1 
                   OR EXISTS (
                       SELECT 1 FROM workspace_members 
                       WHERE workspace_id = w.id AND user_id = $1
                   )
                GROUP BY w.id, u.id
                ORDER BY w.created_at DESC`,
                [userId]
            );

            res.json({ workspaces: result.rows });
        } catch (error) {
            console.error('Get workspaces error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 建立工作區
    async createWorkspace(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const workspaceData = createWorkspaceSchema.parse(req.body);

            // 建立工作區
            const workspaceResult = await query(
                `INSERT INTO workspaces (name, description, owner_id)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [workspaceData.name, workspaceData.description || null, userId]
            );

            const workspace = workspaceResult.rows[0];

            // 自動將建立者加入成員表（owner 角色）
            await query(
                `INSERT INTO workspace_members (workspace_id, user_id, role)
                 VALUES ($1, $2, 'owner')
                 ON CONFLICT (workspace_id, user_id) DO NOTHING`,
                [workspace.id, userId]
            );

            // 取得完整的工作區資訊
            const fullWorkspace = await query(
                `SELECT 
                    w.*,
                    u.full_name as owner_name,
                    u.email as owner_email
                FROM workspaces w
                LEFT JOIN users u ON w.owner_id = u.id
                WHERE w.id = $1`,
                [workspace.id]
            );

            res.status(201).json({ workspace: fullWorkspace.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Create workspace error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得工作區詳情
    async getWorkspaceById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限訪問此工作區
            const accessCheck = await query(
                `SELECT w.*, wm.role as user_role
                 FROM workspaces w
                 LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
                 WHERE w.id = $1 AND (w.owner_id = $2 OR wm.user_id = $2)`,
                [id, userId]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found or access denied' });
            }

            const workspace = accessCheck.rows[0];

            // 取得專案數量
            const projectCount = await query(
                `SELECT COUNT(*) as count FROM projects WHERE workspace_id = $1 AND is_archived = false`,
                [id]
            );

            // 取得成員數量
            const memberCount = await query(
                `SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = $1`,
                [id]
            );

            res.json({
                workspace: {
                    ...workspace,
                    project_count: parseInt(projectCount.rows[0].count),
                    member_count: parseInt(memberCount.rows[0].count)
                }
            });
        } catch (error) {
            console.error('Get workspace error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 更新工作區
    async updateWorkspace(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const updateData = updateWorkspaceSchema.parse(req.body);

            // 檢查使用者是否有權限（必須是 owner 或 admin）
            const accessCheck = await query(
                `SELECT w.owner_id, wm.role as user_role
                 FROM workspaces w
                 LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
                 WHERE w.id = $1 AND (w.owner_id = $2 OR wm.role IN ('owner', 'admin'))`,
                [id, userId]
            );

            if (accessCheck.rows.length === 0) {
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

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = NOW()`);
            values.push(id); // id 是最後一個參數

            const result = await query(
                `UPDATE workspaces 
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING *`,
                values
            );

            res.json({ workspace: result.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update workspace error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除工作區
    async deleteWorkspace(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否為 owner
            const workspaceCheck = await query(
                `SELECT owner_id FROM workspaces WHERE id = $1`,
                [id]
            );

            if (workspaceCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found' });
            }

            if (workspaceCheck.rows[0].owner_id !== userId) {
                return res.status(403).json({ error: 'Only workspace owner can delete workspace' });
            }

            // 刪除工作區（CASCADE 會自動刪除相關資料）
            await query(`DELETE FROM workspaces WHERE id = $1`, [id]);

            res.json({ message: 'Workspace deleted successfully' });
        } catch (error) {
            console.error('Delete workspace error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得成員列表
    async getMembers(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限訪問此工作區
            const accessCheck = await query(
                `SELECT 1 FROM workspaces w
                 LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
                 WHERE w.id = $1 AND (w.owner_id = $2 OR wm.user_id = $2)`,
                [id, userId]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found or access denied' });
            }

            const result = await query(
                `SELECT 
                    wm.id,
                    wm.role,
                    wm.joined_at,
                    u.id as user_id,
                    u.email,
                    u.full_name,
                    u.avatar_url,
                    CASE WHEN w.owner_id = u.id THEN true ELSE false END as is_owner
                FROM workspace_members wm
                JOIN users u ON wm.user_id = u.id
                JOIN workspaces w ON wm.workspace_id = w.id
                WHERE wm.workspace_id = $1
                ORDER BY 
                    CASE WHEN w.owner_id = u.id THEN 0 ELSE 1 END,
                    wm.joined_at ASC`,
                [id]
            );

            res.json({ members: result.rows });
        } catch (error) {
            console.error('Get members error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 邀請成員
    async inviteMember(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const inviteData = inviteMemberSchema.parse(req.body);

            // 檢查使用者是否有權限（必須是 owner 或 admin）
            const accessCheck = await query(
                `SELECT w.owner_id, wm.role as user_role
                 FROM workspaces w
                 LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
                 WHERE w.id = $1 AND (w.owner_id = $2 OR wm.role IN ('owner', 'admin'))`,
                [id, userId]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            // 查找要邀請的使用者
            const userResult = await query(
                `SELECT id FROM users WHERE email = $1`,
                [inviteData.email]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const invitedUserId = userResult.rows[0].id;

            // 檢查使用者是否已經是成員
            const existingMember = await query(
                `SELECT id FROM workspace_members 
                 WHERE workspace_id = $1 AND user_id = $2`,
                [id, invitedUserId]
            );

            if (existingMember.rows.length > 0) {
                return res.status(400).json({ error: 'User is already a member' });
            }

            // 添加成員
            const result = await query(
                `INSERT INTO workspace_members (workspace_id, user_id, role)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [id, invitedUserId, inviteData.role]
            );

            // 取得完整的成員資訊
            const memberInfo = await query(
                `SELECT 
                    wm.id,
                    wm.role,
                    wm.joined_at,
                    u.id as user_id,
                    u.email,
                    u.full_name,
                    u.avatar_url
                FROM workspace_members wm
                JOIN users u ON wm.user_id = u.id
                WHERE wm.id = $1`,
                [result.rows[0].id]
            );

            // 取得工作區名稱
            const workspaceResult = await query(
                'SELECT name FROM workspaces WHERE id = $1',
                [id]
            );
            const workspaceName = workspaceResult.rows[0]?.name || '工作區';

            // 發送通知給被邀請的用戶
            try {
                const io = req.app.get('io') as SocketIOServer;
                // 取得邀請者的名稱
                const inviterResult = await query(
                    'SELECT full_name FROM users WHERE id = $1',
                    [req.user!.id]
                );
                const inviterName = inviterResult.rows[0]?.full_name || '使用者';
                await NotificationController.createNotification(
                    invitedUserId,
                    'member_invited',
                    `您被邀請加入工作區「${workspaceName}」`,
                    `${inviterName} 邀請您加入工作區「${workspaceName}」，角色：${inviteData.role === 'admin' ? '管理員' : inviteData.role === 'member' ? '成員' : '訪客'}`,
                    'workspace',
                    id,
                    io
                );
            } catch (notifError) {
                console.error('Failed to create invitation notification:', notifError);
            }

            res.status(201).json({ member: memberInfo.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Invite member error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 更新成員角色
    async updateMemberRole(req: AuthRequest, res: Response) {
        try {
            const { id, userId: targetUserId } = req.params;
            const userId = req.user!.id;
            const updateData = updateMemberRoleSchema.parse(req.body);

            // 檢查使用者是否有權限（必須是 owner）
            const workspaceCheck = await query(
                `SELECT owner_id FROM workspaces WHERE id = $1`,
                [id]
            );

            if (workspaceCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found' });
            }

            if (workspaceCheck.rows[0].owner_id !== userId) {
                return res.status(403).json({ error: 'Only workspace owner can update member roles' });
            }

            // 檢查目標使用者是否是成員
            const memberCheck = await query(
                `SELECT id FROM workspace_members 
                 WHERE workspace_id = $1 AND user_id = $2`,
                [id, targetUserId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Member not found' });
            }

            // 如果將角色設為 owner，需要轉移 ownership
            if (updateData.role === 'owner') {
                // 將當前 owner 設為 admin
                await query(
                    `UPDATE workspace_members 
                     SET role = 'admin'
                     WHERE workspace_id = $1 AND user_id = $2`,
                    [id, workspaceCheck.rows[0].owner_id]
                );

                // 更新工作區的 owner_id
                await query(
                    `UPDATE workspaces 
                     SET owner_id = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [targetUserId, id]
                );
            }

            // 更新成員角色
            const result = await query(
                `UPDATE workspace_members 
                 SET role = $1
                 WHERE workspace_id = $2 AND user_id = $3
                 RETURNING *`,
                [updateData.role, id, targetUserId]
            );

            // 取得完整的成員資訊
            const memberInfo = await query(
                `SELECT 
                    wm.id,
                    wm.role,
                    wm.joined_at,
                    u.id as user_id,
                    u.email,
                    u.full_name,
                    u.avatar_url,
                    CASE WHEN w.owner_id = u.id THEN true ELSE false END as is_owner
                FROM workspace_members wm
                JOIN users u ON wm.user_id = u.id
                JOIN workspaces w ON wm.workspace_id = w.id
                WHERE wm.id = $1`,
                [result.rows[0].id]
            );

            res.json({ member: memberInfo.rows[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Update member role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 移除成員
    async removeMember(req: AuthRequest, res: Response) {
        try {
            const { id, userId: targetUserId } = req.params;
            const userId = req.user!.id;

            // 檢查使用者是否有權限（必須是 owner 或 admin，且不能移除自己）
            const workspaceCheck = await query(
                `SELECT owner_id FROM workspaces WHERE id = $1`,
                [id]
            );

            if (workspaceCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found' });
            }

            const isOwner = workspaceCheck.rows[0].owner_id === userId;

            if (!isOwner) {
                // 非 owner 需要檢查是否為 admin
                const memberCheck = await query(
                    `SELECT role FROM workspace_members 
                     WHERE workspace_id = $1 AND user_id = $2`,
                    [id, userId]
                );

                if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
                    return res.status(403).json({ error: 'Permission denied' });
                }
            }

            // 不能移除 owner
            if (targetUserId === workspaceCheck.rows[0].owner_id) {
                return res.status(400).json({ error: 'Cannot remove workspace owner' });
            }

            // 移除成員
            await query(
                `DELETE FROM workspace_members 
                 WHERE workspace_id = $1 AND user_id = $2`,
                [id, targetUserId]
            );

            res.json({ message: 'Member removed successfully' });
        } catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

