import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index';

export class CacheService {
    private client: RedisClientType | null = null;
    private isConnected = false;

    /**
     * 初始化 Redis 連接
     */
    async initialize(): Promise<void> {
        try {
            this.client = createClient({
                socket: {
                    host: config.redis.host,
                    port: config.redis.port,
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            console.error('Redis: Max reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Redis: Connecting...');
            });

            this.client.on('ready', () => {
                console.log('Redis: Connected and ready ✅');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Redis: Connection ended');
                this.isConnected = false;
            });

            await this.client.connect();
        } catch (error) {
            console.error('Redis initialization failed:', error);
            console.warn('⚠️  Cache service disabled. Application will continue without caching.');
            this.isConnected = false;
        }
    }

    /**
     * 關閉 Redis 連接
     */
    async disconnect(): Promise<void> {
        if (this.client && this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
            console.log('Redis: Disconnected');
        }
    }

    /**
     * 檢查是否已連接
     */
    isAvailable(): boolean {
        return this.isConnected && this.client !== null;
    }

    /**
     * 獲取快取值
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            const value = await this.client!.get(key);
            if (value === null) {
                return null;
            }
            return JSON.parse(value) as T;
        } catch (error) {
            console.error(`Redis get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * 設置快取值
     */
    async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client!.setEx(key, ttlSeconds, serialized);
            } else {
                await this.client!.set(key, serialized);
            }
            return true;
        } catch (error) {
            console.error(`Redis set error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * 刪除快取
     */
    async delete(key: string): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            await this.client!.del(key);
            return true;
        } catch (error) {
            console.error(`Redis delete error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * 批量刪除快取（使用模式匹配）
     */
    async deletePattern(pattern: string): Promise<number> {
        if (!this.isAvailable()) {
            return 0;
        }

        try {
            const keys = await this.client!.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }
            await this.client!.del(keys);
            return keys.length;
        } catch (error) {
            console.error(`Redis deletePattern error for pattern ${pattern}:`, error);
            return 0;
        }
    }

    /**
     * 清除所有快取（謹慎使用）
     */
    async flushAll(): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            await this.client!.flushAll();
            return true;
        } catch (error) {
            console.error('Redis flushAll error:', error);
            return false;
        }
    }

    /**
     * 獲取或設置快取（如果不存在則執行回調函數）
     */
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        // 嘗試從快取獲取
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        // 快取未命中，執行回調函數
        const value = await fetchFn();

        // 設置快取
        if (value !== null && value !== undefined) {
            await this.set(key, value, ttlSeconds);
        }

        return value;
    }
}

// 導出單例實例
export const cacheService = new CacheService();

