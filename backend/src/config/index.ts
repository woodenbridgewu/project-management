import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'project_management',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
        accessExpiry: '15m',
        refreshExpiry: '7d'
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
    },

    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@project-management.com'
    }
};