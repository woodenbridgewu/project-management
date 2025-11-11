# 🚀 MinIO 快速設置指南

## 📋 步驟 1：確認 MinIO 正在運行

檢查 MinIO 容器是否正在運行：

```bash
docker ps | grep minio
```

如果看到 `pm_minio_dev` 或 `minio` 容器正在運行，表示 MinIO 已經啟動。

## 🌐 步驟 2：訪問 MinIO Console

1. 打開瀏覽器，訪問：**http://localhost:9001**

2. 使用以下帳號登入：
   - **Username**: `minioadmin`（或你設置的 `MINIO_ROOT_USER`）
   - **Password**: `minioadmin`（或你設置的 `MINIO_ROOT_PASSWORD`）
   
   > ⚠️ **安全提示**：請在 `.env` 文件中設置 `MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD` 環境變數，不要使用預設密碼！

> 💡 **注意**：系統使用的是 MinIO 版本 `RELEASE.2025-04-22T22-12-26Z`，這是最後一個包含完整 UI 管理介面（包括 Access Keys 管理）的版本。新版本已移除 Access Keys 的 UI 管理功能。

## 🪣 步驟 3：創建 Bucket

1. 登入後，點擊左側選單的 **"Buckets"**
2. 點擊 **"Create Bucket"** 按鈕
3. 輸入 Bucket 名稱：`project-management`
4. 點擊 **"Create Bucket"**

> 💡 **Bucket 名稱必須與 `.env` 文件中的 `STORAGE_BUCKET` 相同**

## 🔑 步驟 4：創建 Access Key（應用程式存取金鑰）

1. 點擊左側選單的 **"Access Keys"**
2. 點擊 **"Create Access Key"**
3. 選擇 **"Restrict beyond default"** 或 **"Custom"**（建議）
4. 設置權限：
   - **Policy**: 選擇 `readwrite` 或自訂策略
   - **Bucket**: 選擇 `project-management`
   - **Prefix**: 留空（允許所有檔案）
5. 點擊 **"Create"**
6. **重要**：複製並保存以下資訊：
   - **Access Key**
   - **Secret Key**
   - ⚠️ **Secret Key 只會顯示一次，請務必保存！**

## ⚙️ 步驟 5：配置後端環境變數

1. 在 `backend/` 目錄下創建 `.env` 文件（如果還沒有）

2. 複製 `.env.example` 到 `.env`：
   ```bash
   cp backend/.env.example backend/.env
   ```

3. 編輯 `backend/.env`，設置以下變數：

```env
# 啟用 MinIO 儲存
STORAGE_ENABLED=true
STORAGE_PROVIDER=minio
STORAGE_BUCKET=project-management
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY_ID=你的AccessKey
STORAGE_SECRET_ACCESS_KEY=你的SecretKey
STORAGE_PUBLIC_URL=http://localhost:9000
```

4. 將步驟 4 中獲取的 Access Key 和 Secret Key 填入對應位置

## 🔒 步驟 6：設置 Bucket 政策（可選，用於公開訪問）

如果需要讓檔案可以公開訪問（例如圖片預覽），需要設置 Bucket 政策：

1. 在 MinIO Console 中，點擊 **"Buckets"** → 選擇 `project-management`
2. 點擊 **"Access Policy"** 標籤
3. 選擇 **"Public"** 或 **"Custom"**
4. 如果選擇 Custom，添加以下政策：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::project-management/*"]
    }
  ]
}
```

5. 點擊 **"Save"**

## ✅ 步驟 7：測試配置

1. 重啟後端服務：
   ```bash
   cd backend
   npm run dev
   ```

2. 查看後端日誌，應該會看到：
   ```
   Storage service initialized successfully
   ```

3. 在前端上傳一個測試檔案，檢查：
   - 檔案是否成功上傳
   - 在 MinIO Console 的 `project-management` bucket 中是否能看到檔案

## 🐛 故障排除

### 問題：無法連接到 MinIO

**檢查：**
1. MinIO 容器是否運行：`docker ps | grep minio`
2. 端口是否被占用：`lsof -i :9000`
3. `.env` 中的 `STORAGE_ENDPOINT` 是否正確

### 問題：上傳失敗，提示 Access Denied

**解決：**
1. 檢查 Access Key 和 Secret Key 是否正確
2. 檢查 Access Key 的權限是否包含 `readwrite`
3. 檢查 Bucket 名稱是否與 `.env` 中的 `STORAGE_BUCKET` 相同

### 問題：檔案上傳成功但無法訪問

**解決：**
1. 檢查 Bucket 的 Access Policy 是否設置為 Public 或包含 GetObject 權限
2. 檢查 `STORAGE_PUBLIC_URL` 是否正確設置

### 問題：後端日誌顯示 "Storage service disabled"

**解決：**
1. 檢查 `.env` 中的 `STORAGE_ENABLED=true` 是否設置
2. 檢查所有必要的環境變數是否都已設置

## 📝 使用 Docker Compose 管理 MinIO

如果使用 Docker Compose，可以使用以下命令：

```bash
# 啟動所有服務（包括 MinIO）
docker-compose -f docker-compose.dev.yml up -d

# 查看 MinIO 日誌
docker-compose -f docker-compose.dev.yml logs minio

# 停止 MinIO
docker-compose -f docker-compose.dev.yml stop minio

# 重啟 MinIO
docker-compose -f docker-compose.dev.yml restart minio
```

## 🎯 完成！

現在你的系統已經配置好 MinIO 儲存服務了！

- ✅ MinIO 運行在 http://localhost:9000
- ✅ MinIO Console 在 http://localhost:9001
- ✅ Bucket 已創建：`project-management`
- ✅ Access Key 已配置
- ✅ 後端已連接 MinIO

所有上傳的檔案現在都會存儲在 MinIO 中，而不是本地 `uploads/` 目錄。

---

**提示**：如果遇到任何問題，可以查看：
- 後端日誌：查看 Storage Service 的初始化訊息
- MinIO Console：檢查 Bucket 和 Access Keys 設置
- 瀏覽器控制台：查看前端是否有錯誤訊息

