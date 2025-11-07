# 專案管理系統 - 部署指南

## 📦 Docker 部署（推薦）

### docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL 資料庫
  postgres:
    image: postgres:15-alpine
    container_name: pm_postgres
    restart: always
    environment:
      POSTGRES_DB: project_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database-init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 快取
  redis:
    image: redis:7-alpine
    container_name: pm_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 後端 API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: pm_backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: project_management
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads

  # 前端 Angular
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        API_URL: ${API_URL}
    container_name: pm_frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

  # Nginx 反向代理（可選，用於生產環境）
  nginx:
    image: nginx:alpine
    container_name: pm_nginx
    restart: always
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
```

### .env 檔案範例

```bash
# 資料庫
DB_PASSWORD=your_secure_db_password

# JWT
JWT_ACCESS_SECRET=your_access_secret_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_chars

# URL
FRONTEND_URL=http://localhost:4200
API_URL=http://localhost:3000

# 其他
NODE_ENV=production
```

---

## 🐳 Dockerfile 配置

### 後端 Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製原始碼
COPY . .

# 編譯 TypeScript
RUN npm run build

# 生產環境映像
FROM node:20-alpine

WORKDIR /app

# 複製編譯後的檔案和依賴
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 建立上傳目錄
RUN mkdir -p /app/uploads

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["node", "dist/server.js"]
```

### 前端 Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci

# 複製原始碼
COPY . .

# 設定環境變數
ARG API_URL
ENV API_URL=$API_URL

# 建置應用
RUN npm run build -- --configuration=production

# Nginx 映像
FROM nginx:alpine

# 複製編譯後的檔案
COPY --from=builder /app/dist/project-management/browser /usr/share/nginx/html

# 複製 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 前端 Nginx 配置

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 壓縮
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Angular 路由支援
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支援
    location /socket.io {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # 快取靜態資源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🚀 部署步驟

### 1. 準備環境

```bash
# 克隆專案
git clone <repository-url>
cd project-management

# 建立環境變數檔案
cp .env.example .env
nano .env  # 編輯環境變數
```

### 2. 使用 Docker Compose 啟動

```bash
# 建置並啟動所有服務
docker-compose up -d --build

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down

# 停止並移除所有資料
docker-compose down -v
```

### 3. 初始化資料庫

```bash
# 進入 PostgreSQL 容器
docker exec -it pm_postgres psql -U postgres -d project_management

# 或直接執行 SQL 檔案
docker exec -i pm_postgres psql -U postgres -d project_management < database-init.sql
```

### 4. 驗證部署

```bash
# 檢查後端健康狀態
curl http://localhost:3000/api/health

# 檢查前端
curl http://localhost:80
```

---

## 🌐 雲端部署

### AWS 部署架構

```
┌─────────────────────────────────────────────┐
│            CloudFront (CDN)                  │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         Application Load Balancer            │
└──────┬───────────────────┬───────────────────┘
       │                   │
┌──────▼──────┐    ┌──────▼──────┐
│  ECS/Fargate│    │  ECS/Fargate│
│   (Backend) │    │  (Frontend) │
└──────┬──────┘    └─────────────┘
       │
┌──────▼──────────────────────────────────────┐
│  RDS PostgreSQL (Multi-AZ)                   │
└──────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│  ElastiCache Redis                           │
└──────────────────────────────────────────────┘
```

### AWS 部署步驟

#### 1. 設置 RDS PostgreSQL

```bash
# 使用 AWS CLI 建立 RDS 實例
aws rds create-db-instance \
  --db-instance-identifier pm-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password <password> \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --multi-az
```

#### 2. 設置 ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id pm-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

#### 3. 建置並推送 Docker 映像到 ECR

```bash
# 建立 ECR repository
aws ecr create-repository --repository-name pm-backend
aws ecr create-repository --repository-name pm-frontend

# 登入 ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# 建置並推送後端
docker build -t pm-backend ./backend
docker tag pm-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/pm-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/pm-backend:latest

# 建置並推送前端
docker build -t pm-frontend ./frontend
docker tag pm-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/pm-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/pm-frontend:latest
```

#### 4. 部署到 ECS/Fargate

使用 AWS Console 或 Terraform 配置 ECS 服務。

---

## 📊 監控與日誌

### 使用 Docker 日誌

```bash
# 查看所有服務日誌
docker-compose logs

# 查看特定服務日誌
docker-compose logs backend
docker-compose logs -f frontend  # 即時追蹤

# 查看最近 100 行
docker-compose logs --tail=100 backend
```

### 設置 Log Rotation

```yaml
# docker-compose.yml 中加入
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Prometheus + Grafana 監控（進階）

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

---

## 🔒 安全性檢查清單

- [ ] 使用強密碼和金鑰
- [ ] 啟用 HTTPS (SSL/TLS)
- [ ] 設置防火牆規則
- [ ] 定期更新依賴套件
- [ ] 實作 Rate Limiting
- [ ] 設置 CORS 政策
- [ ] 啟用資料庫備份
- [ ] 使用環境變數管理機密資訊
- [ ] 實作審計日誌
- [ ] 設置入侵檢測系統

---

## 🔧 故障排除

### 常見問題

#### 1. 資料庫連接失敗

```bash
# 檢查 PostgreSQL 是否運行
docker-compose ps postgres

# 檢查網路連接
docker-compose exec backend ping postgres

# 查看資料庫日誌
docker-compose logs postgres
```

#### 2. Redis 連接失敗

```bash
# 測試 Redis 連接
docker-compose exec redis redis-cli ping

# 應該回傳 PONG
```

#### 3. 前端無法連接後端

檢查 `environment.ts` 中的 API URL 設置。

#### 4. 記憶體不足

```bash
# 增加 Docker 記憶體限制
# 編輯 docker-compose.yml
services:
  backend:
    mem_limit: 1g
    memswap_limit: 1g
```

---

## 📈 效能優化

### 1. 資料庫優化

```sql
-- 分析查詢計畫
EXPLAIN ANALYZE SELECT * FROM tasks WHERE project_id = 'xxx';

-- 更新統計資料
ANALYZE tasks;

-- Vacuum
VACUUM ANALYZE;
```

### 2. Redis 快取策略

```typescript
// 快取任務列表
const cacheKey = `tasks:project:${projectId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const tasks = await fetchTasksFromDB(projectId);
await redis.setex(cacheKey, 300, JSON.stringify(tasks)); // 5分鐘過期
return tasks;
```

### 3. CDN 配置

將靜態資源（圖片、CSS、JS）部署到 CDN 以加速載入。

---

## 🔄 CI/CD 管道

### GitHub Actions 範例

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          npm install
          npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Build and push Docker images
        run: |
          docker build -t pm-backend ./backend
          docker push <ecr-url>/pm-backend:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster pm-cluster --service pm-backend --force-new-deployment
```

---

## 📝 維護指南

### 定期維護任務

- **每日**: 檢查日誌，監控系統健康狀態
- **每週**: 檢查磁碟空間，資料庫效能
- **每月**: 更新依賴套件，安全性掃描
- **每季**: 資料庫優化，備份測試

### 資料備份

```bash
# 自動備份腳本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec pm_postgres pg_dump -U postgres project_management > backup_$DATE.sql
gzip backup_$DATE.sql

# 上傳到 S3
aws s3 cp backup_$DATE.sql.gz s3://your-backup-bucket/
```

---

**文件版本**: 1.0.0  
**最後更新**: 2025-10-24