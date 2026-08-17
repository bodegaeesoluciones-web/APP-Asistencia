require('dotenv').config();
const { pool } = require('./src/config/db');

pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entry_time VARCHAR(5) DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS exit_time VARCHAR(5) DEFAULT '16:30';
`)
  .then(() => console.log('Successfully added columns'))
  .catch(console.error)
  .finally(() => process.exit());
