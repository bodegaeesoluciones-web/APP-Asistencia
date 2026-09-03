const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('./env');

// Remove sslmode=require from URL to prevent pg security warning
let connectionString = DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.replace(/\?sslmode=require/, '').replace(/&sslmode=require/, '');
}

const pool = new Pool({
  connectionString,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  if (NODE_ENV !== 'production') console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

module.exports = { pool };
