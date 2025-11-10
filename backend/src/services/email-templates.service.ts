import { config } from '../config/index';

export interface TaskAssignedEmailData {
    recipientName: string;
    taskTitle: string;
    taskUrl: string;
    assignerName?: string;
}

export interface CommentAddedEmailData {
    recipientName: string;
    commenterName: string;
    taskTitle: string;
    commentPreview: string;
    taskUrl: string;
}

export interface MemberInvitedEmailData {
    recipientName: string;
    inviterName: string;
    workspaceName: string;
    role: string;
    workspaceUrl: string;
}

export class EmailTemplatesService {
    private static getBaseUrl(): string {
        return config.frontendUrl || 'http://localhost:4200';
    }

    /**
     * 任務指派 Email 模板
     */
    static getTaskAssignedTemplate(data: TaskAssignedEmailData): string {
        const roleText = data.assignerName ? `由 ${data.assignerName}` : '';
        const baseUrl = this.getBaseUrl();
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f0f2f5;
        }
        .email-container {
            background: white;
            margin: 20px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }
        .header-title {
            font-size: 18px;
            margin: 0;
            opacity: 0.95;
        }
        .content {
            padding: 40px 30px;
            background: white;
        }
        .greeting {
            font-size: 16px;
            color: #1a202c;
            margin-bottom: 20px;
        }
        .task-info {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
        }
        .task-title {
            color: #1a202c;
            font-size: 20px;
            font-weight: 600;
            margin: 0;
            word-break: break-word;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            margin: 25px 0;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .button:hover {
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .system-info {
            background: #f7fafc;
            padding: 20px;
            margin-top: 30px;
            border-radius: 4px;
            font-size: 13px;
            color: #4a5568;
            line-height: 1.8;
        }
        .system-info strong {
            color: #1a202c;
        }
        .footer {
            background: #f7fafc;
            padding: 25px 30px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #718096;
            text-align: center;
            line-height: 1.6;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 25px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">📋 專案管理系統</div>
            <h1 class="header-title">新任務指派通知</h1>
        </div>
        <div class="content">
            <div class="greeting">
                您好 <strong>${this.escapeHtml(data.recipientName)}</strong>，
            </div>
            <p style="color: #4a5568; margin: 20px 0;">
                您${roleText}被指派了一個新任務，請查看以下詳情：
            </p>
            <div class="task-info">
                <h2 class="task-title">${this.escapeHtml(data.taskTitle)}</h2>
            </div>
            <div style="text-align: center;">
                <a href="${data.taskUrl}" class="button">立即查看任務</a>
            </div>
            <div class="system-info">
                <strong>📌 系統資訊：</strong><br>
                此郵件由 <strong>專案管理系統</strong> 自動發送<br>
                系統網址：<a href="${baseUrl}" class="footer-link" style="color: #667eea;">${baseUrl}</a><br>
                如需協助，請登入系統查看詳情
            </div>
        </div>
        <div class="footer">
            <p style="margin: 0 0 8px 0;">
                <strong>專案管理系統</strong> - 團隊協作與任務管理平台
            </p>
            <p style="margin: 0 0 8px 0;">
                此為系統自動發送的郵件，請勿直接回覆此郵件。
            </p>
            <p style="margin: 0;">
                © ${new Date().getFullYear()} 專案管理系統 | 所有權利保留
            </p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * 評論新增 Email 模板
     */
    static getCommentAddedTemplate(data: CommentAddedEmailData): string {
        const baseUrl = this.getBaseUrl();
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f0f2f5;
        }
        .email-container {
            background: white;
            margin: 20px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }
        .header-title {
            font-size: 18px;
            margin: 0;
            opacity: 0.95;
        }
        .content {
            padding: 40px 30px;
            background: white;
        }
        .greeting {
            font-size: 16px;
            color: #1a202c;
            margin-bottom: 20px;
        }
        .task-reference {
            background: #f7fafc;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            border-left: 3px solid #48bb78;
        }
        .comment-box {
            background: #f0fff4;
            border: 2px solid #48bb78;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
        }
        .comment-author {
            color: #2d3748;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .comment-text {
            color: #1a202c;
            margin: 0;
            font-size: 15px;
            line-height: 1.7;
            word-break: break-word;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            margin: 25px 0;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
        }
        .button:hover {
            box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
        }
        .system-info {
            background: #f7fafc;
            padding: 20px;
            margin-top: 30px;
            border-radius: 4px;
            font-size: 13px;
            color: #4a5568;
            line-height: 1.8;
        }
        .system-info strong {
            color: #1a202c;
        }
        .footer {
            background: #f7fafc;
            padding: 25px 30px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #718096;
            text-align: center;
            line-height: 1.6;
        }
        .footer-link {
            color: #48bb78;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 25px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">💬 專案管理系統</div>
            <h1 class="header-title">新評論通知</h1>
        </div>
        <div class="content">
            <div class="greeting">
                您好 <strong>${this.escapeHtml(data.recipientName)}</strong>，
            </div>
            <div class="task-reference">
                <strong>${this.escapeHtml(data.commenterName)}</strong> 在任務「<strong>${this.escapeHtml(data.taskTitle)}</strong>」中新增了評論：
            </div>
            <div class="comment-box">
                <div class="comment-author">👤 ${this.escapeHtml(data.commenterName)}：</div>
                <p class="comment-text">${this.escapeHtml(data.commentPreview)}</p>
            </div>
            <div style="text-align: center;">
                <a href="${data.taskUrl}" class="button">查看完整討論</a>
            </div>
            <div class="system-info">
                <strong>📌 系統資訊：</strong><br>
                此郵件由 <strong>專案管理系統</strong> 自動發送<br>
                系統網址：<a href="${baseUrl}" class="footer-link" style="color: #48bb78;">${baseUrl}</a><br>
                如需回覆或查看更多評論，請登入系統
            </div>
        </div>
        <div class="footer">
            <p style="margin: 0 0 8px 0;">
                <strong>專案管理系統</strong> - 團隊協作與任務管理平台
            </p>
            <p style="margin: 0 0 8px 0;">
                此為系統自動發送的郵件，請勿直接回覆此郵件。
            </p>
            <p style="margin: 0;">
                © ${new Date().getFullYear()} 專案管理系統 | 所有權利保留
            </p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * 成員邀請 Email 模板
     */
    static getMemberInvitedTemplate(data: MemberInvitedEmailData): string {
        const roleMap: Record<string, string> = {
            'admin': '管理員',
            'member': '成員',
            'guest': '訪客'
        };
        const roleText = roleMap[data.role] || data.role;
        const baseUrl = this.getBaseUrl();

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f0f2f5;
        }
        .email-container {
            background: white;
            margin: 20px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }
        .header-title {
            font-size: 18px;
            margin: 0;
            opacity: 0.95;
        }
        .content {
            padding: 40px 30px;
            background: white;
        }
        .greeting {
            font-size: 16px;
            color: #1a202c;
            margin-bottom: 20px;
        }
        .invitation-info {
            background: #fff5eb;
            border: 2px solid #ed8936;
            border-radius: 6px;
            padding: 25px;
            margin: 25px 0;
        }
        .workspace-name {
            color: #1a202c;
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 15px 0;
            word-break: break-word;
        }
        .role-badge {
            display: inline-block;
            background: #ed8936;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 10px;
        }
        .inviter-info {
            color: #4a5568;
            font-size: 14px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #fed7aa;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            margin: 25px 0;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 2px 8px rgba(237, 137, 54, 0.3);
        }
        .button:hover {
            box-shadow: 0 4px 12px rgba(237, 137, 54, 0.4);
        }
        .system-info {
            background: #f7fafc;
            padding: 20px;
            margin-top: 30px;
            border-radius: 4px;
            font-size: 13px;
            color: #4a5568;
            line-height: 1.8;
        }
        .system-info strong {
            color: #1a202c;
        }
        .footer {
            background: #f7fafc;
            padding: 25px 30px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #718096;
            text-align: center;
            line-height: 1.6;
        }
        .footer-link {
            color: #ed8936;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 25px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">👥 專案管理系統</div>
            <h1 class="header-title">工作區邀請通知</h1>
        </div>
        <div class="content">
            <div class="greeting">
                您好 <strong>${this.escapeHtml(data.recipientName)}</strong>，
            </div>
            <p style="color: #4a5568; margin: 20px 0;">
                您收到了一個工作區邀請，詳情如下：
            </p>
            <div class="invitation-info">
                <h2 class="workspace-name">${this.escapeHtml(data.workspaceName)}</h2>
                <div class="role-badge">${roleText}</div>
                <div class="inviter-info">
                    <strong>邀請者：</strong>${this.escapeHtml(data.inviterName)}
                </div>
            </div>
            <div style="text-align: center;">
                <a href="${data.workspaceUrl}" class="button">接受邀請並查看工作區</a>
            </div>
            <div class="system-info">
                <strong>📌 系統資訊：</strong><br>
                此郵件由 <strong>專案管理系統</strong> 自動發送<br>
                系統網址：<a href="${baseUrl}" class="footer-link" style="color: #ed8936;">${baseUrl}</a><br>
                點擊上方按鈕即可加入工作區，開始協作
            </div>
        </div>
        <div class="footer">
            <p style="margin: 0 0 8px 0;">
                <strong>專案管理系統</strong> - 團隊協作與任務管理平台
            </p>
            <p style="margin: 0 0 8px 0;">
                此為系統自動發送的郵件，請勿直接回覆此郵件。
            </p>
            <p style="margin: 0;">
                © ${new Date().getFullYear()} 專案管理系統 | 所有權利保留
            </p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * 轉義 HTML 特殊字符
     */
    private static escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

