-- ============================================================
-- Sistema de Control de Asistencia — Schema Inicial
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'technician'
    CHECK (role IN ('admin', 'technician')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  mobile_number VARCHAR(20),
  position VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(45),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  authorized_by UUID REFERENCES users(id),
  authorized_at TIMESTAMPTZ,
  UNIQUE(user_id, device_fingerprint)
);

-- ============================================================
-- QR TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  gps_accuracy DECIMAL(10,2),
  wifi_ssid VARCHAR(100),
  wifi_confirmed BOOLEAN DEFAULT false,
  ip_address VARCHAR(45),
  qr_token_id UUID REFERENCES qr_tokens(id),
  is_valid BOOLEAN DEFAULT true,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  device_fingerprint VARCHAR(255),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT false
);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);

-- ============================================================
-- DEFAULT SETTINGS
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('base_lat', '-12.0464'),
  ('base_lng', '-77.0428'),
  ('allowed_radius_m', '50'),
  ('authorized_ssid', 'EESOLUCIONES_BASE'),
  ('qr_rotation_minutes', '60'),
  ('late_hour', '8'),
  ('late_minute', '0'),
  ('timezone', 'America/Lima')
ON CONFLICT (key) DO NOTHING;
