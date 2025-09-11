// backend/src/db.js
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'semanticdb',
  password: process.env.PGPASSWORD || 'pass',
  port: process.env.PGPORT || 5432
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export default pool;
