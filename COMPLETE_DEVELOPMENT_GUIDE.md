# 專案管理系統 - 完整開發文檔

## 📋 專案概述

對標 Asana 的專案管理系統，支援團隊協作、任務追蹤、看板視圖等核心功能。

**技術棧:**
- **前端**: Angular 17+ (Standalone Components)
- **後端**: Node.js + Express + TypeScript
- **資料庫**: PostgreSQL + Redis (快取)
- **即時通訊**: Socket.io
- **檔案儲存**: AWS S3 / MinIO
- **認證**: JWT + Refresh Token

---

## 🏗️ 系統架構

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Angular   │◄───────►│   API Server │◄───────►│  PostgreSQL  │
│   Frontend  │         │   (Express)  │         │   Database   │
└─────────────┘         └──────────────┘         └──────────────┘
       │                        │                         
       │                        │                 ┌──────────────┐
       │                        └────────────────►│    Redis     │
       │                                          │    Cache     │
       │                                          └──────────────┘
       │                ┌──────────────┐                 
       └───────────────►│  Socket.io   │
                        │  (Realtime)  │
                        └──────────────┘
```

---

## 📊 資料庫設計

### 核心資料表

#### users (使用者)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### workspaces (工作區)
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### workspace_members (工作區成員)
```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

#### projects (專案)
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

#### sections (區段/列表)
```sql
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### tasks (任務)
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

#### task_attachments (附件)
```sql
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100),
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

#### comments (評論)
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### tags (標籤)
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#808080',
  UNIQUE(workspace_id, name)
);
```

#### task_tags (任務標籤關聯)
```sql
CREATE TABLE task_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
```

#### activity_logs (活動紀錄)
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 索引優化
```sql
-- 任務查詢優化
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_section_id ON tasks(section_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- 活動紀錄查詢
CREATE INDEX idx_activity_workspace ON activity_logs(workspace_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
```

---

## 🔌 API 設計

### 認證相關

```
POST   /api/auth/register          # 註冊
POST   /api/auth/login             # 登入
POST   /api/auth/refresh           # 刷新 token
POST   /api/auth/logout            # 登出
GET    /api/auth/me                # 取得當前使用者資訊
```

### 工作區管理

```
GET    /api/workspaces             # 取得使用者的所有工作區
POST   /api/workspaces             # 建立工作區
GET    /api/workspaces/:id         # 取得工作區詳情
PATCH  /api/workspaces/:id         # 更新工作區
DELETE /api/workspaces/:id         # 刪除工作區

GET    /api/workspaces/:id/members # 取得成員列表
POST   /api/workspaces/:id/members # 邀請成員
PATCH  /api/workspaces/:id/members/:userId  # 更新成員角色
DELETE /api/workspaces/:id/members/:userId  # 移除成員
```

### 專案管理

```
GET    /api/workspaces/:wid/projects        # 取得專案列表
POST   /api/workspaces/:wid/projects        # 建立專案
GET    /api/projects/:id                    # 取得專案詳情
PATCH  /api/projects/:id                    # 更新專案
DELETE /api/projects/:id                    # 刪除專案
POST   /api/projects/:id/archive            # 封存專案
```

### 區段管理

```
GET    /api/projects/:pid/sections          # 取得區段列表
POST   /api/projects/:pid/sections          # 建立區段
PATCH  /api/sections/:id                    # 更新區段
DELETE /api/sections/:id                    # 刪除區段
POST   /api/sections/:id/reorder            # 重新排序
```

### 任務管理

```
GET    /api/projects/:pid/tasks             # 取得任務列表
POST   /api/projects/:pid/tasks             # 建立任務
GET    /api/tasks/:id                       # 取得任務詳情
PATCH  /api/tasks/:id                       # 更新任務
DELETE /api/tasks/:id                       # 刪除任務
POST   /api/tasks/:id/move                  # 移動任務
POST   /api/tasks/:id/duplicate             # 複製任務

GET    /api/tasks/:id/subtasks              # 取得子任務
POST   /api/tasks/:id/subtasks              # 建立子任務

GET    /api/tasks/:id/attachments           # 取得附件
POST   /api/tasks/:id/attachments           # 上傳附件
DELETE /api/attachments/:id                 # 刪除附件

GET    /api/tasks/:id/comments              # 取得評論
POST   /api/tasks/:id/comments              # 新增評論
PATCH  /api/comments/:id                    # 更新評論
DELETE /api/comments/:id                    # 刪除評論
```

### 標籤管理

```
GET    /api/workspaces/:wid/tags            # 取得標籤列表
POST   /api/workspaces/:wid/tags            # 建立標籤
PATCH  /api/tags/:id                        # 更新標籤
DELETE /api/tags/:id                        # 刪除標籤
```

### 活動紀錄

```
GET    /api/workspaces/:wid/activities      # 取得活動紀錄
GET    /api/projects/:pid/activities        # 取得專案活動
GET    /api/tasks/:tid/activities           # 取得任務活動
```

---

## 🎨 前端架構 (Angular)

### 專案結構

```
src/
├── app/
│   ├── core/                    # 核心模組
│   │   ├── guards/              # 路由守衛
│   │   ├── interceptors/        # HTTP 攔截器
│   │   ├── services/            # 全域服務
│   │   └── models/              # 資料模型
│   │
│   ├── shared/                  # 共享模組
│   │   ├── components/          # 共用元件
│   │   │   ├── header/
│   │   │   ├── sidebar/
│   │   │   ├── task-card/
│   │   │   ├── user-avatar/
│   │   │   └── date-picker/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── utils/
│   │
│   ├── features/                # 功能模組
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── auth.service.ts
│   │   │
│   │   ├── workspace/
│   │   │   ├── workspace-list/
│   │   │   ├── workspace-settings/
│   │   │   └── workspace.service.ts
│   │   │
│   │   ├── project/
│   │   │   ├── project-list/
│   │   │   ├── project-detail/
│   │   │   ├── project-board/
│   │   │   ├── project-timeline/
│   │   │   └── project.service.ts
│   │   │
│   │   ├── task/
│   │   │   ├── task-list/
│   │   │   ├── task-detail/
│   │   │   ├── task-form/
│   │   │   └── task.service.ts
│   │   │
│   │   └── dashboard/
│   │       ├── dashboard.component.ts
│   │       └── dashboard.service.ts
│   │
│   ├── app.routes.ts
│   └── app.component.ts
│
└── assets/
```

### 核心服務範例

#### AuthService
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  login(email: string, password: string): Observable<AuthResponse>;
  register(userData: RegisterData): Observable<AuthResponse>;
  logout(): void;
  refreshToken(): Observable<AuthResponse>;
  isAuthenticated(): boolean;
}
```

#### WebSocketService
```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket;
  
  connect(): void;
  disconnect(): void;
  
  onTaskUpdate(): Observable<Task>;
  onCommentAdded(): Observable<Comment>;
  onMemberActivity(): Observable<Activity>;
  
  emitTaskUpdate(task: Task): void;
}
```

### 狀態管理

使用 NgRx 或 Signals (Angular 17+)

```typescript
// 使用 Signals 範例
export class ProjectStore {
  private projectsState = signal<Project[]>([]);
  private loadingState = signal<boolean>(false);
  
  readonly projects = this.projectsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  
  async loadProjects(workspaceId: string): Promise<void>;
  async createProject(project: CreateProjectDto): Promise<void>;
  async updateProject(id: string, updates: Partial<Project>): Promise<void>;
}
```

---

## 🚀 開發路線圖

### Phase 1: 基礎功能 (Week 1-2) ✅ 已完成

- [x] **後端設置**
  - [x] Express + TypeScript 專案初始化
  - [x] PostgreSQL 資料庫連接
  - [x] JWT 認證實作
  - [x] 基礎 API 端點

- [x] **前端設置**
  - [x] Angular 專案初始化
  - [x] 路由配置
  - [x] 認證流程 (登入/註冊)
  - [x] HTTP Interceptor 設置

### Phase 2: 核心功能 (Week 3-4) ✅ 已完成

- [x] **工作區與專案**
  - [x] 工作區 CRUD
  - [x] 專案 CRUD
  - [x] 成員管理
  - [x] 權限控制

- [x] **任務管理**
  - [x] 任務 CRUD
  - [x] 任務列表視圖
  - [x] 任務拖曳排序
  - [x] 任務指派

### Phase 3: 進階功能 (Week 5-6) ✅ 已完成

- [x] **看板視圖**
  - [x] 區段管理
  - [x] 卡片拖曳
  - [x] 狀態轉換

- [x] **任務詳情**
  - [x] 子任務
  - [x] 附件上傳
  - [x] 評論系統
  - [x] 標籤系統

### Phase 4: 協作功能 (Week 7-8) ⏳ 90% 完成

- [x] **即時功能**
  - [x] Socket.io 整合
  - [x] 即時任務更新
  - [x] 即時評論
  - [x] 即時附件更新
  - [x] 即時標籤更新
  - [ ] 線上使用者顯示（可選）

- [x] **通知系統**
  - [x] 站內通知
  - [x] Email 通知
  - [ ] 提醒設置（可選）

### Phase 5: 優化與擴展 (Week 9-10)

- [ ] **視圖模式**
  - [ ] 時間軸視圖 (Timeline)
  - [ ] 日曆視圖
  - [ ] 甘特圖

- [ ] **搜尋與篩選**
  - [ ] 全文搜尋
  - [ ] 進階篩選
  - [ ] 自訂篩選器

- [ ] **報表與分析**
  - [ ] 專案進度報表
  - [ ] 成員工作量分析
  - [ ] 匯出功能

---

## 📝 待實作清單 (TODO)

### 高優先級

1. **全域 Header 優化** ⭐ 核心功能已完成（85%）
   - [x] 建立全域常駐 Header 組件
   - [x] 整合通知中心到所有頁面
   - [x] 添加用戶資訊顯示（下拉選單形式）
   - [x] 統一導航功能（Logo、返回按鈕、智能返回邏輯）
   - [x] 統一返回按鈕（智能顯示/隱藏，支援自訂返回邏輯）
   - [x] 移除各頁面獨立 header，統一體驗
   - [x] 響應式設計適配（基本完成）
   - [x] 固定定位和內容區域調整
   - [x] 統一樣式系統（各頁面 padding 和對齊已統一）
   - [ ] 麵包屑導航（可選優化）
   - [ ] 整合頁面特定操作按鈕到 Header（可選，目前按鈕在頁面內容區）
   - [ ] 搜尋功能整合（需要後端 API 支援）
   - [ ] 鍵盤快捷鍵支援（可選優化）
   - [ ] 主題切換功能（可選優化）
   - [ ] 工作區快速切換（可選優化）
   
   **詳細優化建議：**
   - **結構優化**：建立全域 Header 組件，統一所有認證頁面的 header
   - **功能整合**：通知中心、用戶資訊、導航功能
   - **頁面特定功能**：返回按鈕、頁面標題、操作按鈕
   - **響應式設計**：移動端適配、固定定位
   - **視覺優化**：統一樣式、狀態指示、動畫效果
   - **互動優化**：搜尋功能、快捷操作、上下文感知
   - **技術優化**：效能優化、可維護性、無障礙性
   - **進階功能**：主題切換、多語言、工作區切換、最近訪問

2. **認證系統強化**
   - [ ] OAuth 登入 (Google, GitHub)
   - [ ] 雙因素驗證 (2FA)
   - [ ] 密碼重設流程

3. **檔案處理** ✅ 已完成
   - [x] S3/MinIO 整合
   - [x] 圖片預覽
   - [x] 檔案大小限制（10MB）
   - [ ] 病毒掃描（可選）

4. **效能優化**
   - [ ] Redis 快取策略
   - [ ] 資料庫查詢優化
   - [ ] 分頁載入
   - [ ] 虛擬滾動

### 中優先級

5. **Email 系統**
   - [ ] SMTP 配置
   - [ ] Email 模板
   - [ ] 排程寄送

6. **搜尋功能**
   - [ ] Elasticsearch 整合
   - [ ] 全文搜尋
   - [ ] 搜尋建議

7. **匯入匯出**
   - [ ] CSV 匯出
   - [ ] Excel 匯出
   - [ ] Asana 資料匯入

### 低優先級

8. **進階功能**
   - [ ] 自動化規則 (Automation)
   - [ ] 自訂欄位
   - [ ] 範本系統
   - [ ] API Webhooks

9. **行動應用**
   - [ ] PWA 優化
   - [ ] 離線支援
   - [ ] 推播通知

---

## 🛠️ 開發指南

### 環境設置

#### 後端
```bash
cd backend
npm install
cp .env.example .env
# 設置資料庫連線
npm run migrate
npm run dev
```

#### 前端
```bash
cd frontend
npm install
ng serve
```

### 程式碼規範

- **TypeScript**: 嚴格模式
- **ESLint**: Airbnb 規範
- **Prettier**: 自動格式化
- **Commit**: Conventional Commits

### 測試策略

- **單元測試**: Jest (後端) + Jasmine (前端)
- **整合測試**: Supertest
- **E2E 測試**: Cypress
- **測試覆蓋率**: > 80%

---

## 📚 參考資源

- [Asana API 文件](https://developers.asana.com/docs)
- [Angular 官方文件](https://angular.io/)
- [Express 最佳實踐](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PostgreSQL 效能調校](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

## 🤝 貢獻指南

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

---

**文件版本**: 1.0.0  
**最後更新**: 2025-10-23