const rateLimit = require('express-rate-limit');

/** Rate limiter estricto para endpoints de autenticación (Bloqueo removido a pedido del usuario) */
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10000, // Permitir virtualmente intentos ilimitados
  message: {
    error: 'Demasiados intentos. Intente de nuevo más tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter general para la API */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10000, // Permitir virtualmente intentos ilimitados
  message: {
    error: 'Demasiadas solicitudes. Intente más tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
