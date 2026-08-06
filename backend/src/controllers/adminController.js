const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { getSettings, updateSetting } = require('../services/settingsService');

// === Dashboard ===
exports.getDashboard = async (req, res) => {
  try {
    const settings = await getSettings();
    const tz = settings.timezone || 'America/Panama';
    const lateHour = parseInt(settings.late_hour || '8', 10);
    const lateMinute = parseInt(settings.late_minute || '0', 10);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // 'YYYY-MM-DD' en hora Panamá

    // Total active technicians
    const { rows: techRows } = await pool.query(
      "SELECT count(*) FROM users WHERE role = 'technician' AND status = 'active'"
    );
    const totalTechnicians = parseInt(techRows[0].count, 10);

    // Today's attendances (valid only)
    const { rows: attRows } = await pool.query(
      `SELECT u.id, u.full_name, a.type, a.timestamp AT TIME ZONE $1 as local_time
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE DATE(a.timestamp AT TIME ZONE $1) = $2 AND a.is_valid = true
       ORDER BY a.timestamp ASC`,
      [tz, todayStr]
    );

    const presentIds = new Set();
    let entriesToday = 0;
    let exitsToday = 0;
    let lateArrivals = 0;

    attRows.forEach(row => {
      if (row.type === 'entry') {
        presentIds.add(row.id);
        entriesToday++;
        
        const time = new Date(row.local_time);
        if (time.getHours() > lateHour || (time.getHours() === lateHour && time.getMinutes() > lateMinute)) {
          lateArrivals++;
        }
      } else if (row.type === 'exit') {
        presentIds.delete(row.id);
        exitsToday++;
      }
    });

    res.json({
      totalTechnicians,
      presentNow: presentIds.size,
      absentNow: totalTechnicians - presentIds.size,
      entriesToday,
      exitsToday,
      lateArrivals
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// === Users CRUD ===
exports.getUsers = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      `SELECT id, username, full_name, role, status, mobile_number, position,
              base_lat, base_lng, allowed_radius_m,
              entry_time, exit_time,
              created_at 
       FROM users 
       WHERE role = 'technician'
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: countRows } = await pool.query("SELECT count(*) FROM users WHERE role = 'technician'");
    res.json({ users: rows, total: parseInt(countRows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

exports.createUser = async (req, res) => {
  const {
    username, password, fullName, mobileNumber = null,
    position = null, status = 'active',
    base_lat = null, base_lng = null, allowed_radius_m = null,
    entry_time = '07:30', exit_time = '16:30'
  } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, mobile_number, position, status, base_lat, base_lng, allowed_radius_m, entry_time, exit_time)
       VALUES ($1, $2, $3, 'technician', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, username, full_name`,
      [username, hash, fullName, mobileNumber, position, status, base_lat, base_lng, allowed_radius_m, entry_time, exit_time]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    fullName, mobileNumber = null, position = null, status, password,
    base_lat = null, base_lng = null, allowed_radius_m = null,
    entry_time = '07:30', exit_time = '16:30'
  } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = $1, mobile_number = $2, position = $3, status = $4,
         base_lat = $6, base_lng = $7, allowed_radius_m = $8,
         entry_time = $9, exit_time = $10,
         updated_at = NOW()
       WHERE id = $5 RETURNING id, username, full_name, status, entry_time, exit_time`,
      [fullName, mobileNumber, position, status, id, base_lat, base_lng, allowed_radius_m, entry_time, exit_time]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  // Verify auth
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  // Prevent deleting yourself
  if (String(req.user.id) === String(id)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario administrador.' });
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Nullify authorized_by if the user is an admin who authorized devices
      await client.query('UPDATE devices SET authorized_by = NULL WHERE authorized_by = $1', [id]);
      await client.query('UPDATE settings SET updated_by = NULL WHERE updated_by = $1', [id]);
      
      // Delete dependent records manually to avoid cascade FK conflicts
      await client.query('DELETE FROM attendance WHERE user_id = $1', [id]);
      await client.query('DELETE FROM devices WHERE user_id = $1', [id]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
      await client.query('DELETE FROM audit_log WHERE user_id = $1', [id]);
      
      const { rows } = await client.query(
        `DELETE FROM users WHERE id = $1 RETURNING id, username, full_name`,
        [id]
      );
      
      await client.query('COMMIT');
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado o no es un técnico.' });
      }
      res.json({ message: `Colaborador "${rows[0].full_name}" eliminado correctamente.`, user: rows[0] });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
  }
};

// === Reset User Devices ===
exports.resetUserDevices = async (req, res) => {
  const { id } = req.params;
  try {
    // Paso 1: Desvincular registros de asistencia del dispositivo
    // (esto evita el error de FK al borrar el dispositivo)
    await pool.query('UPDATE attendance SET device_id = NULL WHERE user_id = $1', [id]);
    
    // Paso 2: Eliminar el/los dispositivos del usuario
    const { rowCount } = await pool.query('DELETE FROM devices WHERE user_id = $1', [id]);
    
    // Paso 3: Revocar los refresh tokens para forzar nuevo login
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [id]);
    
    res.json({
      message: `Se eliminaron ${rowCount} dispositivo(s) registrados. El colaborador deberá iniciar sesión nuevamente y registrar su nuevo dispositivo.`,
      deleted: rowCount
    });
  } catch (err) {
    console.error('resetUserDevices error:', err);
    res.status(500).json({ error: 'Error al resetear dispositivos del usuario', details: err.message });
  }
};

// === Devices ===
exports.getDevices = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      `SELECT d.*, u.full_name as user_name 
       FROM devices d JOIN users u ON d.user_id = u.id
       ORDER BY d.registered_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ devices: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
};

exports.deleteDevice = async (req, res) => {
  const { id } = req.params;
  try {
    // First nullify attendance records referencing this device (FK constraint)
    await pool.query('UPDATE attendance SET device_id = NULL WHERE device_id = $1', [id]);
    await pool.query('DELETE FROM devices WHERE id = $1', [id]);
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    console.error('deleteDevice error:', err);
    res.status(500).json({ error: 'Error al eliminar dispositivo', details: err.message });
  }
};

// === History & Audit ===
exports.getAllHistory = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.full_name as user_name, u.mobile_number 
       FROM attendance a JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

exports.getAuditLog = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      `SELECT al.*, u.full_name as user_name 
       FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ audit: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener auditoría' });
  }
};

// === Settings ===
exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
};

exports.updateSystemSettings = async (req, res) => {
  const settings = req.body;
  try {
    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key, String(value), req.user.id);
    }
    res.json({ message: 'Configuración actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
};

// === Clear Today's Attendance (Emergency Reset) ===
exports.clearTodayAttendance = async (req, res) => {
  const { id } = req.params;
  try {
    const settings = await getSettings();
    const TZ = (settings.timezone && settings.timezone.trim()) ? settings.timezone.trim() : 'America/Panama';
    const todayInTz = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // 'YYYY-MM-DD'

    const { rowCount } = await pool.query(
      `DELETE FROM attendance
       WHERE user_id = $1
         AND DATE(timestamp AT TIME ZONE $2) = $3::date`,
      [id, TZ, todayInTz]
    );

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit({
      userId: req.user.id,
      action: 'ADMIN_CLEAR_TODAY_ATTENDANCE',
      details: { targetUserId: id, deletedRecords: rowCount, date: todayInTz, tz: TZ },
      ipAddress: req.ip,
      success: true,
    });

    res.json({
      message: `Se eliminaron ${rowCount} registro(s) de asistencia de hoy (${todayInTz}) para el colaborador. Ahora puede marcar entrada nuevamente.`,
      deleted: rowCount,
      date: todayInTz,
    });
  } catch (err) {
    console.error('clearTodayAttendance error:', err);
    res.status(500).json({ error: 'Error al limpiar registros de hoy' });
  }
};

// === Override Attendance (Manual Edit) ===
exports.overrideAttendance = async (req, res) => {
  const { cedula, date, type, time } = req.body;
  if (!cedula || !date || !type || !time) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    const settings = await getSettings();
    const TZ = (settings.timezone && settings.timezone.trim()) ? settings.timezone.trim() : 'America/Panama';
    
    // Convert 12h AM/PM to 24h if needed
    let time24 = time;
    if (time.includes('AM') || time.includes('PM')) {
      const parts = time.split(' ');
      let [h, m] = parts[0].split(':');
      h = parseInt(h, 10);
      if (parts[1] === 'PM' && h < 12) h += 12;
      if (parts[1] === 'AM' && h === 12) h = 0;
      time24 = `${String(h).padStart(2, '0')}:${m}:00`;
    }
    if (time24.split(':').length === 2) time24 += ':00';

    const timestampStr = `${date} ${time24}`; // 'YYYY-MM-DD HH:mm:ss'

    // Get user id from cedula
    const { rows: users } = await pool.query('SELECT id FROM users WHERE username = $1', [cedula]);
    if (users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const userId = users[0].id;

    // Check if an attendance record already exists for this date and type
    const { rows: existing } = await pool.query(
      `SELECT id FROM attendance 
       WHERE user_id = $1 AND type = $2 AND DATE(timestamp AT TIME ZONE $3) = $4::date`,
      [userId, type, TZ, date]
    );

    if (existing.length > 0) {
      // Update
      await pool.query(
        `UPDATE attendance 
         SET timestamp = $1::timestamp AT TIME ZONE $3, is_manual_edit = true 
         WHERE id = $2`,
        [timestampStr, existing[0].id, TZ]
      );
    } else {
      // Insert
      await pool.query(
        `INSERT INTO attendance (user_id, type, timestamp, is_valid, is_manual_edit) 
         VALUES ($1, $2, $3::timestamp AT TIME ZONE $4, true, true)`,
        [userId, type, timestampStr, TZ]
      );
    }

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit({
      userId: req.user.id,
      action: 'ADMIN_OVERRIDE_ATTENDANCE',
      details: { targetCedula: cedula, date, type, newTime: time24, tz: TZ },
      ipAddress: req.ip,
      success: true,
    });

    res.json({ message: 'Asistencia actualizada correctamente' });
  } catch (err) {
    console.error('overrideAttendance error:', err);
    res.status(500).json({ error: 'Error al actualizar asistencia' });
  }
};
