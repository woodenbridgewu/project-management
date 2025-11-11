# 檔案儲存系統配置指南

## 📦 概述

系統支援兩種檔案儲存方式：
1. **本地儲存**（預設）- 檔案儲存在伺服器的 `uploads/` 目錄
2. **S3/MinIO 儲存** - 檔案儲存在 S3 相容的物件儲存服務

> 💡 **不知道該選哪個？** 請先閱讀 [STORAGE_EXPLAINED.md](../STORAGE_EXPLAINED.md) 了解兩種方式的差異和適用場景。
> 
> **簡單來說：**
> - 小專案（< 50 用戶）→ 本地儲存就夠了 ✅
> - 中大型專案 → 建議使用 S3/MinIO ⚠️
> - **本地儲存完全可以上線！** 只要做好備份即可。

## 🔧 配置步驟

### 1. 本地儲存（預設，無需配置）

如果不需要使用 S3/MinIO，系統會自動使用本地儲存。無需任何配置。

### 2. S3/MinIO 配置

在 `backend/.env` 文件中添加以下配置：

```env
# 啟用儲存服務（設為 true 啟用 S3/MinIO）
STORAGE_ENABLED=true

# 儲存提供者（'s3' 或 'minio'，目前僅用於說明，實際使用 endpoint 判斷）
STORAGE_PROVIDER=minio

# Bucket 名稱
STORAGE_BUCKET=project-management

# 區域（AWS S3 需要，MinIO 可選）
STORAGE_REGION=us-east-1

# Access Key ID
STORAGE_ACCESS_KEY_ID=your-access-key-id

# Secret Access Key
STORAGE_SECRET_ACCESS_KEY=your-secret-access-key

# 端點（MinIO 必需，AWS S3 不需要）
STORAGE_ENDPOINT=http://localhost:9000

# 公開訪問 URL（可選，用於 CDN 或自訂域名）
STORAGE_PUBLIC_URL=https://cdn.example.com
```

## 🚀 MinIO 設置

### 方法 1：使用 Docker Compose（推薦）

MinIO 已經整合到 `docker-compose.dev.yml` 中，直接啟動即可：

```bash
# 啟動所有服務（包括 MinIO）
docker-compose -f docker-compose.dev.yml up -d minio

# 查看 MinIO 狀態
docker-compose -f docker-compose.dev.yml ps minio

# 查看 MinIO 日誌
docker-compose -f docker-compose.dev.yml logs minio
```

### 方法 2：使用 Docker 命令（單獨啟動）

如果需要單獨啟動 MinIO：

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}" \
  -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin}" \
  --name minio \
  minio/minio server /data --console-address ":9001"
```

> 💡 **快速設置指南**：請參考 [MINIO_QUICK_SETUP.md](../MINIO_QUICK_SETUP.md) 了解完整的設置步驟。

### 創建 Bucket

1. 訪問 MinIO Console: http://localhost:9001
2. 使用 root 用戶和密碼登入
3. 創建一個新的 Bucket（例如：`project-management`）
4. 設置 Bucket 為公開讀取（如果需要公開訪問）

### 配置 Access Key

1. 在 MinIO Console 中，前往 **Access Keys**
2. 創建新的 Access Key
3. 將 Access Key 和 Secret Key 填入 `.env` 文件

### 環境變數範例（MinIO）

```env
STORAGE_ENABLED=true
STORAGE_PROVIDER=minio
STORAGE_BUCKET=project-management
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=your-minio-access-key
STORAGE_SECRET_ACCESS_KEY=your-minio-secret-key
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_PUBLIC_URL=http://localhost:9000
```

## ☁️ AWS S3 設置

### 1. 創建 S3 Bucket

1. 登入 AWS Console
2. 前往 S3 服務
3. 創建新的 Bucket
4. 選擇區域（例如：`us-east-1`）

### 2. 創建 IAM 用戶

1. 前往 IAM 服務
2. 創建新用戶
3. 附加策略：`AmazonS3FullAccess`（或自訂策略）
4. 創建 Access Key

### 3. 環境變數範例（AWS S3）

```env
STORAGE_ENABLED=true
STORAGE_PROVIDER=s3
STORAGE_BUCKET=your-bucket-name
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=your-aws-access-key
STORAGE_SECRET_ACCESS_KEY=your-aws-secret-key
# 不需要 STORAGE_ENDPOINT（使用 AWS 預設端點）
# 可選：使用 CloudFront CDN
STORAGE_PUBLIC_URL=https://d1234567890.cloudfront.net
```

## 🔒 安全性建議

### 生產環境

1. **使用環境變數**：不要將憑證提交到版本控制
2. **最小權限原則**：IAM 用戶只給予必要的權限
3. **使用 CDN**：透過 CloudFront 或其他 CDN 提供檔案
4. **Bucket 政策**：設置適當的 Bucket 政策限制訪問
5. **HTTPS**：確保使用 HTTPS 連接

### MinIO 生產環境

1. **更改預設密碼**：不要使用預設的 `minioadmin` 密碼
2. **使用 TLS**：配置 HTTPS
3. **備份策略**：定期備份 MinIO 資料
4. **訪問控制**：設置適當的 Bucket 政策

## 📝 功能特性

### 自動回退

- 如果 S3/MinIO 配置錯誤或連接失敗，系統會自動回退到本地儲存
- 確保系統在各種情況下都能正常運作

### 檔案管理

- **上傳**：自動上傳到配置的儲存服務
- **刪除**：刪除附件時自動刪除儲存中的檔案
- **URL 生成**：自動生成正確的檔案訪問 URL

### 圖片預覽

- 前端自動識別圖片檔案
- 顯示圖片預覽縮圖
- 點擊圖片可下載或查看完整圖片

## 🧪 測試

### 測試本地儲存

不設置 `STORAGE_ENABLED` 或設為 `false`，系統會使用本地儲存。

### 測試 S3/MinIO

1. 設置所有必要的環境變數
2. 重啟後端服務
3. 上傳一個測試檔案
4. 檢查檔案是否出現在 Bucket 中
5. 檢查前端是否能正確顯示和下載檔案

## 🐛 故障排除

### 問題：檔案上傳失敗

1. 檢查環境變數是否正確設置
2. 檢查 Access Key 和 Secret Key 是否正確
3. 檢查 Bucket 是否存在
4. 檢查網路連接（MinIO 端點是否可訪問）
5. 查看後端日誌錯誤訊息

### 問題：檔案無法訪問

1. 檢查 Bucket 政策是否允許公開讀取
2. 檢查 `STORAGE_PUBLIC_URL` 是否正確設置
3. 檢查 CORS 設置（如果使用瀏覽器直接訪問）

### 問題：圖片無法預覽

1. 檢查檔案 URL 是否正確
2. 檢查 CORS 設置
3. 檢查瀏覽器控制台錯誤訊息

## 📚 參考資源

- [AWS S3 文件](https://docs.aws.amazon.com/s3/)
- [MinIO 文件](https://min.io/docs/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)

---

**最後更新**：2025-01-XX

