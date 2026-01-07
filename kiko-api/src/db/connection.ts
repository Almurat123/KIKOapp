import { Pool } from 'pg';
import prisma from './prisma.js';

// PostgreSQL pool for legacy repositories (SocialJob, MarketJob, etc.)
const postgresUrl = process.env.POSTGRES_URL || 'postgresql://almurat@localhost:5432/kiko_db';

export const pool = new Pool({
  connectionString: postgresUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Unexpected error:', err.message);
});

// Test Prisma (SQLite) connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Test PostgreSQL connection
export const testPostgresConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.error('PostgreSQL connection failed:', error);
    return false;
  }
};
