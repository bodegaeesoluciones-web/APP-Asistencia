-- Add status and geofencing fields to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS base_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS base_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS allowed_radius_m INTEGER;
