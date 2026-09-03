const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('./env');

// Strip all query parameters from the connection URL (sslmode, channel_binding, etc.)
// so that pg does not misinterpret them as part of the database name.
// SSL is configured explicitly via the 'ssl' option below.
let connectionString = DATABASE_URL;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    url.search = ''; // remove ALL query params (?sslmode=require&channel_binding=require etc.)
    connectionString = url.toString();
  } catch (_) {
    // If URL parsing fails, fall back to simple regex strip
    connectionString = connectionString.split('?')[0];
  }
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
