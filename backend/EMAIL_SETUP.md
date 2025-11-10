# Email 通知系統配置指南

## 📧 概述

Email 通知系統已整合到通知流程中。當系統創建通知時，會自動發送對應的 Email 給用戶。

## 🔧 配置步驟

### 1. 環境變數配置

在 `backend/.env` 文件中添加以下 SMTP 配置：

```env
# SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@project-management.com
```

### 2. 常見 SMTP 服務商配置

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # 需要使用應用程式密碼，不是 Gmail 密碼
SMTP_FROM=your-email@gmail.com
```

**注意**：Gmail 需要使用「應用程式密碼」，而非一般密碼。
1. 前往 Google 帳戶設定
2. 啟用「兩步驟驗證」
3. 產生「應用程式密碼」
4. 使用應用程式密碼作為 `SMTP_PASSWORD`

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@outlook.com
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

#### Brevo (原 Sendinblue)
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-email@example.com
SMTP_PASSWORD=your-smtp-key
SMTP_FROM=noreply@yourdomain.com
```

**Brevo 配置步驟：**
1. 登入 [Brevo 控制台](https://app.brevo.com/)
2. 前往 **Settings** > **SMTP & API**
3. 在 **SMTP** 區塊中，點擊 **Generate a new SMTP key**
4. 複製生成的 SMTP key（這不是你的登入密碼）
5. 使用你的 Brevo 帳號 email 作為 `SMTP_USER`
6. 使用生成的 SMTP key 作為 `SMTP_PASSWORD`
7. 確保 `SMTP_FROM` 的 email 地址已在 Brevo 中驗證（前往 **Senders** 驗證）

**注意事項：**
- Brevo 免費方案每天可發送 300 封 Email
- 發送者 email 地址必須在 Brevo 中驗證
- 使用 SMTP key 而非登入密碼

### 3. 測試 Email 配置

系統會在啟動時自動驗證 SMTP 連接。如果配置錯誤，會在控制台顯示警告訊息，但不會影響系統運行。

## 📨 支援的通知類型

系統會自動為以下通知類型發送 Email：

1. **任務指派** (`task_assigned`)
   - 當任務被指派給用戶時
   - Email 包含任務標題、指派者資訊、任務連結

2. **評論新增** (`comment_added`)
   - 當任務收到新評論時
   - Email 包含評論者、任務標題、評論預覽、任務連結

3. **成員邀請** (`member_invited`)
   - 當用戶被邀請加入工作區時
   - Email 包含邀請者、工作區名稱、角色、工作區連結

## 🎨 Email 模板

系統使用 HTML 模板生成美觀的 Email，包含：
- 響應式設計
- 品牌色彩
- 清晰的內容結構
- 行動按鈕（查看任務/工作區）

## ⚙️ 功能特性

- **異步發送**：Email 發送不會阻塞主要業務流程
- **錯誤處理**：Email 發送失敗不會影響通知創建
- **自動降級**：如果 SMTP 未配置，系統會自動跳過 Email 發送，只發送站內通知
- **用戶驗證**：只有有效 email 的用戶才會收到 Email

## 🚫 停用 Email 通知

如果不需要 Email 通知功能，只需：
1. 不設置 SMTP 環境變數，或
2. 將 `SMTP_HOST` 留空

系統會自動檢測並跳過 Email 發送，只保留站內通知功能。

## 📝 注意事項

1. **生產環境**：建議使用專業的 Email 服務（如 SendGrid、Mailgun）而非個人 Gmail
2. **安全性**：不要將 SMTP 密碼提交到版本控制系統
3. **速率限制**：注意 SMTP 服務商的發送速率限制
4. **垃圾郵件**：確保 Email 內容符合反垃圾郵件規範

