-- ============================================
-- 全文搜尋索引優化
-- database-search-indexes.sql
-- ============================================

-- 為任務表添加全文搜尋索引
-- 使用 GIN 索引以提升全文搜尋效能
CREATE INDEX IF NOT EXISTS idx_tasks_title_description_gin 
ON tasks USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- 為專案表添加全文搜尋索引
CREATE INDEX IF NOT EXISTS idx_projects_name_description_gin 
ON projects USING GIN (to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(description, '')));

-- 為工作區表添加全文搜尋索引
CREATE INDEX IF NOT EXISTS idx_workspaces_name_description_gin 
ON workspaces USING GIN (to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(description, '')));

-- 注意：
-- 1. GIN 索引會增加資料庫儲存空間，但大幅提升全文搜尋效能
-- 2. 索引會在資料更新時自動維護
-- 3. 如果資料量很大，建立索引可能需要一些時間
-- 4. 這些索引支援 PostgreSQL 的全文搜尋功能（to_tsvector 和 plainto_tsquery）

