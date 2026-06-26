require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function wipeAndSeed() {
  console.log('⚠️ ADVERTENCIA: Limpiando la base de datos (TRUNCATE CASCADE)...');
  await pool.query('TRUNCATE TABLE users, devices, attendance, qr_tokens, refresh_tokens, audit_log RESTART IDENTITY CASCADE');
  console.log('✅ Base de datos limpiada correctamente.');

  const passwordHash = await bcrypt.hash('Admin123!', 12);
  await pool.query(`
    INSERT INTO users (username, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, 'admin', 'active')
  `, ['admin', passwordHash, 'Administrador del Sistema']);

  console.log('✅ Admin user created: admin / Admin123!');
  await pool.end();
}

wipeAndSeed().catch(err => {
  console.error('Wipe error:', err);
  process.exit(1);
});
