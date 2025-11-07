import { Pool } from 'pg';
import { config } from '../config/index';

export const pool = new Pool(config.database);

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