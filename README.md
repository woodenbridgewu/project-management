# 專案管理系統

對標 Asana 的現代化專案管理系統，使用 Angular + Node.js + PostgreSQL 建構。

## 🚀 快速開始

### 前置需求
- Node.js >= 18.0.0
- Docker & Docker Compose
- PostgreSQL 15+ (或使用 Docker)

### 啟動服務

#### 1. 啟動資料庫（使用 Docker）
```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### 2. 啟動後端
```bash
cd backend
npm install
npm run dev
```

#### 3. 啟動前端
```bash
cd frontend
npm install
npm start
```

## 📁 專案結構

```
project-management/
├── backend/          # 後端 API (Express + TypeScript)
├── frontend/         # 前端應用 (Angular 17+)
├── database-init.sql # 資料庫初始化腳本
└── docker-compose.dev.yml # Docker 開發環境配置
```

## 🔧 開發狀態

### 已完成
- ✅ 後端基礎架構設置
- ✅ 資料庫連接與初始化
- ✅ JWT 認證系統（註冊、登入、Token 刷新）
- ✅ 任務管理 API（CRUD）
- ✅ WebSocket 基礎設置
- ✅ 前端基礎架構與服務

### 進行中
- 🔄 工作區與專案管理功能
- 🔄 前端認證頁面

### 待實作
- ⏳ 前端完整 UI
- ⏳ 看板視圖
- ⏳ 評論系統
- ⏳ 附件上傳

## 📚 文件

- [完整開發指南](./COMPLETE_DEVELOPMENT_GUIDE.md)
- [快速開始指南](./RAPID_DEVELOPMENT_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUILD.md)

## 🛠️ 技術棧

- **前端**: Angular 17+ (Standalone Components)
- **後端**: Node.js + Express + TypeScript
- **資料庫**: PostgreSQL 15
- **快取**: Redis
- **即時通訊**: Socket.io
- **認證**: JWT (Access + Refresh Token)

## 📝 License

MIT

