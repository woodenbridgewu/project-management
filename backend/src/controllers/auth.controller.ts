import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { query } from '../database/index';
import { config } from '../config/index';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { cacheService } from '../services/cache.service';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2)
});

export class AuthController {
    async register(req: Request, res: Response) {
        try {
            const { email, password, fullName } = registerSchema.parse(req.body);

            // 檢查使用者是否存在
            const existing = await query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            // 雜湊密碼
            const passwordHash = await bcrypt.hash(password, 10);

            // 建立使用者
            const result = await query(
                `INSERT INTO users (email, password_hash, full_name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, full_name, created_at`,
                [email, passwordHash, fullName]
            );

            const user = result.rows[0];
            const accessToken = this.generateAccessToken(user);
            const refreshToken = this.generateRefreshToken(user);

            res.status(201).json({
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name
                },
                accessToken,
                refreshToken
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            console.error('Register error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('Error details:', { errorMessage, errorStack });
            res.status(500).json({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
            });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            const result = await query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const accessToken = this.generateAccessToken(user);
            const refreshToken = this.generateRefreshToken(user);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    avatarUrl: user.avatar_url
                },
                accessToken,
                refreshToken
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async refreshToken(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({ error: 'Refresh token required' });
            }

            const decoded = jwt.verify(
                refreshToken,
                config.jwt.refreshSecret
            ) as any;

            const result = await query(
                'SELECT id, email, full_name FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }

            const user = result.rows[0];
            const newAccessToken = this.generateAccessToken(user);

            res.json({ accessToken: newAccessToken });
        } catch (error) {
            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }

    async logout(req: Request, res: Response) {
        // TODO: 將 token 加入黑名單 (使用 Redis)
        res.json({ message: 'Logged out successfully' });
    }

    async getCurrentUser(req: AuthRequest, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const cacheKey = `user:${req.user.id}`;

            // 嘗試從快取獲取
            const cached = await cacheService.get<any>(cacheKey);
            if (cached) {
                return res.json(cached);
            }

            const result = await query(
                `SELECT 
                    id,
                    email,
                    full_name,
                    avatar_url,
                    timezone,
                    (created_at AT TIME ZONE 'UTC')::text as created_at,
                    (updated_at AT TIME ZONE 'UTC')::text as updated_at
                FROM users 
                WHERE id = $1`,
                [req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = result.rows[0];

            // 將時間戳轉換為 ISO 8601 格式（UTC）
            if (user.created_at) {
                const createdAt = new Date(user.created_at + 'Z');
                if (!isNaN(createdAt.getTime())) {
                    user.created_at = createdAt.toISOString();
                }
            }
            if (user.updated_at) {
                const updatedAt = new Date(user.updated_at + 'Z');
                if (!isNaN(updatedAt.getTime())) {
                    user.updated_at = updatedAt.toISOString();
                }
            }

            const response = {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    avatarUrl: user.avatar_url,
                    timezone: user.timezone,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            };

            // 設置快取（TTL: 10 分鐘）
            await cacheService.set(cacheKey, response, 600);

            res.json(response);
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    private generateAccessToken(user: any): string {
        const options: SignOptions = {
            expiresIn: config.jwt.accessExpiry as StringValue
        };
        return jwt.sign(
            { userId: user.id, email: user.email },
            config.jwt.accessSecret,
            options
        );
    }

    private generateRefreshToken(user: any): string {
        const options: SignOptions = {
            expiresIn: config.jwt.refreshExpiry as StringValue
        };
        return jwt.sign(
            { userId: user.id },
            config.jwt.refreshSecret,
            options
        );
    }
}