const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { pool } = require('../config/db');

/**
 * Middleware: verifica JWT en Authorization: Bearer <token>
 * Adjunta req.user con datos del usuario autenticado
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const { rows } = await pool.query(
      'SELECT id, username, full_name, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (rows[0].status === 'inactive') {
      return res.status(403).json({ error: 'Cuenta inactiva. Contacte al administrador.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware: verifica que el usuario sea administrador
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
