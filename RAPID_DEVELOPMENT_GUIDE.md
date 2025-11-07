# 專案管理系統 - 快速開始指南

> 🚀 一個對標 Asana 的現代化專案管理系統，使用 Angular + Node.js + PostgreSQL 建構

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/angular-%5E17.0.0-red.svg)](https://angular.io/)

---

## 📋 目錄

- [功能特性](#功能特性)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [專案結構](#專案結構)
- [開發指南](#開發指南)
- [API 文件](#api-文件)
- [部署指南](#部署指南)
- [常見問題](#常見問題)

---

## ✨ 功能特性

### 核心功能
- ✅ **使用者認證** - JWT 認證、密碼加密、Token 刷新
- ✅ **工作區管理** - 多工作區支援、成員邀請、權限管理
- ✅ **專案管理** - 建立、編輯、封存專案
- ✅ **任務系統** - 完整的任務 CRUD、子任務、任務指派
- ✅ **看板視圖** - 拖曳排序、區段管理
- ✅ **即時協作** - WebSocket 實時更新、線上狀態
- ✅ **評論系統** - 任務討論、@提及功能
- ✅ **檔案附件** - 上傳、預覽、下載
- ✅ **標籤系統** - 自訂標籤、顏色分類
- ✅ **活動紀錄** - 完整的操作歷史追蹤

### 進階功能（待實作）
- 🔲 時間軸視圖 (Gantt Chart)
- 🔲 日曆視圖
- 🔲 搜尋與篩選
- 🔲 通知系統
- 🔲 自動化規則
- 🔲 報表分析
- 🔲 匯入/匯出

---

## 🏗️ 技術架構

### 前端
- **框架**: Angular 17+ (Standalone Components)
- **狀態管理**: Signals / NgRx
- **UI 庫**: Angular Material / Tailwind CSS
- **拖曳**: Angular CDK Drag & Drop
- **即時通訊**: Socket.io Client

### 後端
- **運行環境**: Node.js 20+
- **框架**: Express + TypeScript
- **資料庫**: PostgreSQL 15
- **快取**: Redis
- **認證**: JWT (Access + Refresh Token)
- **WebSocket**: Socket.io
- **驗證**: Zod

### DevOps
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **監控**: Prometheus + Grafana
- **日誌**: Winston / Pino

---

## 🚀 快速開始

### 前置需求

確保已安裝以下軟體：

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose
- PostgreSQL 15+ (如果不使用 Docker)
- Redis (如果不使用 Docker)

### 方法一：使用 Docker（推薦）

```bash
# 1. 克隆專案
git clone <repository-url>
cd project-management

# 2. 設置環境變數
cp .env.example .env
# 編輯 .env 檔案，設置密碼和金鑰

# 3. 啟動所有服務
docker-compose up -d

# 4. 初始化資料庫（首次執行）
docker exec -i pm_postgres psql -U postgres -d project_management < database-init.sql

# 5. 建立測試資料（可選）
npm run seed

# 6. 訪問應用
# 前端: http://localhost:80
# 後端: http://localhost:3000
```

### 方法二：本地開發

#### 後端設置

```bash
cd backend

# 安裝依賴
npm install

# 設置環境變數
cp .env.example .env
# 編輯 .env 設置資料庫連接

# 初始化資料庫
npm run migrate

# 啟動開發伺服器
npm run dev

# 後端將運行在 http://localhost:3000
```

#### 前端設置

```bash
cd frontend

# 安裝依賴
npm install

# 設置環境變數
# 編輯 src/environments/environment.ts

# 啟動開發伺服器
ng serve

# 前端將運行在 http://localhost:4200
```

### 測試帳號

使用種子資料後，可以使用以下帳號登入：

```
Email: admin@test.com
Password: password123
```

---

## 📁 專案結構

```
project-management/
├── backend/                 # 後端程式碼
│   ├── src/
│   │   ├── config/         # 配置檔案
│   │   ├── controllers/    # 控制器
│   │   ├── database/       # 資料庫相關
│   │   ├── middleware/     # 中介軟體
│   │   ├── models/         # 資料模型
│   │   ├── routes/         # 路由定義
│   │   ├── services/       # 業務邏輯
│   │   ├── utils/          # 工具函數
│   │   ├── websocket/      # WebSocket 處理
│   │   └── server.ts       # 入口檔案
│   ├── __tests__/          # 測試檔案
│   ├── Dockerfile
│   └── package.json
│
├── frontend/               # 前端程式碼
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/       # 核心模組（服務、守衛）
│   │   │   ├── shared/     # 共享元件
│   │   │   ├── features/   # 功能模組
│   │   │   │   ├── auth/
│   │   │   │   ├── workspace/
│   │   │   │   ├── project/
│   │   │   │   ├── task/
│   │   │   │   └── dashboard/
│   │   │   └── app.routes.ts
│   │   ├── assets/
│   │   └── environments/
│   ├── Dockerfile
│   └── package.json
│
├── database-init.sql       # 資料庫初始化腳本
├── docker-compose.yml      # Docker Compose 配置
├── nginx.conf              # Nginx 配置
├── .env.example            # 環境變數範例
├── scripts/                # 開發工具腳本
└── docs/                   # 文件目錄
```

---

## 💻 開發指南

### 分支策略

```
main          # 生產環境
├── develop   # 開發環境
    ├── feature/xxx  # 功能開發
    ├── bugfix/xxx   # 錯誤修復
    └── hotfix/xxx   # 緊急修復
```

### 提交規範

使用 Conventional Commits：

```bash
feat: 新增任務拖曳功能
fix: 修復登入 token 過期問題
docs: 更新 API 文件
style: 格式化程式碼
refactor: 重構任務服務
test: 新增任務控制器測試
chore: 更新依賴套件
```

### 開發流程

1. **建立功能分支**
   ```bash
   git checkout -b feature/task-filters
   ```

2. **開發與測試**
   ```bash
   # 執行開發伺服器
   npm run dev
   
   # 執行測試
   npm test
   
   # 執行 Lint
   npm run lint
   ```

3. **提交程式碼**
   ```bash
   git add .
   git commit -m "feat: 新增任務篩選功能"
   git push origin feature/task-filters
   ```

4. **建立 Pull Request**
   - 描述變更內容
   - 關聯相關 Issue
   - 等待 Code Review

### 程式碼規範

#### TypeScript 規範

```typescript
// ✅ 良好示範
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

export class TaskService {
  async getTaskById(id: string): Promise<Task> {
    // 實作...
  }
}

// ❌ 不良示範
export interface task {  // 應使用 PascalCase
  Id: string;            // 應使用 camelCase
}

function GetTask(ID) {   // 應使用 camelCase 和型別註解
  // ...
}
```

#### Angular 規範

```typescript
// ✅ 使用 Signals（Angular 17+）
export class TaskListComponent {
  tasks = signal<Task[]>([]);
  loading = signal(false);
  
  loadTasks() {
    this.loading.set(true);
    this.taskService.getTasks().subscribe(tasks => {
      this.tasks.set(tasks);
      this.loading.set(false);
    });
  }
}

// ✅ 使用 Standalone Components
@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  template: `...`
})
export class TaskCardComponent {}
```

### 資料庫遷移

```bash
# 建立新的遷移檔案
npm run migration:create -- AddNotificationsTable

# 執行遷移
npm run migration:run

# 回滾遷移
npm run migration:revert
```

### API 開發範例

```typescript
// 1. 定義路由
router.post('/projects/:id/tasks', taskController.createTask);

// 2. 實作控制器
export class TaskController {
  async createTask(req: AuthRequest, res: Response) {
    try {
      const taskData = createTaskSchema.parse(req.body);
      const task = await this.taskService.create(taskData);
      res.status(201).json({ task });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

// 3. 實作服務
export class TaskService {
  async create(data: CreateTaskDto): Promise<Task> {
    const result = await query(
      'INSERT INTO tasks (...) VALUES (...) RETURNING *',
      [...]
    );
    return result.rows[0];
  }
}

// 4. 撰寫測試
describe('TaskController', () => {
  it('should create a task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send(mockTaskData)
      .expect(201);
    
    expect(response.body.task).toHaveProperty('id');
  });
});
```

---

## 📚 API 文件

### 基礎資訊

- **Base URL**: `http://localhost:3000/api`
- **認證方式**: Bearer Token
- **回應格式**: JSON
- **日期格式**: ISO 8601

### 認證相關

#### 註冊

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}

# 回應
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### 登入

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 任務相關

#### 取得任務列表

```http
GET /tasks/projects/:projectId/tasks?status=todo&assigneeId=xxx
Authorization: Bearer {token}

# 回應
{
  "tasks": [
    {
      "id": "uuid",
      "title": "任務標題",
      "status": "todo",
      "priority": "high",
      "assignee": {...},
      "dueDate": "2025-12-31T23:59:59Z"
    }
  ]
}
```

#### 建立任務

```http
POST /tasks/projects/:projectId/tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "新任務",
  "description": "任務描述",
  "priority": "high",
  "assigneeId": "uuid",
  "dueDate": "2025-12-31T23:59:59Z"
}
```

#### 更新任務

```http
PATCH /tasks/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "urgent"
}
```

### 錯誤碼

| 狀態碼 | 說明 |
|-------|------|
| 200 | 成功 |
| 201 | 建立成功 |
| 400 | 請求參數錯誤 |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 500 | 伺服器錯誤 |

完整 API 文件請參考：[Postman Collection](./postman-collection.json)

---

## 🚢 部署指南

### 使用 Docker Compose（推薦）

```bash
# 1. 準備環境變數
cp .env.example .env
nano .env

# 2. 建置並啟動
docker-compose -f docker-compose.prod.yml up -d --build

# 3. 檢查狀態
docker-compose ps

# 4. 查看日誌
docker-compose logs -f
```

### 手動部署

#### 1. 資料庫設置

```bash
# 安裝 PostgreSQL
sudo apt-get install postgresql

# 建立資料庫
sudo -u postgres createdb project_management

# 執行初始化腳本
psql -U postgres -d project_management < database-init.sql
```

#### 2. 後端部署

```bash
cd backend

# 安裝依賴
npm ci --production

# 建置
npm run build

# 使用 PM2 運行
pm2 start dist/server.js --name pm-backend
```

#### 3. 前端部署

```bash
cd frontend

# 安裝依賴
npm ci

# 建置生產版本
npm run build -- --configuration=production

# 部署到 Nginx
sudo cp -r dist/project-management/browser/* /var/www/html/
```

#### 4. Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 雲端部署選項

- **AWS**: ECS/Fargate + RDS + ElastiCache
- **Google Cloud**: Cloud Run + Cloud SQL + Memorystore
- **Azure**: App Service + Azure Database + Redis Cache
- **Heroku**: Web Dyno + Heroku Postgres + Redis
- **DigitalOcean**: App Platform + Managed Database

詳細部署指南請參考：[部署文件](./docs/deployment.md)

---

## 🧪 測試

### 執行所有測試

```bash
# 後端測試
cd backend
npm test

# 前端測試
cd frontend
npm test

# E2E 測試
npm run e2e
```

### 測試覆蓋率

```bash
npm run test:coverage
```

目標：> 80% 測試覆蓋率

### 效能測試

```bash
# 使用 K6
k6 run performance-test.js

# 壓力測試
k6 run --vus 100 --duration 30s performance-test.js
```

---

## 🛠️ 開發工具

### 推薦的 VS Code 擴展

- Angular Language Service
- ESLint
- Prettier
- GitLens
- Docker
- Thunder Client (API 測試)
- Error Lens
- Auto Rename Tag

### 實用指令

```bash
# 開發工具選單
./scripts/dev-tools.sh

# 快速重啟
docker-compose restart backend

# 查看實時日誌
docker-compose logs -f backend

# 進入容器
docker exec -it pm_backend sh

# 資料庫備份
./scripts/backup-db.sh

# 程式碼格式化
npm run format

# 型別檢查
npm run type-check
```

---

## ❓ 常見問題

### Q: 如何重置資料庫？

```bash
docker-compose down -v
docker-compose up -d
docker exec -i pm_postgres psql -U postgres -d project_management < database-init.sql
```

### Q: WebSocket 連接失敗？

檢查防火牆設置，確保 3000 端口可訪問。檢查環境變數 `FRONTEND_URL` 是否正確。

### Q: 前端無法連接後端？

1. 檢查 `environment.ts` 中的 `apiUrl`
2. 確認後端服務正在運行：`curl http://localhost:3000/api/health`
3. 檢查 CORS 設置

### Q: 如何新增環境變數？

1. 更新 `.env` 檔案
2. 更新 `src/config/index.ts`
3. 重啟服務：`docker-compose restart`

### Q: 資料庫遷移失敗？

```bash
# 檢查資料庫連接
docker exec -it pm_postgres psql -U postgres -d project_management

# 手動執行 SQL
\i /path/to/migration.sql
```

### Q: 如何除錯？

```bash
# 後端除錯
npm run dev:debug

# 查看詳細日誌
docker-compose logs --tail=100 -f backend

# 進入容器檢查
docker exec -it pm_backend sh
```

---

## 📈 效能優化建議

### 前端優化
- 使用 Lazy Loading 載入模組
- 實作虛擬滾動處理大量列表
- 使用 OnPush 變更檢測策略
- 優化 bundle 大小

### 後端優化
- 實作 Redis 快取
- 使用資料庫連接池
- 建立適當的索引
- 實作查詢分頁

### 資料庫優化
- 定期執行 VACUUM ANALYZE
- 監控慢查詢
- 適當的索引策略
- 使用連接池

---

## 🤝 貢獻指南

我們歡迎任何形式的貢獻！

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'feat: Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

請確保：
- 遵循程式碼規範
- 撰寫測試
- 更新文件
- 通過所有 CI 檢查

---

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案

---

## 👥 團隊

- **專案負責人**: Your Name
- **技術主管**: Tech Lead Name
- **貢獻者**: [查看完整列表](CONTRIBUTORS.md)

---

## 🔗 相關連結

- [官方網站](https://your-domain.com)
- [API 文件](https://api.your-domain.com/docs)
- [使用手冊](https://docs.your-domain.com)
- [問題回報](https://github.com/your-org/project/issues)
- [Slack 社群](https://your-slack.slack.com)

---

## 📞 聯絡我們

- Email: support@your-domain.com
- Discord: [加入我們的社群](https://discord.gg/xxx)
- Twitter: [@YourProject](https://twitter.com/yourproject)

---

## 🗺️ 開發路線圖

### v1.0 (當前版本)
- ✅ 基礎任務管理
- ✅ 看板視圖
- ✅ 即時協作
- ✅ 評論系統

### v1.1 (計劃中)
- 🔲 時間軸視圖
- 🔲 進階搜尋
- 🔲 通知系統
- 🔲 行動應用

### v2.0 (未來)
- 🔲 AI 智能助手
- 🔲 自動化工作流
- 🔲 進階報表
- 🔲 第三方整合

---

## 🙏 致謝

感謝以下開源專案：

- [Angular](https://angular.io/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Socket.io](https://socket.io/)
- [Docker](https://www.docker.com/)

---

<div align="center">
  <p>Made with ❤️ by Your Team</p>
  <p>⭐️ 如果這個專案對你有幫助，請給我們一個 Star！</p>
</div>