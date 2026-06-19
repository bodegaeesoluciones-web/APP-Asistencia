const { pool } = require('../config/db');
const { haversineDistance } = require('../utils/haversine');
const { getSettings } = require('../services/settingsService');
const { logAudit } = require('../utils/audit');

exports.markAttendance = async (req, res) => {
  const { latitude, longitude, gpsAccuracy, wifiSsid } = req.body;
  const user = req.user;
  const device = req.device;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Faltan datos requeridos (GPS)' });
  }

  try {
    // 1. Fetch current settings for validation
    const settings = await getSettings();
    const baseLat = parseFloat(settings.base_lat || '-12.0464');
    const baseLng = parseFloat(settings.base_lng || '-77.0428');
    const allowedRadius = parseInt(settings.allowed_radius_m || '50', 10);
    const authorizedSsid = settings.authorized_ssid || 'EESOLUCIONES_BASE';

    let isValid = true;
    let rejectionReasons = [];

    // 2. (Removed QR Validation)

    // 3. Validate GPS
    const distance = haversineDistance(latitude, longitude, baseLat, baseLng);
    if (distance > allowedRadius) {
      isValid = false;
      rejectionReasons.push(`Fuera de rango (${Math.round(distance)}m, max ${allowedRadius}m)`);
    }

    // 4. Validate WiFi
    if (wifiSsid !== authorizedSsid) {
      isValid = false;
      rejectionReasons.push(`Red WiFi no autorizada (detectada: ${wifiSsid || 'ninguna'})`);
    }

    // 5. Determine if entry or exit
    // Find today's entries for this user
    const todayStr = new Date().toISOString().split('T')[0];
    const { rows: todayRecords } = await pool.query(
      `SELECT type FROM attendance 
       WHERE user_id = $1 AND DATE(timestamp AT TIME ZONE $2) = $3
       ORDER BY timestamp DESC`,
      [user.id, settings.timezone || 'America/Lima', todayStr]
    );

    let type = 'entry';
    if (todayRecords.length > 0) {
      if (todayRecords[0].type === 'entry') {
        type = 'exit';
      } else {
        type = 'entry'; // Can have multiple entry/exit pairs in a day
      }
    }

    // 6. Save attendance record
    const { rows: newRecord } = await pool.query(
      `INSERT INTO attendance (
        user_id, device_id, type, latitude, longitude, gps_accuracy,
        wifi_ssid, wifi_confirmed, ip_address, qr_token_id, is_valid, rejection_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        user.id,
        device.id,
        type,
        latitude,
        longitude,
        gpsAccuracy,
        wifiSsid,
        wifiSsid === authorizedSsid, // Confirmed if it matches
        req.ip,
        null, // No QR token id anymore
        isValid,
        rejectionReasons.join('; ') || null
      ]
    );

    // 7. Audit log
    await logAudit({
      userId: user.id,
      action: isValid ? `ATTENDANCE_MARKED_${type.toUpperCase()}` : 'ATTENDANCE_FAILED',
      details: { type, distance, isValid, reasons: rejectionReasons },
      ipAddress: req.ip,
      deviceFingerprint: device.device_fingerprint,
      success: isValid,
    });

    if (!isValid) {
      return res.status(403).json({
        error: 'Validación fallida',
        reasons: rejectionReasons,
        recordId: newRecord[0].id
      });
    }

    res.json({
      message: `Asistencia (${type === 'entry' ? 'Entrada' : 'Salida'}) registrada correctamente`,
      type,
      distance: Math.round(distance),
      timestamp: new Date()
    });

  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getTodayAttendance = async (req, res) => {
  try {
    const settings = await getSettings();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { rows } = await pool.query(
      `SELECT id, type, timestamp, is_valid, rejection_reason 
       FROM attendance 
       WHERE user_id = $1 AND DATE(timestamp AT TIME ZONE $2) = $3
       ORDER BY timestamp ASC`,
      [req.user.id, settings.timezone || 'America/Lima', todayStr]
    );

    res.json({ records: rows });
  } catch (err) {
    console.error('Get today attendance error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getMyHistory = async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const { rows, rowCount } = await pool.query(
      `SELECT id, type, timestamp, is_valid, rejection_reason, latitude, longitude
       FROM attendance 
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ records: rows, total: rowCount }); // Note: rowCount is just rows.length here, need a count query for true total
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
