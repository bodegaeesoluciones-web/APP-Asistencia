const { pool } = require('../config/db');

/**
 * Registra un evento en el audit_log
 */
async function logAudit({ userId, action, details, ipAddress, deviceFingerprint, success }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, details, ip_address, device_fingerprint, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        action,
        JSON.stringify(details || {}),
        ipAddress || null,
        deviceFingerprint || null,
        success !== false,
      ]
    );
  } catch (err) {
    console.error('❌ Audit log error:', err.message);
  }
}

module.exports = { logAudit };
