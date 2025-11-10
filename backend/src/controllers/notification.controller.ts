import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';
import { EmailService } from '../services/email.service';
import { EmailTemplatesService } from '../services/email-templates.service';
import { config } from '../config/index';

const markAsReadSchema = z.object({
    notificationIds: z.array(z.string().uuid())
});

export class NotificationController {
    // 取得使用者的通知列表
    async getNotifications(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { isRead, limit = '50', offset = '0' } = req.query;

            let queryText = `
                SELECT 
                    n.id,
                    n.type,
                    n.title,
                    n.content,
                    n.related_entity_type,
                    n.related_entity_id,
                    n.is_read,
                    (n.created_at AT TIME ZONE 'UTC')::text as created_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as actor
                FROM notifications n
                LEFT JOIN users u ON n.related_entity_id = u.id AND n.type LIKE '%mention%'
                WHERE n.user_id = $1
            `;

            const params: any[] = [userId];
            let paramIndex = 2;

            if (isRead !== undefined) {
                queryText += ` AND n.is_read = $${paramIndex}`;
                params.push(isRead === 'true');
                paramIndex++;
            }

            queryText += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit as string), parseInt(offset as string));

            const result = await query(queryText, params);

            // 取得未讀通知數量
            const unreadCountResult = await query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
                [userId]
            );
            const unreadCount = parseInt(unreadCountResult.rows[0].count);

            // 轉換時間格式
            const notifications = result.rows.map((row: any) => {
                if (row.created_at) {
                    const createdAt = new Date(row.created_at + 'Z');
                    if (!isNaN(createdAt.getTime())) {
                        row.created_at = createdAt.toISOString();
                    }
                }
                return row;
            });

            res.json({
                notifications,
                unreadCount,
                total: notifications.length
            });
        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 標記通知為已讀
    async markAsRead(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { notificationIds } = markAsReadSchema.parse(req.body);

            if (notificationIds.length === 0) {
                return res.status(400).json({ error: 'notificationIds is required' });
            }

            // 確保只能標記自己的通知
            const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(', ');
            const result = await query(
                `UPDATE notifications 
                 SET is_read = true 
                 WHERE id IN (${placeholders}) AND user_id = $1
                 RETURNING id`,
                [userId, ...notificationIds]
            );

            // 發送 WebSocket 事件更新未讀數量
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io) {
                    const unreadCountResult = await query(
                        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
                        [userId]
                    );
                    const unreadCount = parseInt(unreadCountResult.rows[0].count);
                    io.to(`user:${userId}`).emit('notification:unread_count', { unreadCount });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ 
                message: 'Notifications marked as read',
                updated: result.rows.length
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Mark as read error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 標記所有通知為已讀
    async markAllAsRead(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            const result = await query(
                `UPDATE notifications 
                 SET is_read = true 
                 WHERE user_id = $1 AND is_read = false
                 RETURNING id`,
                [userId]
            );

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io) {
                    io.to(`user:${userId}`).emit('notification:unread_count', { unreadCount: 0 });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ 
                message: 'All notifications marked as read',
                updated: result.rows.length
            });
        } catch (error) {
            console.error('Mark all as read error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除通知
    async deleteNotification(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            const result = await query(
                'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Notification not found' });
            }

            // 更新未讀數量
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io) {
                    const unreadCountResult = await query(
                        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
                        [userId]
                    );
                    const unreadCount = parseInt(unreadCountResult.rows[0].count);
                    io.to(`user:${userId}`).emit('notification:unread_count', { unreadCount });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.json({ message: 'Notification deleted successfully' });
        } catch (error) {
            console.error('Delete notification error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 取得未讀通知數量
    async getUnreadCount(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            const result = await query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
                [userId]
            );

            res.json({ unreadCount: parseInt(result.rows[0].count) });
        } catch (error) {
            console.error('Get unread count error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 輔助方法：建立通知
    static async createNotification(
        userId: string,
        type: string,
        title: string,
        content: string | null = null,
        relatedEntityType: string | null = null,
        relatedEntityId: string | null = null,
        io?: SocketIOServer
    ): Promise<void> {
        try {
            const result = await query(
                `INSERT INTO notifications 
                 (user_id, type, title, content, related_entity_type, related_entity_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [userId, type, title, content, relatedEntityType, relatedEntityId]
            );

            const notification = result.rows[0];

            // 轉換時間格式
            if (notification.created_at) {
                const createdAt = new Date(notification.created_at + 'Z');
                if (!isNaN(createdAt.getTime())) {
                    notification.created_at = createdAt.toISOString();
                }
            }

            // 發送 WebSocket 事件
            if (io) {
                // 發送新通知
                io.to(`user:${userId}`).emit('notification:new', notification);

                // 更新未讀數量
                const unreadCountResult = await query(
                    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
                    [userId]
                );
                const unreadCount = parseInt(unreadCountResult.rows[0].count);
                io.to(`user:${userId}`).emit('notification:unread_count', { unreadCount });
            }

            // 發送 Email 通知（異步，不阻塞主流程）
            this.sendEmailNotification(userId, type, title, content, relatedEntityType, relatedEntityId).catch(error => {
                console.error('Failed to send email notification:', error);
            });
        } catch (error) {
            console.error('Create notification error:', error);
            // 不拋出錯誤，避免影響主要業務流程
        }
    }

    /**
     * 發送 Email 通知
     */
    private static async sendEmailNotification(
        userId: string,
        type: string,
        title: string,
        content: string | null,
        relatedEntityType: string | null,
        relatedEntityId: string | null
    ): Promise<void> {
        try {
            // 不發送 Email 的通知類型列表
            const skipEmailTypes = ['comment_added'];
            if (skipEmailTypes.includes(type)) {
                console.log(`Skipping email notification for type: ${type}`);
                return;
            }

            // 獲取用戶資訊（包含 email）
            const userResult = await query(
                'SELECT email, full_name FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].email) {
                console.warn(`User ${userId} not found or has no email, skipping email notification`);
                return;
            }

            const userEmail = userResult.rows[0].email;
            const userName = userResult.rows[0].full_name || '使用者';

            let emailHtml = '';
            let emailSubject = title;

            // 根據通知類型生成對應的 Email 模板
            switch (type) {
                case 'task_assigned': {
                    // 獲取任務資訊
                    if (relatedEntityType === 'task' && relatedEntityId) {
                        const taskResult = await query(
                            'SELECT title FROM tasks WHERE id = $1',
                            [relatedEntityId]
                        );
                        const taskTitle = taskResult.rows[0]?.title || title.replace('您被指派了任務「', '').replace('」', '');
                        const taskUrl = `${config.frontendUrl}/tasks/${relatedEntityId}`;
                        
                        // 嘗試獲取指派者資訊
                        let assignerName: string | undefined;
                        try {
                            const assignerResult = await query(
                                `SELECT u.full_name 
                                 FROM tasks t
                                 JOIN users u ON t.creator_id = u.id
                                 WHERE t.id = $1`,
                                [relatedEntityId]
                            );
                            assignerName = assignerResult.rows[0]?.full_name;
                        } catch (e) {
                            // 忽略錯誤
                        }

                        emailHtml = EmailTemplatesService.getTaskAssignedTemplate({
                            recipientName: userName,
                            taskTitle: taskTitle,
                            taskUrl: taskUrl,
                            assignerName: assignerName
                        });
                        emailSubject = `您被指派了任務「${taskTitle.substring(0, 50)}」`;
                    }
                    break;
                }
                case 'comment_added': {
                    // 獲取任務和評論資訊
                    if (relatedEntityType === 'task' && relatedEntityId) {
                        const taskResult = await query(
                            'SELECT title FROM tasks WHERE id = $1',
                            [relatedEntityId]
                        );
                        const taskTitle = taskResult.rows[0]?.title || '任務';
                        const taskUrl = `${config.frontendUrl}/tasks/${relatedEntityId}`;
                        
                        // 從 title 中提取評論者名稱
                        const commenterNameMatch = title.match(/^(.+?) 在任務/);
                        const commenterName = commenterNameMatch ? commenterNameMatch[1] : '某位使用者';
                        const commentPreview = content || '新增了評論';

                        emailHtml = EmailTemplatesService.getCommentAddedTemplate({
                            recipientName: userName,
                            commenterName: commenterName,
                            taskTitle: taskTitle,
                            commentPreview: commentPreview,
                            taskUrl: taskUrl
                        });
                        emailSubject = `${commenterName} 在任務「${taskTitle.substring(0, 30)}」中新增了評論`;
                    }
                    break;
                }
                case 'member_invited': {
                    // 獲取工作區資訊
                    if (relatedEntityType === 'workspace' && relatedEntityId) {
                        const workspaceResult = await query(
                            'SELECT name FROM workspaces WHERE id = $1',
                            [relatedEntityId]
                        );
                        const workspaceName = workspaceResult.rows[0]?.name || '工作區';
                        const workspaceUrl = `${config.frontendUrl}/workspaces/${relatedEntityId}`;
                        
                        // 從 content 中提取邀請者名稱和角色
                        const inviterMatch = content?.match(/^(.+?) 邀請您加入/);
                        const inviterName = inviterMatch ? inviterMatch[1] : '某位使用者';
                        const roleMatch = content?.match(/角色：(.+?)$/);
                        const role = roleMatch ? roleMatch[1] : '成員';

                        emailHtml = EmailTemplatesService.getMemberInvitedTemplate({
                            recipientName: userName,
                            inviterName: inviterName,
                            workspaceName: workspaceName,
                            role: role,
                            workspaceUrl: workspaceUrl
                        });
                        emailSubject = `您被邀請加入工作區「${workspaceName}」`;
                    }
                    break;
                }
                default:
                    // 對於其他類型的通知，使用簡單的 HTML 模板
                    emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .content {
            background: #f7fafc;
            padding: 30px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="content">
        <h2>${this.escapeHtml(title)}</h2>
        ${content ? `<p>${this.escapeHtml(content)}</p>` : ''}
    </div>
</body>
</html>
                    `.trim();
                    break;
            }

            // 發送 Email
            if (emailHtml) {
                await EmailService.sendEmail({
                    to: userEmail,
                    subject: emailSubject,
                    html: emailHtml
                });
            }
        } catch (error) {
            console.error('Send email notification error:', error);
            // 不拋出錯誤，避免影響主要業務流程
        }
    }

    /**
     * 轉義 HTML 特殊字符（用於簡單模板）
     */
    private static escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

