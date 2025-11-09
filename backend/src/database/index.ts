import { Pool } from 'pg';
import { config } from '../config/index';

// 確保資料庫連接使用 UTF-8 編碼
export const pool = new Pool({
    ...config.database,
    client_encoding: 'UTF8'
});

pool.on('error', (err: Error) => {
    console.error('Unexpected database error', err);
    process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
};