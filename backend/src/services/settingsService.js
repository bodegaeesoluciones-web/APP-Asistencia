const { pool } = require('../config/db');

async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

async function getSetting(key, defaultValue = null) {
  const { rows } = await pool.query(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : defaultValue;
}

async function updateSetting(key, value, userId) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE
     SET value = $2, updated_at = NOW(), updated_by = $3`,
    [key, value, userId]
  );
}

module.exports = {
  getSettings,
  getSetting,
  updateSetting,
};
