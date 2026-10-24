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

  // deviceFingerprint is now optional — no device restriction
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
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
        deviceFingerprint: deviceFingerprint || null,
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
        deviceFingerprint: deviceFingerprint || null,
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
        deviceFingerprint: deviceFingerprint || null,
        success: false,
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Device restriction removed — all technicians can log in from any device.
    // We optionally register the device for audit/tracking purposes only.
    let deviceId = null;
    if (deviceFingerprint && user.role !== 'admin') {
      try {
        const { rows: existing } = await pool.query(
          'SELECT id FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
          [user.id, deviceFingerprint]
        );
        if (existing.length === 0) {
          const { rows: allUserDevices } = await pool.query(
            'SELECT COUNT(*) as count FROM devices WHERE user_id = $1',
            [user.id]
          );
          const deviceLabel = deviceName ? deviceName : `Dispositivo ${parseInt(allUserDevices[0].count) + 1}`;
          const { rows: newDevice } = await pool.query(
            `INSERT INTO devices (user_id, device_fingerprint, device_name, user_agent, ip_address, is_active)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
            [user.id, deviceFingerprint, deviceLabel, req.headers['user-agent'], req.ip]
          );
          deviceId = newDevice[0].id;
        } else {
          deviceId = existing[0].id;
          await pool.query('UPDATE devices SET ip_address = $1 WHERE id = $2', [req.ip, deviceId]);
        }
      } catch (_) {
        // Non-critical: device tracking failed, login still proceeds
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
