import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Using the native pool connection via connectionString
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// A quick helper to test the connection health on server startup
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL database via native Pool');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});