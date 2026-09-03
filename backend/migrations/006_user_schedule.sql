-- Add entry_time and exit_time to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS entry_time VARCHAR(5) DEFAULT '07:30',
ADD COLUMN IF NOT EXISTS exit_time VARCHAR(5) DEFAULT '16:30';
