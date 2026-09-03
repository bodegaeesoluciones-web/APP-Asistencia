require('dotenv').config();
const { pool } = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function checkAdmin() {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (rows.length === 0) {
      console.log('Admin user does not exist! Creating one...');
      const hash = await bcrypt.hash('Admin123!', 12);
      await pool.query("INSERT INTO users (username, password_hash, full_name, role, status) VALUES ($1, $2, $3, 'admin', 'active')", ['admin', hash, 'Administrador del Sistema']);
      console.log('Admin user created with password Admin123!');
    } else {
      console.log('Admin user exists:', rows[0].username, rows[0].role, rows[0].status);
      const hash = await bcrypt.hash('Admin123!', 12);
      await pool.query("UPDATE users SET password_hash = $1 WHERE username = 'admin'", [hash]);
      console.log('Admin password forcefully reset to Admin123!');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkAdmin();
