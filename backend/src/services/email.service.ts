import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/index';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export class EmailService {
    private static transporter: Transporter | null = null;

    /**
     * 初始化 Email 傳輸器
     */
    private static initializeTransporter(): Transporter | null {
        // 如果已經初始化，直接返回
        if (this.transporter) {
            return this.transporter;
        }

        // 檢查是否配置了 SMTP
        if (!config.smtp.host || !config.smtp.port) {
            console.warn('SMTP not configured, email notifications will be disabled');
            return null;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.secure, // true for 465, false for other ports
                auth: config.smtp.user && config.smtp.password ? {
                    user: config.smtp.user,
                    pass: config.smtp.password
                } : undefined,
                tls: {
                    rejectUnauthorized: false // 開發環境可以設為 false，生產環境建議設為 true
                }
            });

            return this.transporter;
        } catch (error) {
            console.error('Failed to initialize email transporter:', error);
            return null;
        }
    }

    /**
     * 發送 Email
     */
    static async sendEmail(options: EmailOptions): Promise<boolean> {
        try {
            const transporter = this.initializeTransporter();
            if (!transporter) {
                console.warn('Email transporter not available, skipping email send');
                return false;
            }

            const mailOptions = {
                from: config.smtp.from || config.smtp.user || 'noreply@project-management.com',
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text || this.htmlToText(options.html)
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', {
                messageId: info.messageId,
                to: options.to,
                subject: options.subject,
                response: info.response
            });
            return true;
        } catch (error: any) {
            console.error('Failed to send email:', {
                to: options.to,
                subject: options.subject,
                error: error.message,
                code: error.code,
                response: error.response,
                responseCode: error.responseCode
            });
            return false;
        }
    }

    /**
     * 將 HTML 轉換為純文字（簡單版本）
     */
    private static htmlToText(html: string): string {
        return html
            .replace(/<[^>]*>/g, '') // 移除 HTML 標籤
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }

    /**
     * 驗證 Email 配置
     */
    static async verifyConnection(): Promise<boolean> {
        try {
            const transporter = this.initializeTransporter();
            if (!transporter) {
                return false;
            }
            await transporter.verify();
            console.log('Email server connection verified');
            return true;
        } catch (error) {
            console.error('Email server connection failed:', error);
            return false;
        }
    }
}

