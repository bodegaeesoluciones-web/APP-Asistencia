const rateLimit = require('express-rate-limit');

/** Rate limiter estricto para endpoints de autenticación */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    error: 'Demasiados intentos. Intente de nuevo en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter general para la API */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: {
    error: 'Demasiadas solicitudes. Intente más tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
