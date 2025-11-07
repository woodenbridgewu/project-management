
-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 建立資料表
-- ============================================

-- 使用者表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 工作區表
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 工作區成員表
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 專案表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#4A90E2',
  icon VARCHAR(50),
  view_mode VARCHAR(20) DEFAULT 'list' CHECK (view_mode IN ('list', 'board', 'timeline', 'calendar')),
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 區段表
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 任務表
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES users(id),
  due_date TIMESTAMP,
  start_date TIMESTAMP,
  completed_at TIMESTAMP,
  position INTEGER NOT NULL,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 附件表
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100),
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 評論表
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 標籤表
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#808080',
  UNIQUE(workspace_id, name)
);

-- 任務標籤關聯表
CREATE TABLE task_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- 活動紀錄表
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 通知表
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 建立索引
-- ============================================

-- 使用者索引
CREATE INDEX idx_users_email ON users(email);

-- 工作區成員索引
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- 專案索引
CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE INDEX idx_projects_archived ON projects(is_archived);

-- 區段索引
CREATE INDEX idx_sections_project ON sections(project_id);
CREATE INDEX idx_sections_position ON sections(project_id, position);

-- 任務索引（關鍵效能優化）
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_section ON tasks(section_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_creator ON tasks(creator_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_position ON tasks(project_id, position);

-- 複合索引（常用查詢優化）
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_project_assignee ON tasks(project_id, assignee_id);
CREATE INDEX idx_tasks_section_position ON tasks(section_id, position);

-- 附件索引
CREATE INDEX idx_attachments_task ON task_attachments(task_id);

-- 評論索引
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_created ON comments(task_id, created_at DESC);

-- 標籤索引
CREATE INDEX idx_tags_workspace ON tags(workspace_id);

-- 活動紀錄索引
CREATE INDEX idx_activity_workspace ON activity_logs(workspace_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at DESC);

-- 通知索引
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- ============================================
-- 建立觸發器（自動更新 updated_at）
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 為需要的表建立觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 測試資料（開發環境用）
-- ============================================

-- 插入測試使用者（密碼都是 'password123'）
INSERT INTO users (email, password_hash, full_name) VALUES
  ('admin@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'Admin User'),
  ('user1@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'John Doe'),
  ('user2@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'Jane Smith'),
  ('user3@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'Bob Johnson');

-- 插入測試工作區
INSERT INTO workspaces (id, name, description, owner_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Default Workspace', '預設工作區', 
   (SELECT id FROM users WHERE email = 'admin@example.com'));

-- 插入工作區成員
INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 
   (SELECT id FROM users WHERE email = 'admin@example.com'), 'owner'),
  ('11111111-1111-1111-1111-111111111111', 
   (SELECT id FROM users WHERE email = 'user1@example.com'), 'member'),
  ('11111111-1111-1111-1111-111111111111', 
   (SELECT id FROM users WHERE email = 'user2@example.com'), 'member');

-- 插入測試專案
INSERT INTO projects (id, workspace_id, name, description, color, created_by) VALUES
  ('22222222-2222-2222-2222-222222222222', 
   '11111111-1111-1111-1111-111111111111',
   'Website Redesign', '重新設計公司官網', '#FF6B6B',
   (SELECT id FROM users WHERE email = 'admin@example.com')),
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'Mobile App Development', '開發行動應用程式', '#4ECDC4',
   (SELECT id FROM users WHERE email = 'admin@example.com'));

-- 插入測試區段
INSERT INTO sections (project_id, name, position) VALUES
  ('22222222-2222-2222-2222-222222222222', '待辦', 0),
  ('22222222-2222-2222-2222-222222222222', '進行中', 1),
  ('22222222-2222-2222-2222-222222222222', '已完成', 2);

-- 插入測試任務
INSERT INTO tasks (
  project_id, section_id, title, description, status, priority,
  assignee_id, creator_id, position, due_date
) VALUES
  ('22222222-2222-2222-2222-222222222222',
   (SELECT id FROM sections WHERE name = '待辦' LIMIT 1),
   '設計首頁 Mockup', '使用 Figma 設計新首頁的 UI/UX', 'todo', 'high',
   (SELECT id FROM users WHERE email = 'user1@example.com'),
   (SELECT id FROM users WHERE email = 'admin@example.com'),
   0, NOW() + INTERVAL '7 days'),
  ('22222222-2222-2222-2222-222222222222',
   (SELECT id FROM sections WHERE name = '進行中' LIMIT 1),
   '實作導航列', '使用 Angular 實作響應式導航列', 'in_progress', 'medium',
   (SELECT id FROM users WHERE email = 'user2@example.com'),
   (SELECT id FROM users WHERE email = 'admin@example.com'),
   0, NOW() + INTERVAL '3 days');

-- 插入測試標籤
INSERT INTO tags (workspace_id, name, color) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Frontend', '#3498db'),
  ('11111111-1111-1111-1111-111111111111', 'Backend', '#2ecc71'),
  ('11111111-1111-1111-1111-111111111111', 'Bug', '#e74c3c'),
  ('11111111-1111-1111-1111-111111111111', 'Feature', '#f39c12');

-- ============================================
-- 常用查詢視圖
-- ============================================

-- 任務詳細資訊視圖
CREATE OR REPLACE VIEW task_details AS
SELECT 
  t.id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_date,
  t.position,
  t.created_at,
  t.updated_at,
  p.name as project_name,
  p.color as project_color,
  s.name as section_name,
  json_build_object(
    'id', u_assignee.id,
    'fullName', u_assignee.full_name,
    'email', u_assignee.email,
    'avatarUrl', u_assignee.avatar_url
  ) as assignee,
  json_build_object(
    'id', u_creator.id,
    'fullName', u_creator.full_name,
    'email', u_creator.email
  ) as creator,
  (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as subtask_count,
  (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count,
  (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN sections s ON t.section_id = s.id
LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
LEFT JOIN users u_creator ON t.creator_id = u_creator.id;

-- 專案統計視圖
CREATE OR REPLACE VIEW project_statistics AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  COUNT(t.id) as total_tasks,
  COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
  COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as todo_tasks,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
  COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 END) as overdue_tasks,
  ROUND(
    CAST(COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS DECIMAL) / 
    NULLIF(COUNT(t.id), 0) * 100, 
    2
  ) as completion_rate
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, p.name;

-- ============================================
-- 效能優化函數
-- ============================================

-- 取得使用者的所有任務（含分頁）
CREATE OR REPLACE FUNCTION get_user_tasks(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  task_id UUID,
  task_title VARCHAR,
  project_name VARCHAR,
  due_date TIMESTAMP,
  priority VARCHAR,
  status VARCHAR
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    p.name,
    t.due_date,
    t.priority,
    t.status
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.assignee_id = p_user_id
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY 
    CASE 
      WHEN t.due_date IS NULL THEN 1
      ELSE 0
    END,
    t.due_date ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$ LANGUAGE plpgsql;

-- 更新任務位置（拖曳排序）
CREATE OR REPLACE FUNCTION reorder_tasks(
  p_task_id UUID,
  p_new_section_id UUID,
  p_new_position INTEGER
)
RETURNS VOID AS $
DECLARE
  v_old_section_id UUID;
  v_old_position INTEGER;
BEGIN
  -- 取得舊的區段和位置
  SELECT section_id, position INTO v_old_section_id, v_old_position
  FROM tasks WHERE id = p_task_id;
  
  -- 如果在同一個區段內移動
  IF v_old_section_id = p_new_section_id THEN
    IF v_old_position < p_new_position THEN
      -- 向下移動
      UPDATE tasks 
      SET position = position - 1
      WHERE section_id = p_new_section_id
        AND position > v_old_position
        AND position <= p_new_position;
    ELSE
      -- 向上移動
      UPDATE tasks 
      SET position = position + 1
      WHERE section_id = p_new_section_id
        AND position >= p_new_position
        AND position < v_old_position;
    END IF;
  ELSE
    -- 移動到不同區段
    -- 更新舊區段的位置
    UPDATE tasks 
    SET position = position - 1
    WHERE section_id = v_old_section_id
      AND position > v_old_position;
    
    -- 更新新區段的位置
    UPDATE tasks 
    SET position = position + 1
    WHERE section_id = p_new_section_id
      AND position >= p_new_position;
  END IF;
  
  -- 更新目標任務
  UPDATE tasks 
  SET section_id = p_new_section_id, position = p_new_position
  WHERE id = p_task_id;
END;
$ LANGUAGE plpgsql;

-- ============================================
-- 資料庫維護
-- ============================================

-- 清理舊的活動紀錄（保留 90 天）
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- 設定定期清理任務（需要 pg_cron 擴展）
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-activities', '0 2 * * 0', 'SELECT cleanup_old_activities()');

-- ============================================
-- 權限設定
-- ============================================

-- 建立應用程式使用者
CREATE USER app_user WITH PASSWORD 'your_secure_password';

-- 授予權限
GRANT CONNECT ON DATABASE project_management TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================
-- 備份與還原指令（參考）
-- ============================================

-- 備份資料庫
-- pg_dump -U postgres -d project_management -F c -b -v -f backup_$(date +%Y%m%d).dump

-- 還原資料庫
-- pg_restore -U postgres -d project_management -v backup_20240101.dump

-- 僅備份資料（不含結構）
-- pg_dump -U postgres -d project_management -a -F c -b -v -f data_backup.dump

-- ============================================
-- 效能監控查詢
-- ============================================

-- 查看最慢的查詢
-- SELECT query, calls, total_time, mean_time, max_time
-- FROM pg_stat_statements
-- ORDER BY total_time DESC
-- LIMIT 10;

-- 查看表的大小
-- SELECT 
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看未使用的索引
-- SELECT 
--   schemaname, tablename, indexname,
--   idx_scan as scans,
--   pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;