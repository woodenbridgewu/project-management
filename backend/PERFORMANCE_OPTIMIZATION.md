# 效能優化實作文檔

## 📊 優化概述

本文件記錄了專案管理系統的效能優化實作，包括 Redis 快取策略和資料庫查詢優化。

---

## 🔴 Redis 快取策略

### 快取服務 (`cache.service.ts`)

**功能：**
- Redis 連接管理（自動重連機制）
- 快取讀寫操作（get, set, delete）
- 批量刪除（模式匹配）
- 快取失效策略（TTL）
- 優雅降級（Redis 不可用時不影響應用運行）

**快取鍵命名規範：**
- 工作區列表：`workspaces:user:{userId}`
- 工作區詳情：`workspace:{workspaceId}`
- 工作區成員：`workspace:{workspaceId}:members`
- 專案列表：`projects:workspace:{workspaceId}:archived:{archived}`
- 專案詳情：`project:{projectId}`
- 任務列表：`tasks:project:{projectId}:status:{status}:assignee:{assigneeId}:section:{sectionId}`
- 任務詳情：`task:{taskId}`
- 活動紀錄：`activities:task:{taskId}:limit:{limit}:offset:{offset}`
- 用戶資訊：`user:{userId}`

### 快取 TTL 設定

| 資料類型 | TTL | 理由 |
|---------|-----|------|
| 工作區列表 | 5 分鐘 | 更新頻率較低 |
| 工作區詳情 | 5 分鐘 | 更新頻率較低 |
| 工作區成員 | 5 分鐘 | 更新頻率較低 |
| 專案列表 | 5 分鐘 | 更新頻率較低 |
| 專案詳情 | 5 分鐘 | 更新頻率較低 |
| 任務列表 | 2 分鐘 | 更新頻率較高 |
| 活動紀錄 | 1 分鐘 | 更新頻率很高 |
| 用戶資訊 | 10 分鐘 | 更新頻率很低 |

### 快取失效機制

**自動失效：**
- 所有快取都有 TTL，到期自動失效

**手動清除：**
- 建立/更新/刪除操作時，清除相關快取
- 使用模式匹配批量清除相關快取

**清除策略：**
- 工作區操作：清除 `workspaces:user:*` 和 `workspace:{id}*`
- 專案操作：清除 `projects:workspace:{workspaceId}:*` 和 `project:{id}`
- 任務操作：清除 `tasks:project:{projectId}:*` 和 `task:{id}`

---

## 🗄️ 資料庫查詢優化

### 現有索引

資料庫已包含以下索引，覆蓋主要查詢場景：

**用戶表：**
- `idx_users_email` - 登入查詢優化

**工作區相關：**
- `idx_workspace_members_workspace` - 工作區成員查詢
- `idx_workspace_members_user` - 用戶工作區查詢

**專案相關：**
- `idx_projects_workspace` - 工作區專案列表
- `idx_projects_archived` - 封存專案篩選

**區段相關：**
- `idx_sections_project` - 專案區段列表
- `idx_sections_position` - 區段排序

**任務相關：**
- `idx_tasks_project` - 專案任務列表
- `idx_tasks_section` - 區段任務列表
- `idx_tasks_assignee` - 指派任務查詢
- `idx_tasks_creator` - 創建任務查詢
- `idx_tasks_status` - 狀態篩選
- `idx_tasks_due_date` - 到期日查詢
- `idx_tasks_parent` - 子任務查詢
- `idx_tasks_position` - 任務排序
- `idx_tasks_project_status` - 複合索引（專案 + 狀態）
- `idx_tasks_project_assignee` - 複合索引（專案 + 指派者）
- `idx_tasks_section_position` - 複合索引（區段 + 位置）

**附件相關：**
- `idx_attachments_task` - 任務附件查詢

**評論相關：**
- `idx_comments_task` - 任務評論查詢
- `idx_comments_created` - 評論排序

**標籤相關：**
- `idx_tags_workspace` - 工作區標籤查詢

**活動紀錄相關：**
- `idx_activity_workspace` - 工作區活動查詢
- `idx_activity_entity` - 實體活動查詢
- `idx_activity_user` - 用戶活動查詢

**通知相關：**
- `idx_notifications_user` - 用戶通知查詢
- `idx_notifications_created` - 通知排序

### 查詢優化建議

**已實作的優化：**
1. ✅ 使用複合索引覆蓋常用查詢
2. ✅ JOIN 查詢使用索引欄位
3. ✅ 避免全表掃描
4. ✅ 使用 LIMIT 和 OFFSET 進行分頁

**未來可考慮的優化：**
1. 實作資料庫連接池監控
2. 慢查詢日誌分析
3. 查詢計劃分析（EXPLAIN）
4. 考慮使用物化視圖（Materialized Views）用於複雜報表

---

## 🚀 效能提升預期

### 快取命中率預期

- **工作區列表**：80-90%（用戶頻繁查看）
- **專案列表**：70-80%（用戶頻繁查看）
- **任務列表**：60-70%（更新較頻繁）
- **活動紀錄**：50-60%（更新非常頻繁）
- **用戶資訊**：90-95%（幾乎不變）

### 響應時間改善

- **無快取**：100-500ms（取決於查詢複雜度）
- **有快取**：1-10ms（Redis 記憶體讀取）

**預期改善：**
- 列表查詢：**10-50 倍**速度提升
- 詳情查詢：**20-100 倍**速度提升
- 活動紀錄：**5-20 倍**速度提升

---

## 🔧 配置說明

### Redis 配置

在 `.env` 文件中設置：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Docker Compose

Redis 服務已在 `docker-compose.dev.yml` 中配置：

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

---

## 📝 使用說明

### 快取服務使用範例

```typescript
import { cacheService } from '../services/cache.service';

// 獲取快取
const cached = await cacheService.get<MyType>('my:key');

// 設置快取（帶 TTL）
await cacheService.set('my:key', data, 300); // 5 分鐘

// 刪除快取
await cacheService.delete('my:key');

// 批量刪除
await cacheService.deletePattern('my:prefix:*');

// 獲取或設置（如果不存在則執行回調）
const data = await cacheService.getOrSet(
  'my:key',
  async () => {
    // 從資料庫獲取資料
    return await fetchFromDatabase();
  },
  300 // TTL
);
```

---

## ⚠️ 注意事項

1. **快取一致性**：確保在更新/刪除操作時清除相關快取
2. **記憶體使用**：監控 Redis 記憶體使用情況
3. **快取失效**：使用適當的 TTL 避免資料過期
4. **優雅降級**：Redis 不可用時，應用應繼續正常運行
5. **安全性**：不要快取敏感資料（如密碼、token）

---

## 🔍 監控建議

### Redis 監控指標

- 記憶體使用率
- 連接數
- 命令執行次數
- 快取命中率
- 慢查詢

### 資料庫監控指標

- 查詢執行時間
- 索引使用率
- 連接池使用率
- 慢查詢日誌

---

## 📚 參考資源

- [Redis 官方文檔](https://redis.io/docs/)
- [PostgreSQL 索引優化](https://www.postgresql.org/docs/current/indexes.html)
- [Node.js Redis 客戶端](https://github.com/redis/node-redis)

---

**最後更新**：2025-01-XX  
**版本**：1.0.0

