const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { getSettings, updateSetting } = require('../services/settingsService');

// === Dashboard ===
exports.getDashboard = async (req, res) => {
  try {
    const settings = await getSettings();
    const tz = settings.timezone || 'America/Lima';
    const lateHour = parseInt(settings.late_hour || '8', 10);
    const lateMinute = parseInt(settings.late_minute || '0', 10);
    const todayStr = new Date().toISOString().split('T')[0];

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
       FROM users WHERE role = 'technician'
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
  // Prevent deleting yourself
  if (String(req.user.id) === String(id)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario administrador.' });
  }
  try {
    // Soft delete: mark as 'deleted' to preserve attendance history
    const { rows } = await pool.query(
      `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND role = 'technician' RETURNING id, username, full_name`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o no es un técnico.' });
    }
    res.json({ message: `Colaborador "${rows[0].full_name}" eliminado correctamente.`, user: rows[0] });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

// === Reset User Devices ===
exports.resetUserDevices = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM devices WHERE user_id = $1', [id]);
    res.json({ message: `Se eliminaron ${rowCount} dispositivo(s) registrados. El colaborador podrá registrar un nuevo dispositivo en su próximo inicio de sesión.`, deleted: rowCount });
  } catch (err) {
    console.error('resetUserDevices error:', err);
    res.status(500).json({ error: 'Error al resetear dispositivos del usuario' });
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
    await pool.query('DELETE FROM devices WHERE id = $1', [id]);
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dispositivo' });
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
