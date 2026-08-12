/**
 * migrate.js — Auto-migration script
 * Runs on server startup to apply DB schema changes safely.
 * Each migration step runs independently so a single failure
 * does not block subsequent migrations.
 */
const { pool } = require('./db');

async function runStep(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}: ${err.message}`);
  }
}

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

    // M1: Add entry_time and exit_time to users table
    await runStep(client, 'M1: users.entry_time / exit_time', `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS entry_time VARCHAR(5) DEFAULT '07:30',
        ADD COLUMN IF NOT EXISTS exit_time  VARCHAR(5) DEFAULT '16:30';
    `);

    // M2: Add is_manual_edit to attendance table
    await runStep(client, 'M2: attendance.is_manual_edit', `
      ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS is_manual_edit BOOLEAN DEFAULT false;
    `);

    // M3: Add manual_status to attendance table (for Ausente/Incapacitado/Suspendido)
    // VARCHAR(50) to safely accommodate all status labels
    await runStep(client, 'M3: attendance.manual_status', `
      ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS manual_status VARCHAR(50) DEFAULT NULL;
    `);

    console.log('✅ All auto-migrations completed.');
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
