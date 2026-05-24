import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Using the native pool connection via connectionString
export const pool = new Pool({
  connectionString: 
  "postgresql://neondb_owner:npg_kyNwgar7Soq9@ep-twilight-shape-ap6dzmj6-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

// A quick helper to test the connection health on server startup
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL database via native Pool');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});