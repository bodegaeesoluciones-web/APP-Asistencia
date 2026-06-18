const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/login',
  authLimiter,
  [
    body('username').notEmpty().withMessage('Username es requerido'),
    body('password').notEmpty().withMessage('Password es requerido'),
    body('deviceFingerprint').notEmpty().withMessage('Device Fingerprint es requerido'),
  ],
  validateRequest,
  authController.login
);

router.post(
  '/refresh',
  authLimiter,
  [
    body('refreshToken').notEmpty().withMessage('Refresh Token es requerido'),
    body('userId').notEmpty().withMessage('User ID es requerido'),
  ],
  validateRequest,
  authController.refreshToken
);

router.post('/logout', authenticateToken, authController.logout);

router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
