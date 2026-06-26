require('dotenv').config();
const { pool } = require('./src/config/db');

pool.query("SELECT table_name, constraint_name, column_name FROM information_schema.key_column_usage WHERE referenced_table_name = 'users'")
  .then(r => console.log(r.rows))
  .catch(console.error)
  .finally(() => process.exit());
