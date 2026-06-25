/**
 * migrate.js — Auto-migration script
 * Runs on server startup to apply DB schema changes safely.
 */
const { pool } = require('./db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running auto-migrations...');

    // Migration 1: Add entry_time and exit_time to users table
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS entry_time VARCHAR(5) DEFAULT '07:30',
        ADD COLUMN IF NOT EXISTS exit_time  VARCHAR(5) DEFAULT '16:30';
    `);

    console.log('✅ Migrations completed successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
