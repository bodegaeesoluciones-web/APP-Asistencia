require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`✅ Migration ${file} completed`);
  }

  console.log('All migrations completed');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
