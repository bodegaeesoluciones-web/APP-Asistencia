/**
 * migrate.js — Auto-migration script
 * Runs on server startup to apply DB schema changes safely.
 */
const { pool } = require('./db');

async function runMigrations() {
  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.warn('⚠️  DB not reachable at startup (will retry on first request):', connErr.message);
    return; // Don't crash — the pool will reconnect automatically
  }

  try {
    console.log('🔄 Running auto-migrations...');

    // Migration 1: Add entry_time and exit_time to users table
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS entry_time VARCHAR(5) DEFAULT '07:30',
        ADD COLUMN IF NOT EXISTS exit_time  VARCHAR(5) DEFAULT '16:30';
    `);

    // Migration 2: Add is_manual_edit to attendance table
    await client.query(`
      ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS is_manual_edit BOOLEAN DEFAULT false;
    `);

    console.log('✅ Migrations completed successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
