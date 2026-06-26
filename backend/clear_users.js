require('dotenv').config();
const { pool } = require('./src/config/db');

async function clearUsers() {
  try {
    await pool.query("DELETE FROM users WHERE role != 'admin'");
    console.log("✅ All non-admin users deleted successfully.");
  } catch (err) {
    console.error("❌ Error deleting users:", err.message);
  } finally {
    pool.end();
  }
}

clearUsers();
