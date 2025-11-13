import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database/index';
import { z } from 'zod';

const searchSchema = z.object({
    q: z.string().min(1).max(500),
    type: z.enum(['all', 'tasks', 'projects', 'workspaces']).optional().default('all'),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0)
});

export class SearchController {
    /**
     * 全文搜尋
     * 支援搜尋任務、專案、工作區
     */
    async search(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { q, type, limit, offset } = searchSchema.parse({
                q: req.query.q,
                type: req.query.type || 'all',
                limit: req.query.limit || 20,
                offset: req.query.offset || 0
            });

            const searchTerm = q.trim();
            if (!searchTerm) {
                return res.json({
                    tasks: [],
                    projects: [],
                    workspaces: [],
                    total: 0
                });
            }

            // 使用 PostgreSQL 全文搜尋
            // 轉換搜尋詞為 tsquery 格式（支援多詞搜尋）
            const searchWords = searchTerm
                .split(/\s+/)
                .filter(word => word.length > 0)
                .map(word => word.replace(/[^\w\u4e00-\u9fa5]/g, '')) // 移除特殊字符，保留中文和英文
                .filter(word => word.length > 0)
                .map(word => `'${word}'`); // 轉換為 tsquery 格式

            if (searchWords.length === 0) {
                return res.json({
                    tasks: [],
                    projects: [],
                    workspaces: [],
                    total: 0
                });
            }

            // 使用 & 連接詞（AND 搜尋）或 | 連接詞（OR 搜尋）
            // 這裡使用 & 表示所有詞都必須匹配
            const tsQuery = searchWords.join(' & ');

            const results: {
                tasks: any[];
                projects: any[];
                workspaces: any[];
                total: number;
            } = {
                tasks: [],
                projects: [],
                workspaces: [],
                total: 0
            };

            // 搜尋任務
            if (type === 'all' || type === 'tasks') {
                const tasksResult = await query(
                    `SELECT 
                        t.id,
                        t.title,
                        t.description,
                        t.status,
                        t.priority,
                        t.project_id,
                        t.section_id,
                        p.name as project_name,
                        p.workspace_id,
                        w.name as workspace_name,
                        u.full_name as assignee_name,
                        ts_rank(
                            to_tsvector('simple', COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')),
                            plainto_tsquery('simple', $1)
                        ) as rank
                    FROM tasks t
                    INNER JOIN projects p ON t.project_id = p.id
                    INNER JOIN workspaces w ON p.workspace_id = w.id
                    LEFT JOIN users u ON t.assignee_id = u.id
                    WHERE t.project_id IS NOT NULL
                    AND t.section_id IS NOT NULL
                    AND p.workspace_id IS NOT NULL
                    AND (
                        -- 檢查用戶是否有權限訪問該任務的專案
                        EXISTS (
                            SELECT 1 FROM workspace_members wm
                            WHERE wm.workspace_id = p.workspace_id
                            AND wm.user_id = $2
                        )
                        OR p.workspace_id IN (
                            SELECT id FROM workspaces WHERE owner_id = $2
                        )
                    )
                    AND (
                        t.title ILIKE $3
                        OR (t.description IS NOT NULL AND t.description ILIKE $3)
                        OR (
                            LENGTH(COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')) > 0
                            AND to_tsvector('simple', COALESCE(t.title, '') || ' ' || COALESCE(t.description, ''))
                            @@ plainto_tsquery('simple', $1)
                        )
                    )
                    ORDER BY rank DESC NULLS LAST, t.updated_at DESC
                    LIMIT $4 OFFSET $5`,
                    [searchTerm, userId, `%${searchTerm}%`, limit, offset]
                );
                results.tasks = tasksResult.rows;
            }

            // 搜尋專案
            if (type === 'all' || type === 'projects') {
                const projectsResult = await query(
                    `SELECT 
                        p.id,
                        p.name,
                        p.description,
                        p.color,
                        p.icon,
                        p.workspace_id,
                        w.name as workspace_name,
                        COUNT(DISTINCT t.id) as task_count,
                        ts_rank(
                            to_tsvector('simple', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')),
                            plainto_tsquery('simple', $1)
                        ) as rank
                    FROM projects p
                    INNER JOIN workspaces w ON p.workspace_id = w.id
                    LEFT JOIN tasks t ON t.project_id = p.id
                    WHERE (
                        -- 檢查用戶是否有權限訪問該專案
                        EXISTS (
                            SELECT 1 FROM workspace_members wm
                            WHERE wm.workspace_id = p.workspace_id
                            AND wm.user_id = $2
                        )
                        OR p.workspace_id IN (
                            SELECT id FROM workspaces WHERE owner_id = $2
                        )
                    )
                    AND p.is_archived = false
                    AND (
                        p.name ILIKE $3
                        OR (p.description IS NOT NULL AND p.description ILIKE $3)
                        OR (
                            LENGTH(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) > 0
                            AND to_tsvector('simple', COALESCE(p.name, '') || ' ' || COALESCE(p.description, ''))
                            @@ plainto_tsquery('simple', $1)
                        )
                    )
                    GROUP BY p.id, p.name, p.description, p.color, p.icon, p.workspace_id, p.updated_at, w.name
                    ORDER BY rank DESC NULLS LAST, p.updated_at DESC
                    LIMIT $4 OFFSET $5`,
                    [searchTerm, userId, `%${searchTerm}%`, limit, offset]
                );
                results.projects = projectsResult.rows;
            }

            // 搜尋工作區
            if (type === 'all' || type === 'workspaces') {
                const workspacesResult = await query(
                    `SELECT 
                        w.id,
                        w.name,
                        w.description,
                        w.owner_id,
                        u.full_name as owner_name,
                        COUNT(DISTINCT p.id) as project_count,
                        COUNT(DISTINCT wm.user_id) as member_count,
                        ts_rank(
                            to_tsvector('simple', COALESCE(w.name, '') || ' ' || COALESCE(w.description, '')),
                            plainto_tsquery('simple', $1)
                        ) as rank
                    FROM workspaces w
                    LEFT JOIN users u ON w.owner_id = u.id
                    LEFT JOIN projects p ON p.workspace_id = w.id
                    LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
                    WHERE (
                        -- 檢查用戶是否有權限訪問該工作區
                        w.owner_id = $2
                        OR EXISTS (
                            SELECT 1 FROM workspace_members wm2
                            WHERE wm2.workspace_id = w.id
                            AND wm2.user_id = $2
                        )
                    )
                    AND (
                        w.name ILIKE $3
                        OR (w.description IS NOT NULL AND w.description ILIKE $3)
                        OR (
                            LENGTH(COALESCE(w.name, '') || ' ' || COALESCE(w.description, '')) > 0
                            AND to_tsvector('simple', COALESCE(w.name, '') || ' ' || COALESCE(w.description, ''))
                            @@ plainto_tsquery('simple', $1)
                        )
                    )
                    GROUP BY w.id, w.name, w.description, w.owner_id, w.updated_at, u.full_name
                    ORDER BY rank DESC NULLS LAST, w.updated_at DESC
                    LIMIT $4 OFFSET $5`,
                    [searchTerm, userId, `%${searchTerm}%`, limit, offset]
                );
                results.workspaces = workspacesResult.rows;
            }

            results.total = results.tasks.length + results.projects.length + results.workspaces.length;

            res.json(results);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
            }
            console.error('Search error:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    /**
     * 快速搜尋建議（自動完成）
     * 返回前 5 個最相關的結果
     */
    async searchSuggestions(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;
            const { q } = req.query;

            if (!q || typeof q !== 'string' || q.trim().length === 0) {
                return res.json({ suggestions: [] });
            }

            const searchTerm = q.trim();
            const limit = 5;

            const suggestions: any[] = [];

            // 搜尋任務標題（最相關）
            const tasksResult = await query(
                `SELECT DISTINCT
                    t.id,
                    t.title,
                    'task' as type,
                    p.name as project_name,
                    w.name as workspace_name
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN workspaces w ON p.workspace_id = w.id
                WHERE t.section_id IS NOT NULL
                AND (
                    EXISTS (
                        SELECT 1 FROM workspace_members wm
                        WHERE wm.workspace_id = p.workspace_id
                        AND wm.user_id = $1
                    )
                    OR p.workspace_id IN (
                        SELECT id FROM workspaces WHERE owner_id = $1
                    )
                )
                AND t.title ILIKE $2
                ORDER BY t.updated_at DESC
                LIMIT $3`,
                [userId, `%${searchTerm}%`, limit]
            );

            suggestions.push(...tasksResult.rows.map(row => ({
                id: row.id,
                title: row.title,
                type: 'task',
                subtitle: `${row.project_name || '未知專案'} · ${row.workspace_name || '未知工作區'}`,
                url: `/tasks/${row.id}`
            })));

            // 搜尋專案名稱
            const projectsResult = await query(
                `SELECT DISTINCT
                    p.id,
                    p.name,
                    'project' as type,
                    w.name as workspace_name
                FROM projects p
                LEFT JOIN workspaces w ON p.workspace_id = w.id
                WHERE (
                    EXISTS (
                        SELECT 1 FROM workspace_members wm
                        WHERE wm.workspace_id = p.workspace_id
                        AND wm.user_id = $1
                    )
                    OR p.workspace_id IN (
                        SELECT id FROM workspaces WHERE owner_id = $1
                    )
                )
                AND p.is_archived = false
                AND p.name ILIKE $2
                ORDER BY p.updated_at DESC
                LIMIT $3`,
                [userId, `%${searchTerm}%`, limit]
            );

            suggestions.push(...projectsResult.rows.map(row => ({
                id: row.id,
                title: row.name,
                type: 'project',
                subtitle: row.workspace_name || '未知工作區',
                url: `/projects/${row.id}/board`
            })));

            // 搜尋工作區名稱
            const workspacesResult = await query(
                `SELECT DISTINCT
                    w.id,
                    w.name,
                    'workspace' as type
                FROM workspaces w
                WHERE (
                    w.owner_id = $1
                    OR EXISTS (
                        SELECT 1 FROM workspace_members wm
                        WHERE wm.workspace_id = w.id
                        AND wm.user_id = $1
                    )
                )
                AND w.name ILIKE $2
                ORDER BY w.updated_at DESC
                LIMIT $3`,
                [userId, `%${searchTerm}%`, limit]
            );

            suggestions.push(...workspacesResult.rows.map(row => ({
                id: row.id,
                title: row.name,
                type: 'workspace',
                subtitle: '工作區',
                url: `/workspaces/${row.id}`
            })));

            // 限制總數並排序
            const limitedSuggestions = suggestions.slice(0, limit);

            res.json({ suggestions: limitedSuggestions });
        } catch (error) {
            console.error('Search suggestions error:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
}

