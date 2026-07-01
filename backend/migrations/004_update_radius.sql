-- ============================================================
-- Update global allowed radius from 50m to 100m
-- ============================================================
INSERT INTO settings (key, value) VALUES ('allowed_radius_m', '100')
ON CONFLICT (key) DO UPDATE SET value = '100';
