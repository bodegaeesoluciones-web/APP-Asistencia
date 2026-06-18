const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { logAudit } = require('../utils/audit');
const env = require('../config/env');

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  // Generate a random string for refresh token to hash it later
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  return { accessToken, rawRefreshToken };
}

exports.login = async (req, res) => {
  const { username, password, deviceFingerprint, deviceName } = req.body;

  if (!username || !password || !deviceFingerprint) {
    return res.status(400).json({ error: 'Faltan credenciales o identificador de dispositivo' });
  }

  try {
    const { rows: users } = await pool.query(
      'SELECT id, username, password_hash, full_name, role, status FROM users WHERE username = $1',
      [username]
    );

    if (users.length === 0) {
      await logAudit({
        action: 'LOGIN_FAILED',
        details: { reason: 'User not found', username },
        ipAddress: req.ip,
        deviceFingerprint,
        success: false,
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    if (user.status !== 'active') {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_FAILED',
        details: { reason: 'Account inactive' },
        ipAddress: req.ip,
        deviceFingerprint,
        success: false,
      });
      return res.status(403).json({ error: 'Cuenta inactiva' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await logAudit({
        userId: user.id,
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ipAddress: req.ip,
        deviceFingerprint,
        success: false,
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Device validation
    let isDeviceAuthorized = false;
    let deviceId = null;

    if (user.role === 'admin') {
      // Admins bypass strict device checking for login, but we still log it
      isDeviceAuthorized = true;
    } else {
      // For technicians
      const { rows: devices } = await pool.query(
        'SELECT id, is_active FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
        [user.id, deviceFingerprint]
      );

      if (devices.length === 0) {
        // First time login for this user? Check if they have ANY devices
        const { rows: allUserDevices } = await pool.query(
          'SELECT COUNT(*) as count FROM devices WHERE user_id = $1',
          [user.id]
        );

        if (parseInt(allUserDevices[0].count) === 0) {
          // First device ever, auto-register
          const { rows: newDevice } = await pool.query(
            `INSERT INTO devices (user_id, device_fingerprint, device_name, user_agent, ip_address, is_active)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
            [user.id, deviceFingerprint, deviceName || 'Dispositivo Inicial', req.headers['user-agent'], req.ip]
          );
          isDeviceAuthorized = true;
          deviceId = newDevice[0].id;
        } else {
          // Has devices, but not this one
          await logAudit({
            userId: user.id,
            action: 'LOGIN_FAILED_UNAUTHORIZED_DEVICE',
            details: { deviceFingerprint, userAgent: req.headers['user-agent'] },
            ipAddress: req.ip,
            deviceFingerprint,
            success: false,
          });
          return res.status(403).json({ 
            error: 'Dispositivo no autorizado. Ya tiene un dispositivo registrado. Contacte al administrador.',
            code: 'DEVICE_NOT_AUTHORIZED'
          });
        }
      } else {
        const device = devices[0];
        if (!device.is_active) {
          await logAudit({
            userId: user.id,
            action: 'LOGIN_FAILED_INACTIVE_DEVICE',
            details: { deviceFingerprint },
            ipAddress: req.ip,
            deviceFingerprint,
            success: false,
          });
          return res.status(403).json({ 
            error: 'Este dispositivo ha sido desactivado. Contacte al administrador.',
            code: 'DEVICE_INACTIVE'
          });
        }
        isDeviceAuthorized = true;
        deviceId = device.id;
        
        // Update last seen IP
        await pool.query('UPDATE devices SET ip_address = $1 WHERE id = $2', [req.ip, device.id]);
      }
    }

    // Generate tokens
    const { accessToken, rawRefreshToken } = generateTokens(user.id);
    
    // Hash refresh token to store in DB
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
    
    // Parse duration string to DB interval equivalent or calculate JS date
    // Simple approach: set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshTokenHash, expiresAt]
    );

    await logAudit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      details: { role: user.role, deviceId },
      ipAddress: req.ip,
      deviceFingerprint,
      success: true,
    });

    res.json({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken, userId } = req.body;

  if (!refreshToken || !userId) {
    return res.status(400).json({ error: 'Refresh token y userId son requeridos' });
  }

  try {
    // Find active refresh tokens for user
    const { rows: tokens } = await pool.query(
      'SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked = false AND expires_at > NOW()',
      [userId]
    );

    let validTokenId = null;
    for (const tokenRow of tokens) {
      const isValid = await bcrypt.compare(refreshToken, tokenRow.token_hash);
      if (isValid) {
        validTokenId = tokenRow.id;
        break;
      }
    }

    if (!validTokenId) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    // Generate new access token
    const { accessToken } = generateTokens(userId);

    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  const userId = req.user.id; // from auth middleware

  try {
    if (refreshToken) {
      const { rows: tokens } = await pool.query(
        'SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked = false',
        [userId]
      );

      for (const tokenRow of tokens) {
        const isValid = await bcrypt.compare(refreshToken, tokenRow.token_hash);
        if (isValid) {
          await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [tokenRow.id]);
          break;
        }
      }
    }

    await logAudit({
      userId,
      action: 'LOGOUT',
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'],
      success: true,
    });

    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, role, status, mobile_number, position FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
