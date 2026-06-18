const { pool } = require('../config/db');
const { logAudit } = require('../utils/audit');

/**
 * Middleware: verifica que el device_fingerprint del header
 * esté autorizado para el usuario autenticado.
 * Adjunta req.device con datos del dispositivo.
 */
async function deviceCheck(req, res, next) {
  const fingerprint = req.headers['x-device-fingerprint'];

  if (!fingerprint) {
    return res.status(400).json({
      error: 'Identificador de dispositivo requerido',
      code: 'NO_DEVICE_FINGERPRINT',
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT d.* FROM devices d
       WHERE d.user_id = $1
         AND d.device_fingerprint = $2
         AND d.is_active = true
       LIMIT 1`,
      [req.user.id, fingerprint]
    );

    if (rows.length === 0) {
      await logAudit({
        userId: req.user.id,
        action: 'DEVICE_NOT_AUTHORIZED',
        details: { fingerprint, userAgent: req.headers['user-agent'] },
        ipAddress: req.ip,
        deviceFingerprint: fingerprint,
        success: false,
      });

      return res.status(403).json({
        error: 'Dispositivo no autorizado. Contacte al administrador.',
        code: 'DEVICE_NOT_AUTHORIZED',
      });
    }

    req.device = rows[0];
    next();
  } catch (err) {
    console.error('Device check error:', err);
    res.status(500).json({ error: 'Error de verificación de dispositivo' });
  }
}

module.exports = { deviceCheck };
