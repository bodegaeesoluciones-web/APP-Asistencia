require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function seed() {
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  await pool.query(`
    INSERT INTO users (username, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, 'admin', 'active')
    ON CONFLICT (username) DO UPDATE SET password_hash = $2, full_name = $3, role = 'admin'
  `, ['admin', passwordHash, 'Administrador del Sistema']);

  console.log('✅ Admin user created: admin / Admin123!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
