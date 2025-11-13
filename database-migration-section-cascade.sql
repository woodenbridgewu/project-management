-- ============================================
-- 資料庫遷移腳本：修改區塊刪除行為
-- 將 section_id 外鍵從 ON DELETE SET NULL 改為 ON DELETE CASCADE
-- 這樣刪除區塊時會自動刪除該區塊中的所有任務
-- ============================================

-- 步驟 1: 刪除現有的外鍵約束
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_section_id_fkey;

-- 步驟 2: 重新建立外鍵約束，使用 CASCADE 刪除
ALTER TABLE tasks 
ADD CONSTRAINT tasks_section_id_fkey 
FOREIGN KEY (section_id) 
REFERENCES sections(id) 
ON DELETE CASCADE;

-- 注意：
-- 1. 此變更會導致刪除區塊時，該區塊中的所有任務（包括子任務）都會被自動刪除
-- 2. 任務的評論、附件、標籤關聯也會因為任務的 CASCADE 刪除而自動刪除
-- 3. 請確保在執行此遷移前已備份資料庫
-- 4. 執行此遷移後，現有的「孤兒」任務（section_id 為 NULL）不會被自動清理
--    如果需要清理，可以執行：DELETE FROM tasks WHERE section_id IS NULL;

