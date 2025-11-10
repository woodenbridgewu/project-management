# Email 通知調試指南

## 🔍 如何確認 Brevo 寄件備份和收件問題

### 1. 檢查 Brevo 控制台的寄件記錄

#### 免費版查看方法：

由於免費版無法查看 **Statistics** > **Email Activity**，可以使用以下替代方法：

**方法 1：查看 SMTP 日誌（推薦）**
1. 登入 [Brevo 控制台](https://app.brevo.com/)
2. 前往 **Settings** > **SMTP & API**
3. 在 **SMTP** 區塊中，查看 **SMTP Logs** 或 **Recent Activity**
4. 這裡會顯示最近的 SMTP 連接記錄

**方法 2：查看後端日誌（最可靠）**
- 後端日誌中的 `250 2.0.0 OK: queued as ...` 表示郵件已被 SMTP 伺服器接受
- 這是最可靠的確認方式，因為它直接來自 SMTP 伺服器的回應

**方法 3：升級到付費版（可選）**
- 付費版可以查看完整的 **Statistics** > **Email Activity**
- 包含詳細的發送狀態、送達狀態、退回記錄等

#### 付費版查看方法（參考）：
1. 登入 [Brevo 控制台](https://app.brevo.com/)
2. 前往 **Statistics** > **Email Activity**
3. 查看 **Sent** 標籤，這裡會顯示所有發送的 Email
4. 檢查每封 Email 的狀態：
   - ✅ **Delivered**：已送達
   - ⏳ **Pending**：等待發送
   - ❌ **Bounced**：退回（可能是 email 地址無效）
   - ⚠️ **Spam**：被標記為垃圾郵件
   - 🚫 **Blocked**：被阻擋

#### 查看詳細資訊：
- 點擊每封 Email 可以查看：
  - 發送時間
  - 收件者地址
  - 郵件主題
  - 發送狀態
  - 錯誤訊息（如果有）

### 2. 檢查系統日誌

#### 查看後端控制台輸出

當系統發送 Email 時，會輸出以下日誌：

**成功發送（SMTP 伺服器已接受）：**
```javascript
Email sent successfully: {
  messageId: '<message-id>',
  to: 'recipient@example.com',
  subject: '郵件主題',
  response: '250 2.0.0 OK: queued as <message-id>'
}
```

**重要說明：**
- `250 2.0.0 OK: queued as ...` 表示郵件已被 SMTP 伺服器接受並排隊
- 這**不代表郵件已送達收件者**，只表示郵件已進入發送流程
- 郵件可能還在處理中，或被收件者的郵箱服務商過濾

**發送失敗：**
```javascript
Failed to send email: {
  to: 'recipient@example.com',
  subject: '郵件主題',
  error: '錯誤訊息',
  code: '錯誤代碼'
}
```

**跳過發送（評論通知）：**
```
Skipping email notification for type: comment_added
```

#### 檢查日誌文件

如果使用日誌文件，檢查以下內容：
- Email 發送嘗試的記錄
- SMTP 連接錯誤
- 用戶 email 地址驗證失敗

### 3. 驗證 Email 配置

#### 檢查環境變數

確認 `backend/.env` 文件中的配置：

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-email@example.com
SMTP_PASSWORD=your-smtp-key
SMTP_FROM=noreply@yourdomain.com
```

**重要檢查點：**
- ✅ `SMTP_FROM` 的 email 地址必須在 Brevo 中驗證過
- ✅ `SMTP_PASSWORD` 是 SMTP key，不是登入密碼
- ✅ `SMTP_USER` 是你的 Brevo 帳號 email

#### 驗證 SMTP 連接

系統啟動時會自動驗證 SMTP 連接，查看啟動日誌：

**成功：**
```
✅ Email service configured and verified
```

**失敗：**
```
⚠️  Email service configuration failed, email notifications will be disabled
⚠️  Email service verification error: <error-message>
```

### 4. 常見問題排查

#### 問題 1：後端日誌顯示發送成功，但收件者沒收到 ⭐ 常見問題

**後端日誌顯示：**
```
Email sent successfully: {
  response: '250 2.0.0 OK: queued as ...'
}
```

**這表示什麼？**
- ✅ SMTP 伺服器已接受郵件
- ✅ 郵件已進入發送隊列
- ⚠️ **但這不保證郵件已送達收件者**

**可能原因：**
1. **垃圾郵件資料夾** ⭐ 最常見
   - 檢查收件者的垃圾郵件/垃圾箱資料夾
   - 企業郵箱（如 @systex.com.tw）可能有更嚴格的過濾規則

2. **郵箱服務商過濾**
   - 企業郵箱系統可能有防火牆或過濾規則
   - 可能被標記為垃圾郵件或直接阻擋

3. **Email 地址錯誤**
   - 確認資料庫中的用戶 email 地址是否正確
   - 檢查是否有拼寫錯誤

4. **SPF/DKIM 設定**
   - 如果使用自訂域名，需要設定 DNS 記錄
   - 免費版 Brevo 使用 brevo.com 域名，通常不需要額外設定

5. **郵件延遲**
   - 郵件可能還在處理中，等待幾分鐘再檢查

**解決方法（按優先順序）：**
1. ✅ **檢查垃圾郵件資料夾**（最重要）
2. ✅ 等待 5-10 分鐘後再檢查（郵件可能延遲）
3. ✅ 確認收件者 email 地址正確
4. ✅ 請收件者檢查郵箱過濾規則
5. ✅ 如果是企業郵箱，聯繫 IT 部門檢查防火牆設定
6. ✅ 嘗試發送到不同的 email 地址測試

#### 問題 2：Brevo 沒有顯示發送記錄

**可能原因：**
1. **Email 發送失敗**：檢查後端日誌中的錯誤訊息
2. **SMTP 配置錯誤**：驗證 SMTP 連接
3. **通知類型被跳過**：確認通知類型是否在 `skipEmailTypes` 列表中

**解決方法：**
- 檢查後端控制台的錯誤日誌
- 確認 SMTP 配置正確
- 驗證通知是否真的被創建

#### 問題 3：Email 被退回（Bounced）

**可能原因：**
1. **無效的 email 地址**：收件者 email 地址不存在
2. **郵箱已滿**：收件者郵箱空間不足
3. **域名問題**：發送者域名未驗證

**解決方法：**
- 確認收件者 email 地址有效
- 在 Brevo 中查看退回原因
- 驗證發送者域名

### 5. 調試步驟

#### 步驟 1：確認 Email 是否被發送

1. 觸發一個會發送 Email 的操作（例如：指派任務）
2. 立即檢查後端控制台，應該看到：
   ```
   Email sent successfully: <message-id>
   ```
3. 如果沒有看到，檢查是否有錯誤訊息

#### 步驟 2：檢查 Brevo 控制台（免費版）

**免費版用戶：**
1. 前往 **Settings** > **SMTP & API**
2. 查看 **SMTP Logs** 或 **Recent Activity**（如果有）
3. 或者直接依賴後端日誌確認（更可靠）

**付費版用戶：**
1. 前往 **Statistics** > **Email Activity**
2. 查看最近的發送記錄
3. 確認：
   - Email 是否出現在列表中
   - 發送狀態是什麼
   - 收件者地址是否正確

#### 步驟 3：檢查收件者郵箱

1. 檢查收件箱
2. 檢查垃圾郵件資料夾
3. 檢查郵箱過濾規則
4. 確認 email 地址正確

#### 步驟 4：測試 SMTP 連接

可以創建一個測試腳本來驗證 SMTP 配置：

```typescript
// test-email.ts
import { EmailService } from './src/services/email.service';

async function testEmail() {
    const verified = await EmailService.verifyConnection();
    if (verified) {
        console.log('✅ SMTP connection verified');
        
        // 發送測試 Email
        const sent = await EmailService.sendEmail({
            to: 'your-test-email@example.com',
            subject: '測試 Email',
            html: '<h1>這是一封測試 Email</h1><p>如果您收到這封 Email，表示配置正確。</p>'
        });
        
        if (sent) {
            console.log('✅ Test email sent successfully');
        } else {
            console.log('❌ Failed to send test email');
        }
    } else {
        console.log('❌ SMTP connection failed');
    }
}

testEmail();
```

### 6. 檢查資料庫中的用戶 Email

確認用戶的 email 地址是否正確：

```sql
SELECT id, email, full_name FROM users WHERE id = '<user-id>';
```

### 7. 啟用詳細日誌

如果需要更詳細的調試資訊，可以在 `email.service.ts` 中啟用詳細日誌：

```typescript
// 在 sendEmail 方法中添加
console.log('Sending email to:', options.to);
console.log('Email subject:', options.subject);
console.log('SMTP config:', {
    host: config.smtp.host,
    port: config.smtp.port,
    user: config.smtp.user,
    from: config.smtp.from
});
```

### 8. 檢查 Brevo 額度

1. 前往 Brevo 控制台的 **Account** > **Plan**
2. 檢查剩餘的 Email 額度
3. 確認沒有超過每日/每月限制

### 9. 常見錯誤訊息

#### "Invalid login"
- **原因**：SMTP_USER 或 SMTP_PASSWORD 錯誤
- **解決**：確認使用 SMTP key 而非登入密碼

#### "Sender address not verified"
- **原因**：SMTP_FROM 的 email 地址未在 Brevo 中驗證
- **解決**：前往 Brevo 的 **Senders** 頁面驗證 email 地址

#### "Recipient address rejected"
- **原因**：收件者 email 地址無效或格式錯誤
- **解決**：檢查資料庫中的用戶 email 地址

#### "Connection timeout"
- **原因**：網路問題或 SMTP 伺服器無法連接
- **解決**：檢查網路連接和防火牆設定

## 📝 調試檢查清單

- [ ] 後端控制台顯示 "Email sent successfully"
- [ ] Brevo 控制台顯示發送記錄
- [ ] Email 狀態為 "Delivered"
- [ ] 收件者 email 地址正確
- [ ] SMTP_FROM 已在 Brevo 中驗證
- [ ] 檢查收件者的垃圾郵件資料夾
- [ ] 確認沒有超過 Brevo 額度限制
- [ ] SMTP 配置正確（使用 SMTP key）

## 🔧 快速測試方法

1. **測試任務指派通知**：
   - 指派一個任務給另一個用戶
   - 檢查後端日誌
   - 檢查 Brevo 控制台
   - 檢查收件者郵箱

2. **測試成員邀請通知**：
   - 邀請一個新成員加入工作區
   - 重複上述檢查步驟

3. **直接測試 Email 服務**：
   - 使用上面的測試腳本
   - 直接發送測試 Email

## 💡 建議

1. **先檢查 Brevo 控制台**：這是最直接的方式確認 Email 是否被發送
2. **查看後端日誌**：確認系統是否嘗試發送 Email
3. **檢查收件者郵箱**：包括垃圾郵件資料夾
4. **驗證配置**：確認所有 SMTP 配置正確

如果以上都檢查過了還是沒收到，可能需要：
- 檢查域名 DNS 設定（SPF、DKIM）
- 聯繫 Brevo 客服查看詳細日誌
- 檢查收件者郵箱服務商的過濾規則

