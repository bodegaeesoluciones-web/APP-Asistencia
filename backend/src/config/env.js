require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Geolocation defaults (overridden by DB settings)
  BASE_LAT: parseFloat(process.env.BASE_LAT || '-12.0464'),
  BASE_LNG: parseFloat(process.env.BASE_LNG || '-77.0428'),
  ALLOWED_RADIUS_M: parseInt(process.env.ALLOWED_RADIUS_M || '50'),

  // WiFi
  AUTHORIZED_SSID: process.env.AUTHORIZED_SSID || 'EESOLUCIONES_BASE',

  // QR
  QR_ROTATION_MINUTES: parseInt(process.env.QR_ROTATION_MINUTES || '60'),

  // Time
  TIMEZONE: process.env.TIMEZONE || 'America/Lima',
  LATE_HOUR: parseInt(process.env.LATE_HOUR || '8'),
  LATE_MINUTE: parseInt(process.env.LATE_MINUTE || '0'),

  // CORS
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
};
