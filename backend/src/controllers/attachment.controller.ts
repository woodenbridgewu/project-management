import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 從 Content-Disposition header 解析檔名
function parseFileNameFromHeader(req: any): string | null {
    try {
        const contentDisposition = req.headers['content-disposition'];
        if (!contentDisposition) return null;

        // 嘗試解析 RFC 2231 格式: filename*=UTF-8''encoded-name
        const rfc2231Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (rfc2231Match) {
            try {
                return decodeURIComponent(rfc2231Match[1]);
            } catch (e) {
                // 解碼失敗
            }
        }

        // 嘗試解析標準格式: filename="encoded-name" 或 filename=encoded-name
        const standardMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
        if (standardMatch) {
            let fileName = standardMatch[1].replace(/^['"]|['"]$/g, '');
            
            // 如果是 URL 編碼，解碼它
            if (fileName.includes('%')) {
                try {
                    fileName = decodeURIComponent(fileName);
                } catch (e) {
                    // 解碼失敗，繼續處理
                }
            }
            
            return fileName;
        }

        return null;
    } catch (error) {
        console.warn('從 header 解析檔名失敗:', error);
        return null;
    }
}

// 處理檔名編碼的輔助函數
function decodeFileName(originalName: string, req?: any): string {
    try {
        // 首先嘗試從請求頭中解析檔名（最準確）
        if (req) {
            const headerFileName = parseFileNameFromHeader(req);
            if (headerFileName) {
                return headerFileName;
            }
        }

        // 如果檔名看起來已經是正確的 UTF-8，直接返回
        if (/[\u4E00-\u9FFF]/.test(originalName)) {
            return originalName;
        }

        // 方法1: 處理 RFC 2231 編碼 (filename*=UTF-8''...)
        if (originalName.includes("''")) {
            const parts = originalName.split("''");
            if (parts.length > 1) {
                try {
                    return decodeURIComponent(parts[parts.length - 1]);
                } catch (e) {
                    // 如果解碼失敗，繼續其他方法
                }
            }
        }
        
        // 方法2: 處理 URL 編碼
        if (originalName.includes('%')) {
            try {
                return decodeURIComponent(originalName);
            } catch (e) {
                // 如果解碼失敗，嘗試逐個解碼
                try {
                    return originalName.replace(/%([0-9A-F]{2})/gi, (match, hex) => {
                        return String.fromCharCode(parseInt(hex, 16));
                    });
                } catch (e2) {
                    // 如果都失敗，繼續下一個方法
                }
            }
        }
        
        // 方法3: 檢查是否為 Latin1 誤解為 UTF-8 的情況（最常見的亂碼）
        // 如果檔名包含 Latin1 範圍的字節但沒有中文字符，可能是編碼問題
        const hasLatin1Bytes = /[\x80-\xFF]/.test(originalName);
        const hasChineseChars = /[\u4E00-\u9FFF]/.test(originalName);
        
        if (hasLatin1Bytes && !hasChineseChars) {
            try {
                // 將字串當作 Latin1 讀取，然後轉換為 UTF-8
                // 這是因為 UTF-8 字節被誤解為 Latin1 的情況
                const buffer = Buffer.from(originalName, 'latin1');
                const decoded = buffer.toString('utf8');
                
                // 檢查解碼後是否包含有效的中文字符
                if (/[\u4E00-\u9FFF]/.test(decoded)) {
                    return decoded;
                }
            } catch (e) {
                // 轉換失敗
            }
        }
        
        return originalName;
    } catch (error) {
        console.warn('檔名解碼錯誤:', error, '原始檔名:', originalName);
        return originalName;
    }
}

// 自定義 Multer storage，正確處理中文檔名
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        // 確保上傳目錄存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 先嘗試從請求頭解析正確的檔名
        let originalName = file.originalname;
        
        // 嘗試從 Content-Disposition header 獲取正確的檔名
        try {
            const contentDisposition = req.headers['content-disposition'];
            if (contentDisposition) {
                // RFC 2231 格式
                const rfc2231Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
                if (rfc2231Match) {
                    try {
                        originalName = decodeURIComponent(rfc2231Match[1]);
                    } catch (e) {
                        // 解碼失敗，使用原始檔名
                    }
                } else {
                    // 標準格式
                    const standardMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
                    if (standardMatch) {
                        let fileName = standardMatch[1].replace(/^['"]|['"]$/g, '');
                        if (fileName.includes('%')) {
                            try {
                                fileName = decodeURIComponent(fileName);
                            } catch (e) {
                                // 解碼失敗
                            }
                        }
                        originalName = fileName || originalName;
                    }
                }
            }
        } catch (e) {
            // 解析失敗，使用原始檔名
        }
        
        // 處理可能的編碼問題：如果檔名看起來是 Latin1 誤解為 UTF-8
        if (/[\x80-\xFF]/.test(originalName) && !/[\u4E00-\u9FFF]/.test(originalName)) {
            try {
                const buffer = Buffer.from(originalName, 'latin1');
                const decoded = buffer.toString('utf8');
                if (/[\u4E00-\u9FFF]/.test(decoded)) {
                    originalName = decoded;
                }
            } catch (e) {
                // 轉換失敗
            }
        }
        
        // 使用 UUID + 原始檔名來避免檔名衝突
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        
        // 確保儲存的檔名是安全的（移除特殊字符，但保留中文）
        const safeName = name.replace(/[^a-zA-Z0-9\u4E00-\u9FFF\s\-_\.]/g, '_');
        cb(null, `${safeName}-${uniqueSuffix}${ext}`);
        
        // 將正確的檔名存儲在 file 對象中，以便後續使用
        file.originalname = originalName;
    }
});

// 檔案過濾器：限制檔案類型和大小
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // 允許所有檔案類型，但可以根據需求限制
    // 例如：只允許圖片和文件
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支援的檔案類型'));
    }
};

// 設定 Multer（限制檔案大小為 10MB）
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

export class AttachmentController {
    // 檢查使用者是否有權限訪問任務
    private async checkTaskAccess(taskId: string, userId: string): Promise<{ hasAccess: boolean; workspaceId?: string; projectId?: string }> {
        const result = await query(
            `SELECT t.project_id, p.workspace_id, w.owner_id, wm.role as user_role
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
        
        if (result.rows.length === 0) {
            return { hasAccess: false };
        }
        
        return {
            hasAccess: true,
            workspaceId: result.rows[0].workspace_id,
            projectId: result.rows[0].project_id
        };
    }

    // 取得任務的所有附件
    async getAttachmentsByTask(req: AuthRequest, res: Response) {
        try {
            const { taskId } = req.params;

            // 檢查任務訪問權限
            const access = await this.checkTaskAccess(taskId, req.user!.id);
            if (!access.hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await query(
                `SELECT 
                    a.id,
                    a.task_id,
                    a.file_name,
                    a.file_size,
                    a.file_type,
                    a.file_url,
                    a.uploaded_by,
                    (a.uploaded_at AT TIME ZONE 'UTC')::text as uploaded_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM task_attachments a
                LEFT JOIN users u ON a.uploaded_by = u.id
                WHERE a.task_id = $1
                ORDER BY a.uploaded_at DESC`,
                [taskId]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            const attachments = result.rows.map((row: any) => {
                if (row.uploaded_at) {
                    const uploadedAt = new Date(row.uploaded_at + 'Z');
                    if (!isNaN(uploadedAt.getTime())) {
                        row.uploaded_at = uploadedAt.toISOString();
                    }
                }
                return row;
            });

            res.json({ attachments });
        } catch (error) {
            console.error('Get attachments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 上傳附件
    async uploadAttachment(req: AuthRequest, res: Response) {
        try {
            const { taskId } = req.params;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // 檢查任務訪問權限
            const access = await this.checkTaskAccess(taskId, req.user!.id);
            if (!access.hasAccess) {
                // 刪除已上傳的檔案
                if (file.path) {
                    fs.unlinkSync(file.path);
                }
                return res.status(403).json({ error: 'Access denied' });
            }

            // 正確處理中文檔名編碼
            // 優先從請求頭解析，如果失敗則使用 Multer 提供的檔名並嘗試修復編碼
            let fileName = parseFileNameFromHeader(req) || file.originalname;
            fileName = decodeFileName(fileName, req);
            
            // 調試日誌（開發時使用）
            if (process.env.NODE_ENV !== 'production') {
                console.log('原始檔名:', file.originalname);
                console.log('解析後檔名:', fileName);
            }

            // 建立附件記錄
            const fileUrl = `/uploads/${file.filename}`;
            const result = await query(
                `INSERT INTO task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [taskId, fileName, file.size, file.mimetype, fileUrl, req.user!.id]
            );

            const attachment = result.rows[0];

            // 取得完整的附件資料（包含使用者資訊）
            const attachmentWithUser = await query(
                `SELECT 
                    a.id,
                    a.task_id,
                    a.file_name,
                    a.file_size,
                    a.file_type,
                    a.file_url,
                    a.uploaded_by,
                    (a.uploaded_at AT TIME ZONE 'UTC')::text as uploaded_at,
                    json_build_object(
                        'id', u.id,
                        'fullName', u.full_name,
                        'avatarUrl', u.avatar_url,
                        'email', u.email
                    ) as user
                FROM task_attachments a
                LEFT JOIN users u ON a.uploaded_by = u.id
                WHERE a.id = $1`,
                [attachment.id]
            );

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            if (attachmentWithUser.rows[0]) {
                const row = attachmentWithUser.rows[0];
                if (row.uploaded_at) {
                    const uploadedAt = new Date(row.uploaded_at + 'Z');
                    if (!isNaN(uploadedAt.getTime())) {
                        row.uploaded_at = uploadedAt.toISOString();
                    }
                }
            }

            // 記錄活動
            try {
                await this.logActivity(
                    access.workspaceId!,
                    req.user!.id,
                    'attachment',
                    attachment.id,
                    'created',
                    { taskId, fileName: file.originalname }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io && access.projectId) {
                    io.to(`project:${access.projectId}`).emit('attachment:added', attachmentWithUser.rows[0]);
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(201).json({ attachment: attachmentWithUser.rows[0] });
        } catch (error) {
            console.error('Upload attachment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 刪除附件
    async deleteAttachment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            // 檢查附件是否存在
            const attachmentResult = await query(
                `SELECT a.*, t.id as task_id, t.project_id, p.workspace_id
                 FROM task_attachments a
                 JOIN tasks t ON a.task_id = t.id
                 JOIN projects p ON t.project_id = p.id
                 WHERE a.id = $1`,
                [id]
            );

            if (attachmentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            const attachment = attachmentResult.rows[0];

            // 檢查權限：只有上傳者可以刪除
            if (attachment.uploaded_by !== req.user!.id) {
                return res.status(403).json({ error: 'Only the uploader can delete this attachment' });
            }

            // 刪除實體檔案
            const filePath = path.join(process.cwd(), attachment.file_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // 刪除資料庫記錄
            await query('DELETE FROM task_attachments WHERE id = $1', [id]);

            // 記錄活動
            try {
                await this.logActivity(
                    attachment.workspace_id,
                    req.user!.id,
                    'attachment',
                    id,
                    'deleted',
                    { taskId: attachment.task_id, fileName: attachment.file_name }
                );
            } catch (activityError) {
                console.error('Failed to log activity:', activityError);
            }

            // 發送 WebSocket 事件
            try {
                const io = req.app.get('io') as SocketIOServer;
                if (io) {
                    io.to(`project:${attachment.project_id}`).emit('attachment:deleted', { id, taskId: attachment.task_id });
                }
            } catch (wsError) {
                console.error('Failed to emit WebSocket event:', wsError);
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete attachment error:', error);
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

